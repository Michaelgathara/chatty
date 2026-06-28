import path from "node:path";

export interface PiBackendConfig {
  agentDirectory?: string;
  sessionRootDirectory: string;
}

export function createDefaultPiBackendConfig(workspaceRoot: string): PiBackendConfig {
  const configuredAgentDirectory = process.env.CHATTY_PI_AGENT_DIR?.trim();
  const configuredSessionRoot = process.env.CHATTY_PI_SESSION_ROOT?.trim();

  return {
    agentDirectory: configuredAgentDirectory || undefined,
    sessionRootDirectory:
      configuredSessionRoot ||
      path.join(workspaceRoot, ".chatty", "backends", "pi", "projects"),
  };
}
