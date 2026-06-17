/**
 * Per-host config-builder tests — verifies that each host descriptor's
 * buildConfig produces the right shape and merges cleanly with existing
 * entries (no clobbering of other MCP servers the user already has).
 */

import { describe, it, expect } from 'vitest';
import { findHostById, HOSTS } from '../src/hosts.js';

const SSE = 'https://acme.robotactions.com/mcp/sse';
const TOKEN = 'tk_123';

describe('hosts.buildConfig — Claude Desktop / Cursor / standard mcpServers envelope', () => {
    it('adds robot-actions under mcpServers without dropping existing entries', () => {
        const host = findHostById('claude-desktop')!;
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
                    url: SSE,
                    headers: { Authorization: `Bearer ${TOKEN}` },
                },
            },
        });
    });

    it('creates mcpServers envelope when config file was empty', () => {
        const host = findHostById('cursor')!;
        const next = host.buildConfig({}, SSE, TOKEN);
        expect(next).toEqual({
            mcpServers: {
                'robot-actions': { url: SSE, headers: { Authorization: `Bearer ${TOKEN}` } },
            },
        });
    });

    it('overwrites existing robot-actions entry (idempotent re-install)', () => {
        const host = findHostById('cursor')!;
        const existing = {
            mcpServers: {
                'robot-actions': { url: 'https://OLD.robotactions.com/mcp/sse', headers: { Authorization: 'Bearer old' } },
            },
        };
        const next = host.buildConfig(existing, SSE, TOKEN) as {
            mcpServers: { 'robot-actions': { url: string } };
        };
        expect(next.mcpServers['robot-actions'].url).toBe(SSE);
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
