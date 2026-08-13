# Robot Actions Agent Skills

[![Agent Skills](https://skills.sh/b/krishtoautomate/robotactions)](https://skills.sh/krishtoautomate/robotactions)

Agent Skills that teach an AI coding agent how to use the [Robot Actions](https://robotactions.com)
MCP server — real Android and iOS devices, and real browsers, driven from natural language.

The MCP server hands an agent several hundred tools. These skills supply the missing
half: **when to reach for which tool, in what order, and which mistakes silently produce
a passing test that tested nothing.**

Browse them on the site: [robotactions.com/skills](https://robotactions.com/skills)

## Install

### Any agent — one command

```bash
npx skills add krishtoautomate/robotactions
```

Installs all four skills in a universal format that Claude Code, Cursor, GitHub Copilot,
Gemini CLI, Amp, Antigravity and a dozen other agents read. Nothing else to configure.

### Claude Code — as a plugin

```
/plugin marketplace add krishtoautomate/robotactions
/plugin install robotactions@robotactions
```

The plugin bundles all four skills **and** an MCP server entry, so installing it also
registers the server. That entry targets the shared free `test` tenant and reads your
token from `ROBOTACTIONS_API_TOKEN`:

```bash
export ROBOTACTIONS_API_TOKEN="<your-api-token>"
```

On a paid tenant, point it at your own subdomain instead — see
[USING_MCP.md](../USING_MCP.md) or run `npx --yes @robotactions/mcp init`.

### By hand

Each skill is a self-contained folder with a `SKILL.md`. Copy the ones you want into
whatever directory your agent loads skills from:

```bash
git clone https://github.com/krishtoautomate/robotactions.git
cp -r robotactions/skills/* ~/.claude/skills/
```

A machine-readable index of every skill lives at [`skills.json`](../skills.json) in the
repo root.

## The skills

| Skill | What it covers |
|---|---|
| [**robotactions-getting-started**](robotactions-getting-started/SKILL.md) | Connect an MCP host to the device cloud, authenticate, verify with a real device, understand device holds and the parallel limit. |
| [**mobile-app-testing**](mobile-app-testing/SKILL.md) | Drive native Android and iOS apps: install, locate elements without guessing coordinates, type without racing focus, wait properly, assert on what is actually on screen. |
| [**web-app-testing**](web-app-testing/SKILL.md) | Test the web on a real device browser or the desktop grid: snapshot-and-ref interaction, verified clicks, page network capture. |
| [**device-state-setup**](device-state-setup/SKILL.md) | Put the device into the state the test needs: push files so an upload picker has something to pick, seed an app's own container, mock GPS, force a locale, dark mode, clean app state. |
| [**network-mocking**](network-mocking/SKILL.md) | Capture and mock traffic for native app requests as well as web pages — error, empty, offline and slow-network states without a broken backend. |
| [**framework-integration**](framework-integration/SKILL.md) | Use the MCP tools alongside an existing Appium, Selenium, Playwright or WebdriverIO suite: lift stable locators into page objects, emit tests in their framework, run the suite on the grid. |
| [**flow-record-replay**](flow-record-replay/SKILL.md) | Record a walkthrough as a replayable regression test with assertions, build reusable components, replay across devices, diagnose failures step by step. |

## You still need an MCP connection

These skills are documentation, not a server. They assume the Robot Actions MCP server
is registered with your agent. If it is not, the `robotactions-getting-started` skill
walks through it — or, from [`packages/mcp`](../packages/mcp):

```bash
npx --yes @robotactions/mcp init
```

You will need a tenant subdomain and an API token from **Portal → Profile → API Tokens**.
The shared free tenant is `test`. See [USING_MCP.md](../USING_MCP.md) for the full setup.

## Contributing

Corrections and additions are welcome — especially failure modes you hit in practice
that are not written down here. Open an [issue](../../../issues) or a pull request.

MIT licensed, like the rest of the public material in this repo.
