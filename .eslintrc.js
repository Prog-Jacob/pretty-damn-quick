/** @type import('eslint').Linter.Config */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["./tsconfig.json", "./tsconfig.eslint.json"],
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
  ],
  overrides: [
    {
      files: [
        "*.js",
        ".*.js",
        "*.config.js",
        ".*rc.js",
        "generate-contributors.js",
        "lint-staged.config.js",
        "jest.config.js",
      ],
      env: {
        node: true,
      },
      rules: {
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
      },
    },
  ],
};
