---
name: device-state-setup
description: Put a real device into the state a test needs before driving it — push files onto the device so an upload or file-picker flow has something to pick, seed an app's own container with fixture data, mock GPS location, force a language or locale, reset app data for a clean first run, and manage files on the device. Use when a test needs a photo/document/attachment present, a specific location, a locale, or a known starting state.
license: MIT
---

# Setting up device state

Most "flaky" mobile tests are not flaky — they assume state that is not there. No photo
in the gallery, so the upload picker is empty. A location from whoever used the device
last. An app already logged in from a previous run.

Set the state explicitly, then test.

## Files on the device — upload and attachment flows

The blocker for testing an upload is having something to upload. Push it.

### Android

```
device_file_push(udid,
  remotePath: "/sdcard/Download/invoice.pdf",
  content: "<base64>")
```

Destinations are limited to `/sdcard/` (user storage) and `/data/local/tmp/` (scratch).
Hard cap is 20MB decoded, and `remotePath` must contain no shell metacharacters. For an
APK use `app_install` rather than pushing it.

Put the file where the picker will look: `/sdcard/Download/` for documents,
`/sdcard/Pictures/` or `/sdcard/DCIM/` for images. A newly pushed image may not appear in
the gallery until the media store notices it — if the picker comes up empty, that scan is
the first thing to check, not your test.

### iOS — including an app's own container

```
ios_file_push(udid, remotePath: "Documents/fixtures.json", content: "<base64>",
              bundleId: "com.acme.app")
```

With `bundleId`, this writes into **that app's own container** (`Documents/`, `Library/`,
`tmp/`) — the files the app itself reads. That is how you seed fixture data, a config
file, or a prepared test database *before* launching it, instead of clicking through the
UI to build that state.

Only apps built for testing expose a container; store-installed apps do not. Omit
`bundleId` to write to the shared media directory (photos, downloads) instead — which is
what a photo picker reads from. `ios_upload_targets(udid)` reports where uploads are
allowed to land.

### Managing what is there

```
device_file_list / device_file_pull                     Android
ios_file_list / ios_file_find / ios_file_stat           iOS
ios_file_pull / ios_file_copy / ios_file_move
ios_file_delete / ios_file_mkdir
```

Pulling is how you get evidence back off the device — a log the app wrote, an exported
file, a generated report — to attach to a bug.

## Location

```
device_set_location(udid, latitude: 37.7749, longitude: -122.4194, accuracy: 5)
device_clear_location(udid)

ios_set_location(udid, ...) / ios_get_location(udid) / ios_clear_location(udid)
```

Android requires API 26+. Every app reading the normal location APIs sees the mock.

**Know this before designing a geo test:** apps that check whether a fix is mocked —
banking, ride-share, some games — will detect it and refuse. That is an OS-level signal,
not something the platform can hide. Pick a target app that does not gate on it, or test
the geo logic another way.

Always `device_clear_location` afterwards. A device left in San Francisco silently breaks
the next run.

## Language and locale

Prefer the per-app override — it does not touch device settings, so it cannot leak into
another test:

```
device_launch_app_in_language(udid, packageName: "com.acme.app", locale: "fr-FR")
device_clear_app_locale(udid, packageName)
```

Android 13+ (API 33). The app is force-stopped first so the cold launch picks up the
locale.

Whole-device, when you need the system UI translated too:

```
device_set_device_language(udid, language: "fr", country: "FR", script: "Hans")
ios_set_device_language(udid, ...) / ios_launch_app_in_language(udid, bundleId, ...)
```

This is persistent and survives reboot. Two caveats: some manufacturer skins re-apply
their own locale a few seconds later, and managed devices may refuse the permission
grant. Verify the language actually changed — read the screen — rather than assuming.

## A clean starting state

```
device_clear_app_data(udid, packageName)     wipes data and cache, like "Clear Storage"
device_terminate_app(udid, packageName)
device_launch_app(udid, packageName)
```

Onboarding, first-run, signup and permission-prompt flows **will not reproduce** against
an app that is already enrolled. Clear first. This is also what `resetAppData` does for a
flow replay — see the `flow-record-replay` skill.

## Other device state

```
device_toggle_wifi / device_toggle_bluetooth
device_clipboard_set / device_clipboard_get        seed a paste target
ios_set_pasteboard / ios_get_pasteboard
device_battery / device_network_info / device_notifications
device_panel(udid, action: "notifications" | "settings" | "collapse")
ios_orientation(udid, ...)
```

### Dark mode

There is **no dedicated tool** for this. On Android, drive it through the shell:

```
device_shell(udid, "cmd uimode night yes")    dark
device_shell(udid, "cmd uimode night no")     light
device_shell(udid, "cmd uimode night auto")
```

Read the screen afterwards to confirm it applied — some skins override it. There is
currently no equivalent path for iOS appearance; switch it by hand in Settings, or test
dark mode on Android.

## Put it back

State you set is state the next run inherits. Before `device_release`:

- `device_clear_location`
- `device_clear_app_locale`, or set the language back
- delete fixture files you pushed
- `device_clear_app_data` if you left the app logged in
