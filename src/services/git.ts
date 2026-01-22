import { execa } from "execa";

export class GitService {
  async getRecentChanges(filePath: string, lines?: number): Promise<string> {
    try {
      const result = await execa("git", [
        "log",
        "-p",
        "-n",
        String(lines ?? 5),
        "--",
        filePath,
      ]);
      return result.stdout;
    } catch {
      return "";
    }
  }

  async getBlame(filePath: string, lineNumber: number): Promise<string> {
    try {
      const result = await execa("git", [
        "blame",
        "-L",
        `${lineNumber},${lineNumber}`,
        filePath,
      ]);
      return result.stdout;
    } catch {
      return "";
    }
  }

  async isGitRepository(): Promise<boolean> {
    try {
      await execa("git", ["rev-parse", "--git-dir"]);
      return true;
    } catch {
      return false;
    }
  }
}
