---
name: flow-record-replay
description: Turn a manual walkthrough of a mobile app into a saved, replayable regression test on RobotActions — record steps with assertions, build reusable components, replay on any device, and diagnose failures step by step. Use when asked to record a flow, build or run a regression test, replay a scenario on another device, create a test suite, or triage a failed replay, or when working with flow_recording_*, flow_replay_*, or test_suite_* tools.
license: MIT
---

# Recording and replaying flows

A flow recording is a saved test. You drive the app once; each action is captured
together with the page source and element locators at that moment. Replay finds those
elements again on any device and re-executes them.

The value is entirely in **how you record**. A recording of taps and nothing else
replays and tells you nothing. A recording with assertions is a test.

## Record

```
flow_recording_start(udid, name: "Checkout — guest", category: "test")
    → recordingId, and a windowSize you will need for coordinates
```

`category`:
- `"test"` — a standalone scenario
- `"fragment"` — a **component**: a reusable piece (login, dismiss onboarding, accept
  cookies) meant to be referenced from other tests

The initial app state is captured automatically and an `appLaunch` step is added, so
step 1 already exists.

### Add steps

Each `flow_recording_action` call **performs the action live on the device** and records
it with an automatic page-source and element capture.

```
flow_recording_action(recordingId, action: "tap", x, y)
flow_recording_action(recordingId, action: "sendKeys", text: "qa@example.com")
flow_recording_action(recordingId, action: "swipe", x, y, toX, toY, durationMs)
flow_recording_action(recordingId, action: "longPress" | "doubleTap", x, y)
flow_recording_action(recordingId, action: "keyPress", keyCode: 4)      Android; 3=HOME 4=BACK
flow_recording_action(recordingId, action: "pressButton", keyName: "home")
                                   also volumeUp, volumeDown, lock
flow_recording_action(recordingId, action: "wait", waitMs: 1500)
```

**Coordinates here are in video / iOS-automation space** — use the `windowSize` returned
by `flow_recording_start` as your reference frame. This is *not* the same space as the
one `device_tap` uses. Get the point from `device_page_source` / `ios_page_source` on
the current screen, and sanity-check it against `windowSize` before recording the step.

### Assert — this is what makes it a test

```
flow_recording_action(recordingId, action: "assert",
                      x, y,
                      assertType: "textContains",
                      expected: "Order #",
                      attribute: "text")
```

`assert` performs no gesture. It identifies the element at `(x, y)` now, and at replay
time verifies the condition. A failed assertion marks the step **FAILED** and surfaces
the mismatch in `errorMessage`.

| assertType | Checks |
|---|---|
| `exists` / `notExists` | Element presence |
| `textEquals` / `textContains` | Attribute value against `expected` |

`attribute` defaults to the platform's primary text attribute. Override it for
precision — Android: `text`, `content-desc`, `resource-id`; iOS: `label`, `value`, `name`.

**Put an assertion after every state change**, not just at the end. A recording that
only asserts the final screen cannot tell you *where* it went wrong three months later.

### Fix a mis-recorded step

Before saving, replace it in place rather than deleting and re-recording:

```
flow_recording_replace_step(recordingId, stepIndex, action: "tap", x, y)
flow_recording_delete_step(recordingId, stepIndex)
```

`replace_step` performs the action live, exactly like `flow_recording_action`, then
overwrites the step at that index instead of appending — so ordering is preserved.
Replacing step 1 (`appLaunch`) is rejected.

### Finish

```
flow_recording_save(recordingId, name?)     waits for pending captures, then persists
flow_recording_cancel(recordingId)          discards everything — steps are lost
```

Save waits for background page-source and screenshot captures to land. Do not skip it
and assume the steps are safe.

## Components — write the login flow once

A component is a `fragment`-category recording referenced from other tests:

```
flow_recording_insert_component(recordingId, snippetId, afterStepIndex,
                                paramBindings: { username: "qa@example.com" })
```

The component is **not copied**. It stays linked and is expanded into concrete steps at
replay time — so editing the component updates every test that references it. That is
the point: when login gains a step, you fix it once.

`paramBindings` substitutes `{{name}}` placeholders in the component's steps, so one
login component serves many accounts.

```
flow_component_usage(componentId)     every test step referencing it — check before
                                      editing or deleting; a component in use is
                                      protected from deletion
flow_recording_detach_component(...)  inline the steps and break the link
```

## Replay

Two modes:

```
flow_replay_start(recordingId, targetUdid, ...)     → replayId, returns immediately
flow_replay_status(replayId)                        poll: current step, pass/fail
flow_replay_abort(replayId)
```

```
flow_recording_replay(recordingId, targetUdid, timeoutMs)   blocks, returns full result
```

Use `flow_replay_start` for anything non-trivial — you can monitor progress and do other
work. Use `flow_recording_replay` only for a short flow you want to await inline.

Options worth knowing:

| Option | Effect |
|---|---|
| `validateElements` (default true) | Use recorded locators to find targets before acting, with coordinate fallback. Leave it on. |
| `resetAppData` | Wipes the app's data before replay so it starts genuinely clean. **Required** for enrollment, first-run, or logged-out recordings — they will not reproduce against an already-enrolled app. **Destructive**, Android only. |
| `visualCheckEnabled` | Captures per-step baselines and runs visual analysis afterwards. Slower, off by default. |

Validation failures are **auto-skipped** — MCP has no interactive prompt, so a replay
never blocks waiting for input. This means a replay can finish "green" with skipped
steps. Always read the skipped count in the summary before calling it a pass.

### Replaying on a different device

That is the main use: record on one device, replay across the pool. Element locators do
the work; coordinates are the fallback. Expect the first cross-device replay to surface
genuine layout differences — that is the test doing its job, not a defect in it.

## Diagnose a failure

Always in this order. The first call is small; the second is heavy.

```
1. flow_replay_summary(replayId)
      totals, passed/failed/skipped, one row per step: status, action,
      duration, diff scores, short error excerpt
2. flow_replay_step(replayId, stepIndex)          ← only for the steps that failed
      recorded element + locators + coordinates, recorded page-source XML,
      LIVE page-source XML from the replay, which locator was actually used,
      scores, full error
3. flow_replay_step_screenshot(replayId, stepIndex, kind)
      "recorded" | "live" | "diff"
```

Step 2 is the one that resolves most failures: comparing recorded page source against
live page source shows immediately whether the element moved, changed label, or was
never rendered.

Reading the result:

| Summary says | Usually means |
|---|---|
| Step skipped, locator not found | Element genuinely absent — different app state, or a screen that needs `resetAppData` |
| Assertion failed with a mismatch | A real behaviour change. This is the finding. |
| High diff score, step passed | Cosmetic or layout change — send it to visual review |
| Everything skipped after step N | The flow diverged at N; only step N matters |

## Visual review

With `visualCheckEnabled`, replay steps whose pixel diff exceeds the baseline become
review candidates:

```
list_visual_reviews(status: "pending", replay_id: "…")   summaries + image refs only
get_visual_review(review_id)                             baseline, live, and diff images
resolve_visual_review(review_id, ...)                    your verdict
visual_compare(...)                                      ad-hoc comparison
```

Pass `replay_id` when you were asked to review one particular run, so you never resolve
pending candidates belonging to someone else's run.

Look at the images before deciding. Approve intentional redesigns; reject real
regressions. A diff score alone does not distinguish a moved button from a broken one.

## Versions

Every mutating save writes a snapshot; the last 10 are kept.

```
flow_recording_revert(recordingId, version)
```

## Suites and reporting

```
test_suite_create(name, description, parentSuiteId)      → id, displayId (S001)
test_suite_add_item(...)
test_suite_list()
test_suite_run(suiteId, udid, name)                      → runId, runs in background
test_suite_run_status(runId)                             progress + rollup report
```

Suites nest via `parentSuiteId`. A run executes every test in the suite, its plans, and
one level of child suites **sequentially** on one device.

Push results outward:

```
jira_create_issue / jira_get_issue / jira_search
azdo_create_work_item / azdo_get_work_item / azdo_search_work_items
testrail_create_case / testrail_update_case / testrail_list_runs / …
insights_build_link(...)      shareable link to the run
```

When filing a bug from a failure, attach what you actually gathered: the failing step
index, the assertion mismatch, and the live-vs-recorded screenshots. Search the tracker
first — `jira_search` / `testrail_find_cases` — so you update the existing ticket instead
of opening a duplicate.

## Housekeeping

```
flow_recording_list(limit, offset, platform, udid, searchQuery)
flow_recording_get(recordingId)      full ordered step list
flow_recording_replays(recordingId)  past runs
```

And when the device work is done: `device_release(udid)`.
