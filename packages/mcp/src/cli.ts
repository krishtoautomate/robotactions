#!/usr/bin/env node
/**
 * Robot Actions MCP installer — entry point.
 *
 * Usage:
 *   npx @robotactions/mcp init [--host <host-id>...] [--all]
 *   npx @robotactions/mcp --help
 *   npx @robotactions/mcp --version
 *
 * Default `init` flow:
 *   1. Detect which MCP hosts are installed on this machine.
 *   2. Auth0 device-code flow: print user_code + verification URL, open
 *      browser, poll until login completes.
 *   3. Exchange Auth0 access token for a Robot Actions API token via the
 *      RDS server-side endpoint (/api/tokens/from-auth0).
 *   4. Write the SSE config entry into each detected host's config file
 *      (merging with existing entries, .bak backup made first).
 *   5. Print next-steps (restart your host) + the token name for
 *      revocation reference.
 *
 * NOT a long-running daemon — this is a one-shot installer. Once configs
 * are written, MCP traffic flows directly from the host to RDS's stateless
 * /mcp (Streamable HTTP) endpoint with no involvement from this binary.
 */

import { hostname } from 'node:os';
import open from 'open';
import { loadConfig } from './config.js';
import { requestDeviceCode, pollForAccessToken, DeviceFlowError } from './deviceFlow.js';
import { exchangeAuth0Token, TokenExchangeError } from './tokenExchange.js';
import { detectInstalledHosts, installInHost, isProjectDir } from './configWriter.js';
import { HOSTS, findHostById, type HostDescriptor } from './hosts.js';

const HELP = `Robot Actions MCP installer

Usage:
  npx @robotactions/mcp init                        Auto: project-scoped config if run inside a project, else global
  npx @robotactions/mcp init --project              Force project-scoped config in the current directory
  npx @robotactions/mcp init --global               Force global (user-level) config for installed hosts
  npx @robotactions/mcp init --host claude-desktop  Install in a specific host (repeatable)
  npx @robotactions/mcp init --all                  Install in every supported host on this OS (global, no detection)

Scope:
  Run inside a project (a dir with .git / .vscode / .cursor / .mcp.json) and the installer writes
  workspace files — .vscode/mcp.json, .cursor/mcp.json, .mcp.json — so the server is scoped to that
  repo. Run elsewhere (or with --global) and it writes each host's global user config. --global always
  overrides auto-detection.

Supported hosts: ${HOSTS.map((h) => h.id).join(', ')}
  Project-scoped: ${HOSTS.filter((h) => h.projectConfigPath).map((h) => h.id).join(', ')}

After installation, restart your MCP host. Robot Actions tools should appear in its tool list.
The installer creates an API token in your account; revoke it any time from Settings → API Tokens.
`;

interface Args {
    command: 'init' | 'help' | 'version' | null;
    hosts: string[];
    all: boolean;
    /** Force global (user-level) config, overriding project auto-detection. */
    global: boolean;
    /** Force project-scoped (workspace) config in the current directory. */
    project: boolean;
}

function parseArgs(argv: string[]): Args {
    const args: Args = { command: null, hosts: [], all: false, global: false, project: false };
    const tokens = argv.slice(2);
    if (tokens.length === 0) {
        args.command = 'help';
        return args;
    }
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t === '--help' || t === '-h') args.command = 'help';
        else if (t === '--version' || t === '-v') args.command = 'version';
        else if (t === '--all') args.all = true;
        else if (t === '--global') args.global = true;
        else if (t === '--project' || t === '--local') args.project = true;
        else if (t === '--host') {
            const next = tokens[i + 1];
            if (next) {
                args.hosts.push(next);
                i++;
            }
        } else if (t === 'init') args.command = 'init';
        else if (!args.command) {
            console.error(`Unknown argument: ${t}\n`);
            args.command = 'help';
            return args;
        }
    }
    return args;
}

async function runInit(args: Args): Promise<number> {
    const cfg = loadConfig();
    if (!cfg.auth0ClientId) {
        console.error(
            'ERROR: ROBOTACTIONS_AUTH0_CLIENT_ID is not set. This is a build-config issue — please report at https://github.com/krishtoautomate/robotactions/issues',
        );
        return 2;
    }

    // 1. Pick target hosts + scope (project-local vs global).
    // --global and --all force global; --project forces project; otherwise
    // auto-detect from the current directory. --global always wins so a user
    // inside a repo can still install their global config on purpose.
    const cwd = process.cwd();
    const wantProject = !args.global && !args.all && (args.project || isProjectDir(cwd));

    let targets: { host: HostDescriptor; configPath: string }[];
    if (wantProject) {
        // Project scope: write workspace files for the project-capable hosts
        // (VS Code / Cursor / Claude Code). We don't "detect" here — the user
        // is inside the project and wants the files regardless of which editor
        // opens it later. --host narrows the set.
        const capable = HOSTS.filter((h) => h.projectConfigPath);
        let chosen = capable;
        if (args.hosts.length > 0) {
            const picked = args.hosts.map((id) => ({ id, host: findHostById(id) }));
            for (const { id, host } of picked) {
                if (!host) console.error(`Unknown host id: ${id}. Supported: ${HOSTS.map((x) => x.id).join(', ')}`);
                else if (!host.projectConfigPath)
                    console.error(`${host.label}: global-only (no project config) — re-run with --global.`);
            }
            chosen = picked
                .map((p) => p.host)
                .filter((h): h is HostDescriptor => !!h && !!h.projectConfigPath);
        }
        targets = chosen.map((h) => ({ host: h, configPath: h.projectConfigPath!(cwd) }));
        if (targets.length === 0) {
            console.error('No project-capable hosts to install. Supported in project mode: ' +
                capable.map((h) => h.id).join(', '));
            return 2;
        }
        console.log(`Installing project-scoped MCP config in ${cwd}:`);
        console.log(`  ${targets.map((t) => t.host.label).join(', ')}\n`);
    } else if (args.hosts.length > 0) {
        targets = args.hosts.flatMap((id) => {
            const h = findHostById(id);
            if (!h) {
                console.error(`Unknown host id: ${id}. Supported: ${HOSTS.map((x) => x.id).join(', ')}`);
                return [];
            }
            const p = h.configPath();
            if (!p) {
                console.error(`${h.label}: no global config path on this OS (may be project-only — try --project)`);
                return [];
            }
            return [{ host: h, configPath: p }];
        });
        if (targets.length === 0) return 2;
    } else if (args.all) {
        targets = HOSTS.flatMap((h) => {
            const p = h.configPath();
            return p ? [{ host: h, configPath: p }] : [];
        });
    } else {
        const detected = detectInstalledHosts();
        if (detected.length === 0) {
            console.error(
                'No MCP hosts detected on this machine. Pass --host <id>, --all, or --project to install anyway.\nSupported: ' +
                    HOSTS.map((h) => h.id).join(', '),
            );
            return 1;
        }
        targets = detected.map(({ host, configPath }) => ({ host, configPath }));
        console.log(`Detected ${targets.length} MCP host(s): ${targets.map((t) => t.host.label).join(', ')}\n`);
    }

    // 2. Device-code flow
    let deviceCode;
    try {
        deviceCode = await requestDeviceCode({
            domain: cfg.auth0Domain,
            clientId: cfg.auth0ClientId,
            audience: cfg.auth0Audience,
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Could not start login: ${msg}`);
        return 3;
    }

    const verificationUrl = deviceCode.verification_uri_complete ?? deviceCode.verification_uri;
    console.log('To finish installation, sign in to Robot Actions:');
    console.log(`  1. Open: ${verificationUrl}`);
    console.log(`  2. Enter the code: ${deviceCode.user_code}`);
    console.log('  3. Complete login in your browser.\n');

    // Best-effort: open the browser automatically. Failure is non-fatal —
    // the URL is already printed for manual entry.
    try {
        await open(verificationUrl);
    } catch {
        // ignored
    }

    console.log('Waiting for login to complete...');

    let auth0Token;
    try {
        auth0Token = await pollForAccessToken(deviceCode, {
            domain: cfg.auth0Domain,
            clientId: cfg.auth0ClientId,
            audience: cfg.auth0Audience,
        });
    } catch (e) {
        if (e instanceof DeviceFlowError) {
            console.error(`Login failed (${e.code}): ${e.message}`);
            return 3;
        }
        console.error(`Login failed: ${e instanceof Error ? e.message : String(e)}`);
        return 3;
    }

    // 3. Trade Auth0 token for an API token
    const label = `MCP CLI (${hostname()})`.slice(0, 80);
    let exchange;
    try {
        exchange = await exchangeAuth0Token(auth0Token.access_token, {
            apiBase: cfg.apiBase,
            label,
        });
    } catch (e) {
        if (e instanceof TokenExchangeError) {
            console.error(`Token exchange failed (HTTP ${e.status}): ${e.message}`);
            return 4;
        }
        console.error(`Token exchange failed: ${e instanceof Error ? e.message : String(e)}`);
        return 4;
    }

    console.log(`Login OK. Tenant: ${exchange.tenant_origin}\n`);

    // 4. Write configs
    const results: ReturnType<typeof installInHost>[] = [];
    for (const target of targets) {
        const detected = {
            host: target.host,
            configPath: target.configPath,
            configDirExists: true,
            configFileExists: false,
        };
        const result = installInHost(detected, exchange.mcp_sse_url, exchange.token);
        results.push(result);
        if (result.error) {
            console.log(`  ✗ ${result.host.label}: ${result.error}`);
        } else {
            console.log(`  ✓ ${result.host.label} → ${result.configPath}`);
            if (result.backupPath) {
                console.log(`      (existing config backed up to ${result.backupPath})`);
            }
        }
    }

    const failures = results.filter((r) => r.error);
    if (failures.length === results.length) {
        console.error('\nAll hosts failed to install. Nothing changed.');
        return 5;
    }

    console.log('\nNext steps:');
    console.log('  1. Restart the MCP host(s) above so they reload their config.');
    console.log('  2. Ask the agent: "List the devices I have available." It should call device_list.');
    console.log(`\nAPI token created: "${exchange.name}"`);
    console.log('  Revoke any time at Settings → API Tokens on your tenant.');

    return failures.length > 0 ? 1 : 0;
}

async function main(): Promise<number> {
    const args = parseArgs(process.argv);
    if (args.command === 'help' || args.command === null) {
        console.log(HELP);
        return 0;
    }
    if (args.command === 'version') {
        console.log(loadConfig().cliVersion);
        return 0;
    }
    return runInit(args);
}

main().then(
    (code) => process.exit(code),
    (e) => {
        console.error('Unexpected error:', e);
        process.exit(99);
    },
);
