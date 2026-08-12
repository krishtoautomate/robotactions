---
name: framework-integration
description: Use Robot Actions MCP tools alongside an existing Appium, Selenium, Playwright or WebdriverIO suite rather than replacing it — explore a screen interactively, lift stable locators into page objects, generate a test in the user's own framework, and point that suite at the grid. Use when the user already has a test suite, asks for a test script rather than a live run, or asks how to run their existing tests on real devices.
license: MIT
---

# Working with an existing test suite

Most teams asking for help already have a suite. They are not looking to replace Appium
or Selenium with an agent — they want the agent to make the suite faster to write and the
grid to be where it runs.

**Default to producing code in the framework they already use.** Drive the device live to
work out what the test should say, then write it in their language, their runner, their
page-object style. Do not propose a rewrite.

## Read the repo before writing a line

Match what is there:

- Framework and language — Appium/Selenium/Playwright/WebdriverIO, TS/JS/Python/Java
- Runner and reporting — pytest, Jest, TestNG, Cucumber, pytest-bdd
- Whether page objects exist, and what selector strategy they favour
- Existing fixtures, base classes, and setup/teardown

A test that does not look like its neighbours will not be merged, however correct it is.

## The high-value loop: explore live, then codegen

This is the thing MCP adds that a framework alone cannot. Selectors written from memory
break; selectors read off the live screen do not.

```
1. device_launch_app(udid, packageName)
2. device_screenshot(udid)                 see the real screen
3. device_locators_for(udid, text: "Sign in")
      → ranked strategies for that element:
        resource-id, text, content-desc, accessibility selector, XPath
4. write the page object using the highest-ranked stable locator
```

`device_locators_for` also accepts `x, y` and picks the smallest element containing that
point — useful when you know where something is but not what it is called. It returns the
same priority-ordered list the inspector shows, so you are not re-deriving selectors by
hand or guessing at an XPath.

Prefer, in order: **resource-id → accessibility id / content-desc → text → XPath.** XPath
is last because it is the one that breaks when the layout shifts.

On iOS, `ios_find_element` reports which strategy matched (`accessibility id`, `class
chain`, `predicate string`, `name`, `xpath`) — use the strategy it actually matched on,
not the one you assumed.

Walk the flow once with the device tools, collecting locators as you go, then write the
whole test. That is far more reliable than writing it blind and debugging the selectors
afterwards.

## Running their suite on the grid

Existing Appium/Selenium/WebdriverIO suites point at the grid by changing the endpoint
and adding a token — the tests themselves do not change.

Ready-to-run templates for each framework, including the connection recipe:
**https://github.com/krishtoautomate/robotactions-automation**

| Template | Stack |
|---|---|
| `appium-js` | Appium + JavaScript |
| `selenium-python` | Selenium + pytest-bdd — grid browsers, mobile web, real devices |
| `wdio` | WebdriverIO + TypeScript — grid browsers, mobile web, real devices |
| `playwright` / `playwright-python` | Playwright against grid browsers |

Configuration is environment-driven — `GRID_URL`, `AUTH_TOKEN`, `RA_TESTSUITE`. The token
rides the URL path for Selenium/Appium and a query parameter for Playwright's WebSocket
upgrade; the templates handle that. `RA_TESTSUITE` labels the run so it is identifiable
in the dashboard afterwards.

Point the user at `docs/connecting-to-the-grid.md` in that repo rather than improvising a
connection string.

## W3C sessions from MCP

When you want a session the same shape their framework uses — for scripted work, or to
mirror what their suite does:

```
session_create(browserName: "chrome", platformName: "linux", capabilities: {...})
     browserName: chrome | firefox | MicrosoftEdge, or empty for a mobile session
session_find_element / session_click / session_send_keys / session_url
session_execute(sessionId, script: "return document.title", args: [])
session_console_logs / session_network_logs(sessionId, failuresOnly: true)
session_quit(sessionId)        ← always; it holds a grid node
```

## Input goes straight to the device

Worth knowing, because it changes what you can test. Taps and keystrokes are delivered
through the device's own input path rather than routed through a separate automation
framework layer.

Concretely: on iOS, `webpage_click` makes the **device tap its own screen**, so the page
receives a genuinely trusted touch — `pointerdown`, `touchstart`, `mousedown`, `click`,
exactly as from a finger. That satisfies sites and apps that gate on trusted input, which
synthesized events cannot. The response reports the path used in `via`. The iOS `*_hid`
tools go further and need no automation session at all — check `ios_hid_status(udid)`.

So a framework session is a **compatibility option**, not a requirement. Use it when the
user wants framework parity; use the direct device tools when you want the most faithful
input.

## Which tool for which request

| They ask for | Do this |
|---|---|
| "Write a test for X" | Explore live, collect locators, emit code in their framework |
| "Does X work on device Y?" | Drive it directly — no code needed. See `mobile-app-testing` |
| "Run our suite on real devices" | Point their config at the grid; templates repo above |
| "Our test is flaky" | Reproduce live, compare their selector against `device_locators_for` |
| "Add this to regression" | `flow-record-replay`, or a test in their suite — ask which |

## Keep the test honest

Whatever framework you write in, carry the same discipline the interactive skills use:

- Wait on elements and conditions, never on fixed sleeps
- Assert on state read back from the device, not on the absence of an exception
- One reason to fail per test
- Reset state in setup — see `device-state-setup`
