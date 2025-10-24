/** @typedef {import('ts-jest')} */
/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/?(*.)+(spec|test).[jt]s?(x)"],
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
    "^.+\\.(js|jsx)$": "babel-jest",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  coveragePathIgnorePatterns: [".test-d.ts", "/__fixtures__/"],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
};
