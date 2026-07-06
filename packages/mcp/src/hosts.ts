/**
 * Per-MCP-host config-file layout knowledge.
 *
 * Each host stores its MCP server list in its own JSON config file with a
 * slightly different schema. This module abstracts the per-host shape so
 * the rest of the CLI can do a generic "add an entry pointing at our
 * SSE URL" without case statements scattered everywhere.
 *
 * Detection rule: a host is considered "installed" if its config-file
 * directory exists. We DO NOT require the file itself to exist (most
 * fresh installs of Claude Desktop / Cursor have no MCP config file yet
 * — we create it on first install).
 *
 * Schemas mirror the structures rendered by RDS's own
 * src/app/react/ui/user/mcpInstallDeeplinks.ts (which the Profile UI
 * already uses) so a token installed via this CLI lands in byte-identical
 * shape to one installed via the in-portal click-to-install flow.
 */

import { homedir, platform } from 'node:os';
import { join } from 'node:path';

export interface HostDescriptor {
    id: string;
    label: string;
    /** Resolves the GLOBAL (user-scoped) config file path on the current OS, or null if unsupported. */
    configPath: () => string | null;
    /**
     * Resolves the PROJECT-scoped (workspace) config path relative to `cwd`,
     * or undefined if this host has no per-project config. Only hosts that read
     * a workspace file define this — VS Code (`.vscode/mcp.json`), Cursor
     * (`.cursor/mcp.json`), Claude Code (`.mcp.json`). Claude Desktop / Goose /
     * Windsurf / Continue / Cline are global-only and omit it.
     */
    projectConfigPath?: (cwd: string) => string;
    /** Returns the existing file shape merged with our new entry. */
    buildConfig: (existing: unknown, sseUrl: string, token: string) => Record<string, unknown>;
}

const SERVER_NAME = 'robot-actions';

/**
 * Convert the legacy SSE endpoint (…/mcp/sse) to the Streamable HTTP endpoint
 * (…/mcp). The stateless /mcp endpoint is restart-immune; /mcp/sse is the
 * connection-bound legacy transport that orphans a client's session whenever
 * the server restarts (the "session expired while token valid" bug). Every
 * host that speaks Streamable HTTP targets /mcp.
 */
function toStreamableUrl(sseUrl: string): string {
    return sseUrl.replace(/\/mcp\/sse$/, '/mcp');
}

/** Cursor / Windsurf accept the URL+headers shape and auto-detect Streamable HTTP from /mcp. */
function buildMcpServersConfig(existing: unknown, sseUrl: string, token: string): Record<string, unknown> {
    const base =
        typeof existing === 'object' && existing !== null
            ? (existing as Record<string, unknown>)
            : {};
    const existingServers =
        typeof base.mcpServers === 'object' && base.mcpServers !== null
            ? (base.mcpServers as Record<string, unknown>)
            : {};

    return {
        ...base,
        mcpServers: {
            ...existingServers,
            [SERVER_NAME]: {
                url: toStreamableUrl(sseUrl),
                headers: { Authorization: `Bearer ${token}` },
            },
        },
    };
}

/**
 * Continue speaks Streamable HTTP but with a distinct shape from Cursor/Windsurf:
 * it requires an explicit `type: "streamable-http"` and nests auth under
 * `requestOptions.headers` (not a top-level `headers`). See Continue MCP docs
 * (docs.continue.dev/customize/deep-dives/mcp) — verified 2026-07-05.
 */
function buildContinueConfig(existing: unknown, sseUrl: string, token: string): Record<string, unknown> {
    const base =
        typeof existing === 'object' && existing !== null
            ? (existing as Record<string, unknown>)
            : {};
    const existingServers =
        typeof base.mcpServers === 'object' && base.mcpServers !== null
            ? (base.mcpServers as Record<string, unknown>)
            : {};

    return {
        ...base,
        mcpServers: {
            ...existingServers,
            [SERVER_NAME]: {
                type: 'streamable-http',
                url: toStreamableUrl(sseUrl),
                requestOptions: { headers: { Authorization: `Bearer ${token}` } },
            },
        },
    };
}

/**
 * Claude Desktop only accepts STDIO transport — the URL+headers shape that
 * Cursor accepts is rejected with "not valid MCP server configurations".
 * Wrap the Streamable HTTP endpoint with `mcp-remote`, the standard stdio
 * bridge (npmjs.com/package/mcp-remote), which auto-detects Streamable HTTP
 * and reconnects transparently. Spawned via npx so users don't need a
 * separate global install.
 *
 * Cline + Goose docs ALSO recommend this wrapper for remote MCP servers
 * — using the same shape across stdio-only hosts keeps the per-host
 * branching minimal.
 */
function buildClaudeDesktopConfig(existing: unknown, sseUrl: string, token: string): Record<string, unknown> {
    const base =
        typeof existing === 'object' && existing !== null
            ? (existing as Record<string, unknown>)
            : {};
    const existingServers =
        typeof base.mcpServers === 'object' && base.mcpServers !== null
            ? (base.mcpServers as Record<string, unknown>)
            : {};

    return {
        ...base,
        mcpServers: {
            ...existingServers,
            [SERVER_NAME]: {
                command: 'npx',
                args: [
                    '-y',
                    'mcp-remote',
                    toStreamableUrl(sseUrl),
                    '--header',
                    `Authorization: Bearer ${token}`,
                ],
            },
        },
    };
}

/** VS Code Copilot Chat config uses `servers` instead of `mcpServers` + a `type` field. */
function buildVsCodeConfig(existing: unknown, sseUrl: string, token: string): Record<string, unknown> {
    const httpUrl = toStreamableUrl(sseUrl);
    const base =
        typeof existing === 'object' && existing !== null
            ? (existing as Record<string, unknown>)
            : {};
    const existingServers =
        typeof base.servers === 'object' && base.servers !== null
            ? (base.servers as Record<string, unknown>)
            : {};

    return {
        ...base,
        servers: {
            ...existingServers,
            [SERVER_NAME]: {
                type: 'http',
                url: httpUrl,
                headers: { Authorization: `Bearer ${token}` },
            },
        },
    };
}

/**
 * Claude Code reads a project-root `.mcp.json` with the `mcpServers` envelope
 * and an explicit `type` for remote transports (same shape as `claude mcp add
 * --transport http`). Project-scoped so the server is shared with anyone who
 * opens the repo. Docs: docs.claude.com/en/docs/claude-code/mcp.
 */
function buildClaudeCodeConfig(existing: unknown, sseUrl: string, token: string): Record<string, unknown> {
    const base =
        typeof existing === 'object' && existing !== null
            ? (existing as Record<string, unknown>)
            : {};
    const existingServers =
        typeof base.mcpServers === 'object' && base.mcpServers !== null
            ? (base.mcpServers as Record<string, unknown>)
            : {};

    return {
        ...base,
        mcpServers: {
            ...existingServers,
            [SERVER_NAME]: {
                type: 'http',
                url: toStreamableUrl(sseUrl),
                headers: { Authorization: `Bearer ${token}` },
            },
        },
    };
}

// ── Project-scoped (workspace) config paths, relative to the run directory ──
function vscodeProjectPath(cwd: string): string {
    return join(cwd, '.vscode', 'mcp.json');
}
function cursorProjectPath(cwd: string): string {
    return join(cwd, '.cursor', 'mcp.json');
}
function claudeCodeProjectPath(cwd: string): string {
    return join(cwd, '.mcp.json');
}

function claudeDesktopPath(): string | null {
    const home = homedir();
    switch (platform()) {
        case 'darwin':
            return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
        case 'win32': {
            const appdata = process.env.APPDATA;
            return appdata ? join(appdata, 'Claude', 'claude_desktop_config.json') : null;
        }
        case 'linux':
            return join(home, '.config', 'Claude', 'claude_desktop_config.json');
        default:
            return null;
    }
}

function cursorPath(): string | null {
    return join(homedir(), '.cursor', 'mcp.json');
}

function vscodePath(): string | null {
    const home = homedir();
    switch (platform()) {
        case 'darwin':
            return join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp.json');
        case 'win32': {
            const appdata = process.env.APPDATA;
            return appdata ? join(appdata, 'Code', 'User', 'mcp.json') : null;
        }
        case 'linux':
            return join(home, '.config', 'Code', 'User', 'mcp.json');
        default:
            return null;
    }
}

function windsurfPath(): string | null {
    return join(homedir(), '.codeium', 'windsurf', 'mcp_config.json');
}

function goosePath(): string | null {
    const home = homedir();
    switch (platform()) {
        case 'darwin':
            return join(home, 'Library', 'Application Support', 'Block', 'goose', 'config.yaml');
        case 'win32': {
            const appdata = process.env.APPDATA;
            return appdata ? join(appdata, 'Block', 'goose', 'config.yaml') : null;
        }
        case 'linux':
            return join(home, '.config', 'Block', 'goose', 'config.yaml');
        default:
            return null;
    }
}

function continuePath(): string | null {
    return join(homedir(), '.continue', 'config.json');
}

function clinePath(): string | null {
    const home = homedir();
    // Cline lives inside the VS Code extension storage dir.
    switch (platform()) {
        case 'darwin':
            return join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
        case 'win32': {
            const appdata = process.env.APPDATA;
            return appdata
                ? join(appdata, 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json')
                : null;
        }
        case 'linux':
            return join(home, '.config', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
        default:
            return null;
    }
}

export const HOSTS: HostDescriptor[] = [
    // Stdio-only hosts → mcp-remote wrapper. Claude Desktop strictly rejects
    // the URL+headers shape; Cline + Goose accept either but stdio works
    // universally + matches their docs' "remote MCP" example.
    { id: 'claude-desktop', label: 'Claude Desktop', configPath: claudeDesktopPath, buildConfig: buildClaudeDesktopConfig },
    { id: 'cline', label: 'Cline', configPath: clinePath, buildConfig: buildClaudeDesktopConfig },
    { id: 'goose', label: 'Goose', configPath: goosePath, buildConfig: buildClaudeDesktopConfig },
    // Streamable-HTTP hosts → URL+headers shape directly, no wrapper. Cursor/Windsurf
    // auto-detect the transport from the /mcp endpoint. Cursor also reads a
    // per-project `.cursor/mcp.json`.
    {
        id: 'cursor',
        label: 'Cursor',
        configPath: cursorPath,
        projectConfigPath: cursorProjectPath,
        buildConfig: buildMcpServersConfig,
    },
    { id: 'windsurf', label: 'Windsurf', configPath: windsurfPath, buildConfig: buildMcpServersConfig },
    // Continue needs an explicit `type: "streamable-http"` + requestOptions.headers.
    { id: 'continue', label: 'Continue', configPath: continuePath, buildConfig: buildContinueConfig },
    // VS Code Copilot Chat → uses a different envelope (`servers` not
    // `mcpServers`) + `type: "http"` field + `/mcp` (not `/mcp/sse`). Also reads
    // a workspace-scoped `.vscode/mcp.json`.
    {
        id: 'vscode-copilot',
        label: 'VS Code (Copilot Chat)',
        configPath: vscodePath,
        projectConfigPath: vscodeProjectPath,
        buildConfig: buildVsCodeConfig,
    },
    // Claude Code is PROJECT-ONLY here: it reads a repo-root `.mcp.json`. It has
    // no global path this CLI writes (its user scope lives in ~/.claude.json,
    // which we don't touch), so configPath returns null → it only appears in
    // project mode.
    {
        id: 'claude-code',
        label: 'Claude Code',
        configPath: () => null,
        projectConfigPath: claudeCodeProjectPath,
        buildConfig: buildClaudeCodeConfig,
    },
];

export function findHostById(id: string): HostDescriptor | undefined {
    return HOSTS.find((h) => h.id === id);
}
