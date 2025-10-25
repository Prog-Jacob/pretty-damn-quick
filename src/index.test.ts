process.env.CI = "true";
import * as child_process from "child_process";
import { type PrettierOptionsCLI } from "./processors";

jest.mock("child_process");
const mockedChildProcess = jest.mocked(child_process, { shallow: true });
mockedChildProcess.execFileSync.mockReturnValue(
  Buffer.from("line1\nline2\nline3"),
);

type YargsMock = {
  options: jest.Mock;
  help: jest.Mock;
  parseSync: jest.Mock;
};

const createYargsMock = (): YargsMock =>
  Object.assign(jest.fn(), {
    options: jest.fn().mockReturnThis(),
    help: jest.fn().mockReturnThis(),
    parseSync: jest.fn(),
  });

const yargsMock = createYargsMock();

jest.mock("yargs", () => ({
  __esModule: true,
  default: jest.fn(() => yargsMock),
}));

jest.mock("yargs/helpers", () => ({
  hideBin: jest.fn((argv: string[]) => argv),
}));

let runCli: (argv: string[]) => Promise<void>;

beforeAll(async () => {
  const mod = await import("./index");
  runCli = mod.runCli;
});

describe("CLI entrypoint", () => {
  let runPrettierSpy: jest.SpyInstance<Promise<void>, [PrettierOptionsCLI]>;

  beforeEach(async () => {
    const processors = await import("./processors");
    runPrettierSpy = jest
      .spyOn(processors, "runPrettier")
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.exitCode = 0;
  });

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
      lines: false,
      extensions: ["ts", "js"],
    });
  });

  it("defaults options when none provided", async () => {
    yargsMock.parseSync.mockReturnValue({});

    await runCli(["node", "index.js"]);

    expect(runPrettierSpy).toHaveBeenCalledWith({
      check: false,
      staged: false,
      changed: false,
      lines: false,
      extensions: [],
    });
  });

  it("calls process.exit(1) and logs error if runPrettier throws", async () => {
    const error = new Error("fail!");
    const processors = await import("./processors");
    jest.spyOn(processors, "runPrettier").mockRejectedValueOnce(error);

    const errorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    yargsMock.parseSync.mockReturnValue({ check: true });

    await runCli(["node", "index.js", "--check"]);

    expect(errorSpy).toHaveBeenCalledWith(
      "Error: " + (error.message ?? String(error)),
    );
    expect(process.exitCode).toBe(1);

    errorSpy.mockRestore();
  });
});

describe("exports", () => {
  it("exports expected runPrettier function", async () => {
    jest.resetModules();
    const real = await import("./processors");
    expect(typeof real.runPrettier).toBe("function");
    expect(real.runPrettier).toMatchSnapshot();
  });

  it("allows direct runPrettier call through index (spy only)", async () => {
    jest.resetModules();
    const processors = await import("./processors");
    const spy = jest
      .spyOn(processors, "runPrettier")
      .mockResolvedValue(undefined);
    const { runPrettier } = await import("./index");

    await expect(
      runPrettier({
        check: false,
        staged: false,
        changed: false,
        lines: false,
        extensions: [],
      }),
    ).resolves.toBeUndefined();

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
