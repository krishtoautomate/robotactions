# iOS reference

## Session lifecycle

iOS control runs through an **automation session**. It takes 10–30 seconds to launch, so
start it once and reuse it.

```
ios_start_session(udid)     required before control commands; ~10–30s
...                          all your work
ios_end_session(udid)        release session resources
device_release(udid)         release the device hold
```

Many tools auto-start a session if one is not running — but that means an unexpected
30-second stall in the middle of a flow. Start it explicitly up front.

`ios_unlock(udid)` if the screen is locked. `ios_lock_status(udid)` to check.

## Two input paths

| Path | Needs a session? | When |
|---|---|---|
| Session tools (`ios_tap`, `ios_swipe`, `ios_send_keys`, …) | Yes | **Default.** Element-aware, integrates with page source. |
| Direct HID tools (`ios_tap_hid`, `ios_swipe_hid`, `ios_key_hid`, …) | No | The session is unavailable, or you need input the session cannot deliver. |

`ios_hid_status(udid)` reports whether direct HID is available on this device and
returns its display size. It needs no session. Direct HID is unavailable on some OS
versions and returns "no HID available" — check before designing a flow around it.

`ios_tap_hid` accepts `norm: true`, which takes `x`/`y` as 0–1 **fractions** of the
screen. That lets you pass `pixelInScreenshot ÷ screenshotSize` directly, with no
point-guessing or scale math.

## Finding elements — page source is the source of truth

```
ios_page_source(udid)                        default "description" format:
                                             Type: "label" @ (cx,cy) WxH
ios_page_source(udid, search: "Safari")      greps the WHOLE hierarchy including
                                             off-screen; hits flagged [off-screen]
ios_page_source(udid, tappableOnly: true)    interactive control types only
ios_page_source(udid, type: "Button")        disambiguate duplicate labels
ios_page_source(udid, format: "xml")         full hierarchy
```

`(cx, cy)` is the element **center** and the exact tap point, in physical screen points.

Elements with zero-size bounds are flagged **`[zero-area]`** — bottom-tab labels are the
classic case. They cannot be tapped by coordinate at all. Use `ios_tap_by_label`.

Never read coordinates off a screenshot image. Page source is authoritative.

## Interacting — label first

```
ios_tap_by_label(udid, label, autoScroll)   PREFERRED. One call: find + tap.
                                            Works on zero-area elements.
                                            Auto-scrolls off-screen targets.
                                            On no match, returns similar labels.
ios_find_element(udid, label, type, strategy)   → center, bounds, matched strategy
ios_tap(udid, x, y, duration)               fallback, coords from page source only
ios_long_press(udid, x, y, ...)
ios_swipe(udid, x1, y1, x2, y2, duration)
ios_scroll_to_element(udid, label, direction)
ios_pinch(udid, ...)
ios_drag_drop(udid, ...) / ios_gesture_path(udid, ...)
```

`ios_find_element` strategies, tried in order by default: class chain → predicate
string → accessibility id → name → xpath. Pin one with `strategy:` when a label is
ambiguous, and narrow with `type:` (`XCUIElementTypeButton`, `XCUIElementTypeCell`, …).

## Typing

```
ios_send_keys(udid, text)      keyboard must be VISIBLE — tap a field first.
                               "\n" in the text presses Return/Go, e.g.
                               "user@example.com\n" types and submits.
ios_clear_text(udid)
ios_dismiss_keyboard(udid)
ios_press_button(udid, button)
```

`ios_press_button` covers hardware (`home`, `volumeUp`, `volumeDown`), keyboard submit
(`return`, `go`, `done`, `search`), editing (`backspace`, `delete`), and `tab`.

**Backspace gotcha:** a tap that visually focuses a field may not have raised the soft
keyboard yet, and key events are dropped when it is down. Confirm the keyboard is up
before sending edit keys.

## Apps

```
app_upload(fileName, fileData)        .ipa, same chunked upload as Android
app_install(udid, appId)
ios_install_app(udid, ...)
ios_list_apps(udid)
ios_launch_app(udid, bundleId)
ios_launch_app_in_language(udid, bundleId, ...)
ios_terminate_app(udid, bundleId) / ios_kill_app(udid, ...)
ios_uninstall_app(udid, bundleId)
ios_active_app(udid)                  what is in the foreground
```

## Device state

```
ios_device_info(udid)
ios_window_size(udid)
ios_orientation(udid, ...)
ios_battery(udid)
ios_settings(udid, ...)
ios_diagnostics(udid)
ios_ps(udid)                          running processes
ios_reboot(udid)
ios_shell(udid, ...)
ios_get_pasteboard / ios_set_pasteboard
ios_clipboard_get_hid / ios_clipboard_set_hid
ios_contact_hid(udid, ...)
```

## Files

```
ios_file_list / ios_file_find / ios_file_stat
ios_file_push / ios_file_pull / ios_file_copy / ios_file_move
ios_file_delete / ios_file_mkdir
ios_upload_targets(udid)              where uploads are allowed to land
```

## Localization and location

```
ios_set_device_language(udid, ...)
ios_launch_app_in_language(udid, bundleId, ...)
ios_set_location(udid, ...) / ios_get_location(udid) / ios_clear_location(udid)
```

## Capture

```
ios_screenshot(udid)
ios_fast_screenshot(udid)             lower latency
ios_mjpeg_screenshot(udid)
ios_video_stream(udid)                live view for debugging a stuck flow
ios_record_start / ios_record_stop / ios_record_cleanup
```

## Beyond the basics

- **Safari web content** — `ios_safari_*` (DOM, console, network capture, evaluate,
  cookies, mocking). See the `web-app-testing` skill.
- **Network traffic** — `ios_traffic_*`, plus `ios_pcap_start/stop/status` for a packet
  capture.
- **Performance** — `ios_fps`, `ios_app_launch_time`, `ios_performance_snapshot`,
  `ios_performance_record_start/stop`.
- **Crashes** — `ios_crash_list`, `ios_crash_detail`, `ios_crash_analytics`,
  `ios_crash_symbolicate`.
- **Accessibility** — `ios_accessibility_audit`, `ios_voiceover_preview`.
