---
name: web-app-testing
description: Test websites and web apps on the RobotActions grid — in the browser of a real Android or iOS device, or in a desktop browser on the grid. Use when asked to test a site on mobile Safari or Chrome, check responsive behaviour on a real phone, debug page network requests or console errors on a device, mock an API response, test a file-upload flow past iOS's native picker, extract CSS/XPath locators to hand to a Playwright or Selenium suite, send a raw DevTools-protocol command, or automate a browser with webpage_*, web_*, *_devtools_*, ios_safari_*, or session_* tools.
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

## Locators you can take elsewhere

`webpage_snapshot` is the right tool for driving the page here. When you need locators
that outlive this session — to hand to a Playwright or Selenium suite — use the
extractor instead:

```
android_devtools_elements(udid)      ios_safari_elements(udid)
```

Each record carries a unique-ish **CSS selector and an XPath**, plus tag, text, key
attributes, bounding box and visibility, and optionally computed styles. Same script on
both engines, so the output is identical in shape on Chrome and on Safari.

Every record also carries a `ref`, the same addressing `webpage_snapshot` returns. Two
things a selector cannot do and a ref can:

- reach inside a **shadow root or a child frame** — `document.querySelector()` will never
  resolve those from the top-level document
- stay unambiguous on markup with no stable ids, where a generated
  `:nth-of-type()` chain goes stale between the read and the action

Refs are minted per page, monotonic, and **never reused**: an old ref resolves to the
element it originally named or fails outright. It cannot silently point at a different
element after a re-extraction. Resolution also requires the node to still be connected,
which catches elements detached by a soft SPA navigation; a hard reload discards the
store entirely. The store keeps 2000 refs per page, evicting oldest first.

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

## Uploading a file (iOS)

```
ios_safari_set_input_files(udid, selector: "input[type=file]",
                           files: [{ name: "contacts.csv", text: "name,email\nA,a@x.io" }])
```

Tapping an upload control on iOS opens a native Files/Photos sheet that no web automation
surface can drive, so the tap just blocks. This attaches the files to the input directly —
the picker never opens — then fires `input` and `change`, because assigning the file list
alone updates the DOM without notifying any framework binding or validator, which looks
exactly like an upload the app never noticed.

It then reads the list back **off the input** and reports the names, sizes and MIME types
the page actually sees, so a silent no-op cannot pass as success.

Content comes from `text`, from `contentBase64` for binary, or from `devicePath` for a file
already on the device (`ios_file_push`). 2 MB total; `index` picks among several matches.

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

Per-platform DevTools families: `android_devtools_*` and `ios_safari_*`. Same shape —
and the sameness is real, not a wrapper convenience. Inspection on both platforms speaks
the **Chrome DevTools Protocol**: Android against Chrome directly, iOS through a
per-device bridge that serves CDP over Safari's Web Inspector. The same sequence of calls
works on either platform, which is what makes driving a real phone feel like driving a
desktop browser.

Two places that parity does **not** hold, both worth knowing before you trust a result:

- **Request interception.** There is no CDP Fetch equivalent on the iOS side, so mocking
  drives WebKit's own interception commands underneath (iOS 14.0+). The dedicated mock
  tools — `webpage_mock_*`, which routes by udid on both platforms — hide that difference.
  Reaching for interception through the raw escape hatch below does not.
- **Web content only.** These reach pages in Chrome / debuggable WebViews and
  Safari / WKWebViews. Native app traffic (URLSession, OkHttp) is invisible here and
  always will be — that is `android_traffic_*` / `ios_traffic_*`. Mocking a native
  endpoint at this layer watches the request sail straight through, with no error to
  explain why.

```
android_devtools_console_logs(udid)      ios_safari_console_logs(udid)
android_devtools_get_dom(udid)           ios_safari_get_dom(udid)
android_devtools_evaluate(udid, ...)     ios_safari_evaluate(udid, ...)
android_devtools_cookies(udid)           ios_safari_cookies(udid)
android_devtools_list_pages(udid)        ios_safari_list_pages(udid)
```

### Evaluate reads the page — it does not click it

A click dispatched from JavaScript — `el.click()`, or a synthesized `MouseEvent` — is an
**untrusted** event (`isTrusted: false`). Component frameworks, and anything gated on a real
user gesture (file pickers, clipboard, autoplay, anti-bot checks), may ignore it while the
evaluate still succeeds: a failure shaped like a passing call. Click with `webpage_click`
and type with `webpage_type`, which have the device act on its own screen.

When the read follows an action, wait **inside** the same call rather than splitting it into
a poll and a read:

```
ios_safari_evaluate(udid, expression: "…",
                    waitForSelector: "#menu", waitTimeoutMs: 5000, waitMs: 200)
```

Frameworks paint a frame or two after the click that triggers them, so an evaluate fired
immediately reads the DOM before the menu, overlay or row exists. A selector that never
appears **errors** instead of evaluating anyway and handing back a `null` that reads like a
finding. `waitForSelector` polls for `waitTimeoutMs` (default 5000, max 15000); `waitMs`
(max 10000) settles animation afterwards. Both wait on the same tab in the same session —
a separate poll call re-runs the whole page walk and can land on different state.

### The tab you navigated to is the tab you get (iOS)

`ios_safari_navigate` pins the page it landed on and reports its `pageId`. Every later
id-less `ios_safari_*` call runs on that pinned page **or errors, naming both tabs and both
URLs**. It will not quietly fall through to another tab — a well-formed answer from the
wrong page is worse than a failure, because nothing downstream can tell it from the truth.
Pass `pageId` only when you mean a different tab.

Only the frontmost tab is inspectable: a backgrounded tab is throttled and times out even
though its `pageId` is still valid. Bring it to the front on the device, or navigate again.
`ios_safari_evaluate` also returns a second block naming the tab it ran on — read it when a
result looks like it came from somewhere else.

### When nothing on the page responds

Two causes look identical from off-device, and only one of them is about the device:

- it is asleep or locked, so the page context is suspended
- a page-modal `alert` / `confirm` / `prompt` is open, blocking the page's JS thread

Both kill every probe on the command timeout. **Take a screenshot** — that is what separates
them. A dialog has to be dismissed on the device before any tool can drive the page, and
waking a device that was never asleep changes nothing.

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

### The escape hatch

Every tool above wraps one protocol call behind a friendly schema. When you need a
capability nobody wrapped — Emulation, Performance, CSS, Animation, DOM mutation — forward
the call yourself:

```
webpage_cdp_command(udid, method: "Emulation.setGeolocationOverride", params: { … })
```

It is bounded by the browser on both platforms, not device-level. Two traps:

- **A request paused raw stays frozen until you answer it.** The mock tools own that
  lifecycle; a bare command does not. If you arm interception this way and walk away, that
  load hangs.
- **On iOS, `*.enable` lies.** The bridge absorbs enable calls without forwarding them, so
  `Accessibility.enable` returns a cheerful OK for a domain that does not exist — and the
  next call fails with `-32601 domain was not found`. Do not treat an `.enable` reply on
  iOS as proof the capability is there. The tool attaches that caveat to every one.

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
