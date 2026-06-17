/**
 * RDS token-exchange client.
 *
 * Trades an Auth0 access token (from the device flow) for a long-lived Robot
 * Actions API token + the user's tenant origin. The server-side endpoint
 * (POST /api/tokens/from-auth0) validates the Auth0 token via JWKS and mints
 * the API token via the same generateApiToken helper the in-portal Profile
 * UI uses, so the resulting token shows up in Settings → API Tokens and is
 * revocable normally.
 */

export interface ExchangeResponse {
    token: string;
    tenant_origin: string;
    mcp_sse_url: string;
    name: string;
    expires_in_days: number;
}

export interface ExchangeOptions {
    apiBase: string;
    /** Friendly label that shows up in Settings → API Tokens. */
    label: string;
    fetchImpl?: typeof fetch;
}

export class TokenExchangeError extends Error {
    constructor(
        public readonly status: number,
        message: string,
    ) {
        super(message);
        this.name = 'TokenExchangeError';
    }
}

const AUTH0_SUBDOMAIN_CLAIM = 'https://robotactions.com/subdomain';
const DEFAULT_SUBDOMAIN = 'test';
const SUBDOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

/**
 * Decode an Auth0 RS256 access token's payload (no signature verification —
 * the server re-verifies via JWKS). Returns the `subdomain` claim if
 * present + valid as a DNS label, else null. We use this to figure out
 * which tenant to POST the exchange call to BEFORE making the request,
 * which sidesteps a chain of edge-routing problems:
 *
 *   - Server-side 307 redirect would strip Authorization on cross-host
 *     hop (fetch spec security).
 *   - Manual redirect-follow with header re-attach hit a Cloudflare worker
 *     loop where the second hop (matched-subdomain Bearer passthrough)
 *     didn't break out of the route binding.
 *
 * Doing the tenant lookup CLIENT-SIDE means the CLI POSTs straight to the
 * user's actual tenant — one request, no redirect, no proxy. The Auth0
 * token's `subdomain` claim is the authoritative source either way; only
 * the locus of the lookup moves.
 */
function decodeSubdomainFromAuth0Token(token: string): string {
    const parts = token.split('.');
    const payloadPart = parts[1];
    if (parts.length !== 3 || !payloadPart) return DEFAULT_SUBDOMAIN;
    try {
        // base64url → base64 → JSON
        const b64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
        const pad = b64.length % 4 === 0 ? 0 : 4 - (b64.length % 4);
        const json = Buffer.from(b64 + '='.repeat(pad), 'base64').toString('utf8');
        const payload = JSON.parse(json) as Record<string, unknown>;
        const claimed = payload[AUTH0_SUBDOMAIN_CLAIM];
        if (typeof claimed === 'string' && SUBDOMAIN_LABEL.test(claimed)) {
            return claimed.toLowerCase();
        }
    } catch {
        // Malformed token — server JWKS verify would catch it; fall back to default.
    }
    return DEFAULT_SUBDOMAIN;
}

export async function exchangeAuth0Token(
    auth0AccessToken: string,
    opts: ExchangeOptions,
): Promise<ExchangeResponse> {
    const fetchFn = opts.fetchImpl ?? fetch;

    // Resolve the target tenant from the Auth0 token's subdomain claim and
    // POST directly to that tenant. If opts.apiBase already points at a
    // specific tenant subdomain (e.g. dev override), the URL stays whatever
    // the override sets — only the marketplace-default `apiBase` of
    // `https://mcp.robotactions.com` triggers tenant resolution.
    let url = `${opts.apiBase}/api/tokens/from-auth0`;
    const base = new URL(opts.apiBase);
    if (/^mcp\.robotactions\.com$/i.test(base.hostname)) {
        const tenant = decodeSubdomainFromAuth0Token(auth0AccessToken);
        url = `https://${tenant}.robotactions.com/api/tokens/from-auth0`;
    }

    const res = await fetchFn(url, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${auth0AccessToken}`,
        },
        body: JSON.stringify({ label: opts.label }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new TokenExchangeError(
            res.status,
            `Token exchange failed (HTTP ${res.status}): ${text}`,
        );
    }
    return (await res.json()) as ExchangeResponse;
}
