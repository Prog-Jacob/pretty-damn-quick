import log from "./log";
import { escapeRegex } from "./marker";

const stripAnsi = (str: string) =>
  str.replaceAll(new RegExp(`${escapeRegex("\x1b[")}[0-9;]*m`, "g"), "");
const getOutput = () => logs.map(stripAnsi).join("\n");
const originalConsole = global.console;
let logs: string[] = [];

beforeEach(() => {
  logs = [];
  global.console = {
    ...originalConsole,
    log: (msg: string) => logs.push(msg),
  };
});

afterEach(() => {
  global.console = originalConsole;
});

describe("log", () => {
  describe("basic log levels", () => {
    it.each([
      ["info", "hello", "[INFO] hello"],
      ["warn", "be careful", "[WARN] be careful"],
      ["error", "bad", "[ERROR] bad"],
    ])("%s() logs message with correct prefix", (level, message, expected) => {
      log[level as "info" | "warn" | "error"](message);
      expect(getOutput()).toContain(expected);
    });
  });

  describe("file formatting status", () => {
    it.each([
      ["formatted", undefined, "[INFO] [FORMATTED] file.js"],
      ["formatted", "1-2", "[INFO] [FORMATTED] file.js [1-2]"],
      ["checked", undefined, "[WARN] [NEED FORMATTING] file.js"],
      ["checked", "3-4", "[WARN] [NEED FORMATTING] file.js [3-4]"],
    ])(
      "%s() with range=%s includes correct output",
      (method, range, expected) => {
        log[method as "formatted" | "checked"]("file.js", range);
        expect(getOutput()).toContain(expected);
      },
    );
  });

  it("skipped() includes file and reason", () => {
    log.skipped("file.js", "not staged");
    expect(getOutput()).toContain("[WARN] [SKIPPED] file.js (not staged)");
  });

  it("error() handles Error objects with stack traces", () => {
    const err = new Error("fail message");
    err.stack = "stacktrace";

    log.error(err, "file.js");
    const output = getOutput();

    expect(output).toContain("[ERROR] fail message");
    expect(output).toContain("stacktrace");
  });
});

describe("log.printSummary", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("filters log entries by minimum level", async () => {
    const log = (await import("./log")).default;

    // Create logs at different levels
    log.info("info message", "file1.js");
    log.warn("warn message", "file2.js");
    log.error("error message", "file3.js");

    logs = [];
    log.printSummary({ level: "warn" });
    const output = getOutput();

    expect(output).toContain("Log summary (level: warn):");
    expect(output).toContain("[WARN]  [file2.js] warn message");
    expect(output).toContain("[ERROR]  [file3.js] error message");
    expect(output).not.toContain("info message");
  });

  it("prints nothing when no entries match filter", async () => {
    const log = (await import("./log")).default;

    logs = [];
    log.printSummary({ level: "error" });

    expect(getOutput()).not.toContain("Log summary");
  });

  it("includes error stack traces in summary", async () => {
    const log = (await import("./log")).default;
    const err = new Error("fail!");
    err.stack = "my-stack-trace";

    log.error(err, "file.js");

    logs = [];
    log.printSummary({ level: "error" });

    expect(getOutput()).toContain("my-stack-trace");
  });

  describe("file path formatting", () => {
    it.each([
      ["includes file path when provided", "file.js", true],
      ["omits file path when not provided", undefined, false],
    ])("%s", async (_, file, shouldIncludeFile) => {
      const log = (await import("./log")).default;

      log.info("msg", file);

      logs = [];
      log.printSummary({ level: "info" });
      const output = getOutput();

      if (shouldIncludeFile) {
        expect(output).toContain("[file.js]");
      } else {
        expect(output).not.toContain("[file.js]");
      }
    });
  });

  it("uses default parameters when called without arguments", async () => {
    const log = (await import("./log")).default;

    logs = [];
    log.printSummary();

    expect(Array.isArray(logs)).toBe(true);
  });
});
