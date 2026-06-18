/**
 * Token-exchange client tests — exercises the HTTP shape (Bearer header,
 * JSON body, response decoding) and error mapping.
 */

import { describe, it, expect } from 'vitest';
import { exchangeAuth0Token, TokenExchangeError } from '../src/tokenExchange.js';

describe('exchangeAuth0Token', () => {
    it('POSTs Authorization Bearer + JSON body to /api/tokens/from-auth0', async () => {
        let capturedUrl = '';
        let capturedHeaders: Record<string, string> = {};
        let capturedBody = '';
        const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
            capturedUrl = String(url);
            capturedHeaders = (init?.headers as Record<string, string>) ?? {};
            capturedBody = String(init?.body ?? '');
            return new Response(
                JSON.stringify({
                    token: 'api-token-xyz',
                    tenant_origin: 'https://acme.robotactions.com',
                    mcp_sse_url: 'https://acme.robotactions.com/mcp/sse',
                    name: 'MCP CLI (laptop)',
                    expires_in_days: 365,
                }),
                { status: 200 },
            );
        };
        const result = await exchangeAuth0Token('auth0-access-token-abc', {
            apiBase: 'https://test.robotactions.com',
            label: 'MCP CLI (laptop)',
            fetchImpl,
        });
        expect(capturedUrl).toBe('https://test.robotactions.com/api/tokens/from-auth0');
        expect(capturedHeaders.authorization).toBe('Bearer auth0-access-token-abc');
        expect(capturedHeaders['content-type']).toBe('application/json');
        expect(JSON.parse(capturedBody)).toEqual({ label: 'MCP CLI (laptop)' });
        expect(result.token).toBe('api-token-xyz');
        expect(result.mcp_sse_url).toBe('https://acme.robotactions.com/mcp/sse');
    });

    it('throws TokenExchangeError on non-2xx with HTTP status preserved', async () => {
        const fetchImpl = async () =>
            new Response(JSON.stringify({ message: 'Invalid Auth0 access token' }), {
                status: 401,
            });
        await expect(
            exchangeAuth0Token('bad-token', {
                apiBase: 'https://test.robotactions.com',
                label: 'x',
                fetchImpl,
            }),
        ).rejects.toMatchObject({ status: 401 });
    });

    // ─── Tenant resolution from Auth0 token ────────────────────────────
    // When the CLI's apiBase is the marketplace default (mcp.robotactions.com),
    // we decode the Auth0 token's `https://robotactions.com/subdomain` claim
    // client-side and POST directly to that tenant. This sidesteps the
    // server-side 307 redirect (which would strip Authorization across hosts)
    // AND avoids the Cloudflare worker self-loop the proxy approach hit.

    function fakeAuth0TokenWithSubdomain(subdomain: string | undefined): string {
        const payload: Record<string, unknown> = { sub: 'auth0|x' };
        if (subdomain !== undefined) {
            payload['https://robotactions.com/subdomain'] = subdomain;
        }
        const b64 = (s: string) =>
            Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
        return `${b64('{"alg":"RS256"}')}.${b64(JSON.stringify(payload))}.sig`;
    }

    it('resolves tenant from Auth0 subdomain claim when apiBase is mcp.robotactions.com', async () => {
        let capturedUrl = '';
        const fetchImpl = async (input: string | URL | Request) => {
            capturedUrl = typeof input === 'string' ? input : input.toString();
            return new Response(
                JSON.stringify({
                    token: 't',
                    tenant_origin: 'https://acme.robotactions.com',
                    mcp_sse_url: 'https://acme.robotactions.com/mcp/sse',
                    name: 'x',
                    expires_in_days: 365,
                }),
                { status: 200 },
            );
        };
        await exchangeAuth0Token(fakeAuth0TokenWithSubdomain('acme'), {
            apiBase: 'https://mcp.robotactions.com',
            label: 'x',
            fetchImpl,
        });
        // CRITICAL: routed straight to the user's tenant in one POST
        expect(capturedUrl).toBe('https://acme.robotactions.com/api/tokens/from-auth0');
    });

    it('defaults to test.robotactions.com when subdomain claim missing', async () => {
        let capturedUrl = '';
        const fetchImpl = async (input: string | URL | Request) => {
            capturedUrl = typeof input === 'string' ? input : input.toString();
            return new Response('{"token":"","tenant_origin":"","mcp_sse_url":"","name":"","expires_in_days":0}', { status: 200 });
        };
        await exchangeAuth0Token(fakeAuth0TokenWithSubdomain(undefined), {
            apiBase: 'https://mcp.robotactions.com',
            label: 'x',
            fetchImpl,
        });
        expect(capturedUrl).toBe('https://test.robotactions.com/api/tokens/from-auth0');
    });

    it('rejects DNS-invalid subdomain claim (falls back to default — defense in depth)', async () => {
        let capturedUrl = '';
        const fetchImpl = async (input: string | URL | Request) => {
            capturedUrl = typeof input === 'string' ? input : input.toString();
            return new Response('{"token":"","tenant_origin":"","mcp_sse_url":"","name":"","expires_in_days":0}', { status: 200 });
        };
        await exchangeAuth0Token(fakeAuth0TokenWithSubdomain('evil.com#'), {
            apiBase: 'https://mcp.robotactions.com',
            label: 'x',
            fetchImpl,
        });
        // Claim was DNS-invalid → silently falls back to default tenant
        // (server will JWKS-verify the token regardless, no security loss)
        expect(capturedUrl).toBe('https://test.robotactions.com/api/tokens/from-auth0');
    });

    it('respects explicit apiBase override (does NOT decode token)', async () => {
        let capturedUrl = '';
        const fetchImpl = async (input: string | URL | Request) => {
            capturedUrl = typeof input === 'string' ? input : input.toString();
            return new Response('{"token":"","tenant_origin":"","mcp_sse_url":"","name":"","expires_in_days":0}', { status: 200 });
        };
        await exchangeAuth0Token(fakeAuth0TokenWithSubdomain('acme'), {
            // Dev/staging override — claim is ignored, request goes here verbatim
            apiBase: 'https://staging.example.com',
            label: 'x',
            fetchImpl,
        });
        expect(capturedUrl).toBe('https://staging.example.com/api/tokens/from-auth0');
    });
});
