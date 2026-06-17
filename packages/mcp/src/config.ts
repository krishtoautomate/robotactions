/**
 * Build-time / env configuration for the Robot Actions MCP installer.
 *
 * Defaults assume the production tenant model:
 *   - Auth0 custom domain: auth.robotactions.com
 *   - Token-exchange endpoint: test.robotactions.com (default tenant; the
 *     server will route the response's tenant_origin to whichever subdomain
 *     the authenticated user actually belongs to)
 *
 * All values are overridable via env vars — used in dev to point at a
 * staging Auth0 tenant or a local RDS instance.
 */

export interface RuntimeConfig {
    auth0Domain: string;
    auth0ClientId: string;
    auth0Audience: string;
    apiBase: string;
    /**
     * Bake this at build time so a globally-installed npx run picks up the
     * right value without env vars. Set via build-time env in npm publish CI.
     */
    cliVersion: string;
}

/**
 * Production-default Auth0 client ID for the "RobotActions MCP CLI" Native
 * application (tenant: dev-robotactions). Safe to embed in public code —
 * OAuth public-client IDs are designed to be public per RFC 6749 §2.2.
 * The Device Authorization Grant on this client only mints tokens after
 * a user completes browser login, so possession of the client_id alone
 * grants no access.
 */
const DEFAULT_AUTH0_CLIENT_ID = 'yXXi3KRjsqqZ4sKabGE5DaYMHGne1Q5z';

export function loadConfig(): RuntimeConfig {
    return {
        auth0Domain: process.env.ROBOTACTIONS_AUTH0_DOMAIN ?? 'auth.robotactions.com',
        auth0ClientId: process.env.ROBOTACTIONS_AUTH0_CLIENT_ID ?? DEFAULT_AUTH0_CLIENT_ID,
        auth0Audience: process.env.ROBOTACTIONS_AUTH0_AUDIENCE ?? 'https://robotactions.com/api',
        // Generic entry subdomain — the worker (cloudflare-worker/src/worker.ts)
        // reads the Auth0 token's subdomain claim and transparently proxies
        // each request to the user's actual tenant origin. The CLI never
        // needs to know the tenant in advance, and mcp.robotactions.com
        // doesn't host an origin of its own — the worker provides routing.
        apiBase: process.env.ROBOTACTIONS_API_BASE ?? 'https://mcp.robotactions.com',
        cliVersion: process.env.npm_package_version ?? '0.0.0-dev',
    };
}
