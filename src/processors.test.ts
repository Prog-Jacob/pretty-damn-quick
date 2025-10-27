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
  trackedOnly: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  gitMocked.getDiffFileList.mockReturnValue([]);
  gitMocked.getUntrackedFileList.mockReturnValue([]);
  gitMocked.hasCleanIndex.mockReturnValue(true);
  gitMocked.getDiffForFile.mockReturnValue("diff");
  gitMocked.getRangesForDiff.mockReturnValue([new Range(0, 1)]);
  fsMocked.readFileSync.mockReturnValue("code");
  fsMocked.writeFileSync.mockImplementation(() => undefined);
  fsMocked.statSync.mockReturnValue({ isFile: () => true } as fs.Stats);
  prettierMocked.getFileInfo.mockResolvedValue({
    ignored: false,
    inferredParser: "babel",
  });
  prettierMocked.resolveConfig.mockResolvedValue({});
  prettierMocked.format.mockResolvedValue("formatted");
});

afterEach(() => {
  process.exitCode = 0;
});

describe("resolveTargetFiles", () => {
  it("filters by pattern, extensions, and deduplicates", () => {
    gitMocked.getDiffFileList.mockImplementation((staged) =>
      staged ? ["a.js", "foo.js"] : ["b.ts", "bar.ts"],
    );
    gitMocked.getUntrackedFileList.mockReturnValue(["a.js", "c.js", "baz.js"]);

    expect(
      resolveTargetFiles({
        ...baseOptions,
        staged: true,
        changed: true,
        pattern: "*z.js",
      }),
    ).toEqual(["baz.js"]);

    expect(
      resolveTargetFiles({
        ...baseOptions,
        staged: true,
        changed: true,
        extensions: ["js"],
      }),
    ).toEqual(["a.js", "foo.js", "c.js", "baz.js"]);

    expect(
      resolveTargetFiles({
        ...baseOptions,
        staged: true,
        changed: true,
      }).sort(),
    ).toEqual(["a.js", "foo.js", "b.ts", "bar.ts", "c.js", "baz.js"].sort());
  });
});

describe("processWholeFile", () => {
  it("skips unstaged changes when staged", async () => {
    gitMocked.hasCleanIndex.mockReturnValue(false);
    expect(
      await processWholeFile("file.js", { ...baseOptions, staged: true }),
    ).toBe(true);
    expect(logMocked.skipped).toHaveBeenCalled();
  });

  it.each([
    ["ignored", true, null, "same", "same", true, true],
    ["formatted & written", false, "babel", "old", "new", false, true],
    ["check mode diff", false, "babel", "old", "new", true, false],
    ["check identical", false, "babel", "same", "same", true, true],
    ["null config", false, "babel", "abc", "abc", true, true],
  ])(
    "%s",
    async (_, ignored, inferredParser, code, formatted, check, expected) => {
      prettierMocked.getFileInfo.mockResolvedValueOnce({
        ignored,
        inferredParser,
      });
      prettierMocked.resolveConfig.mockResolvedValueOnce(ignored ? {} : null);
      fsMocked.readFileSync.mockReturnValue(code);
      prettierMocked.format.mockResolvedValue(formatted);
      expect(await processWholeFile("file.js", { ...baseOptions, check })).toBe(
        expected,
      );
    },
  );
});

describe("processFileByRanges", () => {
  const testRangeProcessing = async (processor: string, opts = baseOptions) => {
    const { processRangesWithMarkers } = await import("./processors");
    const fn =
      processor === "markers" ? processRangesWithMarkers : processFileByRanges;
    return fn("file.js", { ...opts, lines: true });
  };

  it.each([
    ["processFileByRanges", "ranges"],
    ["processRangesWithMarkers", "markers"],
  ])("%s: shortcut path and basic formatting", async (_, processor) => {
    // Full diff - formatted
    gitMocked.getRangesForDiff.mockReturnValue([new Range(0, 2)]);
    fsMocked.readFileSync.mockReturnValue("old");
    prettierMocked.format.mockResolvedValue("new");
    expect(await testRangeProcessing(processor)).toBe(false);
    expect(fsMocked.writeFileSync).toHaveBeenCalledWith(
      "file.js",
      "new",
      "utf-8",
    );

    // Full diff - already formatted
    fsMocked.writeFileSync.mockClear();
    gitMocked.getRangesForDiff.mockReturnValue([new Range(0, 2)]);
    fsMocked.readFileSync.mockReturnValue("same");
    prettierMocked.format.mockResolvedValue("same");
    expect(await testRangeProcessing(processor)).toBe(true);
    expect(fsMocked.writeFileSync).not.toHaveBeenCalled();

    // Partial ranges
    fsMocked.writeFileSync.mockClear();
    gitMocked.getRangesForDiff.mockReturnValue([new Range(0, 1)]);
    fsMocked.readFileSync.mockReturnValue("old");
    prettierMocked.format.mockResolvedValue("new");
    expect(await testRangeProcessing(processor)).toBe(false);
    expect(fsMocked.writeFileSync).toHaveBeenCalled();
  });

  it("handles ignored files and null config", async () => {
    prettierMocked.getFileInfo.mockResolvedValueOnce({
      ignored: true,
      inferredParser: null,
    });
    expect(
      await processFileByRanges("file.js", { ...baseOptions, lines: true }),
    ).toBe(true);

    prettierMocked.resolveConfig.mockResolvedValueOnce(null);
    prettierMocked.format.mockImplementation((input) => Promise.resolve(input));
    expect(
      await processFileByRanges("file.js", {
        ...baseOptions,
        check: true,
        lines: true,
      }),
    ).toBe(true);
  });

  it("reports diff in check mode", async () => {
    prettierMocked.format.mockResolvedValue("formatted");
    expect(
      await processFileByRanges("file.js", {
        ...baseOptions,
        check: true,
        lines: true,
      }),
    ).toBe(false);
    expect(logMocked.checked).toHaveBeenCalled();
  });

  it("marker-specific: check mode and error fallback", async () => {
    const marker = await import("./marker");
    jest
      .spyOn(marker, "insertMarkers")
      .mockImplementation(() => `<<MARKED>>original`);
    jest
      .spyOn(marker, "mergeMarkedSections")
      .mockImplementation(() => "changed");
    prettierMocked.format.mockResolvedValue("changed");
    fsMocked.readFileSync.mockReturnValue("original");

    const { processRangesWithMarkers } = await import("./processors");
    expect(
      await processRangesWithMarkers("file.js", {
        ...baseOptions,
        check: true,
      }),
    ).toBe(false);
    expect(logMocked.checked).toHaveBeenCalled();

    // Error fallback
    jest.clearAllMocks();
    jest.spyOn(marker, "insertMarkers").mockImplementation(() => {
      throw new Error("marker fail");
    });
    fsMocked.readFileSync.mockReturnValue("old");
    prettierMocked.format.mockResolvedValue("new");
    expect(await processRangesWithMarkers("file.js", baseOptions)).toBe(false);
    expect(logMocked.error).toHaveBeenCalledWith(
      expect.stringContaining("marker fail"),
    );
  });
});

describe("runPrettier", () => {
  it("handles edge cases", async () => {
    await runPrettier({ ...baseOptions, check: true });
    expect(logMocked.info).toHaveBeenCalledWith("No files to process.");

    gitMocked.getDiffFileList.mockReturnValue(["a.js"]);
    fsMocked.readFileSync.mockReturnValue("code");
    prettierMocked.format.mockImplementation(() => {
      throw new Error("fail");
    });
    await expect(
      runPrettier({ ...baseOptions, staged: true }),
    ).resolves.toBeUndefined();
    expect(logMocked.error).toHaveBeenCalled();
  });

  it.each([
    [false, "whole-file mode"],
    [true, "line-ranges mode"],
  ])("throws when check fails in %s", async (lines) => {
    gitMocked.getDiffFileList.mockReturnValue(["a.js"]);
    fsMocked.readFileSync.mockReturnValue("old");
    prettierMocked.format.mockResolvedValue("new");
    gitMocked.getRangesForDiff.mockReturnValue([new Range(0, 1)]);
    await expect(
      runPrettier({ ...baseOptions, check: true, staged: true, lines }),
    ).rejects.toThrow("Some files are not formatted.");
  });
});
