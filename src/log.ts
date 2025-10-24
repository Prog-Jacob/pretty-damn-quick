type LogRange = string | undefined;

type Logger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
  formatted: (file: string, range?: LogRange) => void;
  checked: (file: string, range?: LogRange) => void;
  skipped: (file: string, reason: string) => void;
};

const log: Logger = {
  info: (msg) => console.log(msg),
  warn: (msg) => console.warn(`Warning: ${msg}`),
  error: (msg) => console.error(`Error: ${msg}`),
  formatted: (file, range) =>
    log.info(`Formatted: ${file}${range ? ` [${range}]` : ""}`),
  checked: (file, range) =>
    log.info(`Needs formatting: ${file}${range ? ` [${range}]` : ""}`),
  skipped: (file, reason) => log.warn(`Skipped: ${file} (${reason})`),
};

export default log;
