import { describe, it, expect, beforeAll } from "vitest";
import { CSharpParser } from "../../src/parser/csharp/parser.js";
import { resolve } from "path";

describe("CSharpParser", () => {
  const fixturesPath = resolve(__dirname, "../fixtures/csharp");

  describe("parseFile - Calculator.cs", () => {
    let parseResult: Awaited<ReturnType<CSharpParser["parseFile"]>>;

    beforeAll(async () => {
      const parser = new CSharpParser(resolve(fixturesPath, "Calculator.cs"));
      parseResult = await parser.parseFile();
    });

    it("should extract source methods", () => {
      expect(parseResult.methods.length).toBeGreaterThan(0);
    });

    it("should find Add method", () => {
      const method = parseResult.methods.find((m) => m.name === "Add");
      expect(method).toBeDefined();
      expect(method?.returnType).toContain("double");
    });

    it("should find Subtract method", () => {
      const method = parseResult.methods.find((m) => m.name === "Subtract");
      expect(method).toBeDefined();
    });

    it("should find Divide method", () => {
      const method = parseResult.methods.find((m) => m.name === "Divide");
      expect(method).toBeDefined();
    });

    it("should find static ApplyDiscount method", () => {
      const method = parseResult.methods.find((m) => m.name === "ApplyDiscount");
      expect(method).toBeDefined();
    });

    it("should extract method parameters", () => {
      const method = parseResult.methods.find((m) => m.name === "Add");
      expect(method?.parameters.length).toBe(2);
      expect(method?.parameters[0].name).toBe("a");
      expect(method?.parameters[0].type).toBe("double");
    });

    it("should capture line numbers", () => {
      const method = parseResult.methods.find((m) => m.name === "Add");
      expect(method?.lineNumber).toBeGreaterThan(0);
      expect(method?.endLine).toBeGreaterThan(method!.lineNumber);
    });

    it("should extract method body", () => {
      const method = parseResult.methods.find((m) => m.name === "Add");
      expect(method?.body).toContain("return");
    });

    it("should detect class name", () => {
      const method = parseResult.methods.find((m) => m.name === "Add");
      expect(method?.className).toBe("Calculator");
    });
  });

  describe("parseFile - CalculatorTests.cs", () => {
    let parseResult: Awaited<ReturnType<CSharpParser["parseFile"]>>;

    beforeAll(async () => {
      const parser = new CSharpParser(resolve(fixturesPath, "CalculatorTests.cs"));
      parseResult = await parser.parseFile();
    });

    it("should extract test cases", () => {
      expect(parseResult.tests.length).toBeGreaterThan(0);
    });

    it("should find NUnit [Test] tests", () => {
      const test = parseResult.tests.find((t) =>
        t.name === "Add_TwoNumbers_ReturnsSum" && t.framework === "nunit"
      );
      expect(test).toBeDefined();
    });

    it("should find xUnit [Fact] tests", () => {
      const tests = parseResult.tests.filter((t) => t.framework === "xunit");
      expect(tests.length).toBeGreaterThan(0);
    });

    it("should find MSTest [TestMethod] tests", () => {
      const tests = parseResult.tests.filter((t) => t.framework === "mstest");
      expect(tests.length).toBeGreaterThan(0);
    });

    it("should extract Assert.AreEqual assertions (NUnit)", () => {
      const test = parseResult.tests.find((t) =>
        t.framework === "nunit" && t.name.includes("Add")
      );
      const assertion = test?.assertions.find((a) => a.type === "equals");
      expect(assertion).toBeDefined();
    });

    it("should extract Assert.That assertions (NUnit)", () => {
      const test = parseResult.tests.find((t) => t.name.includes("Subtract"));
      const assertion = test?.assertions.find((a) => a.type === "equals");
      expect(assertion).toBeDefined();
    });

    it("should extract Assert.Equal assertions (xUnit)", () => {
      const test = parseResult.tests.find((t) =>
        t.framework === "xunit" && t.name.includes("Add")
      );
      const assertion = test?.assertions.find((a) => a.type === "equals");
      expect(assertion).toBeDefined();
    });

    it("should extract Assert.Throws assertions", () => {
      const test = parseResult.tests.find((t) => t.name.includes("ByZero"));
      const assertion = test?.assertions.find((a) => a.type === "throws");
      expect(assertion).toBeDefined();
    });

    it("should extract FluentAssertions .Should().Be()", () => {
      const test = parseResult.tests.find((t) =>
        t.body.includes("Should().Be")
      );
      if (test) {
        const assertion = test.assertions.find((a) => a.type === "equals");
        expect(assertion).toBeDefined();
      }
    });

    it("should extract FluentAssertions .Should().BeTrue()", () => {
      const test = parseResult.tests.find((t) =>
        t.body.includes("Should().BeTrue")
      );
      if (test) {
        const assertion = test.assertions.find((a) => a.type === "truthy");
        expect(assertion).toBeDefined();
      }
    });

    it("should capture assertion line numbers", () => {
      const allAssertions = parseResult.tests.flatMap((t) => t.assertions);
      allAssertions.forEach((assertion) => {
        expect(assertion.lineNumber).toBeGreaterThan(0);
      });
    });
  });

  describe("edge cases", () => {
    it("should handle file not found gracefully", async () => {
      const parser = new CSharpParser("/nonexistent/file.cs");
      await expect(parser.parseFile()).rejects.toThrow();
    });
  });

  describe("framework detection", () => {
    let parseResult: Awaited<ReturnType<CSharpParser["parseFile"]>>;

    beforeAll(async () => {
      const parser = new CSharpParser(resolve(fixturesPath, "CalculatorTests.cs"));
      parseResult = await parser.parseFile();
    });

    it("should detect NUnit framework from [Test] attribute", () => {
      const nunitTests = parseResult.tests.filter((t) => t.framework === "nunit");
      expect(nunitTests.length).toBeGreaterThan(0);
    });

    it("should detect xUnit framework from [Fact] attribute", () => {
      const xunitTests = parseResult.tests.filter((t) => t.framework === "xunit");
      expect(xunitTests.length).toBeGreaterThan(0);
    });

    it("should detect MSTest framework from [TestMethod] attribute", () => {
      const mstestTests = parseResult.tests.filter((t) => t.framework === "mstest");
      expect(mstestTests.length).toBeGreaterThan(0);
    });
  });
});
