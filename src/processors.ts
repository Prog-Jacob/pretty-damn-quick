#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import prettier from "prettier";
import micromatch from "micromatch";

import {
  getDiffFileList,
  getDiffForFile,
  getRangesForDiff,
  getUntrackedFileList,
  hasCleanIndex,
  fetchFromOrigin,
} from "./git";
import { guessBranch } from "./ci";
import log from "./log";
import { LineOffsets } from "./offsets";
import { insertMarkers, mergeMarkedSections } from "./marker";

// ================================
// 1. Branch Fetching for CI
// ================================
// When running in CI, ensure we fetch the latest branch for diff computation.
if (process.env.CI !== undefined) {
  const branch = process.env.ESLINT_PLUGIN_DIFF_COMMIT ?? guessBranch();

  if (branch !== undefined) {
    const branchWithoutOrigin = branch.replace(/^origin\//, "");
    const branchWithOrigin = `origin/${branchWithoutOrigin}`;

    fetchFromOrigin(branchWithoutOrigin);
    process.env.ESLINT_PLUGIN_DIFF_COMMIT = branchWithOrigin;
  }
}

// ================================
// 2. CLI Options Interface
// ================================
type PrettierOptionsCLI = {
  check: boolean; // --check: only check formatting
  staged: boolean; // --staged: only staged files
  changed: boolean; // --changed: only changed files
  trackedOnly: boolean; // --tracked-only: doesn't process untracked files
  lines: boolean | "experimental"; // --lines: format only changed lines, or 'experimental'
  extensions?: string[]; // e.g., ['ts','js']: filter by file extensions
  pattern?: string; // glob pattern to filter files
};

// ================================
// 3. Entry Point
// ================================
async function runPrettier(options: PrettierOptionsCLI): Promise<void> {
  const targetFiles = resolveTargetFiles(options);

  if (targetFiles.length === 0) {
    log.info("No files to process.");
    return;
  }

  let allOk = true;
  let hasExitingError = false;

  for (const file of targetFiles) {
    try {
      const ok =
        options.lines === "experimental"
          ? await processRangesWithMarkers(file, options)
          : options.lines
            ? await processFileByRanges(file, options)
            : await processWholeFile(file, options);
      if (!ok) {
        allOk = false;
      }
    } catch (err) {
      log.error(err, file);

      const errMessage =
        err instanceof Error ? (err.stack ?? err.message) : String(err);

      if (err instanceof SyntaxError || !errMessage.includes("prettier")) {
        hasExitingError = true;
      }
    }
  }

  if (hasExitingError) {
    throw new Error(
      "Prettier exiting error(s) occurred. See above for details.",
    );
  } else if (options.check && !allOk) {
    throw new Error("Some files are not formatted.");
  }

  process.exitCode = 0;
}

// ================================
// 4. Resolve Target Files
// ================================
function resolveTargetFiles(options: PrettierOptionsCLI): string[] {
  const stagedFiles: string[] = getDiffFileList(true);
  const changedFiles: string[] = getDiffFileList(false);
  const untrackedFiles: string[] = getUntrackedFileList(false);

  let files: string[] = [];

  if (options.staged === options.changed || options.staged) {
    files.push(...stagedFiles);
  }

  if (options.staged === options.changed || options.changed) {
    files.push(...changedFiles);
  }

  if (!options.trackedOnly) {
    files.push(...untrackedFiles);
  }

  // Remove duplicates
  files = Array.from(new Set(files));

  // Filter by extensions if provided
  if (options.extensions?.length) {
    const exts = options.extensions ?? [];
    files = files.filter((file) => exts.includes(path.extname(file).slice(1)));
  }

  files = files.filter(
    (file) =>
      fs.statSync(file).isFile() && !path.basename(file).startsWith("."),
  );

  // Filter by glob pattern if provided (from positional argument)
  if (options.pattern) {
    files = micromatch.match(files, options.pattern, { dot: true });
  }

  return files;
}

// ================================
// 5. Process Whole File
// ================================
async function processWholeFile(
  file: string,
  options: PrettierOptionsCLI,
): Promise<boolean> {
  // Skip files with unstaged changes if in staged mode
  if (options.staged && !hasCleanIndex(file)) {
    log.skipped(
      file,
      "has unstaged changes. Please stage or remove the changes.",
    );
    return true;
  }

  const code = fs.readFileSync(file, "utf-8");
  const info = await prettier.getFileInfo(file);
  const config = await prettier.resolveConfig(file);

  if (info.ignored || info.inferredParser === null) {
    return true;
  }

  const formatted = await prettier.format(code, {
    ...(config ?? {}),
    filepath: file,
  });
  const isNoChange = code.length === formatted.length && code === formatted;

  if (options.check) {
    if (!isNoChange) {
      log.checked(file);
      return false;
    }
  } else if (!isNoChange) {
    fs.writeFileSync(file, formatted, "utf-8");
    log.formatted(file);
  }

  return isNoChange;
}

// ================================
// 6. Process File by Changed Ranges
// ================================

async function processFileByRanges(
  file: string,
  options: PrettierOptionsCLI,
): Promise<boolean> {
  const info = await prettier.getFileInfo(file);
  const config = await prettier.resolveConfig(file);

  if (info.ignored || info.inferredParser === null) {
    return true;
  }

  const originalText = fs.readFileSync(file, "utf-8");
  const lineOffsets = new LineOffsets(originalText);
  const diff = getDiffForFile(file, options.staged);
  const ranges = getRangesForDiff(diff);

  if (
    ranges.length === 1 &&
    ranges[0]?.rangeStart() === 0 &&
    Math.abs(ranges[0]?.rangeEnd() - lineOffsets.totalLines()) <= 1
  ) {
    return processWholeFile(file, options);
  }

  let currentText = originalText;

  for (const range of ranges) {
    const startLine = range.rangeStart();
    const endLine = range.rangeEnd();
    const start = lineOffsets.getOffset(startLine);
    const end = lineOffsets.getOffset(endLine) - 1;

    currentText = await prettier.format(currentText, {
      ...(config ?? {}),
      filepath: file,
      rangeStart: start,
      rangeEnd: end,
    });

    if (options.check) {
      const originalSegment = originalText.slice(start, end);
      const currentSegment = currentText.slice(start, end);
      const isNoChange =
        originalSegment.length === currentSegment.length &&
        originalSegment === currentSegment;

      if (!isNoChange) {
        log.checked(file, `${startLine + 1}-${endLine}`);
      }
    }
  }

  const isNoChange =
    currentText.length === originalText.length && currentText === originalText;

  if (!options.check && !isNoChange) {
    fs.writeFileSync(file, currentText, "utf-8");
  }

  return isNoChange;
}

// ================================
// 7. Process File by Changed Ranges Using Markers
// ================================

async function processRangesWithMarkers(
  file: string,
  options: PrettierOptionsCLI,
): Promise<boolean> {
  const originalText = fs.readFileSync(file, "utf-8");
  const info = await prettier.getFileInfo(file);
  const config = await prettier.resolveConfig(file);

  if (info.ignored || info.inferredParser === null) {
    return true;
  }

  const diff = getDiffForFile(file, options.staged);
  const ranges = getRangesForDiff(diff);

  if (ranges.length === 1 && ranges[0]?.rangeStart() === 0) {
    const lineOffsets = new LineOffsets(originalText);

    if (Math.abs(ranges[0]?.rangeEnd() - lineOffsets.totalLines()) <= 1) {
      return processWholeFile(file, options);
    }
  }

  try {
    const markedText = insertMarkers(originalText, ranges, info.inferredParser);
    const formattedWithMarkers = await prettier.format(markedText, {
      ...(config ?? {}),
      filepath: file,
    });
    const mergedText = mergeMarkedSections(
      markedText,
      formattedWithMarkers,
      info.inferredParser,
    );

    if (options.check) {
      if (mergedText !== originalText) {
        for (const range of ranges) {
          log.checked(file, `${range.rangeStart() + 1}-${range.rangeEnd()}`);
        }
        return false;
      }
    } else if (mergedText !== originalText) {
      fs.writeFileSync(file, mergedText, "utf-8");
      log.formatted(file);
    }

    return true;
  } catch (error) {
    log.error(error, file);

    // Fallback to line-based processing if marker-based fails
    return processFileByRanges(file, options);
  }
}

// Top-level export
export {
  runPrettier,
  resolveTargetFiles,
  processWholeFile,
  processFileByRanges,
  processRangesWithMarkers,
};
export type { PrettierOptionsCLI };
