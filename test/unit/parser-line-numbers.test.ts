import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { parsePythonFile } from "../../src/parser/python/parser.js";
import { parseJavaFile } from "../../src/parser/java/parser.js";

// Regression tests: methods preceded by blank lines used to get wrong line numbers
// (and, for Python, an empty body).

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "hambugsy-lines-"));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("parser line numbers", () => {
  it("reports Python functions after PEP 8 blank lines on their def line with their body", async () => {
    const file = join(dir, "module.py");
    await writeFile(
      file,
      ["import os", "def foo(a):", "    return a", "", "", "@staticmethod", "def bar(b):", "    return b", ""].join("\n")
    );

    const { methods } = await parsePythonFile(file);
    const foo = methods.find((m) => m.name === "foo");
    const bar = methods.find((m) => m.name === "bar");

    expect(foo?.lineNumber).toBe(2);
    expect(bar?.lineNumber).toBe(7);
    expect(bar?.body).toContain("return b");
  });

  it("reports package-private Java methods on their signature line", async () => {
    const file = join(dir, "Calc.java");
    await writeFile(
      file,
      ["package x;", "", "class Calc {", "    int add(int a, int b) {", "        return a + b;", "    }", "}", ""].join("\n")
    );

    const { methods } = await parseJavaFile(file);
    expect(methods.find((m) => m.name === "add")?.lineNumber).toBe(4);
  });
});
