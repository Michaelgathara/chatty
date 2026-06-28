import os from "node:os";
import path from "node:path";

export interface ChattyPiExtensionConfig {
  stateDirectory: string;
  piSessionRootDirectory: string;
}

export function createChattyPiExtensionConfig(): ChattyPiExtensionConfig {
  const configuredStateDirectory = process.env.CHATTY_HOME?.trim();
  const stateDirectory = configuredStateDirectory || path.join(os.homedir(), ".chatty");
  const configuredPiSessionRoot = process.env.CHATTY_PI_SESSION_ROOT?.trim();

  return {
    stateDirectory,
    piSessionRootDirectory:
      configuredPiSessionRoot || path.join(stateDirectory, "backends", "pi", "projects"),
  };
}
