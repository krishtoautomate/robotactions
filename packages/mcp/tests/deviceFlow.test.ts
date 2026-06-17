/**
 * Auth0 device-code flow client tests — exercise the HTTP shape (form-urlencoded
 * body, correct grant_type, response decoding) and the polling state machine
 * (authorization_pending retries, slow_down backoff, expired/denied terminal errors).
 *
 * All network is mocked via fetchImpl; sleep is mocked via sleepMs.
 */

import { describe, it, expect } from 'vitest';
import { requestDeviceCode, pollForAccessToken, DeviceFlowError } from '../src/deviceFlow.js';

const baseOpts = {
    domain: 'auth.example.com',
    clientId: 'cli-client',
    audience: 'https://api.example.com',
};

describe('requestDeviceCode', () => {
    it('posts form-urlencoded to /oauth/device/code with client_id + audience + scope', async () => {
        let capturedUrl = '';
        let capturedBody = '';
        let capturedHeaders: Record<string, string> = {};
        const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
            capturedUrl = String(url);
            capturedBody = String(init?.body ?? '');
            capturedHeaders = (init?.headers as Record<string, string>) ?? {};
            return new Response(
                JSON.stringify({
                    device_code: 'dc_abc',
                    user_code: 'WDJB-MJHT',
                    verification_uri: 'https://auth.example.com/activate',
                    expires_in: 900,
                    interval: 5,
                }),
                { status: 200, headers: { 'content-type': 'application/json' } },
            );
        };
        const res = await requestDeviceCode({ ...baseOpts, fetchImpl });
        expect(capturedUrl).toBe('https://auth.example.com/oauth/device/code');
        expect(capturedHeaders['content-type']).toBe('application/x-www-form-urlencoded');
        const params = new URLSearchParams(capturedBody);
        expect(params.get('client_id')).toBe('cli-client');
        expect(params.get('audience')).toBe('https://api.example.com');
        expect(params.get('scope')).toContain('openid');
        expect(res.user_code).toBe('WDJB-MJHT');
        expect(res.expires_in).toBe(900);
    });

    it('throws DeviceFlowError when Auth0 returns non-2xx', async () => {
        const fetchImpl = async () =>
            new Response(JSON.stringify({ error: 'unauthorized_client' }), { status: 401 });
        await expect(requestDeviceCode({ ...baseOpts, fetchImpl })).rejects.toBeInstanceOf(
            DeviceFlowError,
        );
    });
});

describe('pollForAccessToken', () => {
    const deviceCode = {
        device_code: 'dc_abc',
        user_code: 'WDJB-MJHT',
        verification_uri: 'https://auth.example.com/activate',
        expires_in: 900,
        interval: 1,
    };

    it('retries on authorization_pending and returns access_token on success', async () => {
        let calls = 0;
        const sleepMs = async () => {
            /* skip real waits */
        };
        const fetchImpl = async () => {
            calls++;
            if (calls < 3) {
                return new Response(JSON.stringify({ error: 'authorization_pending' }), {
                    status: 400,
                });
            }
            return new Response(
                JSON.stringify({
                    access_token: 'at_xyz',
                    token_type: 'Bearer',
                    expires_in: 3600,
                }),
                { status: 200 },
            );
        };
        const result = await pollForAccessToken(deviceCode, { ...baseOpts, fetchImpl, sleepMs });
        expect(result.access_token).toBe('at_xyz');
        expect(calls).toBe(3);
    });

    it('backs off on slow_down then succeeds', async () => {
        let calls = 0;
        let totalSlept = 0;
        const sleepMs = async (ms: number) => {
            totalSlept += ms;
        };
        const fetchImpl = async () => {
            calls++;
            if (calls === 1) {
                return new Response(JSON.stringify({ error: 'slow_down' }), { status: 400 });
            }
            return new Response(
                JSON.stringify({ access_token: 'at', token_type: 'Bearer', expires_in: 3600 }),
                { status: 200 },
            );
        };
        await pollForAccessToken(deviceCode, { ...baseOpts, fetchImpl, sleepMs });
        // Initial interval 1s, then +5s after slow_down → second sleep is 6s
        expect(totalSlept).toBe(1000 + 6000);
    });

    it('throws DeviceFlowError(expired_token) on Auth0 expiry', async () => {
        const sleepMs = async () => {
            /* skip */
        };
        const fetchImpl = async () =>
            new Response(JSON.stringify({ error: 'expired_token' }), { status: 400 });
        await expect(
            pollForAccessToken(deviceCode, { ...baseOpts, fetchImpl, sleepMs }),
        ).rejects.toMatchObject({ code: 'expired_token' });
    });

    it('throws DeviceFlowError(access_denied) when user declines', async () => {
        const sleepMs = async () => {
            /* skip */
        };
        const fetchImpl = async () =>
            new Response(JSON.stringify({ error: 'access_denied' }), { status: 400 });
        await expect(
            pollForAccessToken(deviceCode, { ...baseOpts, fetchImpl, sleepMs }),
        ).rejects.toMatchObject({ code: 'access_denied' });
    });
});
