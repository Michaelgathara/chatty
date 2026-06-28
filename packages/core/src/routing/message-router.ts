import path from "node:path";

import { ProjectRegistry } from "../registries/project-registry";
import { SessionRegistry } from "../registries/session-registry";
import {
  ProjectDefinition,
  ProjectScore,
  ResolvedRoute,
  RouteDecision,
  RouterInput,
  RoutingEvidence,
} from "../types";

const MIN_CONFIDENCE = 0.55;
const MIN_MARGIN = 0.15;

export class MessageRouter {
  constructor(
    private readonly projects: ProjectRegistry,
    private readonly sessions: SessionRegistry,
  ) {}

  async resolve(input: RouterInput): Promise<ResolvedRoute | { decision: RouteDecision }> {
    const projectList = await this.projects.list();
    if (projectList.length === 0) {
      throw new Error("No projects are registered. Add one with /project add <id> <path>.");
    }

    const scores = await Promise.all(
      projectList.map(async (project) => this.scoreProject(project, input, projectList.length)),
    );

    const ordered = scores.sort((left, right) => right.score - left.score);
    const top = ordered[0];
    const runnerUp = ordered[1];

    if (!top) {
      return {
        decision: {
          action: "clarify",
          confidence: 0,
          evidence: [],
          candidates: [],
        },
      };
    }

    const topEvidence = [...top.evidence];
    if (ordered.length === 1 && topEvidence.every((entry) => entry.kind !== "single-project")) {
      topEvidence.push({ kind: "single-project", value: "Only one project is registered.", weight: 0.6 });
      top.score = Math.max(top.score, 0.6);
    }

    const margin = runnerUp ? top.score - runnerUp.score : top.score;
    if (top.score < MIN_CONFIDENCE || margin < MIN_MARGIN) {
      return {
        decision: {
          action: "clarify",
          confidence: clamp(top.score),
          evidence: topEvidence,
          candidates: ordered.slice(0, 3),
        },
      };
    }

    const project = projectList.find((entry) => entry.id === top.projectId);
    if (!project) {
      throw new Error(`Unable to resolve project ${top.projectId}.`);
    }

    const { session, created } = await this.sessions.ensureSession(project.id, project.defaultBackend);
    const history = await this.sessions.getMessages(session.id);
    const decision: RouteDecision = {
      projectId: project.id,
      action: created ? "create" : "resume",
      confidence: clamp(top.score),
      evidence: topEvidence,
      candidates: ordered.slice(0, 3),
      session,
    };

    return { project, session, history, decision };
  }

  private async scoreProject(
    project: ProjectDefinition,
    input: RouterInput,
    totalProjects: number,
  ): Promise<ProjectScore> {
    const haystack = input.message.toLowerCase();
    const evidence: RoutingEvidence[] = [];
    let score = 0;

    if (input.overrideProjectId === project.id) {
      evidence.push({ kind: "override", value: `Manual override to ${project.id}.`, weight: 1 });
      return { projectId: project.id, score: 1, evidence };
    }

    if (includesWord(haystack, project.id)) {
      evidence.push({ kind: "project-id", value: `Matched project id "${project.id}".`, weight: 0.7 });
      score += 0.7;
    }

    for (const alias of project.aliases) {
      if (includesWord(haystack, alias.toLowerCase())) {
        evidence.push({ kind: "alias", value: `Matched alias "${alias}".`, weight: 0.4 });
        score += 0.4;
      }
    }

    const pathName = path.basename(project.rootPath).toLowerCase();
    if (pathName && includesWord(haystack, pathName)) {
      evidence.push({ kind: "path", value: `Matched path hint "${pathName}".`, weight: 0.25 });
      score += 0.25;
    }

    for (const hint of project.hints) {
      if (includesWord(haystack, hint.toLowerCase())) {
        evidence.push({ kind: "hint", value: `Matched project hint "${hint}".`, weight: 0.2 });
        score += 0.2;
      }
    }

    if (input.lastActiveProjectId === project.id) {
      evidence.push({ kind: "recency", value: `Last active project was ${project.id}.`, weight: 0.15 });
      score += 0.15;
    }

    if (score === 0 && totalProjects === 1) {
      evidence.push({ kind: "single-project", value: "Only one project is registered.", weight: 0.6 });
      score = 0.6;
    }

    if (score === 0) {
      evidence.push({ kind: "fallback", value: "No explicit match yet.", weight: 0 });
    }

    return { projectId: project.id, score: clamp(score), evidence };
  }
}

function includesWord(haystack: string, rawNeedle: string): boolean {
  const needle = escapeRegExp(rawNeedle.trim().toLowerCase());
  if (!needle) {
    return false;
  }

  const pattern = new RegExp(`(^|[^a-z0-9])${needle}([^a-z0-9]|$)`, "i");
  return pattern.test(haystack);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clamp(value: number): number {
  return Math.max(0, Math.min(0.99, Number(value.toFixed(2))));
}
