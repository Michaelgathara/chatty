import path from "node:path";

import { ChattyStores } from "../contracts";
import { JsonMessageStore } from "./message-store";
import { JsonProjectStore } from "./project-store";
import { JsonSessionStore } from "./session-store";

export function createJsonStores(workspaceRoot: string): ChattyStores {
  return createJsonStoresAtStateDirectory(path.join(workspaceRoot, ".chatty"));
}

export function createJsonStoresAtStateDirectory(stateDirectory: string): ChattyStores {
  return {
    projectStore: new JsonProjectStore(stateDirectory),
    sessionStore: new JsonSessionStore(stateDirectory),
    messageStore: new JsonMessageStore(stateDirectory),
  };
}
