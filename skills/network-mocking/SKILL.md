---
name: network-mocking
description: Capture and mock network traffic on real devices — for native app requests as well as web pages. Use when asked to test an error state, an empty state, a slow network, or an offline path; to stub a backend that is not ready; to inspect what an app is actually sending; or when working with android_traffic_*, ios_traffic_*, webpage_mock_*, or *_devtools_capture_network tools.
license: MIT
---

# Mocking and capturing traffic

Two independent interception layers. Picking the wrong one is the mistake that costs
an hour, because the tools succeed and simply never match anything.

| Traffic made by | Layer | Tools |
|---|---|---|
| **Native app code** | Device-wide TLS-inspecting proxy | `android_traffic_*` / `ios_traffic_*` |
| **A browser or WebView page** | Page-level request routing | `webpage_mock_*`, `*_devtools_capture_network` |

**A route added with `webpage_mock_add` will never touch a native app's requests**, and
never will — it is scoped to the page. If the app under test makes its calls in native
code, you need the proxy layer. If you are testing a website, the page layer is lighter
and needs no certificate setup.

Unsure which? `device_current_app` / `ios_active_app` tells you what is in the
foreground. A native app that renders its content in a WebView may need both.

## Native app traffic

```
android_traffic_start(serial)      or   ios_traffic_start(udid)
   → brings up a per-device TLS-inspecting proxy and points the device at it,
     so subsequent HTTPS is decrypted
… drive the app …
android_traffic_flows(serial)      read what was captured
android_traffic_stop(serial)       always stop when done
android_traffic_status(serial)
```

This decrypts HTTPS from **native app code**, which browser DevTools cannot see.

### Mocking

Capture must already be running — routes live inside the proxy.

```
android_traffic_mock_add(serial,
  matchUrl: "/api/orders", matchType: "contains",
  method: "GET",
  status: 500,
  headers: { "content-type": "application/json" },
  body: "{\"error\":\"upstream\"}",
  delayMs: 0)

android_traffic_mock_list / android_traffic_mock_remove
```

`mode: "abort"` kills the connection so the app sees a network failure — the way to test
an offline or connection-dropped path. `delayMs` (capped at 60s) injects latency for
spinner and timeout states. Routes take effect live, no restart, and can be updated in
place by passing an existing `id`.

`ios_traffic_*` mirrors this exactly, keyed on `udid` instead of `serial`.

### The two limits — check these before debugging anything else

1. **The app must trust user certificates.** In practice that means a debug build with a
   permissive `network_security_config`. A release build will not trust the proxy.
2. **Certificate-pinned apps cannot be intercepted at all.** Not by capture, not by
   mocking. A route targeting pinned traffic simply never matches — it does not error.

So "my mock isn't firing" is usually one of those two, not a wrong `matchUrl`. Confirm
traffic is visible in `android_traffic_flows` *before* concluding a route is wrong: if
capture shows nothing, mocking was never going to work.

On Android, some devices are provisioned so that the proxy and its certificate are set up
silently with no on-device interaction; on others the setup falls back to a mode that
relies on the app already trusting user certificates. The start response reports which
path was taken — read it, because it tells you whether limit 1 above applies to this run.

### Packet capture

`ios_pcap_start` / `ios_pcap_stop` / `ios_pcap_status` produce a raw capture when you
need the wire rather than decoded flows.

## Web page traffic

No certificates, nothing device-wide, scoped to the page.

```
webpage_mock_add(udid,
  matchUrl: "/api/cart", matchType: "contains",
  status: 200,
  headers: { "content-type": "application/json" },
  body: "{\"items\":[]}")

webpage_mock_list / webpage_mock_remove / webpage_mock_clear / webpage_mock_status
```

`mode: "abort"` fails the request instead. Routes apply immediately and survive
navigation. **Omit `pageId`** so routing follows the active page across navigations and
new tabs — pinning it to one page is the usual cause of a route that stops working after
a redirect.

Empty states are the highest-value use: mocking `[]` for a list endpoint reaches a screen
that is otherwise hard to reproduce against a populated backend.

### Capturing page traffic

```
android_devtools_capture_network(udid,
  triggerJs: "location.reload()",
  durationMs: 8000,
  urlSubstring: "/api/",
  onlyErrors: true)
```

The collector only sees requests made **after it attaches**. Triggering the navigation
from a separate tool call races the attach and returns **0 records** — a silent failure
that looks like "no traffic". Put the trigger in `triggerJs`.

`throttle: "slow-3g" | "fast-3g" | "offline"` applies for the capture window only and is
cleared afterwards — the cheapest way to test a slow-network path. `blockUrls` strips
third-party noise; `extraHeaders` lets you capture authenticated requests;
`format: "har"` exports. `ios_safari_capture_network` is the same shape.

## Clean up

Leaving a TLS proxy running changes how the whole device reaches the network and will
confuse the next person to use it.

```
android_traffic_stop(serial) / ios_traffic_stop(udid)
webpage_mock_clear(udid)
device_release(udid)
```
