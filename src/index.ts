#!/usr/bin/env node

import type { PrettierOptionsCLI } from "./processors";
import { runPrettier } from "./processors";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import log from "./log";

// Re-export for programmatic usage
export { runPrettier };

// ================================
// CLI Execution
// Only runs when this file is invoked directly (node index.js or npx <package>)
// ================================

export async function runCli(argv: string[]): Promise<void> {
  // 1. Parse CLI Arguments
  const parsed = yargs(hideBin(argv))
    .usage(`\npretty-damn-quick [options] [glob]`)
    .example([
      ["pretty-damn-quick --changed", "Format all changed files in the repo"],
      ["pretty-damn-quick --staged", "Format all staged files in the repo"],
      [
        'pretty-damn-quick --changed "src/**/*.{ts,js}"',
        "Format changed files matching the glob pattern",
      ],
      [
        "pretty-damn-quick --changed --lines",
        "Format only changed lines in changed files",
      ],
    ])
    .options({
      check: {
        type: "boolean",
        description: "Do not format, just check formatting",
      },
      staged: {
        type: "boolean",
        description: "Run only on staged files",
      },
      changed: {
        type: "boolean",
        description: "Run only on changed files",
      },
      lines: {
        type: "boolean",
        description: "Format only changed/staged lines",
      },
      extensions: {
        type: "string",
        description:
          "Comma-separated list of file extensions to process (e.g., 'ts,js,jsx')",
      },
    })
    .help()
    .epilog("Format only your changed or staged files with Prettier, fast.")
    .parseSync();

  // 2. Convert CLI Args to Options Object
  const options: PrettierOptionsCLI = {
    check: parsed.check ?? false,
    staged: parsed.staged ?? false,
    changed: parsed.changed ?? false,
    lines: parsed.lines ?? false,
    extensions:
      typeof parsed.extensions === "string"
        ? parsed.extensions
            .split(",")
            .map((ext) => ext.trim())
            .filter(Boolean)
        : [],
    pattern: parsed._ && parsed._[0] ? String(parsed._[0]) : undefined,
  };

  // 3. Execute Prettier
  try {
    await runPrettier(options);
  } catch (err) {
    log.error(`${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

/* istanbul ignore next */
if (require.main === module) {
  void runCli(process.argv);
}
