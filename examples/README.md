# Examples

Each file is a ready-to-use rule set. Copy one, edit the wording to fit your situation, and point jev-mcp at it.

| File | For | What it decides |
|---|---|---|
| [github-issues.yaml](github-issues.yaml) | Developers | Issue type, size, split into sub-issues, missing info, responsive UI, DB migration, tests, code review, create PR now |
| [pull-request-review.yaml](pull-request-review.yaml) | Developers, reviewers | Review depth, security review, breaking change, description matches diff, ready to merge |
| [customer-support.yaml](customer-support.yaml) | Support teams | Which team, customer mood, refund request, hand over to a human, answer from docs |
| [email-triage.yaml](email-triage.yaml) | Anyone | Email category, needs reply, reply today, has deadline, looks like phishing |
| [linkedin-engagement.yaml](linkedin-engagement.yaml) | Anyone on social media | Should I comment, post tone, and checks on your draft comment |
| [content-publishing.yaml](content-publishing.yaml) | Writers, marketers | Ready to publish, reading level, call to action, needs fact check |

## How to use a rule set

**In a code repository:** copy the file to `<repo>/.jev/rules.yaml`. jev-mcp finds it when you start your MCP client (for example Claude Code) from the repository root.

**Anywhere else:** keep the file wherever you like and either
- set `JEV_RULES_FILE` to its full path in your MCP client config, or
- tell the AI which file to use: *"Use the rules in C:/rules/email-triage.yaml"*. It passes the path as `rules_file`.

## What to say to the AI

You do not call the tools yourself. You ask in normal language, and the AI client calls jev-mcp.

**Developer, GitHub issue**
> Read issue #42 with `gh issue view 42 --comments` and run evaluate_rules on it. If split_issue is yes, propose the sub-issues.

**Developer, before opening a PR**
> Run the create_pr_now rule with the issue text plus a summary of what we changed and the test results.

**Reviewer**
> Get PR #108 (description, changed files, diff, CI status) and run the rules in .jev/pr-review.yaml.

**Support agent**
> Here is a ticket: "...". Run evaluate_rules with customer-support.yaml and tell me which team and whether to escalate.

**Email**
> Here are my 10 unread emails. For each one, run the email triage rules and give me a table of what needs a reply today.

**LinkedIn**
> Here is a post: "...". Should I comment? If yes, write a comment, then check the draft with the comment rules and fix anything flagged.

**Writer**
> Check this draft with content-publishing.yaml before I publish it.

## Ask one-off questions without a rules file

You can also ask any yes/no or multiple-choice question directly. The AI uses `ask_yes_no` or `ask_choice`:

> Using jev, decide if this comment asks a question: "..."

> Using jev, pick the tone of this message: friendly, neutral, or annoyed.

## Turn rules into a workflow

Rules decide *what* to do. To make the AI check them at the right moment, write the steps once in your AI client's instructions (for example `CLAUDE.md` in a repository, or project instructions in Claude Desktop):

```markdown
## Issue workflow
1. When I give you an issue, run evaluate_rules with rule_ids [issue_type, work_size, split_issue, needs_clarification].
   - needs_clarification = yes: list the questions for the author and stop.
   - split_issue = yes: propose sub-issues and wait for my approval.
2. Before you start coding, run responsive_ui and needs_db_migration and include them in the plan.
3. When the code is done, run needs_tests and needs_code_review and do what they say.
4. Run create_pr_now with the issue, a change summary and test results. Open the PR only if it is yes.
If any result has "uncertain": true, ask me instead of deciding.
```

## Writing good rules

- **One question per rule.** "Does it need tests and a review?" should be two rules.
- **Describe both sides.** `yes_when` and `no_when` should be concrete and not overlap.
- **Pick the threshold from the cost of a mistake.** If missing a "yes" is costly (security review, phishing), use a low threshold like `0.3`. If a wrong "yes" is costly (merge, publish), use a high one like `0.7` or more.
- **Choice options should not overlap.** Each option should describe a clearly different case.
- **Pass enough context.** Jev only sees what you send it. For "create PR now", send the test results too, not only the issue.
