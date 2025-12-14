import { insertMarkers, mergeMarkedSections, END_LINE } from "./marker";
import { Range } from "./Range";

// Builds a regex to match PDQ markers for the given parser
const markerRegex = (parser: string) =>
  new RegExp(`__PDQ_MARKER_.*_${parser}_PDQ_MARKER__`, "g");

describe("insertMarkers", () => {
  const parser = "javascript";

  test("appends a trailing newline if missing", () => {
    const result = insertMarkers("foo\nbar", [new Range(1, 2)], parser);
    expect(result.endsWith(END_LINE)).toBe(true);
  });

  test.each([
    {
      name: "single range in JS file",
      content: "line1\nline2\nline3\n",
      ranges: [new Range(1, 2)],
      parser: "javascript",
      expectedCount: 2, // start + end markers
    },
    {
      name: "multiple ranges in HTML file",
      content: "<div>\n<span>\n</span>\n</div>\n",
      ranges: [new Range(0, 1), new Range(2, 3)],
      parser: "html",
      expectedCount: 3, // due to how HTML markers are inserted
    },
  ])(
    "inserts markers for $name",
    ({ content, ranges, parser, expectedCount }) => {
      const result = insertMarkers(content, ranges, parser);
      const matches = result.match(markerRegex(parser)) || [];
      expect(matches.length).toBe(expectedCount);
    },
  );

  test("throws for unsupported parser", () => {
    expect(() => insertMarkers("foo", [new Range(0, 1)], "unknown")).toThrow();
  });
});

describe("mergeMarkedSections", () => {
  const parser = "javascript";

  test("returns original file when there are no markers", () => {
    const original = "foo\nbar\nbaz\n";
    const formatted = "FOO\nBAR\nBAZ\n";
    // Should not merge anything since no markers exist
    expect(mergeMarkedSections(original, formatted, parser)).toBe(original);
  });

  test("merges only marked sections from formatted file", () => {
    const content = "a\nb\nc\n";
    const ranges = [new Range(2, 3)];
    const markedOriginal = insertMarkers(content, ranges, parser);

    // Extract a marker from the generated content
    const markerMatch = markedOriginal.match(
      /\/\/__PDQ_MARKER_.*_javascript_PDQ_MARKER__\n/,
    );
    const marker = markerMatch?.[0] ?? "";
    expect(marker).toBeTruthy();

    // Split the content by marker boundaries → [before, target, after]
    const parts = markedOriginal.split(marker);
    expect(parts.length).toBe(3);

    // Modify the target section in the formatted version
    const changedMarked = parts[1]?.replace("b", "B");
    const formatted = [parts[0], marker, changedMarked, marker, parts[2]].join(
      "",
    );

    // Merge back only the marked section from formatted into the original
    const merged = mergeMarkedSections(markedOriginal, formatted, parser);

    expect(merged).toContain("B");
    expect(merged).toContain("a");
    expect(merged).toContain("c");
    expect(merged).not.toContain("b");
  });

  test("throws if marker count mismatches", () => {
    const content = "a\nb\nc\n";
    const ranges = [new Range(2, 3)];
    const markedOriginal = insertMarkers(content, ranges, parser);

    // Remove one marker to simulate mismatch between original and formatted
    const markedFormatted = markedOriginal.replace(markerRegex(parser), "");

    expect(() =>
      mergeMarkedSections(markedOriginal, markedFormatted, parser),
    ).toThrow();
  });
});
