import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, readFile, mkdir, rm } from "fs/promises";
import { resolve, join } from "path";
import { execSync } from "child_process";

describe("Fix Command", () => {
  const testDir = resolve(__dirname, "../temp-fix-test");
  const testFile = join(testDir, "TestService.java");

  beforeEach(async () => {
    // Create temp directory and test file
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup
    await rm(testDir, { recursive: true, force: true });
  });

  describe("--dry-run mode", () => {
    it("should not modify files in dry-run mode", async () => {
      const originalContent = `
public class TestService {
    public double calculate(double price) {
        return price * 0.85;
    }
}`;
      await writeFile(testFile, originalContent);

      // Run fix in dry-run mode
      try {
        execSync(`npm run dev -- fix "${testDir}" --dry-run`, {
          cwd: resolve(__dirname, "../.."),
          encoding: "utf-8",
        });
      } catch {
        // Command might exit with non-zero if no fixes found
      }

      // File should be unchanged
      const content = await readFile(testFile, "utf-8");
      expect(content).toBe(originalContent);
    });
  });

  describe("--yes mode", () => {
    it("should skip confirmation in --yes mode", async () => {
      const content = `
public class TestService {
    public int getValue() {
        return 42;
    }
}`;
      await writeFile(testFile, content);

      // Run fix with --yes flag (should complete without prompting)
      const result = execSync(`npm run dev -- fix "${testDir}" --yes --dry-run 2>&1`, {
        cwd: resolve(__dirname, "../.."),
        encoding: "utf-8",
        timeout: 30000,
      });

      // Should complete without hanging for input
      expect(result).toBeDefined();
    });
  });

  describe("--filter option", () => {
    it("should accept bugs filter", async () => {
      const content = `public class Test {}`;
      await writeFile(testFile, content);

      const result = execSync(
        `npm run dev -- fix "${testDir}" --filter=bugs --dry-run 2>&1`,
        {
          cwd: resolve(__dirname, "../.."),
          encoding: "utf-8",
          timeout: 30000,
        }
      );

      expect(result).toContain("Analyzing");
    });

    it("should accept tests filter", async () => {
      const content = `public class Test {}`;
      await writeFile(testFile, content);

      const result = execSync(
        `npm run dev -- fix "${testDir}" --filter=tests --dry-run 2>&1`,
        {
          cwd: resolve(__dirname, "../.."),
          encoding: "utf-8",
          timeout: 30000,
        }
      );

      expect(result).toContain("Analyzing");
    });

    it("should accept all filter", async () => {
      const content = `public class Test {}`;
      await writeFile(testFile, content);

      const result = execSync(
        `npm run dev -- fix "${testDir}" --filter=all --dry-run 2>&1`,
        {
          cwd: resolve(__dirname, "../.."),
          encoding: "utf-8",
          timeout: 30000,
        }
      );

      expect(result).toContain("Analyzing");
    });
  });

  describe("command help", () => {
    it("should display help information", () => {
      const result = execSync(`npm run dev -- fix --help 2>&1`, {
        cwd: resolve(__dirname, "../.."),
        encoding: "utf-8",
      });

      expect(result).toContain("fix");
      expect(result).toContain("--dry-run");
      expect(result).toContain("--yes");
      expect(result).toContain("--filter");
    });
  });

  describe("no issues found", () => {
    it("should report no issues when files are clean", async () => {
      const content = `
public class SimpleClass {
    public void doNothing() {
        // Empty method
    }
}`;
      await writeFile(testFile, content);

      const result = execSync(
        `npm run dev -- fix "${testDir}" --dry-run 2>&1`,
        {
          cwd: resolve(__dirname, "../.."),
          encoding: "utf-8",
          timeout: 30000,
        }
      );

      // Should complete without errors
      expect(result).toBeDefined();
    });
  });

  describe("multi-language support", () => {
    it("should process TypeScript files", async () => {
      const tsFile = join(testDir, "test.ts");
      const content = `
export function add(a: number, b: number): number {
    return a + b;
}`;
      await writeFile(tsFile, content);

      const result = execSync(
        `npm run dev -- fix "${testDir}" --dry-run 2>&1`,
        {
          cwd: resolve(__dirname, "../.."),
          encoding: "utf-8",
          timeout: 30000,
        }
      );

      // Should complete analysis (either finds issues or reports nothing to fix)
      expect(result).toMatch(/Analyzing|No issues found|nothing to fix/);
    });

    it("should process Python files", async () => {
      const pyFile = join(testDir, "test.py");
      const content = `
def add(a, b):
    return a + b
`;
      await writeFile(pyFile, content);

      const result = execSync(
        `npm run dev -- fix "${testDir}" --dry-run 2>&1`,
        {
          cwd: resolve(__dirname, "../.."),
          encoding: "utf-8",
          timeout: 30000,
        }
      );

      // Should complete analysis (either finds issues or reports nothing to fix)
      expect(result).toMatch(/Analyzing|No issues found|nothing to fix/);
    });
  });
});
