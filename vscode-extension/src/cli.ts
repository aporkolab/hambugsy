import { execFile } from "child_process";

// ============================================================================
// Hambugsy CLI bridge (no `vscode` import, so it can be unit tested)
// ============================================================================

export type VerdictType = "CODE_BUG" | "OUTDATED_TEST" | "FLAKY_TEST" | "ENVIRONMENT_ISSUE" | "PASSED";

export interface AnalysisSummary {
  codeBugs: number;
  outdatedTests: number;
  flakyTests: number;
  environmentIssues: number;
  passed: number;
}

export interface MissingTestSuggestion {
  methodName: string;
  filePath: string;
  lineNumber: number;
  priority: string;
  rationale: string;
  suggestedTest?: string;
}

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const MAX_BUFFER = 64 * 1024 * 1024;

/**
 * Builds the command and arguments for invoking the CLI through npx.
 * Arguments are passed as an array so file paths are never interpreted by a shell.
 * Windows needs a shell to launch npx.cmd, so every argument is double-quoted there
 * (`"` cannot occur in Windows file names, and cmd metacharacters are literal inside quotes).
 */
export function buildCliInvocation(
  args: string[],
  platform: NodeJS.Platform = process.platform
): { command: string; args: string[]; shell: boolean } {
  const fullArgs = ["hambugsy", ...args];
  if (platform === "win32") {
    return { command: "npx.cmd", args: fullArgs.map((a) => `"${a}"`), shell: true };
  }
  return { command: "npx", args: fullArgs, shell: false };
}

/**
 * Runs the CLI. A non-zero exit code is not an error by itself: `analyze` exits with 1
 * when it finds code bugs and `suggest` when it finds critical gaps, while still
 * printing a valid report. Only spawn failures reject.
 */
export function runHambugsy(args: string[], cwd: string): Promise<CliResult> {
  const invocation = buildCliInvocation(args);
  return new Promise((resolve, reject) => {
    execFile(
      invocation.command,
      invocation.args,
      { cwd, shell: invocation.shell, maxBuffer: MAX_BUFFER, env: { ...process.env, FORCE_COLOR: "0" } },
      (error, stdout, stderr) => {
        if (error && typeof error.code !== "number") {
          reject(error);
          return;
        }
        resolve({ stdout, stderr, exitCode: error ? (error.code as unknown as number) : 0 });
      }
    );
  });
}

/**
 * Parses the JSON report of the CLI, with a readable error when the output is not JSON
 * (for example when the CLI failed before producing a report).
 */
export function parseCliJson<T>(result: CliResult): T {
  try {
    return JSON.parse(result.stdout) as T;
  } catch {
    const detail = (result.stderr || result.stdout).trim().split("\n").slice(-5).join("\n");
    throw new Error(`Hambugsy CLI did not return JSON (exit code ${result.exitCode})${detail ? `:\n${detail}` : ""}`);
  }
}

export function summarizeResults(results: Array<{ verdict: { type: VerdictType } }>): AnalysisSummary {
  const count = (type: VerdictType) => results.filter((r) => r.verdict.type === type).length;
  return {
    codeBugs: count("CODE_BUG"),
    outdatedTests: count("OUTDATED_TEST"),
    flakyTests: count("FLAKY_TEST"),
    environmentIssues: count("ENVIRONMENT_ISSUE"),
    passed: count("PASSED"),
  };
}

/**
 * Flattens the `suggest --format json` report (`coverageByMethod[].suggestions[]`).
 */
export function extractSuggestions(report: unknown): MissingTestSuggestion[] {
  const coverage = (report as { coverageByMethod?: Array<{ suggestions?: MissingTestSuggestion[] }> } | null)
    ?.coverageByMethod;
  if (!Array.isArray(coverage)) {
    return [];
  }
  return coverage.flatMap((c) => c.suggestions ?? []);
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
