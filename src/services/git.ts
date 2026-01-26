import { execa, ExecaError } from "execa";

// ============================================================================
// Types
// ============================================================================

export interface Commit {
  hash: string;
  author: string;
  date: Date;
  message: string;
}

export interface BlameInfo {
  lineNumber: number;
  commit: Commit;
}

export class GitError extends Error {
  constructor(
    message: string,
    public readonly isNotGitRepo: boolean = false
  ) {
    super(message);
    this.name = "GitError";
  }
}

// ============================================================================
// GitService
// ============================================================================

export class GitService {
  private cwd?: string;

  constructor(cwd?: string) {
    this.cwd = cwd;
  }

  // ==========================================================================
  // Repository Status
  // ==========================================================================

  async isGitRepository(): Promise<boolean> {
    try {
      await execa("git", ["rev-parse", "--git-dir"], { cwd: this.cwd });
      return true;
    } catch {
      return false;
    }
  }

  private async ensureGitRepo(): Promise<void> {
    const isRepo = await this.isGitRepository();
    if (!isRepo) {
      throw new GitError(
        "Not a git repository. Please run this command from within a git repository.",
        true
      );
    }
  }

  // ==========================================================================
  // History
  // ==========================================================================

  /**
   * Get commit history for a file
   * @param filePath - Path to the file
   * @param limit - Maximum number of commits to return (default: 50)
   */
  async getHistory(filePath: string, limit: number = 50): Promise<Commit[]> {
    await this.ensureGitRepo();

    try {
      const result = await execa(
        "git",
        [
          "log",
          `--format=%H|%an|%ai|%s`,
          `-n`,
          String(limit),
          "--",
          filePath,
        ],
        { cwd: this.cwd }
      );

      if (!result.stdout.trim()) {
        return [];
      }

      return this.parseGitLog(result.stdout);
    } catch (error) {
      // File might not exist in git history
      if (this.isFileNotFoundError(error)) {
        return [];
      }
      throw this.wrapError(error);
    }
  }

  private parseGitLog(output: string): Commit[] {
    const commits: Commit[] = [];
    const lines = output.trim().split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;

      const parts = line.split("|");
      if (parts.length >= 4) {
        commits.push({
          hash: parts[0],
          author: parts[1],
          date: new Date(parts[2]),
          message: parts.slice(3).join("|"), // Message might contain |
        });
      }
    }

    return commits;
  }

  // ==========================================================================
  // Blame
  // ==========================================================================

  /**
   * Get blame information for a range of lines
   * @param filePath - Path to the file
   * @param startLine - Start line number (1-indexed)
   * @param endLine - End line number (1-indexed)
   */
  async blame(
    filePath: string,
    startLine: number,
    endLine: number
  ): Promise<BlameInfo[]> {
    await this.ensureGitRepo();

    try {
      const result = await execa(
        "git",
        [
          "blame",
          "-L",
          `${startLine},${endLine}`,
          "--line-porcelain",
          filePath,
        ],
        { cwd: this.cwd }
      );

      return this.parseBlameOutput(result.stdout, startLine);
    } catch (error) {
      if (this.isFileNotFoundError(error)) {
        return [];
      }
      throw this.wrapError(error);
    }
  }

  private parseBlameOutput(output: string, startLine: number): BlameInfo[] {
    const blameInfos: BlameInfo[] = [];
    const lines = output.split("\n");

    let currentHash = "";
    let currentAuthor = "";
    let currentDate: Date | null = null;
    let currentMessage = "";
    let lineNumber = startLine;

    for (const line of lines) {
      // Hash line (starts with 40 char hash)
      if (/^[0-9a-f]{40}/.test(line)) {
        const parts = line.split(" ");
        currentHash = parts[0];
      }
      // Author
      else if (line.startsWith("author ")) {
        currentAuthor = line.substring(7);
      }
      // Author time (Unix timestamp)
      else if (line.startsWith("author-time ")) {
        const timestamp = parseInt(line.substring(12), 10);
        currentDate = new Date(timestamp * 1000);
      }
      // Summary (commit message)
      else if (line.startsWith("summary ")) {
        currentMessage = line.substring(8);
      }
      // Actual code line (starts with tab)
      else if (line.startsWith("\t")) {
        if (currentHash && currentDate) {
          blameInfos.push({
            lineNumber,
            commit: {
              hash: currentHash,
              author: currentAuthor,
              date: currentDate,
              message: currentMessage,
            },
          });
        }
        lineNumber++;
      }
    }

    return blameInfos;
  }

  // ==========================================================================
  // Last Modification
  // ==========================================================================

  /**
   * Get the last commit that modified a specific line
   * @param filePath - Path to the file
   * @param lineNumber - Line number (1-indexed)
   */
  async getLastModification(
    filePath: string,
    lineNumber: number
  ): Promise<Commit | null> {
    const blameInfos = await this.blame(filePath, lineNumber, lineNumber);

    if (blameInfos.length === 0) {
      return null;
    }

    return blameInfos[0].commit;
  }

  // ==========================================================================
  // Change Analysis
  // ==========================================================================

  /**
   * Determine if a commit message indicates an intentional change
   * Returns true for: feat:, refactor:, update, JIRA-123, etc.
   * Returns false for: fix:, bug, typo, oops, revert
   */
  isIntentionalChange(commitMessage: string): boolean {
    const message = commitMessage.toLowerCase();

    // Patterns that indicate unintentional/fix changes
    const fixPatterns = [
      /^fix[:\s(]/,
      /^bug[:\s(]/,
      /\btypo\b/,
      /\boops\b/,
      /^revert\b/,
      /\bhotfix\b/,
      /\bquick\s*fix\b/,
      /\bpatch\b/,
      /\bbugfix\b/,
      /\bworkaround\b/,
    ];

    for (const pattern of fixPatterns) {
      if (pattern.test(message)) {
        return false;
      }
    }

    // Patterns that indicate intentional changes
    const intentionalPatterns = [
      /^feat[:\s(]/,
      /^feature[:\s(]/,
      /^refactor[:\s(]/,
      /^update[:\s(]/,
      /^add[:\s(]/,
      /^implement[:\s(]/,
      /^improve[:\s(]/,
      /^enhance[:\s(]/,
      /^change[:\s(]/,
      /^modify[:\s(]/,
      /\bupdate\s+policy\b/,
      /\bupdate\s+logic\b/,
      /\bupdate\s+behavior\b/,
      /[A-Z]{2,}-\d+/, // JIRA-123, ABC-456, etc.
      /^perf[:\s(]/,
      /^style[:\s(]/,
      /^docs[:\s(]/,
      /^test[:\s(]/,
      /^chore[:\s(]/,
      /^build[:\s(]/,
      /^ci[:\s(]/,
    ];

    for (const pattern of intentionalPatterns) {
      if (pattern.test(message)) {
        return true;
      }
    }

    // Default: assume intentional if no specific pattern matched
    return true;
  }

  // ==========================================================================
  // Comparison Helpers
  // ==========================================================================

  /**
   * Compare which file was modified more recently
   * Returns positive if file1 was modified after file2
   */
  async compareLastModification(
    file1Path: string,
    file2Path: string
  ): Promise<{ moreRecent: string; file1Date: Date | null; file2Date: Date | null }> {
    const [history1, history2] = await Promise.all([
      this.getHistory(file1Path, 1),
      this.getHistory(file2Path, 1),
    ]);

    const file1Date = history1[0]?.date ?? null;
    const file2Date = history2[0]?.date ?? null;

    let moreRecent = "";
    if (file1Date && file2Date) {
      moreRecent = file1Date > file2Date ? file1Path : file2Path;
    } else if (file1Date) {
      moreRecent = file1Path;
    } else if (file2Date) {
      moreRecent = file2Path;
    }

    return { moreRecent, file1Date, file2Date };
  }

  /**
   * Get commits that modified both files (potential related changes)
   */
  async findRelatedCommits(
    file1Path: string,
    file2Path: string,
    limit: number = 20
  ): Promise<Commit[]> {
    const [history1, history2] = await Promise.all([
      this.getHistory(file1Path, limit),
      this.getHistory(file2Path, limit),
    ]);

    const hashes1 = new Set(history1.map((c) => c.hash));
    return history2.filter((c) => hashes1.has(c.hash));
  }

  // ==========================================================================
  // Diff
  // ==========================================================================

  /**
   * Get the diff for a specific commit and file
   */
  async getDiff(
    filePath: string,
    commitHash: string
  ): Promise<string> {
    await this.ensureGitRepo();

    try {
      const result = await execa(
        "git",
        ["show", "--format=", "--", filePath, commitHash],
        { cwd: this.cwd }
      );
      return result.stdout;
    } catch (error) {
      if (this.isFileNotFoundError(error)) {
        return "";
      }
      throw this.wrapError(error);
    }
  }

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  private isFileNotFoundError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes("does not exist") ||
        message.includes("no such file") ||
        message.includes("pathspec")
      );
    }
    return false;
  }

  private wrapError(error: unknown): GitError {
    if (error instanceof GitError) {
      return error;
    }

    if (error instanceof Error) {
      const execaError = error as ExecaError;

      if (execaError.exitCode === 128) {
        return new GitError("Git command failed: " + error.message);
      }

      return new GitError(error.message);
    }

    return new GitError(String(error));
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let defaultService: GitService | null = null;

export function getGitService(cwd?: string): GitService {
  if (!defaultService || cwd) {
    defaultService = new GitService(cwd);
  }
  return defaultService;
}
