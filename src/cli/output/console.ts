import chalk from "chalk";
import type {
  DiagnosticResult,
  VerdictType,
  MissingTest,
  Priority,
} from "../../core/types.js";

type ChalkFn = typeof chalk.red;

// ============================================================================
// Constants
// ============================================================================

const BOX = {
  TOP_LEFT: "┌",
  TOP_RIGHT: "┐",
  BOTTOM_LEFT: "└",
  BOTTOM_RIGHT: "┘",
  HORIZONTAL: "─",
  VERTICAL: "│",
  T_RIGHT: "├",
  T_LEFT: "┤",
  HEAVY_HORIZONTAL: "━",
};

const EMOJI = {
  HAMBURGER: "🍔",
  BUG: "🐛",
  SCROLL: "📜",
  DICE: "🎲",
  GLOBE: "🌐",
  CHECK: "✅",
  CROSS: "❌",
  BULB: "💡",
  PIN: "📍",
  MICROSCOPE: "🔬",
  TARGET: "🎯",
  CHART: "📊",
  SPARKLES: "✨",
  WARNING: "⚠️",
  FIRE: "🔥",
  ROCKET: "🚀",
};

// ============================================================================
// ConsoleReporter
// ============================================================================

export class ConsoleReporter {
  private readonly boxWidth: number;

  constructor(boxWidth: number = 70) {
    this.boxWidth = boxWidth;
  }

  // ==========================================================================
  // Main Print Methods
  // ==========================================================================

  /**
   * Print verdict results with beautiful box formatting
   */
  print(results: DiagnosticResult[]): void {
    this.printHeader();

    for (const result of results) {
      this.printVerdictBox(result);
    }

    this.printSummary(results);
  }

  /**
   * Print missing test suggestions
   */
  printSuggestResults(suggestions: MissingTest[]): void {
    this.printSuggestHeader();

    // Group by file
    const byFile = new Map<string, MissingTest[]>();
    for (const suggestion of suggestions) {
      const existing = byFile.get(suggestion.filePath) ?? [];
      existing.push(suggestion);
      byFile.set(suggestion.filePath, existing);
    }

    for (const [filePath, fileSuggestions] of byFile) {
      this.printFileSuggestions(filePath, fileSuggestions);
    }

    this.printSuggestSummary(suggestions);
  }

  // ==========================================================================
  // Header
  // ==========================================================================

  private printHeader(): void {
    console.log();
    console.log(
      chalk.cyan.bold(`  ${EMOJI.HAMBURGER} HAMBUGSY - Test Failure Diagnostics ${EMOJI.HAMBURGER}`)
    );
    console.log(chalk.gray("  " + BOX.HEAVY_HORIZONTAL.repeat(45)));
    console.log();
  }

  private printSuggestHeader(): void {
    console.log();
    console.log(
      chalk.cyan.bold(`  ${EMOJI.HAMBURGER} HAMBUGSY - Missing Test Suggestions ${EMOJI.HAMBURGER}`)
    );
    console.log(chalk.gray("  " + BOX.HEAVY_HORIZONTAL.repeat(45)));
    console.log();
  }

  // ==========================================================================
  // Verdict Box
  // ==========================================================================

  private printVerdictBox(result: DiagnosticResult): void {
    const { verdict } = result;
    const verdictColor = this.getVerdictColor(verdict.type);
    const verdictIcon = this.getVerdictIcon(verdict.type);

    // Top border
    this.printBoxLine("top");

    // Method header
    this.printBoxContent(
      `${EMOJI.PIN} Method: ${chalk.cyan.bold(result.testName)} @ ${chalk.gray(result.testFile)}`
    );

    // Separator
    this.printBoxLine("separator");

    // Test status - dynamic based on verdict
    if (verdict.type === "PASSED") {
      this.printBoxContent(
        `${EMOJI.CHECK} ${chalk.green("PASSING TEST:")} ${result.testName}`
      );
    } else {
      this.printBoxContent(
        `${EMOJI.CROSS} ${chalk.red("FAILING TEST:")} ${result.testName}`
      );
    }
    this.printBoxContent("");

    // Analysis section
    this.printBoxContent(`${EMOJI.MICROSCOPE} ${chalk.bold("ANALYSIS:")}`);

    // Parse reasoning into tree format
    const reasonLines = result.reasoning.split("\n").filter((l) => l.trim());
    for (let i = 0; i < reasonLines.length; i++) {
      const isLast = i === reasonLines.length - 1;
      const prefix = isLast ? "└──" : "├──";
      this.printBoxContent(`${chalk.gray(prefix)} ${reasonLines[i].trim()}`);
    }

    this.printBoxContent("");

    // Verdict
    const confidencePercent = Math.round(verdict.confidence * 100);
    this.printBoxContent(
      `${EMOJI.TARGET} ${chalk.bold("VERDICT:")} ${verdictColor(`${verdictIcon} ${this.getVerdictLabel(verdict.type)} (${confidencePercent}%)`)}`
    );

    // Recommendation if available
    if (verdict.recommendation?.suggestedFix) {
      this.printBoxContent("");
      this.printBoxContent(`${EMOJI.BULB} ${chalk.bold("RECOMMENDATION:")}`);

      const fixLines = verdict.recommendation.suggestedFix.split("\n");
      for (const line of fixLines) {
        if (line.startsWith("-")) {
          this.printBoxContent(chalk.red(line));
        } else if (line.startsWith("+")) {
          this.printBoxContent(chalk.green(line));
        } else {
          this.printBoxContent(chalk.gray(line));
        }
      }
    }

    // Suggestions
    if (result.suggestions.length > 0) {
      this.printBoxContent("");
      this.printBoxContent(`${EMOJI.SPARKLES} ${chalk.bold("SUGGESTIONS:")}`);
      for (const suggestion of result.suggestions) {
        this.printBoxContent(`  ${chalk.yellow("•")} ${suggestion}`);
      }
    }

    // Bottom border
    this.printBoxLine("bottom");
    console.log();
  }

  // ==========================================================================
  // Summary
  // ==========================================================================

  private printSummary(results: DiagnosticResult[]): void {
    const codeBugs = results.filter((r) => r.verdict.type === "CODE_BUG").length;
    const outdatedTests = results.filter(
      (r) => r.verdict.type === "OUTDATED_TEST" || r.verdict.type === "FLAKY_TEST"
    ).length;
    const passed = results.filter((r) => r.verdict.type === "PASSED").length;
    const envIssues = results.filter((r) => r.verdict.type === "ENVIRONMENT_ISSUE").length;

    // Estimate time saved (rough heuristic: 15 min per issue diagnosed)
    const timeSaved = (codeBugs + outdatedTests) * 15;

    console.log();
    console.log(chalk.gray(BOX.HEAVY_HORIZONTAL.repeat(this.boxWidth)));
    console.log(chalk.bold(`${EMOJI.CHART} SUMMARY`));
    console.log(chalk.gray(BOX.HEAVY_HORIZONTAL.repeat(this.boxWidth)));
    console.log();
    console.log(`  ${EMOJI.BUG} ${chalk.red("Code bugs:")}        ${chalk.red.bold(codeBugs)}`);
    console.log(`  ${EMOJI.SCROLL} ${chalk.yellow("Outdated tests:")}  ${chalk.yellow.bold(outdatedTests)}`);
    console.log(`  ${EMOJI.CHECK} ${chalk.green("Passed:")}          ${chalk.green.bold(passed)}`);

    if (envIssues > 0) {
      console.log(`  ${EMOJI.GLOBE} ${chalk.gray("Environment:")}     ${chalk.gray.bold(envIssues)}`);
    }

    console.log();

    if (timeSaved > 0) {
      console.log(
        chalk.cyan(`  ${EMOJI.ROCKET} Estimated time saved: ~${timeSaved} minutes`)
      );
    }

    console.log(chalk.gray(BOX.HEAVY_HORIZONTAL.repeat(this.boxWidth)));
    console.log();
  }

  // ==========================================================================
  // Suggest Results
  // ==========================================================================

  private printFileSuggestions(filePath: string, suggestions: MissingTest[]): void {
    // File header
    this.printBoxLine("top");
    this.printBoxContent(`${EMOJI.PIN} File: ${chalk.cyan(filePath)}`);
    this.printBoxLine("separator");

    for (let i = 0; i < suggestions.length; i++) {
      const suggestion = suggestions[i];
      const priorityColor = this.getPriorityColor(suggestion.priority);
      const priorityIcon = this.getPriorityIcon(suggestion.priority);

      this.printBoxContent(
        `${EMOJI.TARGET} ${chalk.bold(suggestion.methodName)}() @ line ${suggestion.lineNumber}`
      );
      this.printBoxContent(
        `   ${priorityIcon} Priority: ${priorityColor(suggestion.priority)}`
      );
      this.printBoxContent(
        `   ${EMOJI.MICROSCOPE} Pattern: ${chalk.cyan(suggestion.pattern)}`
      );
      this.printBoxContent(`   ${EMOJI.BULB} ${suggestion.rationale}`);

      if (suggestion.suggestedTest) {
        this.printBoxContent("");
        this.printBoxContent(`   ${chalk.gray("Suggested test:")}`);
        const testLines = suggestion.suggestedTest.split("\n");
        for (const line of testLines) {
          this.printBoxContent(chalk.green(`   ${line}`));
        }
      }

      if (i < suggestions.length - 1) {
        this.printBoxContent("");
        this.printBoxContent(chalk.gray("   " + BOX.HORIZONTAL.repeat(this.boxWidth - 10)));
        this.printBoxContent("");
      }
    }

    this.printBoxLine("bottom");
    console.log();
  }

  private printSuggestSummary(suggestions: MissingTest[]): void {
    const critical = suggestions.filter((s) => s.priority === "CRITICAL").length;
    const high = suggestions.filter((s) => s.priority === "HIGH").length;
    const medium = suggestions.filter((s) => s.priority === "MEDIUM").length;
    const low = suggestions.filter((s) => s.priority === "LOW").length;

    const byPattern = new Map<string, number>();
    for (const s of suggestions) {
      byPattern.set(s.pattern, (byPattern.get(s.pattern) ?? 0) + 1);
    }

    console.log();
    console.log(chalk.gray(BOX.HEAVY_HORIZONTAL.repeat(this.boxWidth)));
    console.log(chalk.bold(`${EMOJI.CHART} MISSING TEST SUMMARY`));
    console.log(chalk.gray(BOX.HEAVY_HORIZONTAL.repeat(this.boxWidth)));
    console.log();
    console.log(`  ${EMOJI.FIRE} ${chalk.red("CRITICAL:")}  ${chalk.red.bold(critical)}`);
    console.log(`  ${EMOJI.WARNING} ${chalk.yellow("HIGH:")}      ${chalk.yellow.bold(high)}`);
    console.log(`  ${EMOJI.BULB} ${chalk.blue("MEDIUM:")}    ${chalk.blue.bold(medium)}`);
    console.log(`  ${EMOJI.CHECK} ${chalk.gray("LOW:")}       ${chalk.gray.bold(low)}`);
    console.log();

    console.log(chalk.bold("  By pattern:"));
    for (const [pattern, count] of byPattern) {
      console.log(`    ${chalk.cyan(pattern)}: ${count}`);
    }

    console.log();
    console.log(chalk.gray(BOX.HEAVY_HORIZONTAL.repeat(this.boxWidth)));
    console.log();

    if (critical > 0) {
      console.log(
        chalk.red.bold(`  ${EMOJI.FIRE} ${critical} CRITICAL missing test(s) require immediate attention!`)
      );
      console.log();
    }
  }

  // ==========================================================================
  // Box Drawing Helpers
  // ==========================================================================

  private printBoxLine(type: "top" | "bottom" | "separator"): void {
    const innerWidth = this.boxWidth - 2;

    switch (type) {
      case "top":
        console.log(
          chalk.gray(
            BOX.TOP_LEFT + BOX.HORIZONTAL.repeat(innerWidth) + BOX.TOP_RIGHT
          )
        );
        break;
      case "bottom":
        console.log(
          chalk.gray(
            BOX.BOTTOM_LEFT + BOX.HORIZONTAL.repeat(innerWidth) + BOX.BOTTOM_RIGHT
          )
        );
        break;
      case "separator":
        console.log(
          chalk.gray(
            BOX.T_RIGHT + BOX.HORIZONTAL.repeat(innerWidth) + BOX.T_LEFT
          )
        );
        break;
    }
  }

  private printBoxContent(content: string): void {
    // Use visible width that accounts for emoji width
    const visibleWidth = this.getVisibleWidth(content);
    const padding = Math.max(0, this.boxWidth - 4 - visibleWidth);

    console.log(
      chalk.gray(BOX.VERTICAL) +
        "  " +
        content +
        " ".repeat(padding) +
        " " +
        chalk.gray(BOX.VERTICAL)
    );
  }

  private stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
  }

  /**
   * Calculate visible width accounting for emojis (which are 2 chars wide in terminal)
   * Handles variation selectors, zero-width joiners, and combined sequences
   */
  private getVisibleWidth(str: string): number {
    const stripped = this.stripAnsi(str);
    let width = 0;

    // Use Array.from to properly handle surrogate pairs
    const chars = Array.from(stripped);

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const code = char.codePointAt(0) ?? 0;

      // Skip zero-width characters
      if (
        code === 0xFE0F ||  // Variation Selector-16 (emoji presentation)
        code === 0xFE0E ||  // Variation Selector-15 (text presentation)
        code === 0x200D ||  // Zero Width Joiner
        code === 0x200B ||  // Zero Width Space
        code === 0x200C ||  // Zero Width Non-Joiner
        code === 0x200E ||  // Left-to-Right Mark
        code === 0x200F     // Right-to-Left Mark
      ) {
        continue;
      }

      // Emoji and wide character ranges (width 2)
      if (
        code >= 0x1F300 && code <= 0x1F9FF || // Misc Symbols, Emoticons, Dingbats, etc.
        code >= 0x2600 && code <= 0x26FF ||   // Misc Symbols (☀️, ⚠️, etc.)
        code >= 0x2700 && code <= 0x27BF ||   // Dingbats (✅, ❌, etc.)
        code >= 0x1F600 && code <= 0x1F64F || // Emoticons
        code >= 0x1F680 && code <= 0x1F6FF || // Transport & Map Symbols
        code >= 0x1F1E0 && code <= 0x1F1FF || // Regional Indicator Symbols (Flags)
        code >= 0x231A && code <= 0x231B ||   // Watch, Hourglass
        code >= 0x23E9 && code <= 0x23F3 ||   // Various symbols
        code >= 0x23F8 && code <= 0x23FA ||   // Various symbols
        code >= 0x25AA && code <= 0x25AB ||   // Squares
        code >= 0x25B6 && code <= 0x25C0 ||   // Triangles
        code >= 0x25FB && code <= 0x25FE ||   // Squares
        code >= 0x2614 && code <= 0x2615 ||   // Umbrella, Hot Beverage
        code >= 0x2648 && code <= 0x2653 ||   // Zodiac
        code >= 0x267F && code <= 0x267F ||   // Wheelchair
        code >= 0x2693 && code <= 0x2693 ||   // Anchor
        code >= 0x26A1 && code <= 0x26A1 ||   // High Voltage
        code >= 0x26AA && code <= 0x26AB ||   // Circles
        code >= 0x26BD && code <= 0x26BE ||   // Soccer, Baseball
        code >= 0x26C4 && code <= 0x26C5 ||   // Snowman, Sun
        code >= 0x26CE && code <= 0x26CE ||   // Ophiuchus
        code >= 0x26D4 && code <= 0x26D4 ||   // No Entry
        code >= 0x26EA && code <= 0x26EA ||   // Church
        code >= 0x26F2 && code <= 0x26F3 ||   // Fountain, Golf
        code >= 0x26F5 && code <= 0x26F5 ||   // Sailboat
        code >= 0x26FA && code <= 0x26FA ||   // Tent
        code >= 0x26FD && code <= 0x26FD ||   // Fuel Pump
        code >= 0x2702 && code <= 0x2702 ||   // Scissors
        code >= 0x2705 && code <= 0x2705 ||   // Check Mark
        code >= 0x2708 && code <= 0x270D ||   // Airplane to Writing Hand
        code >= 0x270F && code <= 0x270F ||   // Pencil
        code >= 0x2712 && code <= 0x2712 ||   // Black Nib
        code >= 0x2714 && code <= 0x2714 ||   // Check Mark
        code >= 0x2716 && code <= 0x2716 ||   // X Mark
        code >= 0x271D && code <= 0x271D ||   // Latin Cross
        code >= 0x2721 && code <= 0x2721 ||   // Star of David
        code >= 0x2728 && code <= 0x2728 ||   // Sparkles
        code >= 0x2733 && code <= 0x2734 ||   // Eight Spoked Asterisk
        code >= 0x2744 && code <= 0x2744 ||   // Snowflake
        code >= 0x2747 && code <= 0x2747 ||   // Sparkle
        code >= 0x274C && code <= 0x274C ||   // Cross Mark
        code >= 0x274E && code <= 0x274E ||   // Cross Mark
        code >= 0x2753 && code <= 0x2755 ||   // Question Marks
        code >= 0x2757 && code <= 0x2757 ||   // Exclamation Mark
        code >= 0x2763 && code <= 0x2764 ||   // Heart Exclamation, Heart
        code >= 0x2795 && code <= 0x2797 ||   // Plus, Minus, Divide
        code >= 0x27A1 && code <= 0x27A1 ||   // Right Arrow
        code >= 0x27B0 && code <= 0x27B0 ||   // Curly Loop
        code >= 0x27BF && code <= 0x27BF ||   // Double Curly Loop
        code >= 0x2934 && code <= 0x2935 ||   // Arrows
        code >= 0x2B05 && code <= 0x2B07 ||   // Arrows
        code >= 0x2B1B && code <= 0x2B1C ||   // Squares
        code >= 0x2B50 && code <= 0x2B50 ||   // Star
        code >= 0x2B55 && code <= 0x2B55 ||   // Circle
        code >= 0x3030 && code <= 0x3030 ||   // Wavy Dash
        code >= 0x303D && code <= 0x303D ||   // Part Alternation Mark
        code >= 0x3297 && code <= 0x3297 ||   // Circled Ideograph Congratulation
        code >= 0x3299 && code <= 0x3299      // Circled Ideograph Secret
      ) {
        width += 2;
      } else {
        width += 1;
      }
    }
    return width;
  }

  // ==========================================================================
  // Color & Icon Helpers
  // ==========================================================================

  private getVerdictColor(type: VerdictType): ChalkFn {
    switch (type) {
      case "CODE_BUG":
        return chalk.red.bold;
      case "OUTDATED_TEST":
        return chalk.yellow.bold;
      case "FLAKY_TEST":
        return chalk.yellow;
      case "PASSED":
        return chalk.green.bold;
      case "ENVIRONMENT_ISSUE":
        return chalk.gray;
    }
  }

  private getVerdictIcon(type: VerdictType): string {
    switch (type) {
      case "CODE_BUG":
        return EMOJI.BUG;
      case "OUTDATED_TEST":
        return EMOJI.SCROLL;
      case "FLAKY_TEST":
        return EMOJI.DICE;
      case "PASSED":
        return EMOJI.CHECK;
      case "ENVIRONMENT_ISSUE":
        return EMOJI.GLOBE;
    }
  }

  private getVerdictLabel(type: VerdictType): string {
    switch (type) {
      case "CODE_BUG":
        return "CODE BUG";
      case "OUTDATED_TEST":
        return "OUTDATED TEST";
      case "FLAKY_TEST":
        return "FLAKY TEST";
      case "PASSED":
        return "PASSED";
      case "ENVIRONMENT_ISSUE":
        return "ENVIRONMENT ISSUE";
    }
  }

  private getPriorityColor(priority: Priority): ChalkFn {
    switch (priority) {
      case "CRITICAL":
        return chalk.red.bold;
      case "HIGH":
        return chalk.yellow.bold;
      case "MEDIUM":
        return chalk.blue;
      case "LOW":
        return chalk.gray;
    }
  }

  private getPriorityIcon(priority: Priority): string {
    switch (priority) {
      case "CRITICAL":
        return EMOJI.FIRE;
      case "HIGH":
        return EMOJI.WARNING;
      case "MEDIUM":
        return EMOJI.BULB;
      case "LOW":
        return EMOJI.CHECK;
    }
  }
}

// ============================================================================
// Standalone Helper Functions
// ============================================================================

/**
 * Print a simple progress message
 */
export function printProgress(message: string): void {
  console.log(chalk.cyan(`${EMOJI.ROCKET} ${message}`));
}

/**
 * Print a success message
 */
export function printSuccess(message: string): void {
  console.log(chalk.green(`${EMOJI.CHECK} ${message}`));
}

/**
 * Print an error message
 */
export function printError(message: string): void {
  console.log(chalk.red(`${EMOJI.CROSS} ${message}`));
}

/**
 * Print a warning message
 */
export function printWarning(message: string): void {
  console.log(chalk.yellow(`${EMOJI.WARNING} ${message}`));
}

/**
 * Print the Hambugsy banner
 */
export function printBanner(): void {
  console.log();
  console.log(chalk.cyan.bold("  ╔═══════════════════════════════════════════════════════════╗"));
  console.log(chalk.cyan.bold("  ║                                                           ║"));
  console.log(chalk.cyan.bold("  ║   🍔 HAMBUGSY - Test vs Code Bug Detector 🍔              ║"));
  console.log(chalk.cyan.bold("  ║                                                           ║"));
  console.log(chalk.cyan.bold("  ║   " + chalk.white("Is it a bug in your code, or is the test outdated?") + "   ║"));
  console.log(chalk.cyan.bold("  ║   " + chalk.gray("Let Hambugsy figure it out for you!") + "                 ║"));
  console.log(chalk.cyan.bold("  ║                                                           ║"));
  console.log(chalk.cyan.bold("  ╚═══════════════════════════════════════════════════════════╝"));
  console.log();
}

// ============================================================================
// Default Export
// ============================================================================

export const consoleReporter = new ConsoleReporter();
