import chalk from "chalk";
import type { DiagnosticResult, Verdict } from "../../core/types.js";

export class ConsoleOutput {
  printResult(result: DiagnosticResult): void {
    const verdictColor = this.getVerdictColor(result.verdict);
    const verdictLabel = this.getVerdictLabel(result.verdict);

    console.log();
    console.log(chalk.bold(`Test: ${result.testName}`));
    console.log(chalk.gray(`File: ${result.testFile}`));
    console.log();
    console.log(`Verdict: ${verdictColor(verdictLabel)}`);
    console.log(`Confidence: ${this.formatConfidence(result.confidence)}`);
    console.log();
    console.log(chalk.gray("Reasoning:"));
    console.log(result.reasoning);

    if (result.suggestions.length > 0) {
      console.log();
      console.log(chalk.gray("Suggestions:"));
      result.suggestions.forEach((s: string, i: number) => {
        console.log(`  ${i + 1}. ${s}`);
      });
    }
    console.log();
  }

  printSummary(results: DiagnosticResult[]): void {
    const testBugs = results.filter((r) => r.verdict.type === "OUTDATED_TEST" || r.verdict.type === "FLAKY_TEST").length;
    const codeBugs = results.filter((r) => r.verdict.type === "CODE_BUG").length;
    const unknown = results.filter((r) => r.verdict.type === "ENVIRONMENT_ISSUE").length;
    const passed = results.filter((r) => r.verdict.type === "PASSED").length;

    console.log(chalk.bold("\n--- Summary ---"));
    console.log(`Total failures analyzed: ${results.length}`);
    console.log(chalk.yellow(`Test issues: ${testBugs}`));
    console.log(chalk.red(`Code bugs: ${codeBugs}`));
    console.log(chalk.green(`Passed: ${passed}`));
    console.log(chalk.gray(`Environment/Unknown: ${unknown}`));
  }

  private getVerdictColor(verdict: Verdict) {
    switch (verdict.type) {
      case "OUTDATED_TEST":
      case "FLAKY_TEST":
        return chalk.yellow;
      case "CODE_BUG":
        return chalk.red;
      case "PASSED":
        return chalk.green;
      default:
        return chalk.gray;
    }
  }

  private getVerdictLabel(verdict: Verdict): string {
    switch (verdict.type) {
      case "OUTDATED_TEST":
        return "OUTDATED TEST";
      case "FLAKY_TEST":
        return "FLAKY TEST";
      case "CODE_BUG":
        return "CODE BUG";
      case "PASSED":
        return "PASSED";
      case "ENVIRONMENT_ISSUE":
        return "ENVIRONMENT ISSUE";
      default:
        return "UNKNOWN";
    }
  }

  private formatConfidence(confidence: number): string {
    const percentage = Math.round(confidence * 100);
    if (percentage >= 80) return chalk.green(`${percentage}%`);
    if (percentage >= 50) return chalk.yellow(`${percentage}%`);
    return chalk.red(`${percentage}%`);
  }
}
