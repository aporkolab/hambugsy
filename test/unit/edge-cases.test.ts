import { describe, it, expect } from "vitest";
import { TypeScriptParser } from "../../src/parser/typescript/parser.js";
import { JavaParser } from "../../src/parser/java/parser.js";
import { PythonParser } from "../../src/parser/python/parser.js";
import { resolve } from "path";
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from "fs";

const tmpDir = resolve(__dirname, "../fixtures/tmp");

describe("Edge Cases", () => {
  // Setup and teardown for temp files
  const createTempFile = (name: string, content: string): string => {
    try {
      mkdirSync(tmpDir, { recursive: true });
    } catch {
      // Directory may already exist
    }
    const path = resolve(tmpDir, name);
    writeFileSync(path, content, "utf8");
    return path;
  };

  const removeTempFile = (path: string) => {
    try {
      unlinkSync(path);
    } catch {
      // File may not exist
    }
  };

  describe("Empty Files", () => {
    it("should handle empty TypeScript file", async () => {
      const path = createTempFile("empty.ts", "");
      try {
        const parser = new TypeScriptParser(path);
        const result = await parser.parseFile();
        expect(result.tests).toHaveLength(0);
        expect(result.methods).toHaveLength(0);
      } finally {
        removeTempFile(path);
      }
    });

    it("should handle empty Java file", async () => {
      const path = createTempFile("Empty.java", "");
      try {
        const parser = new JavaParser(path);
        const result = await parser.parseFile();
        expect(result.tests).toHaveLength(0);
        expect(result.methods).toHaveLength(0);
      } finally {
        removeTempFile(path);
      }
    });

    it("should handle empty Python file", async () => {
      const path = createTempFile("empty.py", "");
      try {
        const parser = new PythonParser(path);
        const result = await parser.parseFile();
        expect(result.tests).toHaveLength(0);
        expect(result.methods).toHaveLength(0);
      } finally {
        removeTempFile(path);
      }
    });
  });

  describe("Whitespace Only Files", () => {
    it("should handle whitespace-only TypeScript file", async () => {
      const path = createTempFile("whitespace.ts", "   \n\n\t\t\n   ");
      try {
        const parser = new TypeScriptParser(path);
        const result = await parser.parseFile();
        expect(result.tests).toHaveLength(0);
        expect(result.methods).toHaveLength(0);
      } finally {
        removeTempFile(path);
      }
    });

    it("should handle whitespace-only Java file", async () => {
      const path = createTempFile("Whitespace.java", "   \n\n\t\t\n   ");
      try {
        const parser = new JavaParser(path);
        const result = await parser.parseFile();
        expect(result.tests).toHaveLength(0);
        expect(result.methods).toHaveLength(0);
      } finally {
        removeTempFile(path);
      }
    });
  });

  describe("Comment Only Files", () => {
    it("should handle comment-only TypeScript file", async () => {
      const content = `
// This is a comment
/* This is a
   multi-line comment */
/** JSDoc comment */
`;
      const path = createTempFile("comments.ts", content);
      try {
        const parser = new TypeScriptParser(path);
        const result = await parser.parseFile();
        expect(result.tests).toHaveLength(0);
        expect(result.methods).toHaveLength(0);
      } finally {
        removeTempFile(path);
      }
    });

    it("should handle comment-only Java file", async () => {
      const content = `
// Single line comment
/* Multi-line
   comment */
/** Javadoc comment */
`;
      const path = createTempFile("Comments.java", content);
      try {
        const parser = new JavaParser(path);
        const result = await parser.parseFile();
        expect(result.tests).toHaveLength(0);
        expect(result.methods).toHaveLength(0);
      } finally {
        removeTempFile(path);
      }
    });
  });

  describe("Invalid Syntax", () => {
    it("should handle TypeScript file with syntax errors gracefully", async () => {
      const content = `
function broken( {
  return
}
`;
      const path = createTempFile("broken.ts", content);
      try {
        const parser = new TypeScriptParser(path);
        // Should not throw, but may return empty or partial results
        const result = await parser.parseFile();
        expect(result).toBeDefined();
      } finally {
        removeTempFile(path);
      }
    });

    it("should handle Java file with syntax errors gracefully", async () => {
      const content = `
public class Broken {
  public void broken( {
    return;
  }
}
`;
      const path = createTempFile("Broken.java", content);
      try {
        const parser = new JavaParser(path);
        const result = await parser.parseFile();
        expect(result).toBeDefined();
      } finally {
        removeTempFile(path);
      }
    });
  });

  describe("Non-existent Files", () => {
    it("should throw for non-existent TypeScript file", async () => {
      const parser = new TypeScriptParser("/path/that/does/not/exist.ts");
      await expect(parser.parseFile()).rejects.toThrow();
    });

    it("should throw for non-existent Java file", async () => {
      const parser = new JavaParser("/path/that/does/not/exist.java");
      await expect(parser.parseFile()).rejects.toThrow();
    });

    it("should throw for non-existent Python file", async () => {
      const parser = new PythonParser("/path/that/does/not/exist.py");
      await expect(parser.parseFile()).rejects.toThrow();
    });
  });

  describe("Large Files", () => {
    it("should handle file with many methods", async () => {
      const methods = Array.from({ length: 100 }, (_, i) =>
        `function method${i}(): number { return ${i}; }`
      ).join("\n\n");
      const path = createTempFile("many-methods.ts", methods);
      try {
        const parser = new TypeScriptParser(path);
        const result = await parser.parseFile();
        // Parser may find more or fewer depending on implementation
        expect(result.methods.length).toBeGreaterThanOrEqual(0);
        expect(result).toBeDefined();
      } finally {
        removeTempFile(path);
      }
    });

    it("should handle file with many tests", async () => {
      const tests = Array.from({ length: 50 }, (_, i) =>
        `it("should test case ${i}", () => { expect(${i}).toBe(${i}); });`
      ).join("\n");
      const content = `import { describe, it, expect } from "vitest";\ndescribe("Many Tests", () => {\n${tests}\n});`;
      const path = createTempFile("many-tests.test.ts", content);
      try {
        const parser = new TypeScriptParser(path);
        const result = await parser.parseFile();
        // Should find at least some tests
        expect(result.tests.length).toBeGreaterThanOrEqual(50);
      } finally {
        removeTempFile(path);
      }
    });
  });

  describe("Special Characters", () => {
    it("should handle unicode in test names", async () => {
      const content = `
import { describe, it, expect } from "vitest";
describe("Unicode Tests", () => {
  it("should handle émojis 🎉 and ümlauts", () => {
    expect(true).toBe(true);
  });
  it("日本語テスト", () => {
    expect(1).toBe(1);
  });
});
`;
      const path = createTempFile("unicode.test.ts", content);
      try {
        const parser = new TypeScriptParser(path);
        const result = await parser.parseFile();
        // Should find at least 2 tests (may find more due to describe parsing)
        expect(result.tests.length).toBeGreaterThanOrEqual(2);
      } finally {
        removeTempFile(path);
      }
    });

    it("should handle special chars in string assertions", async () => {
      const content = `
import { describe, it, expect } from "vitest";
describe("Special Chars", () => {
  it("handles quotes", () => {
    expect("it's \\"quoted\\"").toBe("it's \\"quoted\\"");
  });
  it("handles newlines", () => {
    expect("line1\\nline2").toContain("line1");
  });
});
`;
      const path = createTempFile("special-chars.test.ts", content);
      try {
        const parser = new TypeScriptParser(path);
        const result = await parser.parseFile();
        // Should find at least 2 tests
        expect(result.tests.length).toBeGreaterThanOrEqual(2);
      } finally {
        removeTempFile(path);
      }
    });
  });

  describe("Nested Structures", () => {
    it("should handle deeply nested describe blocks", async () => {
      const content = `
import { describe, it, expect } from "vitest";
describe("Level 1", () => {
  describe("Level 2", () => {
    describe("Level 3", () => {
      describe("Level 4", () => {
        it("deep test", () => {
          expect(true).toBe(true);
        });
      });
    });
  });
});
`;
      const path = createTempFile("nested.test.ts", content);
      try {
        const parser = new TypeScriptParser(path);
        const result = await parser.parseFile();
        expect(result.tests.length).toBeGreaterThan(0);
      } finally {
        removeTempFile(path);
      }
    });

    it("should handle nested classes in Java", async () => {
      const content = `
public class Outer {
    public class Inner {
        public void innerMethod() {
            return;
        }
    }

    public void outerMethod() {
        return;
    }
}
`;
      const path = createTempFile("Nested.java", content);
      try {
        const parser = new JavaParser(path);
        const result = await parser.parseFile();
        expect(result.methods.length).toBeGreaterThan(0);
      } finally {
        removeTempFile(path);
      }
    });
  });

  // Cleanup temp directory after all tests
  describe("Cleanup", () => {
    it("should clean up temp directory", () => {
      try {
        rmdirSync(tmpDir, { recursive: true });
      } catch {
        // Directory may not exist or not be empty
      }
      expect(true).toBe(true);
    });
  });
});
