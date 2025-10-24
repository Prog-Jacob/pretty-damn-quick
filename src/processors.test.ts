import * as fs from "fs";
import prettier from "prettier";
import * as git from "./git";
import log from "./log";
import {
  runPrettier,
  resolveTargetFiles,
  processWholeFile,
  processFileByRanges,
  type PrettierOptionsCLI,
} from "./processors";
import { Range } from "./Range";

jest.mock("./git");
jest.mock("./log");
jest.mock("prettier");
jest.mock("fs");

const gitMocked = jest.mocked(git);
const logMocked = jest.mocked(log);
const fsMocked = jest.mocked(fs);
const prettierMocked = jest.mocked(prettier);

const baseOptions: PrettierOptionsCLI = {
  check: false,
  staged: false,
  changed: false,
  lines: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  gitMocked.getDiffFileList.mockReturnValue([]);
  gitMocked.getUntrackedFileList.mockReturnValue([]);
  gitMocked.hasCleanIndex.mockReturnValue(true);
  fsMocked.readFileSync.mockReturnValue("code");
  fsMocked.writeFileSync.mockImplementation(() => undefined);
  prettierMocked.getFileInfo.mockResolvedValue({
    ignored: false,
    inferredParser: null,
  });
  prettierMocked.resolveConfig.mockResolvedValue({});
  prettierMocked.format.mockResolvedValue("formatted");
});

afterEach(() => {
  process.exitCode = 0;
});

describe("resolveTargetFiles", () => {
  it("collects staged, changed, and untracked files by extension", () => {
    gitMocked.getDiffFileList.mockImplementation((staged) =>
      staged ? ["a.js"] : ["b.ts"],
    );
    gitMocked.getUntrackedFileList.mockReturnValue(["c.js"]);
    const opts = {
      ...baseOptions,
      staged: true,
      changed: true,
      extensions: ["js"],
    };
    expect(resolveTargetFiles(opts)).toEqual(["a.js", "c.js"]);
  });

  it("deduplicates files", () => {
    gitMocked.getDiffFileList.mockReturnValue(["a.js", "b.ts"]);
    gitMocked.getUntrackedFileList.mockReturnValue(["a.js"]);
    const opts = {
      ...baseOptions,
      staged: true,
      changed: true,
      extensions: ["js"],
    };
    expect(resolveTargetFiles(opts)).toEqual(["a.js"]);
  });

  it("handles no extension filter", () => {
    gitMocked.getDiffFileList.mockReturnValue(["a.js", "b.ts"]);
    gitMocked.getUntrackedFileList.mockReturnValue(["c.ts"]);
    const opts = { ...baseOptions, staged: true, changed: true };
    expect(resolveTargetFiles(opts).sort()).toEqual(
      ["a.js", "b.ts", "c.ts"].sort(),
    );
  });
});

describe("processWholeFile", () => {
  const opts = { ...baseOptions };

  it("skips unstaged changes when staged", async () => {
    gitMocked.hasCleanIndex.mockReturnValue(false);
    const result = await processWholeFile("file.js", { ...opts, staged: true });
    expect(result).toBe(true);
    expect(logMocked.skipped).toHaveBeenCalled();
  });

  it.each([
    ["ignored", true, "same", "same", true, true],
    ["formatted & written", false, "old", "new", false, true],
    ["check mode diff", false, "old", "new", true, false],
    ["check identical", false, "same", "same", true, true],
  ])("%s", async (_, ignored, code, formatted, check, expected) => {
    prettierMocked.getFileInfo.mockResolvedValueOnce({
      ignored,
      inferredParser: null,
    });
    fsMocked.readFileSync.mockReturnValue(code);
    prettierMocked.format.mockResolvedValue(formatted);
    const result = await processWholeFile("file.js", { ...opts, check });
    expect(result).toBe(expected);
  });

  it("handles null config gracefully", async () => {
    prettierMocked.resolveConfig.mockResolvedValueOnce(null);
    fsMocked.readFileSync.mockReturnValue("abc");
    prettierMocked.format.mockResolvedValueOnce("abc");
    const result = await processWholeFile("file.js", { ...opts, check: true });
    expect(result).toBe(true);
  });
});

describe("processFileByRanges", () => {
  const baseRange = new Range(0, 1);

  beforeEach(() => {
    gitMocked.getDiffForFile.mockReturnValue("diff");
    gitMocked.getRangesForDiff.mockReturnValue([baseRange]);
    fsMocked.readFileSync.mockReturnValue("line1\nline2");
  });

  it("formats changed ranges", async () => {
    const result = await processFileByRanges("file.js", {
      ...baseOptions,
      lines: true,
    });
    expect(result).toBe(true);
    expect(fsMocked.writeFileSync).toHaveBeenCalled();
  });

  it("skips ignored files", async () => {
    prettierMocked.getFileInfo.mockResolvedValueOnce({
      ignored: true,
      inferredParser: null,
    });
    const result = await processFileByRanges("file.js", {
      ...baseOptions,
      lines: true,
    });
    expect(result).toBe(true);
  });

  it("reports diff in check mode", async () => {
    prettierMocked.format.mockResolvedValue("formatted");
    const result = await processFileByRanges("file.js", {
      ...baseOptions,
      check: true,
      lines: true,
    });
    expect(result).toBe(false);
    expect(logMocked.checked).toHaveBeenCalled();
  });

  it("handles null config gracefully", async () => {
    prettierMocked.resolveConfig.mockResolvedValueOnce(null);
    prettierMocked.format.mockImplementation((input) => Promise.resolve(input));
    const result = await processFileByRanges("file.js", {
      ...baseOptions,
      check: true,
      lines: true,
    });
    expect(result).toBe(true);
  });
});

describe("runPrettier", () => {
  it("logs when no files", async () => {
    await runPrettier({ ...baseOptions, check: true });
    expect(logMocked.info).toHaveBeenCalledWith("No files to process.");
  });

  it.each([
    [false, "whole-file mode"],
    [true, "line-ranges mode"],
  ])("sets exitCode=1 when check fails (%s)", async (lines) => {
    gitMocked.getDiffFileList.mockReturnValue(["a.js"]);
    fsMocked.readFileSync.mockReturnValue("old");
    prettierMocked.format.mockResolvedValue("new");
    gitMocked.getRangesForDiff.mockReturnValue([new Range(0, 1)]);
    await runPrettier({ ...baseOptions, check: true, staged: true, lines });
    expect(process.exitCode).toBe(1);
  });
});
