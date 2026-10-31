import chalk from "chalk";
import figlet from "figlet";

// ============================================================================
// ASCII Art Banner
// ============================================================================

export function printBanner(): void {
  const banner = figlet.textSync("HAMBUGSY", { font: "Standard" });

  // Color each line with gradient
  const colors = [chalk.red, chalk.yellow, chalk.green, chalk.cyan, chalk.blue, chalk.magenta];
  const lines = banner.split("\n");

  console.log();
  lines.forEach((line, i) => {
    const color = colors[i % colors.length];
    console.log(color(line));
  });
  console.log();
  console.log(chalk.gray("  Who is wrong: your ") + chalk.red.bold("test") + chalk.gray(" or your ") + chalk.blue.bold("code") + chalk.gray("?"));
  console.log();
}

/**
 * The banner is decoration for humans: skip it when stdout is piped or when a
 * machine-readable format is requested, so JSON/Markdown/GitHub output stays parseable.
 */
export function shouldPrintBanner(argv: string[], isTTY: boolean | undefined): boolean {
  if (!isTTY) return false;
  const machineFormats = new Set(["json", "github", "markdown"]);
  return !argv.some((arg, i) => {
    if (arg.startsWith("--format=")) return machineFormats.has(arg.slice("--format=".length));
    return arg === "--format" && machineFormats.has(argv[i + 1] ?? "");
  });
}
