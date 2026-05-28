function clean(value: unknown, fallback = "-"): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeVersion(value: string): string {
  const version = clean(value, "v1.0.0");
  return version.startsWith("v") ? version : `v${version}`;
}

export const APP_VERSION = normalizeVersion(import.meta.env.VITE_APP_VERSION || "v1.0.0");
export const BUILD_COMMIT = clean(import.meta.env.VITE_BUILD_COMMIT, "local");
export const BUILD_TIME = clean(import.meta.env.VITE_BUILD_TIME, "local");
export const APP_ENVIRONMENT = clean(import.meta.env.VITE_APP_ENVIRONMENT, "development");

export function shortCommit(commit = BUILD_COMMIT): string {
  if (!commit || commit === "local" || commit === "-") return commit || "-";
  return commit.slice(0, 8);
}
