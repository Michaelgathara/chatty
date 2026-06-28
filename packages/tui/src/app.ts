import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";

import {
  BackendAdapter,
  BackendKind,
  ChatMessage,
  MessageRouter,
  ProjectDefinition,
  ProjectRegistry,
  RouteDecision,
  SessionRegistry,
  buildSeedProject,
  normalizeProjectId,
} from "../../core/src";
import { MockBackendAdapter } from "../../backends/mock/src";
import { OpenCodeBackendAdapter } from "../../backends/opencode/src";
import { PiBackendAdapter } from "../../backends/pi/src";
import { tokenizeCommand } from "./commands/command-parser";

export class ChattyApp {
  private readonly projects: ProjectRegistry;
  private readonly sessions: SessionRegistry;
  private readonly router: MessageRouter;
  private readonly backends: Record<BackendKind, BackendAdapter>;

  private lastActiveProjectId?: string;
  private pinnedProjectId?: string;

  constructor(private readonly workspaceRoot = process.cwd()) {
    this.projects = new ProjectRegistry(workspaceRoot);
    this.sessions = new SessionRegistry(workspaceRoot);
    this.router = new MessageRouter(this.projects, this.sessions);
    this.backends = {
      mock: new MockBackendAdapter(),
      pi: new PiBackendAdapter(),
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
    await this.projects.ensureSeedProject(buildSeedProject(this.workspaceRoot));
  }

  private printBanner(): void {
    console.log("chatty");
    console.log("One visible chat, isolated hidden sessions behind the scenes.");
    console.log("Commands: /help, /projects, /project add <id> <path> [aliases...], /use <id|auto>, /sessions, /exit");
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
    if (subcommand !== "add") {
      console.log("Usage: /project add <id> <path> [aliases...]");
      return;
    }

    if (rest.length < 2) {
      console.log("Usage: /project add <id> <path> [aliases...]");
      return;
    }

    const [projectId, rawPath, ...aliases] = rest;
    const rootPath = path.resolve(rawPath);
    const project: ProjectDefinition = {
      id: projectId,
      name: projectId,
      rootPath,
      aliases: [projectId, path.basename(rootPath), ...aliases],
      hints: [projectId, rootPath, path.basename(rootPath)],
      defaultBackend: "mock",
    };

    const registered = await this.projects.register(project);
    const normalizedInput = normalizeProjectId(projectId);
    if (normalizedInput !== projectId) {
      console.log(`Registered project ${registered.id} (normalized from "${projectId}") -> ${rootPath}`);
      return;
    }

    console.log(`Registered project ${registered.id} -> ${rootPath}`);
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
      console.log(
        `- ${session.projectId} :: ${session.id.slice(0, 8)} [backend=${session.backend}] messages=${session.messageCount} summary="${session.summary}"`,
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
    const response = await backend.send({
      project: routed.project,
      session: routed.session,
      history: routed.history,
      message,
      routeDecision: routed.decision,
    });

    const now = new Date().toISOString();
    const newMessages: ChatMessage[] = [
      { role: "user", content: message, createdAt: now },
      { role: "assistant", content: response.reply, createdAt: new Date().toISOString() },
    ];

    await this.sessions.appendMessages(routed.session.id, newMessages, response.summary);
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
    console.log("/project add <id> <path> [aliases...]");
    console.log('  Register another project for auto-routing. Quote paths or ids that contain spaces.');
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
