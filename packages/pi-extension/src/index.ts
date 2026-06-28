import path from "node:path";

import {
  ProjectDefinition,
  ProjectRegistry,
  ProjectSelection,
  SessionRegistry,
  createJsonStoresAtStateDirectory,
  selectProjectForInput,
} from "../../core/src";
import { CHATTY_ROUTE_COMMAND, buildRouteCommand, parseRouteCommandArgs } from "./route-command";
import { createChattyPiExtensionConfig } from "./config";

const CHATTTY_STATUS_KEY = "chatty";
const CHATTTY_PROJECTS_COMMAND = "chatty-projects";

interface PiSessionManagerView {
  getSessionFile(): string | undefined;
  getSessionId(): string;
}

interface PiUiContext {
  select(title: string, options: string[]): Promise<string | undefined>;
  notify(message: string, type?: "info" | "warning" | "error"): void;
  setStatus(key: string, text: string | undefined): void;
}

interface PiExtensionContext {
  readonly hasUI: boolean;
  readonly ui: PiUiContext;
  readonly sessionManager: PiSessionManagerView;
}

interface PiReplacedSessionContext extends PiExtensionContext {
  sendUserMessage(content: string): Promise<void>;
}

interface PiCommandContext extends PiExtensionContext {
  switchSession(
    sessionPath: string,
    options?: {
      withSession?: (ctx: PiReplacedSessionContext) => Promise<void>;
    },
  ): Promise<{ cancelled: boolean }>;
}

interface PiInputEvent {
  text: string;
  source: "interactive" | "rpc" | "extension";
}

interface PiExtensionApi {
  on(
    event: "session_start",
    handler: (event: unknown, ctx: PiExtensionContext) => Promise<void> | void,
  ): void;
  on(
    event: "input",
    handler: (
      event: PiInputEvent,
      ctx: PiExtensionContext,
    ) =>
      | Promise<{ action: "continue" | "handled" } | { action: "transform"; text: string }>
      | { action: "continue" | "handled" }
      | { action: "transform"; text: string },
  ): void;
  registerCommand(
    name: string,
    options: {
      description?: string;
      handler: (args: string, ctx: PiCommandContext) => Promise<void>;
    },
  ): void;
  sendUserMessage(content: string): void;
}

interface PiRuntimeSessionManagerFactory {
  create(cwd: string, sessionDir?: string): PiSessionManagerView;
}

interface PiRuntimeModule {
  SessionManager: PiRuntimeSessionManagerFactory;
}

let piRuntimePromise: Promise<PiRuntimeModule> | undefined;

export default function (pi: PiExtensionApi) {
  const config = createChattyPiExtensionConfig();
  const stores = createJsonStoresAtStateDirectory(config.stateDirectory);
  const projects = new ProjectRegistry(stores.projectStore);
  const sessions = new SessionRegistry(stores.sessionStore, stores.messageStore);

  pi.on("session_start", async (_event, ctx) => {
    await updateStatus(ctx, projects, sessions);
  });

  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") {
      return { action: "continue" };
    }

    const text = event.text.trim();
    if (!text || text.startsWith("/")) {
      return { action: "continue" };
    }

    const routableProjects = await getPiProjects(projects);
    if (routableProjects.length === 0) {
      return { action: "continue" };
    }

    const currentProject = await getCurrentProject(ctx, projects, sessions);
    const selection = selectProjectForInput(routableProjects, {
      message: text,
      lastActiveProjectId: currentProject?.id,
    });

    const selectedProject =
      selection.project ?? (await chooseProjectIfNeeded(ctx, projects, sessions, selection));

    if (!selectedProject) {
      return { action: "continue" };
    }

    if (currentProject?.id === selectedProject.id) {
      return { action: "continue" };
    }

    return {
      action: "transform",
      text: buildRouteCommand({
        projectId: selectedProject.id,
        message: text,
      }),
    };
  });

  pi.registerCommand(CHATTY_ROUTE_COMMAND, {
    description: "Internal command used by chatty to route prompts across Pi sessions.",
    handler: async (args, ctx) => {
      const parsed = parseRouteCommandArgs(args);
      if ("error" in parsed) {
        ctx.ui.notify(parsed.error, "warning");
        return;
      }

      await routePromptToProject(parsed, ctx, projects, sessions, config.piSessionRootDirectory, pi);
    },
  });

  pi.registerCommand(CHATTTY_PROJECTS_COMMAND, {
    description: "List chatty projects that currently use the Pi backend.",
    handler: async (_args, ctx) => {
      const routableProjects = await getPiProjects(projects);
      if (routableProjects.length === 0) {
        ctx.ui.notify("No Pi-backed projects are registered in chatty yet.", "warning");
        return;
      }

      const lines = routableProjects.map(
        (project) => `${project.id} -> ${project.rootPath}`,
      );
      ctx.ui.notify(`Pi projects:\n${lines.join("\n")}`, "info");
    },
  });
}

async function routePromptToProject(
  payload: { projectId: string; message: string },
  ctx: PiCommandContext,
  projects: ProjectRegistry,
  sessions: SessionRegistry,
  piSessionRootDirectory: string,
  pi: PiExtensionApi,
): Promise<void> {
  const project = await projects.get(payload.projectId);
  if (!project) {
    ctx.ui.notify(`Unknown project: ${payload.projectId}`, "warning");
    return;
  }

  if (project.defaultBackend !== "pi") {
    ctx.ui.notify(
      `Project ${project.id} is configured for ${project.defaultBackend}, not pi.`,
      "warning",
    );
    return;
  }

  const { session } = await sessions.ensureSession(project.id, project.defaultBackend);
  const currentSessionFile = ctx.sessionManager.getSessionFile();

  if (session.backendSession?.sessionFile) {
    if (currentSessionFile === session.backendSession.sessionFile) {
      pi.sendUserMessage(payload.message);
      return;
    }

    const switched = await ctx.switchSession(session.backendSession.sessionFile, {
      withSession: async (replacedCtx) => {
        await bindCurrentPiSession(sessions, session.id, replacedCtx);
        await updateStatus(replacedCtx, projects, sessions);
        await replacedCtx.sendUserMessage(payload.message);
      },
    });
    if (switched.cancelled) {
      ctx.ui.notify(`Switch to project ${project.id} was cancelled.`, "warning");
    }
    return;
  }

  const piRuntime = await loadPiRuntime();
  const targetSessionManager = piRuntime.SessionManager.create(
    project.rootPath,
    path.join(piSessionRootDirectory, project.id, session.id),
  );
  const targetSessionFile = targetSessionManager.getSessionFile();

  if (!targetSessionFile) {
    ctx.ui.notify(`Could not create a Pi session for ${project.id}.`, "error");
    return;
  }

  await sessions.bindBackendSession(session.id, {
    sessionId: targetSessionManager.getSessionId(),
    sessionFile: targetSessionFile,
  });

  const switched = await ctx.switchSession(targetSessionFile, {
    withSession: async (replacedCtx) => {
      await bindCurrentPiSession(sessions, session.id, replacedCtx);
      await updateStatus(replacedCtx, projects, sessions);
      await replacedCtx.sendUserMessage(payload.message);
    },
  });
  if (switched.cancelled) {
    ctx.ui.notify(`Switch to project ${project.id} was cancelled.`, "warning");
  }
}

async function getCurrentProject(
  ctx: PiExtensionContext,
  projects: ProjectRegistry,
  sessions: SessionRegistry,
): Promise<ProjectDefinition | undefined> {
  const sessionFile = ctx.sessionManager.getSessionFile();
  if (!sessionFile) {
    return undefined;
  }

  const session = await sessions.findByBackendSessionFile(sessionFile, "pi");
  if (!session) {
    return undefined;
  }

  return projects.get(session.projectId);
}

async function chooseProjectIfNeeded(
  ctx: PiExtensionContext,
  projects: ProjectRegistry,
  sessions: SessionRegistry,
  selection: ProjectSelection,
): Promise<ProjectDefinition | undefined> {
  if (!ctx.hasUI || selection.candidates.length === 0) {
    return undefined;
  }

  const options = selection.candidates.map((candidate) => candidate.projectId);
  const picked = await ctx.ui.select("Route message to project", options);
  if (!picked) {
    return undefined;
  }

  const project = await projects.get(picked);
  if (!project || project.defaultBackend !== "pi") {
    return undefined;
  }

  const currentSessionFile = ctx.sessionManager.getSessionFile();
  if (currentSessionFile) {
    const currentSession = await sessions.findByBackendSessionFile(currentSessionFile, "pi");
    if (currentSession?.projectId === project.id) {
      return undefined;
    }
  }

  return project;
}

async function updateStatus(
  ctx: PiExtensionContext,
  projects: ProjectRegistry,
  sessions: SessionRegistry,
): Promise<void> {
  const project = await getCurrentProject(ctx, projects, sessions);
  ctx.ui.setStatus(CHATTTY_STATUS_KEY, project ? `project: ${project.id}` : undefined);
}

async function getPiProjects(projects: ProjectRegistry): Promise<ProjectDefinition[]> {
  return (await projects.list()).filter((project) => project.defaultBackend === "pi");
}

async function bindCurrentPiSession(
  sessions: SessionRegistry,
  hiddenSessionId: string,
  ctx: PiExtensionContext,
): Promise<void> {
  const sessionFile = ctx.sessionManager.getSessionFile();
  if (!sessionFile) {
    return;
  }

  await sessions.bindBackendSession(hiddenSessionId, {
    sessionId: ctx.sessionManager.getSessionId(),
    sessionFile,
  });
}

async function loadPiRuntime(): Promise<PiRuntimeModule> {
  piRuntimePromise ??= import("@earendil-works/pi-coding-agent") as Promise<PiRuntimeModule>;
  return piRuntimePromise;
}
