import type { DiagnosticResult, MissingTest, Priority } from "../../core/types.js";

// ============================================================================
// MarkdownReporter
// ============================================================================

export class MarkdownReporter {
  /**
   * Generate markdown report for verdict results
   */
  formatResults(results: DiagnosticResult[]): string {
    const lines: string[] = [];

    // Header
    lines.push("# 🍔 Hambugsy Analysis Report");
    lines.push("");
    lines.push(`*Generated: ${new Date().toISOString()}*`);
    lines.push("");

    // Summary
    lines.push("## 📊 Summary");
    lines.push("");

    const codeBugs = results.filter((r) => r.verdict.type === "CODE_BUG").length;
    const outdatedTests = results.filter(
      (r) => r.verdict.type === "OUTDATED_TEST" || r.verdict.type === "FLAKY_TEST"
    ).length;
    const passed = results.filter((r) => r.verdict.type === "PASSED").length;
    const envIssues = results.filter((r) => r.verdict.type === "ENVIRONMENT_ISSUE").length;

    lines.push("| Category | Count |");
    lines.push("|----------|-------|");
    lines.push(`| 🐛 Code Bugs | ${codeBugs} |`);
    lines.push(`| 📜 Outdated Tests | ${outdatedTests} |`);
    lines.push(`| ✅ Passed | ${passed} |`);
    if (envIssues > 0) {
      lines.push(`| 🌐 Environment Issues | ${envIssues} |`);
    }
    lines.push("");

    // Detailed Results
    if (results.length > 0) {
      lines.push("## 🔍 Detailed Results");
      lines.push("");

      for (const result of results) {
        lines.push(this.formatResult(result));
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  /**
   * Format a single diagnostic result
   */
  formatResult(result: DiagnosticResult): string {
    const lines: string[] = [];
    const { verdict } = result;

    const icon = this.getVerdictIcon(verdict.type);
    const confidencePercent = Math.round(verdict.confidence * 100);

    lines.push(`### ${icon} ${result.testName}`);
    lines.push("");
    lines.push(`**File:** \`${result.testFile}\``);
    lines.push("");
    lines.push(`**Verdict:** ${this.getVerdictLabel(verdict.type)} (${confidencePercent}% confidence)`);
    lines.push("");

    // Reasoning
    lines.push("**Analysis:**");
    lines.push("");
    const reasonLines = result.reasoning.split("\n").filter((l) => l.trim());
    for (const line of reasonLines) {
      lines.push(`- ${line.trim()}`);
    }
    lines.push("");

    // Recommendation
    if (verdict.recommendation) {
      lines.push("**Recommendation:**");
      lines.push("");
      lines.push(`> ${verdict.recommendation.description}`);
      lines.push("");

      if (verdict.recommendation.suggestedFix) {
        lines.push("**Suggested Fix:**");
        lines.push("");
        lines.push("```diff");
        lines.push(verdict.recommendation.suggestedFix);
        lines.push("```");
        lines.push("");
      }

      if (verdict.recommendation.affectedFiles.length > 0) {
        lines.push("**Affected Files:**");
        for (const file of verdict.recommendation.affectedFiles) {
          lines.push(`- \`${file}\``);
        }
        lines.push("");
      }
    }

    // Suggestions
    if (result.suggestions.length > 0) {
      lines.push("**Suggestions:**");
      lines.push("");
      for (const suggestion of result.suggestions) {
        lines.push(`- ${suggestion}`);
      }
      lines.push("");
    }

    lines.push("---");

    return lines.join("\n");
  }

  /**
   * Generate markdown report for missing test suggestions
   */
  formatSuggestResults(suggestions: MissingTest[]): string {
    const lines: string[] = [];

    // Header
    lines.push("# 🍔 Hambugsy Missing Test Report");
    lines.push("");
    lines.push(`*Generated: ${new Date().toISOString()}*`);
    lines.push("");

    // Summary
    const critical = suggestions.filter((s) => s.priority === "CRITICAL").length;
    const high = suggestions.filter((s) => s.priority === "HIGH").length;
    const medium = suggestions.filter((s) => s.priority === "MEDIUM").length;
    const low = suggestions.filter((s) => s.priority === "LOW").length;

    lines.push("## 📊 Summary");
    lines.push("");
    lines.push("| Priority | Count |");
    lines.push("|----------|-------|");
    lines.push(`| 🔥 CRITICAL | ${critical} |`);
    lines.push(`| ⚠️ HIGH | ${high} |`);
    lines.push(`| 💡 MEDIUM | ${medium} |`);
    lines.push(`| ✅ LOW | ${low} |`);
    lines.push("");

    // Group by file
    const byFile = new Map<string, MissingTest[]>();
    for (const suggestion of suggestions) {
      const existing = byFile.get(suggestion.filePath) ?? [];
      existing.push(suggestion);
      byFile.set(suggestion.filePath, existing);
    }

    // Detailed suggestions by file
    lines.push("## 🔍 Missing Tests by File");
    lines.push("");

    for (const [filePath, fileSuggestions] of byFile) {
      lines.push(`### 📁 \`${filePath}\``);
      lines.push("");

      for (const suggestion of fileSuggestions) {
        const priorityIcon = this.getPriorityIcon(suggestion.priority);

        lines.push(`#### ${priorityIcon} \`${suggestion.methodName}()\` @ line ${suggestion.lineNumber}`);
        lines.push("");
        lines.push(`**Pattern:** ${suggestion.pattern}`);
        lines.push("");
        lines.push(`**Priority:** ${suggestion.priority}`);
        lines.push("");
        lines.push(`**Rationale:** ${suggestion.rationale}`);
        lines.push("");

        if (suggestion.suggestedTest) {
          lines.push("**Suggested Test:**");
          lines.push("");
          lines.push("```java");
          lines.push(suggestion.suggestedTest);
          lines.push("```");
          lines.push("");
        }

        lines.push("---");
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  /**
   * Print results to console
   */
  print(results: DiagnosticResult[]): void {
    console.log(this.formatResults(results));
  }

  /**
   * Print suggest results to console
   */
  printSuggestResults(suggestions: MissingTest[]): void {
    console.log(this.formatSuggestResults(suggestions));
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private getVerdictIcon(type: string): string {
    switch (type) {
      case "CODE_BUG":
        return "🐛";
      case "OUTDATED_TEST":
        return "📜";
      case "FLAKY_TEST":
        return "🎲";
      case "PASSED":
        return "✅";
      case "ENVIRONMENT_ISSUE":
        return "🌐";
      default:
        return "❓";
    }
  }

  private getVerdictLabel(type: string): string {
    switch (type) {
      case "CODE_BUG":
        return "**Code Bug**";
      case "OUTDATED_TEST":
        return "**Outdated Test**";
      case "FLAKY_TEST":
        return "**Flaky Test**";
      case "PASSED":
        return "**Passed**";
      case "ENVIRONMENT_ISSUE":
        return "**Environment Issue**";
      default:
        return "**Unknown**";
    }
  }

  private getPriorityIcon(priority: Priority): string {
    switch (priority) {
      case "CRITICAL":
        return "🔥";
      case "HIGH":
        return "⚠️";
      case "MEDIUM":
        return "💡";
      case "LOW":
        return "✅";
      default:
        return "❓";
    }
  }
}

// ============================================================================
// Default Export
// ============================================================================

export const markdownReporter = new MarkdownReporter();
