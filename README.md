# Robot Actions

**Test mobile and web apps from anywhere.** Robot Actions is a cloud-connected testing platform that lets you control real Android and iOS devices through a web browser, automate test flows with an AI assistant, and generate runnable test scripts in your framework of choice (WebdriverIO, Python, Robot Framework, and more).

🔗 **Product**: <https://robotactions.com>
📋 **Pricing & tiers**: <https://robotactions.com/pricing>
📨 **Sales & enterprise**: hello@robotactions.com
🤖 **Drive Robot Actions from an AI agent**: [USING_MCP.md](USING_MCP.md) — Claude Desktop, Cursor, Windsurf, Claude Code, and any other MCP-compatible client

---

## What this repo is for

This repo contains **no application source code** — Robot Actions is a hosted product, there is nothing to install or build. The repo exists for three current purposes plus one that's coming:

1. **Public issue intake.** File a bug, request a feature, or ask a question via the [Issues tab](../../issues). No paid account required — drive-by feedback is welcome.
2. **Release notes.** Every shipped change is published as a [Release](../../releases) with user-facing notes. That's the running changelog.
3. **Test framework examples (coming soon).** Once the product is more widely used, this repo will host runnable example scripts in the test frameworks Robot Actions can generate — WebdriverIO, Python (`appium-python-client` style), Robot Framework, and more. These will live as small standalone projects under `examples/` so you can copy-paste a starting point. **None of the application source will ever land here** — the examples are public starter templates, not the product.
4. **Public roadmap & discussions** — being scoped.

## When to file an Issue here vs. when to email us

| Filing here | Email us at hello@robotactions.com |
|---|---|
| Bug reproductions, feature requests, public questions | Account-specific issues (billing, credentials, dedicated deployments) |
| "Does Robot Actions support X?" | Anything that would expose your account email, device IDs, or session data publicly |
| General feedback / ideas | Sales conversations, enterprise contracts |

## Security disclosures

**Do not file security issues here.** See [SECURITY.md](SECURITY.md) for the responsible-disclosure process.

## Releases

Every shipped change is published as a Release with user-facing notes. [Browse releases →](../../releases)

---

## License

This README, the issue templates, and any future `examples/` test scripts are MIT-licensed. The Robot Actions product itself is a hosted commercial service — not open source, and no application source code lives in this repo.
