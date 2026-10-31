// ============================================================================
// Text helpers for the fix command (pure, unit tested)
// ============================================================================

export interface LineFix {
  /** 1-based line number, or 0 when unknown */
  lineNumber: number;
  originalLine: string;
  suggestedLine: string;
}

/** Fluent matchers whose argument is the expected value (`expect(x).toBe(90)`, `assertThat(x).isEqualTo(90)`). */
const EXPECTATION_MATCHER = /\.(toBe|toEqual|toStrictEqual|toBeCloseTo|isEqualTo)\s*\(/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replaces the expected value of an assertion line with the actual one, touching only the
 * expected-value position: the argument of a fluent matcher when there is one, otherwise the
 * first occurrence (JUnit/xUnit `assertEquals(expected, actual)` order). Other occurrences of
 * the same number, e.g. inside the call under test, stay unchanged. A trailing `.0` is kept.
 */
export function replaceExpectedValue(line: string, expected: string, actual: string): string {
  let regionStart = 0;
  for (const match of line.matchAll(EXPECTATION_MATCHER)) {
    regionStart = (match.index ?? 0) + match[0].length;
  }

  const pattern = new RegExp(`(?<![\\w.])${escapeRegExp(expected)}(\\.0+)?(?![\\w.])`);
  const region = line.slice(regionStart);
  const replaced = region.replace(pattern, (_match, zeros: string | undefined) =>
    actual.includes(".") ? actual : actual + (zeros ?? "")
  );
  return line.slice(0, regionStart) + replaced;
}

/**
 * Applies a fix to file content. With a known line number only that line is edited, so an
 * identical line elsewhere (commented-out code, a duplicate assertion) is left alone.
 * Returns null when the expected text is no longer there.
 */
export function applyLineFix(content: string, fix: LineFix): string | null {
  if (fix.lineNumber > 0) {
    const lines = content.split("\n");
    const line = lines[fix.lineNumber - 1];
    const index = line?.indexOf(fix.originalLine) ?? -1;
    if (index === -1) return null;
    lines[fix.lineNumber - 1] =
      line.slice(0, index) + fix.suggestedLine + line.slice(index + fix.originalLine.length);
    return lines.join("\n");
  }

  const index = content.indexOf(fix.originalLine);
  if (index === -1) return null;
  // Slicing instead of String#replace keeps `$&`-style sequences in the fix literal
  return content.slice(0, index) + fix.suggestedLine + content.slice(index + fix.originalLine.length);
}
