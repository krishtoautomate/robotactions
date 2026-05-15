# Using Robot Actions from an AI agent (MCP)

Robot Actions exposes an **MCP** (Model Context Protocol) endpoint that AI agents — Claude Desktop, Claude Code, Cursor, Windsurf, or any MCP-compatible client — can use to drive real Android and iOS devices programmatically. Same actions you'd take by hand in the web UI: tap, swipe, type, screenshot, page-source dump, app install/launch, flow record + replay, and a couple dozen more.

> **You need a Robot Actions account first.** Sign up at <https://robotactions.com>. The MCP endpoint is per-account — your AI agent talks to *your* devices, not anyone else's.

---

## 1. The endpoint

```
https://<your-subdomain>.robotactions.com/mcp/sse
```

Replace `<your-subdomain>` with the subdomain you land on after logging in (for most users that's `test.robotactions.com`, for enterprise tenants it's your own).

The transport is **SSE** (Server-Sent Events) — standard for MCP servers, no custom protocol.

---

## 2. Authentication — get an API token

The MCP endpoint requires a **Bearer token**. Generate one from your Robot Actions account:

1. Log into your subdomain.
2. Open **Settings → API Tokens**.
3. Click **Generate token**, give it a label (e.g. `claude-desktop-laptop`), and copy the token.

> Tokens are shown **once** at generation time. Store it somewhere your AI client can read it (a password manager, a secret in your shell, a CI secret store).
>
> Tokens are scoped to your account. Anyone with the token can drive your devices — treat it like a password.

---

## 3. Configuration snippets

### Claude Desktop / Cursor

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (Claude Desktop) or `.cursor/mcp.json` in your project (Cursor):

```json
{
  "mcpServers": {
    "robot-actions": {
      "url": "https://<your-subdomain>.robotactions.com/mcp/sse",
      "headers": {
        "Authorization": "Bearer <your-api-token>"
      }
    }
  }
}
```

Restart the client. The Robot Actions tools should appear in the agent's tool list.

### Claude Code (CLI)

```bash
claude mcp add robot-actions \
  --transport sse \
  https://<your-subdomain>.robotactions.com/mcp/sse \
  --header "Authorization: Bearer <your-api-token>"
```

Verify:

```bash
claude mcp list
```

### Windsurf / other MCP clients

Same shape — point them at the SSE URL with an `Authorization: Bearer <token>` header. Refer to your client's MCP docs for where the config file lives.

---

## 4. First-call verification

In any of those clients, ask the AI:

> *"List the devices I have available."*

The agent should call the `device_list` tool and return your connected Android + iOS devices. If you see them, the MCP integration is working.

If you get an auth error, the token is wrong or expired — regenerate from Settings.
If you get an empty list, no devices are connected to your account — connect one and try again.

---

## 5. What the AI can do

Once connected, the AI agent has access to all the same actions you do in the web UI:

- **Device discovery & state**: list devices, screenshot, page source, current foreground app, battery, Wi-Fi info.
- **Direct interaction**: tap (by coordinates or by visible text), swipe, long-press, scroll, type text, send keycodes.
- **App management**: install / uninstall / launch / terminate apps, list installed apps, clear app data.
- **Flow recording & replay**: list saved flows, replay a flow, watch live progress, generate test scripts.
- **Cross-platform sessions**: start a Selenium- or Appium-compatible session for any device, run scripts against it.
- **iOS-specific**: device info, lock/unlock, orientation, clipboard, crash logs.

Ask the agent what it can do — it'll enumerate the tools it has from your MCP endpoint.

---

## 6. Security notes

- **API tokens are bearer credentials.** Anyone holding the token can drive your devices. Don't paste them into chat, screenshots, or public Issues.
- **Revoke tokens** you no longer use from **Settings → API Tokens**.
- **Rotate** if a token may have been exposed.
- **One token per client/machine** is a good pattern — that way revoking one doesn't break the others.

If you suspect a token was compromised, revoke it immediately and email **security@robotactions.com**. See [SECURITY.md](SECURITY.md) for the disclosure process.

---

## 7. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Agent reports "MCP server not connecting" | URL typo, missing `Authorization` header, or token revoked |
| Agent connects but tools list is empty | Wrong subdomain — make sure the URL matches your account's actual subdomain |
| "401 Unauthorized" | Bearer token expired or revoked → generate a new one in Settings |
| "403 Forbidden" on device commands | Device locked by another user in your tenant — check the web UI for who has it |
| Tool calls time out | Device unresponsive (sleep, USB re-enum) — try waking it via the web UI first |

For anything else, file an issue on the [Issues tab](../../issues) or email support@robotactions.com.
