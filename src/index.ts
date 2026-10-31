import { createRequire } from "node:module";
import { Command } from "commander";
import chalk from "chalk";
import { printBanner, shouldPrintBanner } from "./cli/banner.js";
import { analyzeCommand } from "./cli/commands/analyze.js";
import { suggestCommand } from "./cli/commands/suggest.js";
import { initCommand } from "./cli/commands/init.js";
import { fixCommand } from "./cli/commands/fix.js";

// Resolved relative to dist/index.js (or src/index.ts in dev); package.json ships with the package
const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

if (shouldPrintBanner(process.argv.slice(2), process.stdout.isTTY)) {
  printBanner();
}

const program = new Command();

program
  .name("hambugsy")
  .description(
    chalk.yellow("The CLI that tells you WHO is wrong: your test or your code")
  )
  .version(version);

program.addCommand(analyzeCommand);
program.addCommand(suggestCommand);
program.addCommand(initCommand);
program.addCommand(fixCommand);

program.parse();
