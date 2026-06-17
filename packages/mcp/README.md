# @robotactions/mcp

One-command installer that connects your AI agent's MCP host (Claude Desktop, Cursor, VS Code Copilot Chat, Windsurf, Goose, Cline, Continue) to your Robot Actions account so you can drive real Android + iOS devices from natural-language chat.

## Install

```bash
npx @robotactions/mcp init
```

That's it. The installer:

1. Detects which MCP hosts you have installed on this machine.
2. Opens your browser to **auth.robotactions.com** for a one-time login (OAuth 2.0 Device Authorization Grant — same flow as `gh auth login`).
3. Creates an API token in your Robot Actions account (you can see + revoke it any time at **Settings → API Tokens**).
4. Writes the server entry into each host's MCP config file, merging cleanly with any other MCP servers you already have configured (a `.bak` of the original config is made first).
5. Tells you to restart the host. Robot Actions tools appear in the agent's tool list.

## Targeting specific hosts

```bash
npx @robotactions/mcp init --host cursor
npx @robotactions/mcp init --host claude-desktop --host vscode-copilot
npx @robotactions/mcp init --all
```

Supported host IDs: `claude-desktop`, `cursor`, `vscode-copilot`, `windsurf`, `goose`, `continue`, `cline`.

## Where configs land

| Host | macOS | Windows | Linux |
|---|---|---|---|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` | `%APPDATA%\Claude\claude_desktop_config.json` | `~/.config/Claude/claude_desktop_config.json` |
| Cursor | `~/.cursor/mcp.json` | same | same |
| VS Code Copilot | `~/Library/Application Support/Code/User/mcp.json` | `%APPDATA%\Code\User\mcp.json` | `~/.config/Code/User/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | same | same |
| Goose | `~/Library/Application Support/Block/goose/config.yaml` | `%APPDATA%\Block\goose\config.yaml` | `~/.config/Block/goose/config.yaml` |
| Continue | `~/.continue/config.json` | same | same |
| Cline | inside the VS Code extension storage dir | same | same |

The installer always backs up your existing config to `<path>.bak` before writing.

## Manual install (no CLI)

If you'd rather not run the CLI, every host accepts a hand-written MCP server entry pointing at your tenant's SSE endpoint with a Bearer token from **Settings → API Tokens**. See [USING_MCP.md](../../USING_MCP.md) in this repo for copy-paste snippets.

## Revoking access

Open **Settings → API Tokens** in your Robot Actions account and revoke the token named `MCP CLI (<your-hostname>)`. The host stops working on its next call.

## Reporting issues

File at <https://github.com/krishtoautomate/robotactions/issues>.

## License

MIT — see [LICENSE](./LICENSE).
