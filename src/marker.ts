import { Range } from "./Range";
import { randomUUID } from "crypto";
import { LineOffsets } from "./offsets";

const PDQ_UUID = randomUUID();
const COMMENT_STYLES: Record<
  string,
  { line?: string; block?: [string, string] }
> = {
  // Block: /* ... */
  css: { block: ["/*", "*/"] },
  ts: { line: "//", block: ["/*", "*/"] },
  flow: { line: "//", block: ["/*", "*/"] },
  apex: { line: "//", block: ["/*", "*/"] },
  scss: { line: "//", block: ["/*", "*/"] },
  less: { line: "//", block: ["/*", "*/"] },
  json5: { line: "//", block: ["/*", "*/"] },
  babel: { line: "//", block: ["/*", "*/"] },
  espree: { line: "//", block: ["/*", "*/"] },
  meriyah: { line: "//", block: ["/*", "*/"] },
  babelFlow: { line: "//", block: ["/*", "*/"] },
  javascript: { line: "//", block: ["/*", "*/"] },
  typescript: { line: "//", block: ["/*", "*/"] },

  // Block: <!-- ... -->
  lwc: { block: ["<!--", "-->"] },
  xml: { block: ["<!--", "-->"] },
  mdx: { block: ["<!--", "-->"] },
  vue: { block: ["<!--", "-->"] },
  html: { block: ["<!--", "-->"] },
  astro: { block: ["<!--", "-->"] },
  svelte: { block: ["<!--", "-->"] },
  angular: { block: ["<!--", "-->"] },
  markdown: { block: ["<!--", "-->"] },
  visualforce: { block: ["<!--", "-->"] },
  "angular-html": { block: ["<!--", "-->"] },

  // Line: -- or Block: /* ... */
  sql: { line: "--", block: ["/*", "*/"] },
  soql: { line: "--", block: ["/*", "*/"] },
  sosl: { line: "--", block: ["/*", "*/"] },

  // Line: #
  yaml: { line: "#" },
  toml: { line: "#" },
  graphql: { line: "#" },

  // Block: {{!-- ... --}}
  glimmer: { block: ["{{!--", "--}}"] },
  handlebars: { block: ["{{!--", "--}}"] },

  // Block: {{! ... }}
  liquid: { block: ["{{!", "}}"] },
};

function getMarker(parser: string): string {
  const markerId = `__PDQ_MARKER_${PDQ_UUID}_${parser}_PDQ_MARKER__`;
  const commentStyle = COMMENT_STYLES[parser];

  if (commentStyle?.line) {
    return `${commentStyle.line}${markerId}`;
  } else if (commentStyle?.block) {
    return `${commentStyle.block[0]}${markerId}${commentStyle.block[1]}`;
  }

  throw new Error(`Unsupported parser for marker generation: ${parser}`);
}

// Insert markers into file content for given ranges.
function insertMarkers(
  fileContent: string,
  ranges: Array<Range>,
  parser: string,
): string {
  let result = fileContent;
  const marker = getMarker(parser);

  if (!/\r?\n$/.test(fileContent)) {
    result += "\n";
  }

  const offsets = new LineOffsets(fileContent);

  for (const range of ranges) {
    const endLine = range.rangeEnd();
    const startLine = range.rangeStart();

    const endOffset = offsets.getOffset(endLine);
    const startOffset = offsets.getOffset(startLine);

    result =
      result.slice(0, endOffset) + marker + "\n" + result.slice(endOffset);
    result =
      result.slice(0, startOffset) + marker + "\n" + result.slice(startOffset);
  }

  return result;
}

// Persist only parts within markers from formatted, rest from original.
function mergeMarkedSections(
  originalFile: string,
  formattedFile: string,
  parser: string,
): string {
  const marker = getMarker(parser);
  const markerRegex = new RegExp(
    `[ \t]*${escapeRegex(marker)}[ \t]*\\r?\\n?`,
    "gm",
  );

  const originalParts = originalFile.split(markerRegex);
  const formattedParts = formattedFile.split(markerRegex);

  if (originalParts.length !== formattedParts.length) {
    throw new Error(
      "Marker count mismatch between original and formatted files.",
    );
  }

  return originalParts
    .map((part, i) => (i % 2 === 1 ? formattedParts[i] : part))
    .join("");
}

function escapeRegex(pattern: string): string {
  return pattern.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
}

export { insertMarkers, mergeMarkedSections };
