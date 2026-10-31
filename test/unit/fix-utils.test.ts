import { describe, it, expect } from "vitest";
import { applyLineFix, replaceExpectedValue } from "../../src/cli/fix-utils.js";

describe("replaceExpectedValue", () => {
  it("replaces only the expected argument of assertEquals", () => {
    expect(replaceExpectedValue("assertEquals(90, svc.discount(90));", "90", "85")).toBe(
      "assertEquals(85, svc.discount(90));"
    );
  });

  it("replaces the matcher argument of fluent assertions, not the call under test", () => {
    expect(replaceExpectedValue("expect(discount(90)).toBe(90);", "90", "85")).toBe(
      "expect(discount(90)).toBe(85);"
    );
    expect(replaceExpectedValue("assertThat(price(90)).isEqualTo(90.0);", "90", "85")).toBe(
      "assertThat(price(90)).isEqualTo(85.0);"
    );
  });

  it("keeps the .0 suffix of floating point literals", () => {
    expect(replaceExpectedValue("assertEquals(90.0, result, 0.01);", "90", "85")).toBe(
      "assertEquals(85.0, result, 0.01);"
    );
  });

  it("treats the expected value literally instead of as a regex", () => {
    expect(replaceExpectedValue("assertEquals(0x9, v); assertEquals(0.9, w);", "0.9", "0.8")).toBe(
      "assertEquals(0x9, v); assertEquals(0.8, w);"
    );
  });

  it("does not touch numbers that only contain the value", () => {
    expect(replaceExpectedValue("assertEquals(190, total);", "90", "85")).toBe("assertEquals(190, total);");
    expect(replaceExpectedValue("assertEquals(90.5, total);", "90", "85")).toBe("assertEquals(90.5, total);");
  });
});

describe("applyLineFix", () => {
  const content = [
    "class T {",
    "  // assertEquals(90, value);",
    "  void test() {",
    "    assertEquals(90, value);",
    "  }",
    "}",
  ].join("\n");

  it("edits the reported line, not the first textual match", () => {
    const result = applyLineFix(content, {
      lineNumber: 4,
      originalLine: "assertEquals(90, value);",
      suggestedLine: "assertEquals(85, value);",
    });
    expect(result?.split("\n")[1]).toBe("  // assertEquals(90, value);");
    expect(result?.split("\n")[3]).toBe("    assertEquals(85, value);");
  });

  it("returns null when the line no longer contains the original text", () => {
    expect(
      applyLineFix(content, { lineNumber: 3, originalLine: "assertEquals(90, value);", suggestedLine: "x" })
    ).toBeNull();
    expect(
      applyLineFix(content, { lineNumber: 99, originalLine: "assertEquals(90, value);", suggestedLine: "x" })
    ).toBeNull();
  });

  it("falls back to the first match without $-pattern expansion when the line is unknown", () => {
    const result = applyLineFix("a = 1;\nb = 2;", {
      lineNumber: 0,
      originalLine: "b = 2;",
      suggestedLine: "b = '$&';",
    });
    expect(result).toBe("a = 1;\nb = '$&';");
  });

  it("preserves CRLF line endings", () => {
    const result = applyLineFix("x\r\n  assertEquals(1, y);\r\nz", {
      lineNumber: 2,
      originalLine: "assertEquals(1, y);",
      suggestedLine: "assertEquals(2, y);",
    });
    expect(result).toBe("x\r\n  assertEquals(2, y);\r\nz");
  });
});
