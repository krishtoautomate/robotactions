# MCP registry submissions — status & copy-paste payloads

Tracks where Robot Actions is listed across the MCP / AI-tool ecosystem. Each section shows: status, the exact action required, and (where applicable) the copy-paste payload to file the submission.

---

## ✅ GitHub MCP Registry (the official one)

**Status**: submitted in commit [`3f897ff`](https://github.com/krishtoautomate/robotactions/commit/3f897ff) — `server.json` + the `mcp-name` marker make this repo auto-discoverable by the registry's GitHub ingestion.

**Verify ingestion**:

```bash
curl -s 'https://registry.modelcontextprotocol.io/v0/servers?search=robotactions' | jq .
```

If the entry doesn't appear after a few days of the commit landing, re-check `server.json` schema against <https://modelcontextprotocol.io/registry/about>.

**No further action needed** unless `server.json` shape changes — registry re-ingests on every push to default branch.

---

## 🟡 Cursor Directory (cursor.directory)

**Status**: `.mcp.json` is in the repo root (this PR). Cursor's auto-detector keys off that file shape.

**Action — manual (one-time)**:

1. Sign in at <https://cursor.directory/plugins/new> with GitHub
2. Paste this repo URL: `https://github.com/krishtoautomate/robotactions`
3. Cursor's SDK agent clones the repo, finds `.mcp.json`, and lists Robot Actions as an installable MCP server
4. Click Submit

After submission, the listing appears at `cursor.directory/mcp/robot-actions` (or similar) and users can click "Add to Cursor" — which writes the `.mcp.json` shape directly into their `~/.cursor/mcp.json`.

**The token** — Cursor Directory's auto-add doesn't know how to mint one. Listing description should tell users to either (a) run `npx @robotactions/mcp init` instead, or (b) generate from Settings → API Tokens. The `${ROBOTACTIONS_API_TOKEN}` placeholder in `.mcp.json` makes this explicit.

---

## 🟡 mcp.so (community registry)

**Status**: not submitted.

**Action — file an issue at <https://github.com/chatmcp/mcp-directory/issues>**:

> **Title**: `New server: Robot Actions — drive Android + iOS devices from natural language`
>
> **Body**:
> ```
> # Submission
>
> **Name**: Robot Actions
> **Repository**: https://github.com/krishtoautomate/robotactions
> **Type**: Hosted (SSE / Streamable HTTP)
> **Endpoint**: https://{tenant}.robotactions.com/mcp/sse (and /mcp for Streamable HTTP)
> **Categories**: mobile, testing, browser-automation, qa
> **Tags**: android, ios, device-control, web-automation, mobile-testing, test-automation
> **Icon**: https://www.robotactions.com/images/logo/robot-actions-icon-dark-green-rgb.svg
> **Homepage**: https://www.robotactions.com
> **Documentation**: See USING_MCP.md in the repo
>
> # What it does
> Robot Actions is a hosted MCP server that lets AI agents drive real Android & iOS devices and web browsers from natural language. Same actions you'd take in the web UI: tap, swipe, type, screenshot, page-source dump, app install/launch, flow record + replay, Selenium/Appium session management.
>
> # Install
> ```bash
> npx @robotactions/mcp init
> ```
> The installer detects which MCP host(s) you have (Claude Desktop, Cursor, VS Code Copilot, Windsurf, Goose, Cline, Continue), logs you into Robot Actions via OAuth, mints an API token in your account, and writes the SSE config into each host. Manual install instructions also in USING_MCP.md.
> ```

---

## 🟡 Cline marketplace

**Status**: deferred — see the related entry in the RemoteDeviceServer TASKS.md. Pre-requisite (this PR's CLI installer) is now ready, so the deferred entry can be reactivated.

**Action — file an issue at <https://github.com/cline/mcp-marketplace/issues/new?template=mcp-server-submission.yml>** with these field values:

- **GitHub Repo URL**: `https://github.com/krishtoautomate/robotactions`
- **Logo Image**: 400×400 PNG hosted on the marketing CDN (resize from `02 Logo Files/Icon/Dark Green/Web/` if not yet uploaded)
- **Why include**: real Android + iOS devices and web browsers from natural language for mobile + web QA. One-command install via `npx @robotactions/mcp init`. Hosted SaaS — users sign up at robotactions.com, get an API token, install in any MCP host.

Verify Cline's mcpServers JSON schema BEFORE filing — Cline has changed format historically. Current source of truth: <https://docs.cline.bot/mcp/configuring-mcp-servers>.

---

## ❌ skills.sh — NOT applicable

skills.sh is the **Agent Skills Directory** (Anthropic/Vercel-style `SKILL.md` skills, used by Claude Code / Cursor / Cline as procedural-knowledge bundles). It is NOT an MCP server registry. Robot Actions is an MCP server, not a Skill — wrong fit.

We *could* publish a `SKILL.md` that wraps the install instructions ("To use Robot Actions, first run `npx @robotactions/mcp init`, then call `device_screenshot`…") but it's a stretch and adds maintenance for marginal discovery value. Skip unless a real user asks for it.

---

## ✋ Anthropic / Claude Desktop directory

Anthropic does not currently maintain an official Claude Desktop MCP directory — discovery is via the user's own `claude_desktop_config.json` or the community curators above. No submission target.

---

## Maintenance

When `server.json` changes (new version, new transport, schema bump), re-run the verify curl above. When the npm package version bumps, no registry resubmission needed — registries point at the repo, not the package.
