/**
 * Auth0 Device Authorization Grant client (RFC 8628).
 *
 * The CLI can't run an OAuth callback web server in a portable way, so it
 * uses the device-code flow instead: ask Auth0 for a one-time user code,
 * tell the user to visit the verification URL in their browser, and poll
 * for the access token while they complete login.
 *
 * Standard Auth0 endpoints (no custom proxy needed):
 *   POST https://<domain>/oauth/device/code   → user_code + device_code
 *   POST https://<domain>/oauth/token         → access_token (polled)
 *
 * Requires the Auth0 application to have "Device Code" grant type enabled
 * in Auth0 Dashboard → Applications → Advanced Settings → Grant Types.
 */

export interface DeviceCodeResponse {
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete?: string;
    expires_in: number;
    interval: number;
}

export interface AccessTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope?: string;
}

export interface DeviceFlowOptions {
    domain: string;
    clientId: string;
    audience: string;
    /** Scopes — keep minimal; we only need an access token suitable for /api/tokens/from-auth0. */
    scope?: string;
    /** Injectable for tests; defaults to global fetch. */
    fetchImpl?: typeof fetch;
    /** Injectable for tests; defaults to setTimeout-based polling. */
    sleepMs?: (ms: number) => Promise<void>;
}

export class DeviceFlowError extends Error {
    constructor(
        public readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = 'DeviceFlowError';
    }
}

/**
 * Step 1: ask Auth0 for a device code. Returns the user-facing code +
 * verification URL the CLI should print to the terminal.
 */
export async function requestDeviceCode(opts: DeviceFlowOptions): Promise<DeviceCodeResponse> {
    const fetchFn = opts.fetchImpl ?? fetch;
    const body = new URLSearchParams({
        client_id: opts.clientId,
        audience: opts.audience,
        scope: opts.scope ?? 'openid profile email',
    });

    const res = await fetchFn(`https://${opts.domain}/oauth/device/code`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new DeviceFlowError(
            'device_code_request_failed',
            `Auth0 returned HTTP ${res.status}: ${text}`,
        );
    }
    return (await res.json()) as DeviceCodeResponse;
}

/**
 * Step 2: poll Auth0's token endpoint until the user completes login (or
 * the device code expires). Respects the server-provided interval and the
 * `slow_down` response code (5xx-class throttling).
 *
 * Returns the access token once issued, or throws DeviceFlowError on:
 *   - expired_token: user took too long
 *   - access_denied: user explicitly declined
 *   - invalid_grant: device_code already consumed
 */
export async function pollForAccessToken(
    deviceCode: DeviceCodeResponse,
    opts: DeviceFlowOptions,
): Promise<AccessTokenResponse> {
    const fetchFn = opts.fetchImpl ?? fetch;
    const sleep = opts.sleepMs ?? ((ms) => new Promise((r) => setTimeout(r, ms)));

    let intervalSec = deviceCode.interval;
    const deadline = Date.now() + deviceCode.expires_in * 1000;

    while (Date.now() < deadline) {
        await sleep(intervalSec * 1000);

        const body = new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            device_code: deviceCode.device_code,
            client_id: opts.clientId,
        });

        const res = await fetchFn(`https://${opts.domain}/oauth/token`, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });

        const data = (await res.json()) as Record<string, unknown>;

        if (res.ok && typeof data.access_token === 'string') {
            return data as unknown as AccessTokenResponse;
        }

        const errorCode = typeof data.error === 'string' ? data.error : `http_${res.status}`;

        if (errorCode === 'authorization_pending') {
            continue;
        }
        if (errorCode === 'slow_down') {
            // RFC 8628 §3.5 — back off by 5 seconds and continue.
            intervalSec += 5;
            continue;
        }
        if (errorCode === 'expired_token') {
            throw new DeviceFlowError(
                'expired_token',
                'The device code expired before login completed. Re-run the installer.',
            );
        }
        if (errorCode === 'access_denied') {
            throw new DeviceFlowError(
                'access_denied',
                'Login was declined. The installer cannot continue without consent.',
            );
        }
        throw new DeviceFlowError(errorCode, `Auth0 token poll failed: ${JSON.stringify(data)}`);
    }

    throw new DeviceFlowError('timeout', 'Device code expired before the polling loop finished');
}
