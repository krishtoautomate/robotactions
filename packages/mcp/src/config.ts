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

export function loadConfig(): RuntimeConfig {
    return {
        auth0Domain: process.env.ROBOTACTIONS_AUTH0_DOMAIN ?? 'auth.robotactions.com',
        auth0ClientId: process.env.ROBOTACTIONS_AUTH0_CLIENT_ID ?? '',
        auth0Audience: process.env.ROBOTACTIONS_AUTH0_AUDIENCE ?? 'https://robotactions.com/api',
        apiBase: process.env.ROBOTACTIONS_API_BASE ?? 'https://test.robotactions.com',
        cliVersion: process.env.npm_package_version ?? '0.0.0-dev',
    };
}
