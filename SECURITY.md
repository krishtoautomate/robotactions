# Security Policy

## Reporting a vulnerability

**Please do not file security issues on the public Issues tracker.** Public disclosure before we ship a fix puts every user at risk.

Send vulnerability reports to:

📨 **security@robotactions.com**

Include in your report:

- A description of the vulnerability and its potential impact
- Steps to reproduce (or a proof-of-concept), as specifically as you can
- Your name / handle if you'd like to be credited in the release notes
- Any disclosure timeline you have in mind

## What to expect

| When | What |
|---|---|
| Within 48 hours | Acknowledgment that we received your report |
| Within 7 days | Initial assessment + a rough timeline for the fix |
| When the fix ships | A release note and (with your permission) a credit |

We aim to ship security fixes faster than feature work — usually within days, not weeks. Critical issues (auth bypass, data exposure across tenants) get same-day patches.

## What's in scope

- The hosted application at `*.robotactions.com`
- The authentication flow (Auth0 + our Callback + edge routing)
- Tenant isolation (data scoped to user / org)
- API surface exposed under `/api/*` and `/mcp/*`

## What's out of scope

- Findings against `localhost` deployments, self-hosted forks, or development branches
- Issues that require physical access to a customer's connected device
- Best-practice nits without an exploitable scenario (e.g. "you don't set a Referrer-Policy header")
- Denial of service via volumetric attacks — we run behind Cloudflare; report DDoS to them
- Social-engineering attacks against staff

## Bounty program

We don't have a paid bug bounty program at this time. We do credit reporters in release notes (with permission) and we'll send a small thank-you for high-impact reports.

Thanks for helping keep Robot Actions safe.
