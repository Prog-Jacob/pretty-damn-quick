process.env.CI = "true";
import * as child_process from "child_process";
import { type PrettierOptionsCLI } from "./processors";
import { coerceLines } from "./index";

jest.mock("child_process");
jest
  .mocked(child_process, { shallow: true })
  .execFileSync.mockReturnValue(Buffer.from("line1\nline2\nline3"));

const yargsMock = {
  usage: jest.fn().mockReturnThis(),
  example: jest.fn().mockReturnThis(),
  options: jest.fn().mockReturnThis(),
  help: jest.fn().mockReturnThis(),
  epilog: jest.fn().mockReturnThis(),
  parseSync: jest.fn(),
};

jest.mock("yargs", () => ({
  __esModule: true,
  default: jest.fn(() => yargsMock),
}));

jest.mock("yargs/helpers", () => ({
  hideBin: jest.fn((argv: string[]) => argv),
}));

let runCli: (argv: string[]) => Promise<void>;
let runPrettierSpy: jest.SpyInstance<Promise<void>, [PrettierOptionsCLI]>;

beforeAll(async () => {
  const mod = await import("./index");
  const processors = await import("./processors");
  runCli = mod.runCli;
  runPrettierSpy = jest
    .spyOn(processors, "runPrettier")
    .mockResolvedValue(undefined);
});

afterEach(() => {
  jest.clearAllMocks();
  process.exitCode = 0;
});

describe("coerceLines", () => {
  it.each([
    ["experimental", "experimental"], // special string preserved
    [true, true], // booleans preserved
    [false, false],
    ["foo", true], // other strings become true
    ["", true],
    [undefined, false], // non-string/non-boolean become false
    [null, false],
    [{}, false],
    [123, false],
    [[], false],
  ])("coerceLines(%s) === %s", (input, expected) => {
    expect(coerceLines(input)).toBe(expected);
  });
});

describe("CLI", () => {
  it("parses CLI args and calls runPrettier with correct options", async () => {
    yargsMock.parseSync.mockReturnValue({
      check: true,
      staged: true,
      extensions: "ts,js",
    });

    await runCli([
      "node",
      "index.js",
      "--check",
      "--staged",
      "--extensions",
      "ts,js",
    ]);

    expect(runPrettierSpy).toHaveBeenCalledWith({
      check: true,
      staged: true,
      changed: false,
      trackedOnly: false,
      lines: false,
      extensions: ["ts", "js"],
    });
  });

  it("uses default options when none provided", async () => {
    yargsMock.parseSync.mockReturnValue({});

    await runCli(["node", "index.js"]);

    expect(runPrettierSpy).toHaveBeenCalledWith({
      check: false,
      staged: false,
      changed: false,
      trackedOnly: false,
      lines: false,
      extensions: [],
    });
  });

  it("sets pattern from positional argument", async () => {
    yargsMock.parseSync.mockReturnValue({ _: ["src/**/*.ts"] });

    await runCli(["node", "index.js", "src/**/*.ts"]);

    expect(runPrettierSpy).toHaveBeenCalledWith(
      expect.objectContaining({ pattern: "src/**/*.ts" }),
    );
  });

  it("logs error message and sets exit code when runPrettier throws Error", async () => {
    const log = (await import("./log")).default;
    runPrettierSpy.mockRejectedValueOnce(new Error("fail!"));
    const logSpy = jest.spyOn(log, "error").mockImplementation(() => undefined);
    yargsMock.parseSync.mockReturnValue({});

    await runCli(["node", "index.js"]);

    expect(logSpy).toHaveBeenCalledWith(expect.any(Error));
    expect(process.exitCode).toBe(1);
    logSpy.mockRestore();
  });

  it("logs error and sets exit code when runPrettier throws non-Error", async () => {
    const log = (await import("./log")).default;
    runPrettierSpy.mockRejectedValueOnce("fail-string");
    const logSpy = jest.spyOn(log, "error").mockImplementation(() => undefined);
    yargsMock.parseSync.mockReturnValue({});

    await runCli(["node", "index.js"]);

    expect(logSpy).toHaveBeenCalledWith("fail-string");
    expect(process.exitCode).toBe(1);
    logSpy.mockRestore();
  });

  it("registers process exit handler to print summary with provided logLevel", async () => {
    const log = (await import("./log")).default;
    const printSpy = jest
      .spyOn(log, "printSummary")
      .mockImplementation(() => undefined);

    yargsMock.parseSync.mockReturnValue({ logLevel: "info" });
    await runCli(["node", "index.js"]);

    // Simulate process exit to trigger the handler
    (process as unknown as NodeJS.EventEmitter).emit("exit");
    expect(printSpy).toHaveBeenCalledWith({ level: "info" });
    printSpy.mockRestore();
  });
});

describe("exports", () => {
  it("re-exports runPrettier from processors", async () => {
    jest.resetModules();
    const { runPrettier } = await import("./index");
    const processors = await import("./processors");

    expect(runPrettier).toBe(processors.runPrettier);
  });
});
