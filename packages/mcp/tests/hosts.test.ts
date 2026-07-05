/**
 * Per-host config-builder tests — verifies that each host descriptor's
 * buildConfig produces the right shape and merges cleanly with existing
 * entries (no clobbering of other MCP servers the user already has).
 */

import { describe, it, expect } from 'vitest';
import { findHostById, HOSTS } from '../src/hosts.js';

const SSE = 'https://acme.robotactions.com/mcp/sse';
// The builders rewrite the legacy SSE endpoint to the stateless Streamable HTTP one.
const HTTP = 'https://acme.robotactions.com/mcp';
const TOKEN = 'tk_123';

describe('hosts.buildConfig — Cursor / Windsurf use URL+headers shape', () => {
    it('Cursor: adds robot-actions under mcpServers without dropping existing entries', () => {
        const host = findHostById('cursor')!;
        const existing = {
            mcpServers: {
                'some-other-server': { command: 'python', args: ['-m', 'whatever'] },
            },
        };
        const next = host.buildConfig(existing, SSE, TOKEN);
        expect(next).toEqual({
            mcpServers: {
                'some-other-server': { command: 'python', args: ['-m', 'whatever'] },
                'robot-actions': {
                    url: HTTP,
                    headers: { Authorization: `Bearer ${TOKEN}` },
                },
            },
        });
    });

    it('Cursor: creates mcpServers envelope when config file was empty', () => {
        const host = findHostById('cursor')!;
        const next = host.buildConfig({}, SSE, TOKEN);
        expect(next).toEqual({
            mcpServers: {
                'robot-actions': { url: HTTP, headers: { Authorization: `Bearer ${TOKEN}` } },
            },
        });
    });

    it('Cursor: overwrites existing robot-actions entry (idempotent re-install)', () => {
        const host = findHostById('cursor')!;
        const existing = {
            mcpServers: {
                'robot-actions': { url: 'https://OLD.robotactions.com/mcp/sse', headers: { Authorization: 'Bearer old' } },
            },
        };
        const next = host.buildConfig(existing, SSE, TOKEN) as {
            mcpServers: { 'robot-actions': { url: string } };
        };
        expect(next.mcpServers['robot-actions'].url).toBe(HTTP);
    });
});

describe('hosts.buildConfig — Continue uses streamable-http shape', () => {
    it('Continue: type=streamable-http + /mcp + requestOptions.headers', () => {
        const host = findHostById('continue')!;
        const next = host.buildConfig({}, SSE, TOKEN);
        expect(next).toEqual({
            mcpServers: {
                'robot-actions': {
                    type: 'streamable-http',
                    url: HTTP,
                    requestOptions: { headers: { Authorization: `Bearer ${TOKEN}` } },
                },
            },
        });
    });
});

describe('hosts.buildConfig — Claude Desktop / Cline / Goose use mcp-remote stdio bridge', () => {
    // Claude Desktop strictly rejects URL+headers shape ("not valid MCP
    // server configurations" — observed in prod). mcp-remote is the
    // standard stdio→SSE bridge; spawned via npx so users don't need a
    // separate global install.

    it('Claude Desktop: writes stdio bridge command + args, NOT url/headers', () => {
        const host = findHostById('claude-desktop')!;
        const next = host.buildConfig({}, SSE, TOKEN);
        expect(next).toEqual({
            mcpServers: {
                'robot-actions': {
                    command: 'npx',
                    args: ['-y', 'mcp-remote', HTTP, '--header', `Authorization: Bearer ${TOKEN}`],
                },
            },
        });
        // CRITICAL: no `url` or `headers` field — Claude Desktop rejects those.
        expect((next as { mcpServers: { 'robot-actions': Record<string, unknown> } }).mcpServers['robot-actions'].url).toBeUndefined();
        expect((next as { mcpServers: { 'robot-actions': Record<string, unknown> } }).mcpServers['robot-actions'].headers).toBeUndefined();
    });

    it('Cline + Goose share the same stdio bridge shape (same buildConfig)', () => {
        const cline = findHostById('cline')!;
        const goose = findHostById('goose')!;
        const claudeDesktop = findHostById('claude-desktop')!;
        expect(cline.buildConfig({}, SSE, TOKEN)).toEqual(claudeDesktop.buildConfig({}, SSE, TOKEN));
        expect(goose.buildConfig({}, SSE, TOKEN)).toEqual(claudeDesktop.buildConfig({}, SSE, TOKEN));
    });

    it('Claude Desktop: preserves other mcpServers entries on merge', () => {
        const host = findHostById('claude-desktop')!;
        const existing = {
            mcpServers: { 'other': { command: 'python', args: ['-m', 'foo'] } },
        };
        const next = host.buildConfig(existing, SSE, TOKEN) as {
            mcpServers: Record<string, unknown>;
        };
        expect(next.mcpServers['other']).toEqual({ command: 'python', args: ['-m', 'foo'] });
        expect(next.mcpServers['robot-actions']).toBeDefined();
    });
});

describe('hosts.buildConfig — VS Code Copilot uses different envelope', () => {
    it('uses `servers` (not `mcpServers`) and type=http + /mcp (not /mcp/sse)', () => {
        const host = findHostById('vscode-copilot')!;
        const next = host.buildConfig({}, SSE, TOKEN);
        expect(next).toEqual({
            servers: {
                'robot-actions': {
                    type: 'http',
                    url: 'https://acme.robotactions.com/mcp',
                    headers: { Authorization: `Bearer ${TOKEN}` },
                },
            },
        });
    });
});

describe('HOSTS registry', () => {
    it('every host has unique id + non-empty label + configPath fn', () => {
        const ids = new Set<string>();
        for (const h of HOSTS) {
            expect(h.id).toMatch(/^[a-z][\w-]*$/);
            expect(h.label.length).toBeGreaterThan(0);
            expect(typeof h.configPath).toBe('function');
            expect(ids.has(h.id)).toBe(false);
            ids.add(h.id);
        }
    });

    it('findHostById returns undefined for unknown id', () => {
        expect(findHostById('nope')).toBeUndefined();
    });
});
