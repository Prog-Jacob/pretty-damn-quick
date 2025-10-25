# pretty-damn-quick (Coming Soon)

**pretty-damn-quick** is a CLI tool that formats or checks only the lines you’ve actually changed. It helps you keep your code clean without wasting time on files you didn’t modify.

## What does it do?

- Formats or checks just the changed or staged lines/files in your codebase.
- Integrates with Prettier and supports popular file types.
- Lets you focus on your work and keeps your git history clean.

## Usage

```sh
npx pretty-damn-quick --changed --lines
```

## Options

```bash
Options:
  --version     Show version number                                    [boolean]
  --check       Only check formatting, do not change files             [boolean]
  --staged      Run only on staged files                               [boolean]
  --changed     Run only on changed files                              [boolean]
  --lines       Format only changed or staged lines                    [boolean]
  --extensions  Comma-separated list of file extensions to process (e.g.,
                'ts,js,jsx')                                           [string]
  --help        Show help                                              [boolean]
```

## Examples

Format only the lines you changed in staged files:

```sh
npx pretty-damn-quick --staged --lines
```

Check formatting (without changing files) for all changed files:

```sh
npx pretty-damn-quick --changed --check
```

## Status

This tool is under active development and will be published to npm soon.
