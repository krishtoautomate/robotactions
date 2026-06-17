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

export async function exchangeAuth0Token(
    auth0AccessToken: string,
    opts: ExchangeOptions,
): Promise<ExchangeResponse> {
    const fetchFn = opts.fetchImpl ?? fetch;
    const res = await fetchFn(`${opts.apiBase}/api/tokens/from-auth0`, {
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
