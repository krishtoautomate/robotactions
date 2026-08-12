---
name: mobile-app-testing
description: Drive real Android and iOS devices on the RobotActions device cloud to test native mobile apps — install an app, navigate its UI, assert on what is on screen, and capture evidence. Use when asked to test, explore, reproduce a bug in, or automate a mobile app on a real phone or tablet, or when working with device_* or ios_* MCP tools.
license: MIT
---

# Testing mobile apps on real devices

You are driving a physical phone or tablet over the network. It has real latency, real
animations, and a real keyboard. Nearly every failure in agent-driven mobile testing
comes from three things: **tapping the wrong pixel**, **typing before focus lands**, and
**acting before the screen settled**. This skill is built around avoiding those.

## The loop

```
1. device_list                       pick a udid, note os (Android vs iOS)
2. (iOS only) ios_start_session      ~10–30s, required before any iOS control
3. launch the app
4. OBSERVE  → screenshot / page source. Never act on an unobserved screen.
5. LOCATE   → resolve a real element. Never eyeball a coordinate.
6. ACT      → tap / type / swipe. Sequentially.
7. WAIT     → wait for the next screen's element, not for a duration.
   repeat 4–7
8. ASSERT   → read the actual on-screen value
9. device_release(udid)              always, including on failure
```

Steps 4–7 are one indivisible cycle. Skipping OBSERVE to save a call is how a run ends
up tapping a stale screen and reporting a false pass.

## Rule 1 — never invent a coordinate

Both platforms give you an authoritative element source. Use it.

**Android.** `device_screenshot` returns the image *plus* a labeled element list with
bounds already in tap-coordinate space. Prefer, in order:

1. `device_tap_by_text(udid, text | contentDesc | resourceId)` — no coordinates at all.
   It ranks candidates so a Button or EditText beats a passive TextView, and auto-scrolls
   to find an off-screen target. **This is the default choice.**
2. Bounds from the screenshot's labeled elements or `device_page_source`
   (`[L,T][R,B]` → tap the center, `((L+R)/2, (T+B)/2)`). Pixel-exact, no scaling.
3. Only if the target is invisible to the accessibility tree (image-only icon, custom
   canvas): estimate from the image — and then you **must** scale, see below.

**iOS.** Prefer `ios_tap_by_label(udid, label)`. It works even on zero-area elements
and needs no coordinate math. Fall back to `ios_find_element` → returns a center point,
then `ios_tap`. Coordinates must come from `ios_page_source`, never from looking at a
screenshot.

### The Android scaling trap

The screenshot you are shown is downscaled. `device_tap` expects full-resolution
tap-space. If you estimated a point off the image, convert it:

```
scale = device_width / rendered_width      # both printed in the device_screenshot footer
tap_x = visual_x × scale
tap_y = visual_y × scale
```

Read both numbers from the footer of the actual screenshot. Never assume a constant —
it differs per device. **Forgetting this scale is the single most common cause of taps
landing in the wrong place.** It does not apply to bounds from page source or the
labeled-element list, which are already in tap space.

## Rule 2 — focus, then type, sequentially

`device_tap_by_text` (or the tap that focuses a field) must **complete** before
`device_type` is issued. Never put them in the same parallel batch.

If you fire both at once, the type races the focus change and lands in the previously
focused field. Real observed failure: a login test where username and password were
concatenated into the username box, and the test reported "typed successfully".

```
device_tap_by_text(udid, text: "Email")      ← wait for this to return
device_type(udid, text: "qa@example.com")    ← then this
```

`device_type` extras that remove a call each:

- `clearFirst: true` — wipes the field first (reads its length, sends that many deletes)
- `pressKey: "ENTER"` — submits after typing, for type-then-search flows
- `method` — leave it on the default `keys`. Some manufacturer keyboards silently drop
  `@`, `.`, and `_` under the `ime` and `shell` methods, which quietly corrupts every
  email and URL you type. Non-ASCII (CJK, emoji) auto-falls back on its own.

## Rule 3 — wait for elements, never for time

```
device_wait_for_element(udid, text: "Order confirmed", timeout: 15000)
```

Polls until it appears and returns coordinates ready to tap. A fixed pause is either
slower than it needs to be or flaky on a slow build — usually both across a device pool.

On iOS: `ios_scroll_to_element` / `ios_find_element` serve the same role.

If an element is not in `device_page_source`, it may simply be scrolled off-screen —
Android only dumps rendered nodes. Use `device_scroll_to_element` to bring it in before
concluding it is absent. Pass `search:` to `device_page_source` to grep the dump
case-insensitively across text, content-desc, class, and resource-id — the fastest way
to answer "is this on screen at all?".

## Installing the app under test

```
app_upload(fileName: "app.apk", fileData: <base64>)   → chunk it over ~100MB
app_list()                                            → get the file id
app_install(udid, appId)
device_launch_app(udid, packageName: "com.acme.app")  → or a display name, e.g. "Chrome"
```

iOS uses the same upload/install path with an `.ipa`, then
`ios_launch_app(udid, bundleId)`.

Already installed? `device_list_apps` / `ios_list_apps` to find the identifier, and
`device_clear_app_data` to force a clean first-run state before an onboarding test.

## Asserting

An assertion reads the device, not your expectation of it.

- Text on screen → `device_page_source(udid, search: "Order #")` or
  `device_find_element`; iOS → `ios_find_element` / `ios_page_source`.
- Correct app in foreground → `device_current_app` / `ios_active_app`.
- Something must be **absent** → search page source and confirm no match. Do not infer
  absence from a screenshot; an element can be present and off-screen.

Report what you actually observed. "The confirmation screen did not appear within 15s;
page source still shows the payment form" is a useful result. "Test passed" without a
read is not.

## Capturing evidence

- `device_screenshot(udid, includeElements: false)` — image only, saves tokens on
  screens you only need to show, not interact with.
- `device_record_start` / `device_record_stop` — video of a repro.
- `android_video_stream` — live view; use this instead of polling screenshots when
  debugging a flow that is stuck.
- `device_locators_for(udid, text | x,y)` — ranked, stable locators (id, text,
  content-desc, accessibility selector, XPath) for the element. Use these when writing
  the flow up as a real test script, so selectors are not re-derived by hand.

## Always release

```
device_release(udid)
```

Holds count against your parallel-device limit. Release on the failure path too.

## Input goes straight to the device

Taps and keystrokes are delivered through the device's own input path, not routed through
a separate automation framework layer. On iOS the `*_hid` tools need no automation
session at all (`ios_hid_status` reports availability), and in the device browser
`webpage_click` makes the device tap its own screen — a genuinely trusted touch that
satisfies targets which reject synthesized events.

You do not need a framework session to drive a device. One is available when you want
framework parity — see the `framework-integration` skill.

## Related skills

| For | Skill |
|---|---|
| Pushing a file so an upload picker has something to pick; location, locale, dark mode, clean app state | `device-state-setup` |
| Mocking or capturing native app traffic, and error/offline/slow-network states | `network-mocking` |
| Writing this up as an Appium/Selenium/WebdriverIO test, or running an existing suite | `framework-integration` |
| Saving the walkthrough as a replayable regression test | `flow-record-replay` |
| Testing a website or WebView rather than native UI | `web-app-testing` |

## Deeper reference

- `references/android.md` — full Android tool map, gestures, hardware keys, app data,
  shell access
- `references/ios.md` — session lifecycle, label-first interaction, hardware buttons,
  HID vs automation input, files and diagnostics
