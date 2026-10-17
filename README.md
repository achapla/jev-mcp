# jev-mcp

[![CI](https://github.com/achapla/jev-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/achapla/jev-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An [MCP](https://modelcontextprotocol.io) server that lets AI assistants make **typed decisions** with [Jev](https://openrouter.ai/docs/guides/community/jev), TypeSafe's decision model on OpenRouter.

Instead of a fixed workflow, you write **rules**: yes/no or multiple-choice questions in plain language. The AI passes in the context (a GitHub issue, an email, a support ticket, a social media post) and gets back a decision with a probability.

```text
"Should this issue be split into sub-issues?"  ->  yes  (probability 0.85)
"How big is this work?"                        ->  large (confidence 0.86)
"Should we create the pull request now?"       ->  no   (probability 0.60, uncertain -> ask the user)
```

## About this project

I built this for my own use. It does not support every Jev feature (for example the `score` and `box` question types and image input), and some design choices fit my personal workflow only.

I am sharing it so others can get ideas from it and build or customize their own MCP server for their needs. Feel free to fork it and change anything.

## Why

- **Rules instead of a hard-coded workflow.** Change behavior by editing a YAML file, not code.
- **Consistent, measurable decisions.** Jev returns a probability, not a free-text opinion. You set the threshold for each rule.
- **Knows when it is unsure.** Results close to the threshold are marked `uncertain`, so the AI asks you instead of guessing.
- **Cheap.** Jev charges $0.042 per 1M input tokens, and output is free. A typical call with 5 rules costs about $0.00003.

## Who is it for

- **Developers**: decide whether to split an issue, run a code review, add tests or open a PR. See [examples/github-issues.yaml](examples/github-issues.yaml).
- **Support teams**: route tickets, detect angry customers, decide when a human must take over.
- **Anyone using an AI assistant**: triage email, decide which LinkedIn posts to comment on, check a draft before publishing. No coding needed.

See [examples/](examples/) for ready-to-use rule sets and what to say to the AI.

## Requirements

- Node.js 22 or newer
- An [OpenRouter API key](https://openrouter.ai/keys) with credits
- An MCP client, for example Claude Code, Claude Desktop, Cursor or VS Code

## Install

```sh
git clone https://github.com/achapla/jev-mcp.git
cd jev-mcp
pnpm install
pnpm build
```

This creates `dist/index.js`. Use its full path in the client config below.

### Claude Code

```sh
claude mcp add jev --scope user -e OPENROUTER_API_KEY=sk-or-... -- node /full/path/to/jev-mcp/dist/index.js
```

If `OPENROUTER_API_KEY` is already set in your environment, you can leave out `-e ...`.

### Claude Desktop (no coding needed)

1. Install [Node.js](https://nodejs.org) (LTS version).
2. Download this repository (green **Code** button → **Download ZIP**) and unzip it.
3. Open a terminal in the unzipped folder and run `npx pnpm install` and then `npx pnpm build`.
4. In Claude Desktop, open **Settings → Developer → Edit Config**, and add:

```json
{
  "mcpServers": {
    "jev": {
      "command": "node",
      "args": ["C:/path/to/jev-mcp/dist/index.js"],
      "env": {
        "OPENROUTER_API_KEY": "sk-or-...",
        "JEV_RULES_FILE": "C:/path/to/my-rules.yaml"
      }
    }
  }
}
```

5. Restart Claude Desktop. Then ask, for example: *"Use jev to check if this email needs a reply today: ..."*

`JEV_RULES_FILE` is optional. Without it, you can still ask one-off questions, or tell Claude which rules file to use.

### Other MCP clients

Use the same `command`, `args` and `env` as above. The server uses the stdio transport.

## Rules

Rules live in a YAML file. By default, the server looks for `.jev/rules.yaml` in the working directory. You can change this with `JEV_RULES_FILE` or the `rules_file` tool argument.

```yaml
defaults:          # optional
  threshold: 0.5   # yes_no: decision = yes when probability >= threshold
  margin: 0.1      # yes_no: uncertain when probability is within margin of threshold
  min_confidence: 0.6  # choice: uncertain when confidence is below this

rules:
  split_issue:
    type: yes_no
    question: Should this issue be split into sub-issues?
    yes_when: Several independent parts, or too big for one pull request.
    no_when: One focused change that fits in a single pull request.
    threshold: 0.6   # optional, overrides the default

  work_size:
    type: choice
    question: How big is this work?
    options:
      small: Less than one day of work.
      medium: One to three days of work.
      large: More than three days of work.
    min_confidence: 0.7  # optional
```

Tips for writing good rules are in [examples/README.md](examples/README.md#writing-good-rules).

## Tools

| Tool | Arguments | Use it for |
|---|---|---|
| `evaluate_rules` | `context`, `rule_ids?`, `custom_rules?`, `rules_file?` | Run several rules in one call. Omit `rule_ids` to run all file rules. Pass `rule_ids: []` to run only `custom_rules`. |
| `ask_yes_no` | `context`, `question`, `yes_when`, `no_when`, `threshold?`, `margin?` | One custom yes/no question |
| `ask_choice` | `context`, `question`, `options`, `min_confidence?` | One custom multiple-choice question |
| `list_rules` | `rules_file?` | Show the rules in the rules file |

`context` can be plain text or a JSON object.

Example result of `evaluate_rules`:

```json
{
  "decisions": {
    "split_issue": {
      "type": "yes_no",
      "question": "Should this issue be split into sub-issues?",
      "decision": "yes",
      "probability": 0.85,
      "threshold": 0.6,
      "uncertain": false
    },
    "work_size": {
      "type": "choice",
      "question": "How big is this work?",
      "decision": "large",
      "confidence": 0.86,
      "probabilities": { "small": 0, "medium": 0.09, "large": 0.91 },
      "uncertain": false
    }
  },
  "model": "typesafe/jev-1.14-20261014",
  "cost_usd": 0.000025662
}
```

## Configuration

| Env var | Required | Default | Description |
|---|---|---|---|
| `OPENROUTER_API_KEY` | yes | | Your OpenRouter API key |
| `JEV_MODEL` | no | `~typesafe/jev-latest` | Jev model ID, for example `typesafe/jev-1.14` to pin a version |
| `JEV_RULES_FILE` | no | `.jev/rules.yaml` | Default rules file |

## Privacy

The `context` you pass is sent to OpenRouter and TypeSafe to make the decision. Do not send data you are not allowed to share with them. See the [OpenRouter privacy policy](https://openrouter.ai/privacy).

## Limitations

- Only OpenRouter is supported as the provider.
- Jev and the OpenRouter Decisions API are in beta (`/api/alpha/`), so the API may change.
- Only text context is supported. Image input and Jev's `score` and `box` question types are not exposed yet.
- Very long context (over about 32 KB of text) runs in Jev's slower, less accurate long-context mode. Send only what the decision needs.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)

This is an independent project. It is not affiliated with TypeSafe or OpenRouter.
