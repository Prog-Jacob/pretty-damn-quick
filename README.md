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
pretty-damn-quick [options] [glob]

Options:
  --version     Show version number                                    [boolean]
  --check       Do not format, just check formatting                   [boolean]
  --staged      Run only on staged files                               [boolean]
  --changed     Run only on changed files                              [boolean]
  --lines       Format only changed/staged lines                       [boolean]
  --extensions  Comma-separated list of file extensions to process (e.g.,
                'ts,js,jsx')                                            [string]
  --help        Show help                                              [boolean]

Examples:
  pretty-damn-quick --changed               Format all changed files in the repo
  pretty-damn-quick --staged                Format all staged files in the repo
  pretty-damn-quick --changed               Format changed files matching the
  "src/**/*.{ts,js}"                        glob pattern
  pretty-damn-quick --changed --lines       Format only changed lines in changed
                                            files

Format only your changed or staged files with Prettier, fast.
```

Add to your package.json scripts:

```json
{
  "scripts": {
    "cl:format": "pretty-damn-quick --changed --lines"
  }
}
```

## Status

This tool is under active development and will be published to npm soon.
