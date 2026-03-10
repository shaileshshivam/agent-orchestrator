import { getSessionsDir } from "@composio/ao-core";
import { resolve } from "node:path";

function normalizePath(path: string): string {
  return resolve(path).replace(/\/+$/, "");
}

/**
 * Resolve sessions metadata directory with metadata override fallback.
 * Returns null when configPath is unavailable/invalid.
 */
export function resolveSessionsDir(
  configPath: string,
  projectPath: string,
  metadata: Record<string, string>,
): string | null {
  let derived: string;
  try {
    derived = getSessionsDir(configPath, projectPath);
  } catch {
    return null;
  }

  const metadataDir = metadata["AO_DATA_DIR"] ?? metadata["aoDataDir"] ?? metadata["sessionsDir"];
  if (metadataDir) {
    // Ignore untrusted metadata paths unless they exactly match the configured sessions dir.
    if (normalizePath(metadataDir) === normalizePath(derived)) {
      return derived;
    }
  }
  return derived;
}
