/**
 * Config-file writer tests — exercises the merge + .bak preservation
 * behavior against the real filesystem (in a tmp dir, no shared state).
 *
 * The detection layer (detectInstalledHosts) is OS-dependent and is not
 * unit-tested here — it's exercised by the integration / smoke test
 * (run the CLI in --all mode and confirm a config file appears).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { installInHost, isProjectDir } from '../src/configWriter.js';
import { findHostById } from '../src/hosts.js';

let TMP: string;

beforeEach(() => {
    TMP = mkdtempSync(join(tmpdir(), 'rda-mcp-test-'));
});

afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
});

function detectedFor(configPath: string) {
    return {
        host: findHostById('cursor')!,
        configPath,
        configDirExists: true,
        configFileExists: existsSync(configPath),
    };
}

describe('installInHost', () => {
    it('creates the config file when none exists, no .bak', () => {
        const path = join(TMP, 'mcp.json');
        const result = installInHost(detectedFor(path), 'https://a.example.com/mcp/sse', 'tk');
        expect(result.error).toBeUndefined();
        expect(existsSync(path)).toBe(true);
        const config = JSON.parse(readFileSync(path, 'utf8'));
        // cursor uses buildMcpServersConfig, which rewrites the SSE input URL to
        // the stateless Streamable HTTP endpoint (/mcp/sse → /mcp).
        expect(config.mcpServers['robot-actions'].url).toBe('https://a.example.com/mcp');
        expect(existsSync(`${path}.bak`)).toBe(false);
    });

    it('writes .bak the first time it modifies an existing file', () => {
        const path = join(TMP, 'mcp.json');
        const seed = { mcpServers: { other: { command: 'foo' } } };
        writeFileSync(path, JSON.stringify(seed), 'utf8');
        installInHost(detectedFor(path), 'https://a/sse', 'tk');
        expect(existsSync(`${path}.bak`)).toBe(true);
        expect(JSON.parse(readFileSync(`${path}.bak`, 'utf8'))).toEqual(seed);
    });

    it('preserves existing .bak across multiple installs (original snapshot stays)', () => {
        const path = join(TMP, 'mcp.json');
        const original = { mcpServers: { other: { command: 'first-install' } } };
        writeFileSync(path, JSON.stringify(original), 'utf8');

        installInHost(detectedFor(path), 'https://a/sse', 'tk1');
        installInHost(detectedFor(path), 'https://b/sse', 'tk2');

        // .bak should still hold the pre-first-install snapshot, not the
        // intermediate state.
        expect(JSON.parse(readFileSync(`${path}.bak`, 'utf8'))).toEqual(original);
    });

    it('merges with existing entries — other MCP servers are not dropped', () => {
        const path = join(TMP, 'mcp.json');
        const seed = {
            mcpServers: {
                'other-server': { command: 'python', args: ['-m', 'other'] },
            },
        };
        writeFileSync(path, JSON.stringify(seed), 'utf8');
        installInHost(detectedFor(path), 'https://a/sse', 'tk');
        const config = JSON.parse(readFileSync(path, 'utf8'));
        expect(config.mcpServers['other-server']).toEqual(seed.mcpServers['other-server']);
        expect(config.mcpServers['robot-actions']).toBeDefined();
    });

    it('handles non-JSON existing file gracefully (treats as empty)', () => {
        const path = join(TMP, 'mcp.json');
        writeFileSync(path, 'this is not json {{{', 'utf8');
        const result = installInHost(detectedFor(path), 'https://a/sse', 'tk');
        expect(result.error).toBeUndefined();
        const config = JSON.parse(readFileSync(path, 'utf8'));
        expect(config.mcpServers['robot-actions']).toBeDefined();
    });

    it('returns error result without throwing when dir cannot be created', () => {
        // Pass a path that can't exist (NUL bytes invalid in paths)
        const bad = join(TMP, '\0invalid', 'mcp.json');
        const result = installInHost(detectedFor(bad), 'https://a/sse', 'tk');
        expect(result.error).toBeDefined();
        expect(result.action).toBe('skipped');
    });

    it('writes a project-scoped VS Code workspace file at cwd/.vscode/mcp.json', () => {
        const vscode = findHostById('vscode-copilot')!;
        const path = vscode.projectConfigPath!(TMP);
        expect(path).toBe(join(TMP, '.vscode', 'mcp.json'));
        const result = installInHost(
            { host: vscode, configPath: path, configDirExists: true, configFileExists: false },
            'https://a.example.com/mcp/sse',
            'tk',
        );
        expect(result.error).toBeUndefined();
        expect(existsSync(path)).toBe(true);
        const cfg = JSON.parse(readFileSync(path, 'utf8'));
        // VS Code uses the `servers` envelope with type:http on the /mcp endpoint.
        expect(cfg.servers['robot-actions']).toEqual({
            type: 'http',
            url: 'https://a.example.com/mcp',
            headers: { Authorization: 'Bearer tk' },
        });
    });
});

describe('isProjectDir', () => {
    it('is false for an empty directory', () => {
        expect(isProjectDir(TMP)).toBe(false);
    });

    for (const marker of ['.git', '.vscode', '.cursor']) {
        it(`is true when ${marker}/ is present`, () => {
            mkdirSync(join(TMP, marker));
            expect(isProjectDir(TMP)).toBe(true);
        });
    }

    it('is true when a .mcp.json already exists', () => {
        writeFileSync(join(TMP, '.mcp.json'), '{}', 'utf8');
        expect(isProjectDir(TMP)).toBe(true);
    });
});
