import { relative } from "node:path";
import type { DiagnosticResult } from "../../core/types.js";

/** Escapes the message part of a workflow command (multi-line text would otherwise break it). */
export function escapeData(value: string): string {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

/** Escapes a workflow command property value such as `file=`. */
export function escapeProperty(value: string): string {
  return escapeData(value).replace(/:/g, "%3A").replace(/,/g, "%2C");
}

/**
 * Formats results as GitHub Actions workflow commands. File paths are made relative to
 * `cwd` (the checkout directory in Actions), which GitHub needs to attach annotations.
 */
export function formatGitHubAnnotations(results: DiagnosticResult[], cwd: string = process.cwd()): string[] {
  const lines = results.map((result) => {
    const level = result.verdict.type === "CODE_BUG" ? "error" : "warning";
    const file = relative(cwd, result.testFile).split("\\").join("/");
    return `::${level} file=${escapeProperty(file)}::${escapeData(`${result.verdict.type}: ${result.reasoning}`)}`;
  });

  const bugs = results.filter((r) => r.verdict.type === "CODE_BUG").length;
  const testIssues = results.filter(
    (r) => r.verdict.type === "OUTDATED_TEST" || r.verdict.type === "FLAKY_TEST"
  ).length;
  lines.push(`::notice::Hambugsy found ${bugs} code bug(s) and ${testIssues} test issue(s)`);

  return lines;
}
