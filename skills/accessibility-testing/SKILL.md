---
name: accessibility-testing
description: Test a mobile app's accessibility on real Android and iOS devices — run the platform's own accessibility audit on a screen, then drive the real screen reader (TalkBack on Android, VoiceOver on iOS) item by item to check what a blind user hears, in what order, and whether every control can be reached and activated. Use when asked for an accessibility, a11y, screen-reader, TalkBack, VoiceOver or WCAG check of a mobile app, or when working with android_talkback, ios_voiceover, ios_voiceover_preview or *_accessibility_audit tools.
license: MIT
---

# Accessibility testing on real devices

Two kinds of tool answer two different questions. Use both — neither covers the other.

| Question | Android | iOS |
|---|---|---|
| What is wrong on this screen, by the platform's own rules? | `android_accessibility_audit` | `ios_accessibility_audit` |
| What does the screen reader actually say, in what order, and does activating work? | `android_talkback` | `ios_voiceover` |
| What would the screen reader probably say, without turning it on? | — | `ios_voiceover_preview` |

An **audit** looks at one screen at one instant: missing labels, small tap targets,
contrast (iOS), duplicate or redundant descriptions. It cannot tell you that focus jumps
from the header to the footer, that a dialog lets focus escape behind it, or that a
control announces fine but does nothing when activated. Only **walking the real screen
reader** shows that.

## The loop

```
1. device_list                       pick a udid; note Android vs iOS
2. Navigate to the screen under test with the screen reader OFF.
   Ordinary taps and tap-by-label tools work normally only while it is off.
3. AUDIT    android_accessibility_audit / ios_accessibility_audit
            Let the screen settle first — an audit mid-animation under-reports.
4. CHECK    action: 'status' first. If the reader is already on (someone left it on),
            note it, and turn it off at the end anyway.
5. TURN ON  android_talkback(action: 'enable') / ios_voiceover(action: 'start')
6. WALK     First 'previous', repeatedly, until the focus stops moving — the reader
            often lands mid-screen, and anything above that point (title, toolbar,
            profile button) is only reached going backwards. Then 'next', repeatedly,
            to the end. Record every `text` in order. See "End of screen".
7. CHECK    the transcript — see "What to look for"
8. ACTIVATE land on a control, then action: 'activate'. Confirm the app actually
            responded (page source / screenshot). If it opened another screen and you
            must stay on this one, go back: device_key(BACK) on Android,
            ios_voiceover(action: 'back') on iOS.
9. TURN OFF android_talkback(action: 'disable') / ios_voiceover(action: 'stop')
            ALWAYS — on the failure path too.
```

**Sound:** while the reader is on and nobody is watching the device in a browser, the
device is kept silent automatically — the enable reply says so in `deviceSound`. Nothing
to do on your side, and the speech is still readable in every reply's `text`.

**Step 9 is not optional.** While a screen reader is on, a single tap only moves its
focus and a double tap activates. Every later tap, swipe and tap-by-text in the session —
yours or the next user's on that device — behaves differently until it is turned off.

## Reading the replies

Both tools return `text`: what the screen reader landed on after the action. They are
close to the spoken words but not a verbatim transcript, and the two platforms differ:

| | Android `android_talkback` | iOS `ios_voiceover` |
|---|---|---|
| On / off | `enable` / `disable` | `start` / `stop` |
| `text` contains | label + role + state, plus anything announced during the action | the element's accessibility label only — iOS does not expose role words or hints |
| Where it is | `bounds`, screen pixels | `focus.frame`, screen points, and `focus.app` |
| Extra moves | — | `back`, `home`, `rotor`, `rotor_item`, `read_all` |

So on iOS, "Submit" with no "button" after it is normal — do not report a missing
role from `ios_voiceover` alone. Check traits with `ios_accessibility_audit` or
`ios_voiceover_preview` instead.

### Android status codes

Read `code` on every `android_talkback` reply:

- `ok` — done.
- `not_running` — TalkBack is off, and the gesture was **not** sent. Enable it first.
- `text_unavailable` — another automation client holds the device's accessibility
  service (typically an Appium test session running on the same device). The gesture **was**
  performed, but no text could be read. End that session, then retry.
- `not_installed` — this device has no TalkBack. Pick another device.

Each move takes up to ~3 s; enable/disable up to ~5 s. Issue moves one at a time and wait
for each reply — never in a parallel batch.

### iOS specifics

- **First use on a device:** iOS shows a one-time "VoiceOver changes the gestures" sheet
  that holds the cursor. If `next` returns `text: null` right after `start`, look at a
  screenshot; if the sheet is up, answer **Use VoiceOver** (`activate` on that button).
- **Rotor:** `rotor` with `direction` cycles the rotor setting (Headings, Links,
  Words…) and reports which one is selected; `rotor_item` then moves to the previous or
  next item of that kind. Use it to check that headings are marked as headings — a
  screen-reader user navigates by them.
- **`read_all`:** reads from the top for `duration` seconds (default 10, max 60) and
  returns every label it reached, one per line. Fastest way to get a full-screen
  transcript; use `next` when you need per-item focus frames.
- **If `ios_voiceover` errors**, this device cannot be driven that way right now. Fall
  back to `ios_voiceover_preview` and say so in the report.
- `ios_voiceover_preview` needs no screen reader at all. It **reconstructs** each
  element's announcement from its attributes and flags what a blind user could not act
  on. Its wording is indicative and its order is document order, not VoiceOver's — trust
  its flagged issues, not its sentences. `onlyIssues: true` returns just the problems.

## End of screen

- iOS: `text` comes back `null` when VoiceOver did not move — that is the last element
  (or the first, when walking with `previous`).
- Android: the reply's `message` says the focus did not move. On older devices that do not
  say so, stop when two consecutive replies return the same `text` **and** the same
  `bounds`.

Set yourself a cap (for example 60 moves). A walk that never ends — the same handful of
items repeating — is itself a finding: a **focus trap**.

## What to look for in the transcript

| Finding | How it shows up |
|---|---|
| Unlabelled control | `text` is only a role ("Button", "Image") or empty, or iOS `(no label)` |
| Developer string spoken aloud | `text` like `btn_submit`, `ic_close_24`, `imageView3` |
| Wrong reading order | Order of `text` does not match the visual top-to-bottom, left-to-right order (compare the focus bounds/frames with a screenshot) |
| Unreachable control | A control visible in the screenshot never appears in the walk — in EITHER direction. Walk `previous` from the first focus too before reporting this, and ignore listed elements with zero-size bounds: they are off-screen, not unreachable |
| Focus escapes a dialog | While a modal is open, `next` reaches elements behind it |
| Focus trap | The walk cycles without reaching the end |
| Ambiguous duplicates | Several items announce identically ("Edit", "Edit", "Edit") with no context |
| Decorative noise | Purely visual images or separators each take a stop |
| Activate does nothing | `activate` on a control leaves the screen unchanged |

Report each one with the `text` and its bounds/frame, so the developer can find the
element. A screenshot with the screen reader's focus visible is good evidence.

## Combining with other skills

- To get to the screen first — install, launch, log in — see `mobile-app-testing`.
  Do that with the screen reader off.
- Dark mode is a device setting: see `device-state-setup`, then re-run the audit —
  contrast failures often appear in only one of the two themes.
- To re-check the same screen after every build, record the navigation to it as a flow
  (`flow-record-replay`) with the screen reader off, replay it, then run the audit and
  the walk.
