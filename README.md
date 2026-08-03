<p align="center">
  <a href="https://robotactions.com">
    <img src="assets/logo-horizontal.svg" alt="Robot Actions" width="420" />
  </a>
</p>

<p align="center">
  <strong>Test mobile and web apps from anywhere.</strong>
</p>

<p align="center">
  <a href="https://robotactions.com/#services">Services</a> ·
  <a href="https://robotactions.com/#pricing">Pricing</a> ·
  <a href="USING_MCP.md">Use from an AI agent</a> ·
  <a href="https://github.com/krishtoautomate/robotactions/issues">File an issue</a>
</p>

---

Robot Actions is a cloud-connected testing platform that lets you control real Android and iOS devices through a web browser, automate test flows with an AI assistant, and generate runnable test scripts in your framework of choice (WebdriverIO, Python, Robot Framework, and more).

For sales or enterprise questions: support@robotactions.com.

<!-- mcp-name: io.github.krishtoautomate/remote-device-server -->

---

## See it in action

Real iOS and Android devices, streamed live to your browser — no emulators, no local setup. A few of the things you can do:

### AI Agent — explore an app and find bugs

Chat with the built-in AI Agent right inside a device session — ask it to find a defect or suggest improvements, and it drives the device on its own: screenshots, reads the screen, taps and swipes, and reports back findings and recommendations.

<video src="https://github.com/krishtoautomate/robotactions/releases/download/readme-assets/agent-finding-bugs.mp4" controls width="640">
  <a href="https://github.com/krishtoautomate/robotactions/releases/download/readme-assets/agent-finding-bugs.mp4">▶ Watch the demo</a>
</video>

### Real-device control — play, draw, anything

Native-speed touch on a real iPad: playing a game and sketching in Freeform, straight from the browser.

<video src="https://github.com/krishtoautomate/robotactions/releases/download/readme-assets/ipad-play-draw.mp4" controls width="280">
  <a href="https://github.com/krishtoautomate/robotactions/releases/download/readme-assets/ipad-play-draw.mp4">▶ Watch the demo</a>
</video>

### Real-time mouse & keyboard control

Native-speed pointer and keyboard input on both iOS and Android — type and click straight from your machine with no lag.

<video src="https://github.com/krishtoautomate/robotactions/releases/download/readme-assets/ios-android-mouse-keyboard.mp4" controls width="640">
  <a href="https://github.com/krishtoautomate/robotactions/releases/download/readme-assets/ios-android-mouse-keyboard.mp4">▶ Watch the demo</a>
</video>

### Web Inspector for mobile Safari

Full DevTools — Network, Elements, Console, Application — attached to Safari running on a real iOS device.

<video src="https://github.com/krishtoautomate/robotactions/releases/download/readme-assets/ios-webinspector.mp4" controls width="640">
  <a href="https://github.com/krishtoautomate/robotactions/releases/download/readme-assets/ios-webinspector.mp4">▶ Watch the demo</a>
</video>

### Chrome DevTools on Android (CDP)

Full Chrome DevTools over the DevTools Protocol — Elements, Console, Network, Application — inspecting a live page on a real Android device.

<video src="https://github.com/krishtoautomate/robotactions/releases/download/readme-assets/android-devtools.mp4" controls width="640">
  <a href="https://github.com/krishtoautomate/robotactions/releases/download/readme-assets/android-devtools.mp4">▶ Watch the demo</a>
</video>

### Capture & mock network traffic

Watch live HTTP(S) flows from the device, then add rules to mock, abort, or rewrite matching requests — set the status, headers, and response body on the fly.

<video src="https://github.com/krishtoautomate/robotactions/releases/download/readme-assets/capture-and-mock.mp4" controls width="640">
  <a href="https://github.com/krishtoautomate/robotactions/releases/download/readme-assets/capture-and-mock.mp4">▶ Watch the demo</a>
</video>

### Light & dark themes

The web console follows your preference — switch between light and dark on the fly.

<video src="https://github.com/krishtoautomate/robotactions/releases/download/readme-assets/light-dark-switch.mp4" controls width="640">
  <a href="https://github.com/krishtoautomate/robotactions/releases/download/readme-assets/light-dark-switch.mp4">▶ Watch the demo</a>
</video>

> More feature walkthroughs are on the way.

---

## Robot Actions on the MCP Registry

The hosted MCP server is published at <https://registry.modelcontextprotocol.io> as `io.github.krishtoautomate/remote-device-server` and auto-syncs to:

- **GitHub MCP Registry** (`github.com/mcp`) — shows up in VS Code under `@mcp`
- **Smithery** (`smithery.ai`) — install via the toolbox button
- **glama.ai/mcp** — community aggregator

Manifest source: [`server.json`](server.json) in this repo mirrors the published version.

---

## What this repo is for

This repo contains **no application source code** — Robot Actions is a hosted product, there is nothing to install or build. The repo exists for three current purposes plus one that's coming:

1. **Public issue intake.** File a bug, request a feature, or ask a question via the [Issues tab](../../issues). No paid account required — drive-by feedback is welcome.
2. **Release notes.** Every shipped change is published as a [Release](../../releases) with user-facing notes. That's the running changelog.
3. **Test framework examples (coming soon).** Once the product is more widely used, this repo will host runnable example scripts in the test frameworks Robot Actions can generate — WebdriverIO, Python (`appium-python-client` style), Robot Framework, and more. These will live as small standalone projects under `examples/` so you can copy-paste a starting point. **None of the application source will ever land here** — the examples are public starter templates, not the product.
4. **Public roadmap & discussions** — being scoped.

## When to file an Issue here vs. when to email us

| Filing here | Email us at support@robotactions.com |
|---|---|
| Bug reproductions, feature requests, public questions | Account-specific issues (billing, credentials, dedicated deployments) |
| "Does Robot Actions support X?" | Anything that would expose your account email, device IDs, or session data publicly |
| General feedback / ideas | Sales conversations, enterprise contracts |

## Security disclosures

**Do not file security issues here.** See [SECURITY.md](SECURITY.md) for the responsible-disclosure process.

## Releases

Every shipped change is published as a Release with user-facing notes. [Browse releases →](../../releases)

---

## License

This README, the issue templates, and any future `examples/` test scripts are MIT-licensed. The Robot Actions product itself is a hosted commercial service — not open source, and no application source code lives in this repo.
