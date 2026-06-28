import { BackendKind } from "../types";

export const BACKEND_KINDS: readonly BackendKind[] = ["mock", "pi", "opencode"];

export function isBackendKind(value: string): value is BackendKind {
  return BACKEND_KINDS.includes(value as BackendKind);
}
