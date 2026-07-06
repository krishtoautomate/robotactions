/**
 * Detect installed MCP hosts on the user's machine + write the new server
 * entry into each host's config file.
 *
 * Detection is "config-dir exists" rather than "binary on PATH" — works for
 * sandboxed Mac apps that aren't in PATH but have created their data dir.
 *
 * Writes merge with existing config rather than overwriting, so a user who
 * already has other MCP servers configured doesn't lose them.
 *
 * NEVER modify a host config file without first making a `.bak` copy if one
 * doesn't already exist. The user's hand-written config is sacred.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { HostDescriptor } from './hosts.js';
import { HOSTS } from './hosts.js';

/**
 * Heuristic: is `cwd` a project/workspace root the user expects the installer
 * to write into (rather than their global config)? True when any of the common
 * project markers is present — a git repo, or an existing editor workspace dir.
 * Keep this cheap and conservative: a false negative just falls back to global
 * (with `--project` as the explicit override), which is the safe direction.
 */
export function isProjectDir(cwd: string): boolean {
    return (
        existsSync(join(cwd, '.git')) ||
        existsSync(join(cwd, '.vscode')) ||
        existsSync(join(cwd, '.cursor')) ||
        existsSync(join(cwd, '.mcp.json'))
    );
}

export interface DetectedHost {
    host: HostDescriptor;
    configPath: string;
    configDirExists: boolean;
    configFileExists: boolean;
}

export interface WriteResult {
    host: HostDescriptor;
    configPath: string;
    action: 'created' | 'updated' | 'skipped';
    backupPath?: string;
    error?: string;
}

/**
 * Find every host whose config directory exists. Returns one entry per
 * supported host on the current OS — caller decides which subset to install
 * into (interactive prompt, --all flag, etc.).
 */
export function detectInstalledHosts(): DetectedHost[] {
    const detected: DetectedHost[] = [];
    for (const host of HOSTS) {
        const configPath = host.configPath();
        if (!configPath) continue;
        const dir = dirname(configPath);
        const configDirExists = existsSync(dir);
        const configFileExists = existsSync(configPath);
        if (configDirExists) {
            detected.push({ host, configPath, configDirExists, configFileExists });
        }
    }
    return detected;
}

/**
 * Apply the install to a single host. Idempotent — re-running with a new
 * token overwrites the existing `robot-actions` entry but preserves any
 * other MCP servers the user has configured.
 */
export function installInHost(detected: DetectedHost, sseUrl: string, token: string): WriteResult {
    const { host, configPath } = detected;
    try {
        const dir = dirname(configPath);
        mkdirSync(dir, { recursive: true });

        let existing: unknown = {};
        let backupPath: string | undefined;

        if (existsSync(configPath)) {
            const raw = readFileSync(configPath, 'utf8');
            try {
                existing = JSON.parse(raw);
            } catch {
                // Non-JSON (e.g. Goose YAML) — leave as empty so the new
                // config replaces it cleanly. Goose support is best-effort
                // in v0.1; YAML round-trip preservation is a follow-up.
                existing = {};
            }
            backupPath = `${configPath}.bak`;
            if (!existsSync(backupPath)) {
                copyFileSync(configPath, backupPath);
            }
        }

        const merged = host.buildConfig(existing, sseUrl, token);
        writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf8');

        return {
            host,
            configPath,
            action: existsSync(configPath) && backupPath ? 'updated' : 'created',
            backupPath,
        };
    } catch (e) {
        return {
            host,
            configPath,
            action: 'skipped',
            error: e instanceof Error ? e.message : String(e),
        };
    }
}
