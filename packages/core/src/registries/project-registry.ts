import path from "node:path";

import { ProjectStore } from "../storage";
import { ProjectDefinition } from "../types";
import { normalizeProjectId } from "../utils/project-id";

export class ProjectRegistry {
  constructor(private readonly store: ProjectStore) {}

  async list(): Promise<ProjectDefinition[]> {
    const projects = await this.store.readAll();
    return [...projects].map(normalizeProject).sort((left, right) => left.name.localeCompare(right.name));
  }

  async get(projectId: string): Promise<ProjectDefinition | undefined> {
    const projects = await this.store.readAll();
    const normalizedId = normalizeProjectId(projectId);
    return projects.map(normalizeProject).find((project) => project.id === normalizedId);
  }

  async register(project: ProjectDefinition): Promise<ProjectDefinition> {
    const store = await this.store.readAll();
    const normalizedProject = normalizeProject(project);
    const existingIndex = store.findIndex((entry) => normalizeProject(entry).id === normalizedProject.id);

    if (existingIndex >= 0) {
      store[existingIndex] = normalizedProject;
    } else {
      store.push(normalizedProject);
    }

    await this.store.writeAll(store);
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
    const projects = await this.store.readAll();
    return projects.length > 0;
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
