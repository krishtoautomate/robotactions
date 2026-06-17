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
});
