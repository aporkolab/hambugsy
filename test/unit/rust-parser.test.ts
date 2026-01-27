import { describe, it, expect, beforeAll } from "vitest";
import { RustParser } from "../../src/parser/rust/parser.js";
import { resolve } from "path";

describe("RustParser", () => {
  const fixturesPath = resolve(__dirname, "../fixtures/rust");

  describe("parseFile - calculator.rs", () => {
    let parseResult: Awaited<ReturnType<RustParser["parseFile"]>>;

    beforeAll(async () => {
      const parser = new RustParser(resolve(fixturesPath, "calculator.rs"));
      parseResult = await parser.parseFile();
    });

    it("should extract source methods", () => {
      expect(parseResult.methods.length).toBeGreaterThan(0);
    });

    it("should find add method", () => {
      const method = parseResult.methods.find((m) => m.name === "add");
      expect(method).toBeDefined();
    });

    it("should find divide method with Result return type", () => {
      const method = parseResult.methods.find((m) => m.name === "divide");
      expect(method).toBeDefined();
    });

    it("should find apply_discount function", () => {
      const method = parseResult.methods.find((m) => m.name === "apply_discount");
      expect(method).toBeDefined();
    });

    it("should extract method parameters", () => {
      const method = parseResult.methods.find((m) => m.name === "add");
      expect(method?.parameters.length).toBeGreaterThan(0);
    });

    it("should capture line numbers", () => {
      const method = parseResult.methods.find((m) => m.name === "add");
      expect(method?.lineNumber).toBeGreaterThan(0);
      expect(method?.endLine).toBeGreaterThan(method!.lineNumber);
    });

    it("should extract test cases from #[test] attributes", () => {
      expect(parseResult.tests.length).toBeGreaterThan(0);
    });

    it("should find test_add test", () => {
      const test = parseResult.tests.find((t) => t.name === "test_add");
      expect(test).toBeDefined();
      expect(test?.framework).toBe("rust-test");
    });

    it("should find test_divide test", () => {
      const test = parseResult.tests.find((t) => t.name === "test_divide");
      expect(test).toBeDefined();
    });

    it("should find test_divide_by_zero test", () => {
      const test = parseResult.tests.find((t) => t.name === "test_divide_by_zero");
      expect(test).toBeDefined();
    });

    it("should extract assert_eq! assertions", () => {
      const test = parseResult.tests.find((t) => t.name === "test_add");
      const assertion = test?.assertions.find((a) => a.type === "equals");
      expect(assertion).toBeDefined();
    });

    it("should extract .unwrap() assertions", () => {
      const test = parseResult.tests.find((t) => t.name === "test_divide");
      const assertion = test?.assertions.find((a) => a.raw.includes("unwrap"));
      expect(assertion).toBeDefined();
    });

    it("should extract .is_err() assertions", () => {
      const test = parseResult.tests.find((t) => t.name === "test_divide_by_zero");
      expect(test?.assertions.length).toBeGreaterThan(0);
    });

    it("should detect rust-test framework", () => {
      parseResult.tests.forEach((test) => {
        expect(["rust-test", "tokio-test"]).toContain(test.framework);
      });
    });

    it("should find panic test with #[should_panic]", () => {
      const test = parseResult.tests.find((t) => t.name === "test_panic_example");
      expect(test).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should handle file not found gracefully", async () => {
      const parser = new RustParser("/nonexistent/file.rs");
      await expect(parser.parseFile()).rejects.toThrow();
    });
  });
});
