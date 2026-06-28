import path from "node:path";

import { ChatMessage } from "../../types";
import { MessageStore } from "../contracts";
import { JsonFile } from "./json-file";

interface MessageStoreFile {
  messages: Record<string, ChatMessage[]>;
}

export class JsonMessageStore implements MessageStore {
  private readonly file: JsonFile<MessageStoreFile>;

  constructor(stateDirectory: string) {
    this.file = new JsonFile(path.join(stateDirectory, "messages.json"), () => ({
      messages: {},
    }));
  }

  async getBySessionId(sessionId: string): Promise<ChatMessage[]> {
    const data = await this.file.read();
    return data.messages[sessionId] ?? [];
  }

  async append(sessionId: string, messages: readonly ChatMessage[]): Promise<void> {
    const data = await this.file.read();
    const existing = data.messages[sessionId] ?? [];
    data.messages[sessionId] = [...existing, ...messages];
    await this.file.write(data);
  }
}
