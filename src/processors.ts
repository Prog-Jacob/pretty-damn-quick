#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import prettier from "prettier";

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
  lines: boolean; // --lines: format only changed lines
  extensions?: string[]; // e.g., ['ts','js']: filter by file extensions
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

  for (const file of targetFiles) {
    try {
      const ok = options.lines
        ? await processFileByRanges(file, options)
        : await processWholeFile(file, options);
      if (!ok) {
        allOk = false;
      }
    } catch (err) {
      log.error(
        `Error processing file ${file}: ${err instanceof Error ? err.message : String(err)}`,
      );
      allOk = false;
    }
  }

  // Report error but do not exit; let caller decide what to do
  if (options.check && !allOk) {
    throw new Error("Some files are not formatted.");
  }
}

// ================================
// 4. Resolve Target Files
// ================================
function resolveTargetFiles(options: PrettierOptionsCLI): string[] {
  const stagedFiles: string[] = getDiffFileList(true);
  const changedFiles: string[] = getDiffFileList(false);
  const untrackedFiles: string[] = getUntrackedFileList(false);

  let files: string[] = [];

  // Include staged or changed files depending on options
  if (options.staged !== options.changed || options.staged) {
    files.push(...stagedFiles);
  }

  if (options.staged !== options.changed || options.changed) {
    files.push(...changedFiles);
  }

  // Always include untracked files
  files.push(...untrackedFiles);

  // Remove duplicates
  files = Array.from(new Set(files));

  // Filter by extensions if provided
  if (options.extensions?.length) {
    const exts = options.extensions.map((e) => e.replace(/^\./, ""));
    files = files.filter((file) => exts.includes(path.extname(file).slice(1)));
  }

  files = files.filter((file) => fs.statSync(file).isFile());

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

  if (options.check) {
    if (formatted !== code) {
      log.checked(file);
      return false;
    }
  } else if (formatted !== code) {
    fs.writeFileSync(file, formatted, "utf-8");
    log.formatted(file);
  }

  return true;
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
  const sortedRanges = [...ranges].sort(
    (a, b) => b.rangeStart() - a.rangeStart(),
  );

  let currentText = originalText;

  for (const range of sortedRanges) {
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

      if (originalSegment !== currentSegment) {
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

class LineOffsets {
  private offsets: number[];

  constructor(text: string) {
    this.offsets = [0];
    const lines = text.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const lineWidth = line.length;
      const previousOffset = this.offsets[i] ?? 0;
      const lineEndingOffset = previousOffset + lineWidth;
      const lineEnding = text.slice(lineEndingOffset, lineEndingOffset + 2);
      const lineEndingWidth = lineEnding?.startsWith("\r\n")
        ? 2
        : lineEnding?.startsWith("\n")
          ? 1
          : 0;

      this.offsets[i + 1] = previousOffset + lineWidth + lineEndingWidth;
    }
  }

  getOffset(line: number) {
    return this.offsets[line] ?? 0;
  }
}

// Top-level export
export {
  runPrettier,
  resolveTargetFiles,
  processWholeFile,
  processFileByRanges,
};
export type { PrettierOptionsCLI };
