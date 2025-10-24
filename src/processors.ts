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
    const ok = options.lines
      ? await processFileByRanges(file, options)
      : await processWholeFile(file, options);

    if (!ok) {
      allOk = false;
    }
  }

  // Exit with error code if --check and any files are not formatted
  if (options.check && !allOk) {
    process.exitCode = 1;
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

  if (info.ignored) {
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
  const lines = fs.readFileSync(file, "utf-8").split("\n");
  const diff = getDiffForFile(file, options.staged);
  const ranges = getRangesForDiff(diff); // only changed lines

  let allOk = true;
  let changed = false;

  for (const range of ranges) {
    const start = range.rangeStart();
    const end = range.rangeEnd();
    const input = lines.slice(start, end).join("\n");

    const info = await prettier.getFileInfo(file);
    const config = await prettier.resolveConfig(file);

    if (info.ignored) {
      continue;
    }

    const formatted = await prettier.format(input, {
      ...(config ?? {}),
      filepath: file,
      rangeStart: 0,
      rangeEnd: input.length,
    });

    if (options.check) {
      if (formatted !== input) {
        log.checked(file, `${start + 1}-${end}`);
        allOk = false;
      }
    } else if (formatted !== input) {
      // Replace only changed lines in memory
      lines.splice(start, end - start, ...formatted.split("\n"));
      changed = true;
      log.formatted(file, `${start + 1}-${end}`);
    }
  }

  if (!options.check && changed) {
    fs.writeFileSync(file, lines.join("\n"), "utf-8");
  }

  return allOk;
}

// Top-level export
export {
  runPrettier,
  resolveTargetFiles,
  processWholeFile,
  processFileByRanges,
};
export type { PrettierOptionsCLI };
