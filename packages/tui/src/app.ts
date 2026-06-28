import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";

import {
  BackendAdapter,
  ChatMessage,
  createJsonStores,
  MessageRouter,
  BackendKind,
  ProjectDefinition,
  ProjectRegistry,
  RouteDecision,
  SessionRegistry,
  buildSeedProject,
  normalizeProjectId,
} from "../../core/src";
import { MockBackendAdapter } from "../../backends/mock/src";
import { OpenCodeBackendAdapter } from "../../backends/opencode/src";
import { createPiBackendAdapter } from "../../backends/pi/src";
import { tokenizeCommand } from "./commands/command-parser";
import { parseProjectAddArgs, parseProjectBackendArgs } from "./commands/project-command";

export class ChattyApp {
  private readonly projects: ProjectRegistry;
  private readonly sessions: SessionRegistry;
  private readonly router: MessageRouter;
  private readonly backends: Record<BackendKind, BackendAdapter>;

  private lastActiveProjectId?: string;
  private pinnedProjectId?: string;

  constructor(private readonly workspaceRoot = process.cwd()) {
    const stores = createJsonStores(workspaceRoot);
    this.projects = new ProjectRegistry(stores.projectStore);
    this.sessions = new SessionRegistry(stores.sessionStore, stores.messageStore);
    this.router = new MessageRouter(this.projects, this.sessions);
    this.backends = {
      mock: new MockBackendAdapter(),
      pi: createPiBackendAdapter(workspaceRoot),
      opencode: new OpenCodeBackendAdapter(),
    };
  }

  async run(): Promise<void> {
    await this.bootstrap();

    const io = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      this.printBanner();

      while (true) {
        const promptLabel = this.pinnedProjectId ? `chatty[${this.pinnedProjectId}]` : "chatty[auto]";
        const input = (await this.nextLine(io, promptLabel)).trim();
        if (!input) {
          continue;
        }

        if (input.startsWith("/")) {
          const shouldExit = await this.handleCommand(input);
          if (shouldExit) {
            return;
          }
          continue;
        }

        await this.handleMessage(input, io);
      }
    } finally {
      io.close();
    }
  }

  private async bootstrap(): Promise<void> {
    const seedProject = await this.projects.ensureSeedProject(buildSeedProject(this.workspaceRoot));
    this.lastActiveProjectId ??= seedProject.id;
  }

  private printBanner(): void {
    console.log("chatty");
    console.log("One visible chat, isolated hidden sessions behind the scenes.");
    console.log("Commands: /help, /projects, /project add <id> <path> [--backend <kind>] [aliases...], /project backend <id> <kind>, /use <id|auto>, /sessions, /exit");
  }

  private async handleCommand(
    input: string,
  ): Promise<boolean> {
    const [command, ...args] = tokenizeCommand(input);

    switch (command) {
      case "/help":
        this.printHelp();
        return false;
      case "/projects":
        await this.printProjects();
        return false;
      case "/project":
        await this.handleProjectCommand(args);
        return false;
      case "/use":
        await this.handleUseCommand(args);
        return false;
      case "/sessions":
        await this.printSessions();
        return false;
      case "/exit":
      case "/quit":
        console.log("Exiting chatty.");
        return true;
      default:
        console.log(`Unknown command: ${command}`);
        this.printHelp();
        return false;
    }
  }

  private async handleProjectCommand(args: string[]): Promise<void> {
    const [subcommand, ...rest] = args;
    switch (subcommand) {
      case "add":
        await this.handleProjectAddCommand(rest);
        return;
      case "backend":
        await this.handleProjectBackendCommand(rest);
        return;
      default:
        console.log("Usage: /project add <id> <path> [--backend <kind>] [aliases...]");
        console.log("       /project backend <projectId> <mock|pi|opencode>");
        return;
    }
  }

  private async handleProjectAddCommand(args: string[]): Promise<void> {
    const parsed = parseProjectAddArgs(args);
    if ("error" in parsed) {
      console.log(parsed.error);
      return;
    }

    const rootPath = path.resolve(parsed.rawPath);
    const project: ProjectDefinition = {
      id: parsed.projectId,
      name: parsed.projectId,
      rootPath,
      aliases: [parsed.projectId, path.basename(rootPath), ...parsed.aliases],
      hints: [parsed.projectId, rootPath, path.basename(rootPath)],
      defaultBackend: parsed.backend,
    };

    const registered = await this.projects.register(project);
    const normalizedInput = normalizeProjectId(parsed.projectId);
    if (normalizedInput !== parsed.projectId) {
      console.log(`Registered project ${registered.id} (normalized from "${parsed.projectId}") -> ${rootPath} [backend=${registered.defaultBackend}]`);
      return;
    }

    console.log(`Registered project ${registered.id} -> ${rootPath} [backend=${registered.defaultBackend}]`);
  }

  private async handleProjectBackendCommand(args: string[]): Promise<void> {
    const parsed = parseProjectBackendArgs(args);
    if ("error" in parsed) {
      console.log(parsed.error);
      return;
    }

    try {
      const updated = await this.projects.setDefaultBackend(parsed.projectId, parsed.backend);
      console.log(`Set project ${updated.id} backend to ${updated.defaultBackend}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(message);
    }
  }

  private async handleUseCommand(args: string[]): Promise<void> {
    const target = args[0];
    if (!target) {
      console.log("Usage: /use <projectId|auto>");
      return;
    }

    if (target === "auto") {
      this.pinnedProjectId = undefined;
      console.log("Auto routing enabled.");
      return;
    }

    const project = await this.projects.get(target);
    if (!project) {
      console.log(`Unknown project: ${target}`);
      return;
    }

    this.pinnedProjectId = project.id;
    console.log(`Pinned routing to ${project.id}.`);
  }

  private async printProjects(): Promise<void> {
    const projects = await this.projects.list();
    console.log("\nProjects:");
    for (const project of projects) {
      const aliases = project.aliases.length > 0 ? ` aliases=${project.aliases.join(", ")}` : "";
      console.log(`- ${project.id} -> ${project.rootPath} [backend=${project.defaultBackend}]${aliases}`);
    }
  }

  private async printSessions(): Promise<void> {
    const sessions = await this.sessions.listSessions();
    console.log("\nHidden sessions:");
    for (const session of sessions) {
      const backendSession = session.backendSession ? ` backendSession=${session.backendSession.sessionId}` : "";
      console.log(
        `- ${session.projectId} :: ${session.id.slice(0, 8)} [backend=${session.backend}] messages=${session.messageCount}${backendSession} summary="${session.summary}"`,
      );
    }

    if (sessions.length === 0) {
      console.log("- none yet");
    }
  }

  private async handleMessage(
    message: string,
    io: readline.Interface,
  ): Promise<void> {
    let routed = await this.router.resolve({
      message,
      overrideProjectId: this.pinnedProjectId,
      lastActiveProjectId: this.lastActiveProjectId,
    });

    if (!("project" in routed)) {
      const choice = await this.askForProjectChoice(io, routed.decision);
      if (!choice) {
        console.log("Routing cancelled.");
        return;
      }

      routed = await this.router.resolve({
        message,
        overrideProjectId: choice,
        lastActiveProjectId: this.lastActiveProjectId,
      });

      if (!("project" in routed)) {
        console.log("Routing remained ambiguous.");
        return;
      }
    }

    const backend = this.backends[routed.project.defaultBackend];
    let response;
    try {
      const ensured = await backend.ensureSession({
        project: routed.project,
        session: routed.session,
        history: routed.history,
      });
      const boundSession = await this.sessions.bindBackendSession(routed.session.id, ensured.binding);
      response = await backend.sendMessage({
        project: routed.project,
        session: boundSession,
        backendSession: boundSession.backendSession!,
        history: routed.history,
        message,
        routeDecision: routed.decision,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`\n-> ${routed.project.id} [${routed.project.defaultBackend}]`);
      console.log(message);
      return;
    }

    const now = new Date().toISOString();
    const newMessages: ChatMessage[] = [
      { role: "user", content: message, createdAt: now },
      { role: "assistant", content: response.reply, createdAt: new Date().toISOString() },
    ];

    await this.sessions.recordExchange({
      sessionId: routed.session.id,
      messages: newMessages,
      summary: response.summary,
      backendSession: response.backendSession,
    });
    this.lastActiveProjectId = routed.project.id;

    console.log(`\n-> ${routed.decision.action.toUpperCase()} ${routed.project.id} (${percent(routed.decision.confidence)})`);
    for (const evidence of routed.decision.evidence.slice(0, 3)) {
      console.log(`   - ${evidence.value}`);
    }
    console.log(`\n${response.reply}`);
  }

  private async askForProjectChoice(
    io: readline.Interface,
    decision: RouteDecision,
  ): Promise<string | undefined> {
    console.log("\nRouting is ambiguous. Pick a project:");
    decision.candidates.forEach((candidate, index) => {
      console.log(`- ${index + 1}. ${candidate.projectId} (${percent(candidate.score)})`);
    });

    const raw = (await io.question("Choose a project number or id (blank cancels): ")).trim();
    if (!raw) {
      return undefined;
    }

    const asNumber = Number.parseInt(raw, 10);
    if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= decision.candidates.length) {
      return decision.candidates[asNumber - 1]?.projectId;
    }

    return raw;
  }

  private printHelp(): void {
    console.log("\n/help");
    console.log("  Show the available commands.");
    console.log("/projects");
    console.log("  List registered projects and routing aliases.");
    console.log("/project add <id> <path> [--backend <kind>] [aliases...]");
    console.log('  Register another project for auto-routing. Quote paths or ids that contain spaces.');
    console.log("/project backend <projectId> <mock|pi|opencode>");
    console.log("  Change which backend a project uses.");
    console.log("/use <projectId|auto>");
    console.log("  Pin routing to a project or hand control back to the router.");
    console.log("/sessions");
    console.log("  Show hidden session state.");
    console.log("/exit");
    console.log("  Leave the app.");
  }

  private async nextLine(io: readline.Interface, promptLabel: string): Promise<string> {
    try {
      return await io.question(`\n${promptLabel}> `);
    } catch (error) {
      if (isReadlineClosed(error)) {
        console.log("\nInput stream closed. Exiting chatty.");
        return "/exit";
      }

      throw error;
    }
  }
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function isReadlineClosed(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ERR_USE_AFTER_CLOSE";
}
