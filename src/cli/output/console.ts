import chalk from "chalk";
import type { AnalysisResult, Verdict } from "../../core/types.js";

export class ConsoleOutput {
  printResult(result: AnalysisResult): void {
    const verdictColor = this.getVerdictColor(result.verdict);
    const verdictLabel = this.getVerdictLabel(result.verdict);

    console.log();
    console.log(chalk.bold(`Test: ${result.failure.testName}`));
    console.log(chalk.gray(`File: ${result.failure.testFile}`));
    console.log();
    console.log(`Verdict: ${verdictColor(verdictLabel)}`);
    console.log(`Confidence: ${this.formatConfidence(result.confidence)}`);
    console.log();
    console.log(chalk.gray("Reasoning:"));
    console.log(result.reasoning);

    if (result.suggestions.length > 0) {
      console.log();
      console.log(chalk.gray("Suggestions:"));
      result.suggestions.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s}`);
      });
    }
    console.log();
  }

  printSummary(results: AnalysisResult[]): void {
    const testBugs = results.filter((r) => r.verdict === "test").length;
    const codeBugs = results.filter((r) => r.verdict === "code").length;
    const unknown = results.filter((r) => r.verdict === "unknown").length;

    console.log(chalk.bold("\n--- Summary ---"));
    console.log(`Total failures analyzed: ${results.length}`);
    console.log(chalk.yellow(`Test bugs: ${testBugs}`));
    console.log(chalk.red(`Code bugs: ${codeBugs}`));
    console.log(chalk.gray(`Unknown: ${unknown}`));
  }

  private getVerdictColor(verdict: Verdict) {
    switch (verdict) {
      case "test":
        return chalk.yellow;
      case "code":
        return chalk.red;
      default:
        return chalk.gray;
    }
  }

  private getVerdictLabel(verdict: Verdict): string {
    switch (verdict) {
      case "test":
        return "TEST IS BUGGY";
      case "code":
        return "CODE IS BUGGY";
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
