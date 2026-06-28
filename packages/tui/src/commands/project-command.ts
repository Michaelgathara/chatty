import { BACKEND_KINDS, BackendKind, isBackendKind } from "../../../core/src";

export interface ParsedProjectAddArgs {
  projectId: string;
  rawPath: string;
  aliases: string[];
  backend: BackendKind;
}

export interface ParsedProjectBackendArgs {
  projectId: string;
  backend: BackendKind;
}

export function parseProjectAddArgs(args: string[]): ParsedProjectAddArgs | { error: string } {
  if (args.length < 2) {
    return { error: 'Usage: /project add <id> <path> [--backend <mock|pi|opencode>] [aliases...]' };
  }

  const [projectId, rawPath, ...rest] = args;
  const aliases: string[] = [];
  let backend: BackendKind = "mock";

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token !== "--backend") {
      aliases.push(token);
      continue;
    }

    const value = rest[index + 1];
    if (!value) {
      return { error: 'Missing backend after "--backend".' };
    }

    if (!isBackendKind(value)) {
      return { error: `Unknown backend "${value}". Expected one of: ${BACKEND_KINDS.join(", ")}.` };
    }

    backend = value;
    index += 1;
  }

  return { projectId, rawPath, aliases, backend };
}

export function parseProjectBackendArgs(args: string[]): ParsedProjectBackendArgs | { error: string } {
  if (args.length !== 2) {
    return { error: "Usage: /project backend <projectId> <mock|pi|opencode>" };
  }

  const [projectId, backend] = args;
  if (!isBackendKind(backend)) {
    return { error: `Unknown backend "${backend}". Expected one of: ${BACKEND_KINDS.join(", ")}.` };
  }

  return { projectId, backend };
}
