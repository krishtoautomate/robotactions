# Android reference

All tools take `udid`. No session start is required — the first control call opens one
(~3s), and the hold is released with `device_release`.

## Coordinate spaces

There is one space that matters: **tap-coord space**. Everything below is already in it.

| Source | In tap space? |
|---|---|
| `device_page_source` bounds `[L,T][R,B]` | Yes — tap the center |
| Labeled elements bundled with `device_screenshot` | Yes |
| `device_find_element` / `device_wait_for_element` return values | Yes |
| `device_scroll_to_element` return value | Yes |
| A point you estimated by looking at the screenshot image | **No — must be scaled** |

Scaling formula, using the two numbers printed in the `device_screenshot` footer:

```
scale = device_width / rendered_width
tap_x = visual_x × scale
tap_y = visual_y × scale
```

Both axes share one scale (aspect is preserved). The values differ per device — read
them from the footer every time, never hardcode.

## Finding elements

```
device_page_source(udid, search: "checkout")     grep the whole dump, case-insensitive,
                                                  across text/content-desc/class/id
device_page_source(udid, format: "description")  compact readable list instead of XML
device_page_source(udid, className: "android.widget.Button")
device_find_element(udid, text | contentDesc | resourceId)
device_wait_for_element(udid, text | resourceId, timeout, interval)
device_scroll_to_element(udid, text | contentDesc | resourceId, direction, maxScrolls)
device_elements_in_region(udid, ...)             elements inside a screen area
device_locators_for(udid, text | x,y)            ranked stable locators for codegen
```

Android only dumps **rendered** nodes. An element missing from page source is often
just below the fold — `device_scroll_to_element` before concluding it does not exist.

## Interacting

```
device_tap_by_text(udid, text | contentDesc | resourceId,
                   autoScroll, maxScroll, scrollDirection)
device_tap(udid, x, y)
device_long_press(udid, x, y)
device_swipe(udid, x1, y1, x2, y2, duration)
device_drag_drop(udid, ...)
device_scroll(udid, direction: up|down|left|right, amount: 0.0–1.0)
device_type(udid, text, clearFirst, pressKey, method)
device_clear_text(udid)
device_key(udid, keycode)   HOME BACK ENTER VOLUME_UP VOLUME_DOWN POWER
                            APP_SWITCH ESCAPE DELETE TAB SEARCH MENU, or a number
```

`device_tap_by_text` ranks candidates when several nodes share a label: an interactive
widget (EditText, Button) wins over a passive TextView. Pass `resourceId` to pin one
exactly. It auto-scrolls to off-screen targets by default.

`device_tap_by_text` cannot reach elements with no stable text, content-desc, or
resource-id — image-only icons, custom canvas widgets, dynamically localized labels.
For those, take bounds from page source and use `device_tap`. Both paths are
first-class; neither is a workaround.

### Typing

`device_type` methods:

| method | Behaviour |
|---|---|
| `keys` (default) | Key events per character. Most reliable. Non-ASCII auto-falls back for that segment. |
| `ime` | Full UTF-8 in one shot, but some manufacturer keyboards intercept `.` `@` `_` as shortcuts. |
| `shell` | Slowest, and some manufacturer keyboards drop `@` `.` `_` entirely. |

Stay on the default unless you have a specific reason. Corrupted emails and URLs from a
silently-dropped `@` are hard to spot in a passing test.

**Sequence, never parallel:** the focusing tap must return before `device_type` is sent.

## Apps

```
app_upload(fileName, fileData)          base64; chunk over ~100MB with
                                        chunkIndex + totalChunks
app_list()                              → file ids
app_install(udid, appId)
app_delete(...)
device_list_apps(udid, userOnly)
device_launch_app(udid, packageName)    package name OR display name substring
device_terminate_app(udid, packageName)
device_uninstall_app(udid, packageName)
device_clear_app_data(udid, packageName)   clean first-run state
device_current_app(udid)                   foreground package + activity
device_app_apk_paths(udid, packageName)
```

## Device state

```
device_info(udid)              model, OS, screen
device_screen(udid)            display metrics
device_battery(udid)
device_network_info(udid)
device_notifications(udid)
device_panel(udid, action)     notifications | settings | collapse
device_toggle_wifi(udid, ...)
device_toggle_bluetooth(udid, ...)
device_clipboard_get / device_clipboard_set
device_dismiss_recent_app(udid, ...)
device_focus_events(udid)      which view currently has focus
device_shell(udid, command)    arbitrary shell command, returns output
```

## Files

```
device_file_list(udid, ...)
device_file_push(udid, ...)
device_file_pull(udid, ...)
```

## Localization and location

```
device_launch_app_in_language(udid, packageName, locale)   Android 13+ (API 33).
    Forces ONE app into a locale without touching device settings. Force-stops the
    app first so the cold launch picks it up. Prefer this for localization testing.

device_set_device_language(udid, language, country, script)
    Changes the whole device, persistent, survives reboot. Caveats: some
    manufacturer skins re-apply their own locale after a few seconds; MDM-managed
    devices may refuse the permission grant.

device_clear_app_locale(udid, packageName)

device_set_location(udid, latitude, longitude, accuracy)   API 26+
device_clear_location(udid)
```

Mock location is visible to apps that check `Location.isFromMockProvider` — banking,
ride-share, and some games will detect it and refuse. That is an OS-level signal, not
something the platform can hide. Plan geo tests around apps that do not gate on it.

## Capture

```
device_screenshot(udid, includeElements)   includeElements:false = image only, cheaper
device_record_start(udid, maxDurationSec)  default 300s, max 600s, auto-stops
device_record_stop(udid, recordingId)      one recording per device at a time
android_mjpeg_screenshot(udid)
android_video_stream(udid)                 live view — use instead of polling
                                           screenshots when debugging a stuck flow
```

## Beyond the basics

Other Android tool families, each worth reading its own tool descriptions before use:

- **Web content in Chrome on the device** — `android_devtools_*` (DOM, console,
  network capture, evaluate, cookies, request mocking). See the `web-app-testing` skill.
- **Network traffic** — `android_traffic_start/stop/status`, `android_traffic_flows`,
  `android_traffic_mock_*` for capturing and stubbing app traffic.
- **Performance** — `android_fps`, `android_app_launch_time`,
  `android_performance_snapshot`, `android_performance_record_start/stop`.
- **Crashes** — `android_crash_analytics`, `android_crash_detail`.
- **Accessibility** — `android_accessibility_audit`.
