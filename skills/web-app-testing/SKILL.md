---
name: web-app-testing
description: Test websites and web apps on the RobotActions grid — in the browser of a real Android or iOS device, or in a desktop browser on the grid. Use when asked to test a site on mobile Safari or Chrome, check responsive behaviour on a real phone, debug page network requests or console errors on a device, mock an API response, or automate a browser with webpage_*, web_*, or session_* tools.
license: MIT
---

# Testing the web on the grid

## Pick the right surface first

Three families of tools drive a browser. They are not interchangeable, and choosing
wrong is the most common mistake here.

| Family | Runs on | Addressed by | Use when |
|---|---|---|---|
| `webpage_*` | **The browser on a real phone or tablet** — iOS Safari or Android Chrome, auto-detected from the udid | `udid` | Mobile web testing. Real device, real viewport, real touch. **The default for anything mobile.** |
| `web_*` | **A desktop browser on the grid** — Chrome, Firefox, Safari | `pageId` from `web_navigate` | Desktop web testing. Not a phone. |
| `session_*` | A W3C automation session on the grid, web **or** mobile | `sessionId` from `session_create` | You need raw JS execution, network/console logs by session, or you are mirroring an existing Selenium/Appium suite. |

Two rules that follow from the table:

- **`web_close(pageId)` is mandatory** when you finish with a desktop page — it releases
  the grid node. `session_quit(sessionId)` likewise. The `webpage_*` tools hold no grid
  node and need no close, but the *device* still needs `device_release(udid)`.
- If a tool wants a `udid`, it is on a device. If it wants a `pageId` from
  `web_navigate`, it is on the desktop grid. Do not mix ids between families.

## The loop (real device browser)

```
1. device_list                          pick a udid
2. webpage_tabs(udid, action:"new", url:"https://…")   Android
   android_devtools_navigate / ios_safari_navigate      or navigate the current tab
3. webpage_snapshot(udid)               ← START HERE. Do not guess selectors.
4. webpage_click / webpage_type / webpage_select_option   using refs from step 3
5. webpage_wait_for(udid, selector, visible:true)
6. webpage_get_text(udid, selector|ref) to assert
7. device_release(udid)
```

## Snapshot first, refs over selectors

```
webpage_snapshot(udid)
```

Returns a structured tree, one line per element:

```
button "Add to cart" [ref=e12]
textbox "Email" [ref=e7]
```

That `ref` goes straight into `webpage_click`, `webpage_type`, `webpage_hover`,
`webpage_select_option`, and `webpage_get_text`. **Prefer refs to CSS selectors.** A ref
addresses the live element, so it survives markup that shifted, and it can reach
elements no top-level selector can express.

The snapshot shows only what is actually visible by default, and marks disabled /
checked / expanded state plus current field values — which is often the assertion you
wanted. Useful options:

- `interactiveOnly: true` — just links, buttons, and fields
- `selector: "#checkout"` — scope to one region of a large page
- `limit` — default 400 nodes, max 2000

When a CSS selector matches several elements, `webpage_click` takes the first **visible**
one, not the first in document order.

## Clicking is verified, not fire-and-forget

`webpage_click` scrolls the element into view, waits for it to stop moving, and checks
it is genuinely clickable — visible, non-zero size, enabled, not covered — retrying
until `timeoutMs` (default 5000, max 30000). If it never becomes clickable it
**errors** rather than reporting a success that did nothing.

`force: true` skips those checks. It restores the old silent behaviour, where clicking a
covered or hidden element "succeeds" while nothing happens. Reach for it only when the
checks are wrong about a target you know is live. It still fails on `display:none` or
zero-size elements — there is no point to aim at.

`snapshot: true` appends a fresh snapshot of the resulting page, so you see what the
click changed without a second call. Use it on every navigation-causing click.

### Trusted input differs by platform

- **iOS** — the device taps its own screen. The page receives a genuine trusted touch
  (`pointerdown`, `touchstart`, `mousedown`, `click`), which satisfies sites that gate
  on `isTrusted`. The response reports `via: "nativeTap"`.
- **Android** — the tap is delivered as a browser-level touch, `isTrusted: false`.

If a component does not respond, `pointerType` is the lever. Default is the best path
per platform. On Android, a handler that cancels `pointerdown`/`touchstart` also
suppresses `click`, and `pointerType: "mouse"` is the way through. The response always
reports which path was used via `via` — read it when debugging a click that did nothing.

## Typing

```
webpage_type(udid, ref|selector, text, clear: true)
```

- **iOS** taps the field and types on the device keyboard — real trusted keystrokes
  (`keydown`, `keypress`, `beforeinput`, `input`). Use this for anything that reacts to
  typing rather than just reading `.value`.
- **Otherwise** the value is set through the native `HTMLInputElement` value setter, so
  React and Vue controlled inputs register the change, then bubbling `input` and
  `change` are dispatched (`isTrusted: false`).

`via` reports `"nativeKeyboard"` or `"jsValue"`. Default appends to the existing value —
pass `clear: true` to replace.

```
webpage_press_key(udid, key)     Enter Tab Escape Arrow* Backspace
webpage_select_option(udid, ref|selector, value|label|index)   exactly one of the three
```

`webpage_press_key` on iOS presses the hardware-keyboard surface, so **Tab really moves
focus** through the form. Where that surface is unavailable it falls back to a
synthesized event that does not move focus — but for Enter inside a `<form>` it also
calls `requestSubmit()`, so submission still fires. Check `via`.

## Waiting

```
webpage_wait_for(udid, selector, visible: true, timeoutMs: 10000)
```

Returns `{ found, waitedMs }` instead of throwing, so branch on the result rather than
wrapping it. `visible: true` requires a laid-out element, not merely one present in the
DOM — that distinction catches most "clicked too early" flakes.

Note: when the selector matches several elements, *any* one satisfying the test counts
as found. A control duplicated across responsive breakpoints reports visible when the
on-screen copy is.

## Tabs

```
webpage_tabs(udid)                                 list — works on iOS and Android
webpage_tabs(udid, action:"new", url:"https://…")  Android only
webpage_tabs(udid, action:"select"|"close", pageId) Android only
```

`list` returns a `pageId` per tab; pass it to any `webpage_*` tool to act on that
specific tab, on either platform. `new`/`select`/`close` error on iOS rather than
pretending — Safari can be listed and driven remotely but not opened or closed, and it
needs no switching because `pageId` already targets a tab directly.

Stale tabs accumulate across sessions. Close what you are done with (on Android).

## Debugging a page: console, network, DOM

Per-platform DevTools families: `android_devtools_*` and `ios_safari_*`. Same shape.

```
android_devtools_console_logs(udid)      ios_safari_console_logs(udid)
android_devtools_get_dom(udid)           ios_safari_get_dom(udid)
android_devtools_evaluate(udid, ...)     ios_safari_evaluate(udid, ...)
android_devtools_cookies(udid)           ios_safari_cookies(udid)
android_devtools_list_pages(udid)        ios_safari_list_pages(udid)
```

### Network capture is a live window — use triggerJs

```
android_devtools_capture_network(udid,
  triggerJs: "location.reload()",
  durationMs: 8000,
  urlSubstring: "/api/",
  onlyErrors: true)
```

The collector only sees requests made **after it attaches**. Triggering the navigation
from a *separate* tool call races the attach and returns **0 records** — a silent,
convincing failure. Put the trigger in `triggerJs` (`location.reload()`,
`location.href='…'`, `fetch('/api/x')`) so it fires inside the window.

Other things worth knowing:

- `throttle: "slow-3g" | "fast-3g" | "offline"` — applies to the capture window only,
  cleared afterwards. The cheapest way to test a slow-network path.
- `blockUrls: ["*.doubleclick.net", "*/analytics*"]` — capture without third-party noise.
- `extraHeaders: { Authorization: "Bearer …" }` — capture authenticated requests.
- `format: "har"` — a HAR 1.2 document for an external tool.
- `includeBodies` defaults true for text-like responses; caps are 10k chars per body and
  200k total, with `bodyTruncated` / `bodiesOmitted` telling you what was dropped.
- Default window 5000ms, max 30000ms. Default 100 records, most-recent first — filter
  with `urlSubstring` / `onlyErrors` on heavy pages.

## Mocking

```
webpage_mock_add(udid, matchUrl: "/api/cart", matchType: "contains",
                 status: 200, headers: {"content-type": "application/json"},
                 body: "{\"items\":[]}", delayMs: 0)
webpage_mock_list / webpage_mock_remove / webpage_mock_clear / webpage_mock_status
```

`mode: "abort"` fails the request instead, for error states without a broken backend.
Routes apply immediately and survive navigation — omit `pageId` so routing follows the
active page across navigations and new tabs.

**Scope matters:** this intercepts requests from **browser and WebView pages only**.
Requests made by native app code are not intercepted and never will be by this tool.
For those, and for the full treatment of capture, throttling and offline paths, see the
**`network-mocking`** skill.

## Desktop grid browser

```
web_navigate(url, browser: "chrome"|"firefox"|"safari")   → pageId
web_snapshot(pageId)          accessibility tree as text
web_click(pageId, selector)
web_type(pageId, ...)
web_get_source(pageId)
web_evaluate(pageId, ...)
web_screenshot(pageId)
web_close(pageId)             ← ALWAYS. Releases the grid node.
```

## W3C automation sessions

For raw scripting, or when porting an existing suite:

```
session_create(browserName: "chrome", platformName: "linux", capabilities: {...})
   browserName: chrome | firefox | MicrosoftEdge, or empty for a mobile session
session_url / session_get_title / session_find_element / session_click
session_send_keys / session_back / session_page_source / session_screenshot
session_execute(sessionId, script: "return document.title", args: [])
session_console_logs(sessionId)
session_network_logs(sessionId, failuresOnly: true, type: "xhr", limit: 50)
session_list()
session_quit(sessionId)       ← ALWAYS
```

`session_network_logs` is captured automatically — method, URL, status, type, timing,
size. Request and response **bodies are not available** there; use
`android_devtools_capture_network` / `ios_safari_capture_network` with
`includeBodies` when you need them.

## Screenshots

`webpage_screenshot(udid)` — on **Android** this is a clean capture of the web content,
and `selector` / `ref` clips to a single element, scrolled into view. On **iOS**,
element clipping is unavailable, so it returns the full device frame including the
browser chrome and status bar; `selector`/`ref` are ignored and a note says so. Do not
build a visual comparison on the assumption that both platforms clip.
