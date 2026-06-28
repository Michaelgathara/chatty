import path from "node:path";

import { ProjectDefinition } from "../../types";
import { ProjectStore } from "../contracts";
import { JsonFile } from "./json-file";

interface ProjectStoreFile {
  projects: ProjectDefinition[];
}

export class JsonProjectStore implements ProjectStore {
  private readonly file: JsonFile<ProjectStoreFile>;

  constructor(stateDirectory: string) {
    this.file = new JsonFile(path.join(stateDirectory, "projects.json"), () => ({
      projects: [],
    }));
  }

  async readAll(): Promise<ProjectDefinition[]> {
    const data = await this.file.read();
    return Array.isArray(data.projects) ? data.projects : [];
  }

  async writeAll(projects: readonly ProjectDefinition[]): Promise<void> {
    await this.file.write({ projects: [...projects] });
  }
}
