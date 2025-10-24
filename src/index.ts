#!/usr/bin/env node

import type { PrettierOptionsCLI } from "./processors";
import { runPrettier } from "./processors";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

// Re-export for programmatic usage
export { runPrettier };

// ================================
// CLI Execution
// Only runs when this file is invoked directly (node index.js or npx <package>)
// ================================

export async function runCli(argv: string[]): Promise<void> {
  // 1. Parse CLI Arguments
  const parsed = yargs(hideBin(argv))
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
  };

  // 3. Execute Prettier
  await runPrettier(options).catch((err) => {
    console.error("Error running Prettier:", err);
    process.exit(1);
  });
}

/* istanbul ignore next */
if (require.main === module) {
  void runCli(process.argv);
}
