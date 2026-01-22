import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { writeFile } from "fs/promises";
import { join } from "path";
import YAML from "yaml";
import type { HambugsyConfig } from "../../core/types.js";

interface InitOptions {
  language?: string;
  force?: boolean;
}

export const initCommand = new Command("init")
  .description("Initialize Hambugsy configuration in the current project")
  .option("-l, --language <lang>", "Project language (java, typescript, python)", "java")
  .option("-f, --force", "Overwrite existing configuration")
  .action(async (options: InitOptions) => {
    const spinner = ora("Initializing Hambugsy...").start();

    try {
      const config: HambugsyConfig = {
        language: (options.language as HambugsyConfig["language"]) ?? "java",
        sourceDir: "src/main",
        testDir: "src/test",
        excludePatterns: ["**/node_modules/**", "**/build/**", "**/target/**"],
      };

      const yamlContent = YAML.stringify(config);
      const configPath = join(process.cwd(), ".hambugsy.yml");

      await writeFile(configPath, yamlContent, "utf-8");

      spinner.succeed("Hambugsy initialized");
      console.log(chalk.gray(`\nConfiguration written to: ${configPath}`));
      console.log(chalk.green("\nYou can now run:"));
      console.log(chalk.cyan("  hambugsy analyze"));
    } catch (error) {
      spinner.fail("Initialization failed");
      console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  });
