# Contributing

Thanks for helping improve jev-mcp.

This project was built for personal use and shared as a starting point. Forking it and changing it for your own needs is the main way to use it. Pull requests are welcome, but features outside the original scope may not be merged.

## Setup

Requires Node.js 22+ and [pnpm](https://pnpm.io).

```sh
git clone https://github.com/achapla/jev-mcp.git
cd jev-mcp
pnpm install
pnpm test
```

Tests mock the Jev API, so they do not need an API key.

## Project layout

| Path | Purpose |
|---|---|
| `src/index.ts` | MCP server and tool definitions |
| `src/decide.ts` | Turns rules into Jev questions and adds `decision` / `uncertain` |
| `src/rules.ts` | Rule schema and YAML loading |
| `src/jev.ts` | OpenRouter Decisions API client |
| `examples/` | Ready-to-use rule sets |
| `test/` | Tests (`node:test`) |

## Pull requests

- Keep each pull request focused on one change.
- Add or update tests for behavior changes.
- Update `README.md` and `CHANGELOG.md` when users would notice the change.
- New example rule sets are welcome. Add the file to `examples/` and a row to `examples/README.md`. The tests check that every example loads.

## Reporting bugs

Open an issue with the tool you called, its arguments (remove private data), the result, and what you expected.
Do not include your API key.
