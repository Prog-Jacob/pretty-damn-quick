type LogRange = string | undefined;
export type LogLevel = "info" | "warn" | "error";
type ExtendedLogLevel = LogLevel | "formatted" | "skipped" | "need formatting";
type LogEntry = {
  level: LogLevel;
  value: unknown;
  file?: string;
};

type Logger = {
  info: (msg: string, file?: string) => void;
  warn: (msg: unknown, file?: string) => void;
  error: (msg: unknown, file?: string) => void;
  formatted: (file: string, range?: LogRange) => void;
  checked: (file: string, range?: LogRange) => void;
  skipped: (file: string, reason: string) => void;
  printSummary: (opts?: { level?: LogLevel }) => void;
};

const LOG_ENTRIES: LogEntry[] = [];
const LEVEL_COLORS: Record<ExtendedLogLevel, string> = {
  info: "\x1b[34m", // Blue
  warn: "\x1b[33m", // Yellow
  error: "\x1b[31m", // Red
  formatted: "\x1b[32m", // Green
  skipped: "\x1b[36m", // Cyan
  "need formatting": "\x1b[35m", // Magenta
};
const COLOR_RESET = "\x1b[0m";
const getPrefix = (level: ExtendedLogLevel): string =>
  `${LEVEL_COLORS[level]}[${level.toUpperCase()}]${COLOR_RESET}`;

function logWithLevel(msg: unknown, file: string | undefined, level: LogLevel) {
  LOG_ENTRIES.push({ level, value: msg, file });
  const prefix = getPrefix(level);

  if (msg instanceof Error) {
    console.log(`${prefix} ${msg.message}`);
    if (msg.stack && !msg.message.includes(msg.stack)) {
      console.log(`${msg.stack}`);
    }
  } else {
    console.log(`${prefix} ${String(msg)}`);
  }
}

const log: Logger = {
  info: (msg, file) => logWithLevel(msg, file, "info"),
  warn: (msg, file) => logWithLevel(msg, file, "warn"),
  error: (msg, file) => logWithLevel(msg, file, "error"),
  formatted: (file, range) =>
    log.info(`${getPrefix("formatted")} ${file}${range ? ` [${range}]` : ""}`),
  checked: (file, range) =>
    log.warn(
      `${getPrefix("need formatting")} ${file}${range ? ` [${range}]` : ""}`,
    ),
  skipped: (file, reason) =>
    log.warn(`${getPrefix("skipped")} ${file} (${reason})`),
  printSummary: (opts = {}) => {
    const levelOrder: LogLevel[] = ["info", "warn", "error"];
    const filterLevel = opts.level ?? "error";
    const filterIdx = levelOrder.indexOf(filterLevel);
    const filtered = LOG_ENTRIES.filter(
      (entry) => levelOrder.indexOf(entry.level) >= filterIdx,
    );

    if (filtered.length) {
      console.log(`\nLog summary (level: ${filterLevel}):`);
    }

    for (const { level, value, file } of filtered) {
      const fileStr = file ? ` [${file}]` : "";
      const prefix = getPrefix(level);

      if (value instanceof Error) {
        console.log(`${prefix} ${fileStr} ${value.message}`);

        if (value.stack && !value.message.includes(value.stack)) {
          console.log(value.stack);
        }
      } else {
        console.log(`${prefix} ${fileStr} ${String(value)}`);
      }
    }
  },
};

export default log;
