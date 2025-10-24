import log from "./log";

describe("log", () => {
  const originalConsole = global.console;
  let logs: string[] = [];
  let warns: string[] = [];
  let errors: string[] = [];

  beforeEach(() => {
    logs = [];
    warns = [];
    errors = [];
    global.console = {
      ...originalConsole,
      log: (msg: string) => logs.push(msg),
      warn: (msg: string) => warns.push(msg),
      error: (msg: string) => errors.push(msg),
    };
  });

  afterEach(() => {
    global.console = originalConsole;
  });

  it("logs info", () => {
    log.info("hello");
    expect(logs).toContain("hello");
  });

  it("logs warn", () => {
    log.warn("be careful");
    expect(warns).toContain("Warning: be careful");
  });

  it("logs error", () => {
    log.error("bad");
    expect(errors).toContain("Error: bad");
  });

  it("logs formatted with and without range", () => {
    log.formatted("file.js");
    expect(logs).toContain("Formatted: file.js");
    log.formatted("file.js", "1-2");
    expect(logs).toContain("Formatted: file.js [1-2]");
  });

  it("logs checked with and without range", () => {
    log.checked("file.js");
    expect(logs).toContain("Needs formatting: file.js");
    log.checked("file.js", "3-4");
    expect(logs).toContain("Needs formatting: file.js [3-4]");
  });

  it("logs skipped", () => {
    log.skipped("file.js", "not staged");
    expect(warns).toContain("Warning: Skipped: file.js (not staged)");
  });
});
