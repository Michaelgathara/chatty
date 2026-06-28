import { promises as fs } from "node:fs";
import path from "node:path";

import { ProjectDefinition, ProjectStoreShape } from "../types";
import { normalizeProjectId } from "../utils/project-id";

export class ProjectRegistry {
  private readonly stateDir: string;
  private readonly projectsFile: string;

  constructor(private readonly workspaceRoot: string) {
    this.stateDir = path.join(workspaceRoot, ".chatty");
    this.projectsFile = path.join(this.stateDir, "projects.json");
  }

  async list(): Promise<ProjectDefinition[]> {
    const store = await this.readStore();
    return [...store.projects].sort((left, right) => left.name.localeCompare(right.name));
  }

  async get(projectId: string): Promise<ProjectDefinition | undefined> {
    const store = await this.readStore();
    const normalizedId = normalizeProjectId(projectId);
    return store.projects.find((project) => project.id === normalizedId);
  }

  async register(project: ProjectDefinition): Promise<ProjectDefinition> {
    const store = await this.readStore();
    const normalizedProject = normalizeProject(project);
    const existingIndex = store.projects.findIndex((entry) => entry.id === normalizedProject.id);

    if (existingIndex >= 0) {
      store.projects[existingIndex] = normalizedProject;
    } else {
      store.projects.push(normalizedProject);
    }

    await this.writeStore(store);
    return normalizedProject;
  }

  async ensureSeedProject(project: ProjectDefinition): Promise<ProjectDefinition> {
    const existing = await this.get(project.id);
    if (existing) {
      return existing;
    }

    return this.register(project);
  }

  async hasProjects(): Promise<boolean> {
    const store = await this.readStore();
    return store.projects.length > 0;
  }

  private async readStore(): Promise<ProjectStoreShape> {
    await fs.mkdir(this.stateDir, { recursive: true });

    try {
      const raw = await fs.readFile(this.projectsFile, "utf8");
      const parsed = JSON.parse(raw) as ProjectStoreShape;
      return {
        projects: Array.isArray(parsed.projects) ? parsed.projects.map(normalizeProject) : [],
      };
    } catch (error) {
      if (isMissingFile(error)) {
        const emptyStore = createEmptyStore();
        await this.writeStore(emptyStore);
        return emptyStore;
      }

      throw error;
    }
  }

  private async writeStore(store: ProjectStoreShape): Promise<void> {
    await fs.mkdir(this.stateDir, { recursive: true });
    await fs.writeFile(this.projectsFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  }
}

export function buildSeedProject(workspaceRoot: string): ProjectDefinition {
  const baseName = path.basename(workspaceRoot);
  return normalizeProject({
    id: normalizeProjectId(baseName),
    name: baseName,
    rootPath: workspaceRoot,
    aliases: [baseName, "this repo", "current repo"],
    hints: [baseName, workspaceRoot],
    defaultBackend: "mock",
  });
}

function normalizeProject(project: ProjectDefinition): ProjectDefinition {
  return {
    ...project,
    id: normalizeProjectId(project.id),
    aliases: uniq(project.aliases),
    hints: uniq(project.hints),
  };
}

function uniq(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function createEmptyStore(): ProjectStoreShape {
  return { projects: [] };
}
