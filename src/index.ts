import { Command } from "commander";
import chalk from "chalk";
import figlet from "figlet";
import { analyzeCommand } from "./cli/commands/analyze.js";
import { suggestCommand } from "./cli/commands/suggest.js";
import { initCommand } from "./cli/commands/init.js";
import { fixCommand } from "./cli/commands/fix.js";

// ============================================================================
// ASCII Art Banner
// ============================================================================

function printBanner(): void {
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

// Print banner on CLI start
printBanner();

const program = new Command();

program
  .name("hambugsy")
  .description(
    chalk.yellow("The CLI that tells you WHO is wrong: your test or your code")
  )
  .version("1.0.0");

program.addCommand(analyzeCommand);
program.addCommand(suggestCommand);
program.addCommand(initCommand);
program.addCommand(fixCommand);

program.parse();
