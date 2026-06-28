import path from "node:path";

import { HiddenSessionRecord } from "../../types";
import { SessionStore } from "../contracts";
import { JsonFile } from "./json-file";

interface SessionStoreFile {
  sessions: HiddenSessionRecord[];
}

export class JsonSessionStore implements SessionStore {
  private readonly file: JsonFile<SessionStoreFile>;

  constructor(stateDirectory: string) {
    this.file = new JsonFile(path.join(stateDirectory, "sessions.json"), () => ({
      sessions: [],
    }));
  }

  async readAll(): Promise<HiddenSessionRecord[]> {
    const data = await this.file.read();
    return Array.isArray(data.sessions) ? data.sessions : [];
  }

  async writeAll(sessions: readonly HiddenSessionRecord[]): Promise<void> {
    await this.file.write({ sessions: [...sessions] });
  }
}
