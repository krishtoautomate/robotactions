---
name: robotactions-getting-started
description: Connect an MCP host to the RobotActions device cloud and verify the connection works. Use when RobotActions tools are missing or erroring, when setting up a new machine or CI job, when a call returns 401/403, or when the user asks how to install, configure, or authenticate the RobotActions MCP server.
license: MIT
---

# Connecting to RobotActions

RobotActions is a hosted device cloud. One MCP server exposes real Android and iOS
devices plus desktop browsers to your agent. This skill gets that connection working
and proves it before any test work starts.

## Check first — is it already connected?

Do not install anything until you know it is missing. Call:

```
device_list
```

- **A device list comes back** → you are connected. Stop here; go straight to
  `mobile-app-testing` or `web-app-testing`.
- **The tool does not exist** → the MCP server is not registered. Install it below.
- **401 / 403 / "unauthorized"** → the server is registered but the token is bad
  or expired. Skip to *Authentication*.

## Install

Two things are needed: a **tenant subdomain** and an **API token**.

| | |
|---|---|
| Tenant | Your account subdomain, e.g. `acme` for `https://acme.robotactions.com`. Use `test` for the shared free tenant. |
| API token | Portal → **Profile → API Tokens** → create one. It is shown once. |

### Already installed the Claude Code plugin?

The `robotactions` plugin ships an MCP server entry with it, so the server may already be
registered. It points at the **shared free `test` tenant** and reads the token from the
`ROBOTACTIONS_API_TOKEN` environment variable:

```bash
export ROBOTACTIONS_API_TOKEN="<your-api-token>"
```

**If you have a paid tenant, that entry is pointing at the wrong host.** Replace it using
one of the methods below with your own subdomain — otherwise you will be driving the
shared free devices and wondering why your own are not listed.

### One-line installer (preferred)

Auto-detects installed MCP hosts and writes the right config shape for each:

```bash
npx --yes @robotactions/mcp init
```

Target a single host instead of auto-detecting:

```bash
npx --yes @robotactions/mcp init --host claude-code-cli
# also: claude-desktop | cursor | windsurf | vscode-copilot
```

### Claude Code, by hand

```bash
claude mcp add robot-actions \
  --transport sse \
  https://<tenant>.robotactions.com/mcp/sse \
  --header "Authorization: Bearer <api-token>"
```

### Hosts that accept a URL directly (Cursor, Windsurf, Continue)

```json
{
  "mcpServers": {
    "robot-actions": {
      "url": "https://<tenant>.robotactions.com/mcp/sse",
      "headers": { "Authorization": "Bearer <api-token>" }
    }
  }
}
```

### Hosts that only speak stdio (Claude Desktop, Cline, Goose)

These reject the URL shape above with "not valid MCP server configurations". Bridge it:

```json
{
  "mcpServers": {
    "robot-actions": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://<tenant>.robotactions.com/mcp/sse",
        "--header",
        "Authorization: Bearer <api-token>"
      ]
    }
  }
}
```

Restart the host after editing its config. MCP servers are read at startup.

## Authentication

The token is a bearer token on every request. Two rules that save an hour of debugging:

- **A token that worked yesterday and 401s today has been rotated.** Mint a new one in
  the portal. Never guess at, patch, or hardcode a replacement.
- **Never commit the token.** In CI, put it in a secret and interpolate it into the
  config at job setup. In a repo, it belongs in an ignored `.env`, not in
  `.mcp.json`.

## Verify

Connection is not proven until a device answers. Run this sequence once:

```
device_list                     → pick a udid with state "device" (Android)
                                  or "Connected" (iOS), and inUseByYou false
device_info(udid)               → confirms the device is reachable, not just listed
device_screenshot(udid)         → confirms you can actually observe it
device_release(udid)            → hand it back
```

If `device_list` returns an empty array on a paid tenant, no devices are provisioned
yet — that is an account question, not a config bug. On the `test` tenant, devices are
shared and may all be busy; retry shortly.

## Device holds and the parallel limit

There is no "reserve" call. **Your first tool call against a udid takes a hold on it**,
and that hold counts against your plan's parallel-device limit until you release it or
it times out from idleness.

`device_list` reports where you stand:

```json
"parallelUsage": { "active": 1, "cap": 5, "inUse": ["R5CR10T9PLE"] }
```

Always `device_release(udid)` when finished with a device — including on the failure
path. A crashed run that never releases burns a slot until the idle timer expires.

## Choosing a device

`device_list` gives you `model`, `manufacturer`, `os`, `osVersion`, `state`, and
`inUseByYou`. Pick deliberately:

- **Filter by `os`** — `"Android"` or `"iOS"`. The tool families are different
  (`device_*` vs `ios_*`); picking the wrong one is the most common early mistake.
- **Filter by `osVersion`** when the bug is version-specific.
- **Prefer `inUseByYou: false`** and `state: "device"` / `"Connected"`.
- If the user named a device ("test on the S21"), match on `model` — but confirm it is
  free before building a plan around it.

## Where to go next

| You want to… | Skill |
|---|---|
| Drive a native Android/iOS app | `mobile-app-testing` |
| Test a website on a real device browser or the desktop grid | `web-app-testing` |
| Record a flow once and replay it as a regression test | `flow-record-replay` |

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Tools absent after editing config | Host caches MCP servers at startup | Restart the host fully |
| 401 on every call | Token rotated, or `Bearer ` prefix missing | Mint a new token; check the header is `Authorization: Bearer <token>` |
| 404 on the endpoint | Wrong tenant subdomain | Confirm it matches your portal URL |
| Claude Desktop: "not valid MCP server configurations" | It cannot take a URL-shaped entry | Use the `mcp-remote` stdio config above |
| `device_list` works, device calls hang | Device is held by another session | Pick a different udid from the list |
