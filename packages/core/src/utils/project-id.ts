export function normalizeProjectId(value: string): string {
  const lowered = value.trim().toLowerCase();
  return lowered.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project";
}
