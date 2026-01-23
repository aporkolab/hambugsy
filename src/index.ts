import { Command } from "commander";
import chalk from "chalk";
import { analyzeCommand } from "./cli/commands/analyze.js";
import { suggestCommand } from "./cli/commands/suggest.js";
import { initCommand } from "./cli/commands/init.js";
import { fixCommand } from "./cli/commands/fix.js";

const program = new Command();

program
  .name("hambugsy")
  .description(
    chalk.yellow("🍔 The CLI that tells you WHO is wrong: your test or your code")
  )
  .version("1.0.0");

program.addCommand(analyzeCommand);
program.addCommand(suggestCommand);
program.addCommand(initCommand);
program.addCommand(fixCommand);

program.parse();
