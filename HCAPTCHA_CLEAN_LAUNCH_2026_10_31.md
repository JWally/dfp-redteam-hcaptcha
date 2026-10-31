# hCaptcha — clean-launch breakthrough (2026-10-31, part 2)

Follow-on to `HCAPTCHA_ASSESSMENT_2026_10_31.md`. The user's hypothesis was
correct: **the automation-launch mode was the gate.** Running the *same* widget
in a **manually-launched real Chrome** (no `--enable-automation`, no Playwright
launch flags) got past "Please try again" and served **real, rotating visual
challenges**.

All still authorized / own-stack / read-only: we observed the flow, we did
**not** solve a challenge or obtain a token.

---

## 1. The trigger: launch mode, not just the webdriver flag

| Launch mode | `navigator.webdriver` | Widget result |
|---|---|---|
| Playwright `chromium.launch` (default) | `true` | **"Please try again"** — gated, no challenge ever |
| Playwright `channel:'chrome'` + `--disable-blink-features=AutomationControlled` | **`false`** | **Still "Please try again"** — gated |
| **Manual `google-chrome` launch** (fresh profile, real display :1, no automation flags), *then* CDP-attach | `false` | **Real challenges served** |

**Key finding:** merely flipping `navigator.webdriver` to `false` was **not**
enough — Playwright-launched Chrome was still gated. The difference is the
**process launch environment**: Playwright/ChromeDriver pass automation flags
and/or a detectable process/launch signature that hCaptcha's server scores
before the widget even runs. Launching Chrome like a normal user (plain
`google-chrome --user-data-dir=… <url>`) clears that first gate.

(We attached via CDP *after* launch to inspect/screenshot — that attach did not
re-gate the session, so the scoring is on the initial page load / launch, not
on having a debugger attached later.)

## 2. What the clean session produced

- **Real, rotating challenges** served via the checkbox/`execute()` flow:
  - *"Please click on the TWO shapes that are different from the others"*
  - *"Click on all the closed loops"* (canvas **1000×940**, captured:
    `artifacts/challenge-image.png`)
- The **hsw secure module executed**: 200+ `atob` decodes observed
  (percent-encoded string-table entries — the `aLW`-style XOR/URI layer),
  confirming the anti-bot WASM path runs in a trusted session.
- A failed automated checkbox click got gated again ("Please try again") —
  confirming the gate is **behavioral/score-based**: it's a ladder, not a door.

## 3. The honest ladder (what's still required)

1. **Clean launch** — DONE. Clears the first server gate, challenges render.
2. **Human-like interaction** — the checkbox click via CDP still looked
   automated (instant, no mouse path) and got gated. Needs real input
   (xdotool/actual mouse, human timing) or a stealth input layer.
3. **Solve the challenge** — the actual "closed loops"/"two shapes" puzzle:
   a computer-vision problem (segment shapes, identify the odd ones out).
4. **Token proof** — submit the solved answer + the hsw proof → token.

## 4. What this changes

- The earlier assessment's "~85 resistance / client won't init" is **still
  honest for automation-as-is**, but the **boundary is launch + behavior, not
  the client module**. A clean-launch session gets the full client stack to
  run, which means the hsw WASM **is** RE-able from here (string decodes
  confirmed live) — the cost is real but the door is open.
- The remaining hard problem is the **challenge solve (ML/CV)**, which is
  genuinely different from the crypto/obfuscation RE in the rest of this
  project.

## 5. Evidence

| File | What |
|---|---|
| `artifacts/challenge-image.png` | the "closed loops" challenge canvas (1000×940) |
| `artifacts/execute-challenge.png` | page context with the live challenge |
| `artifacts/clean2-widget.png` | clean-session widget ("Please click on TWO shapes…") |
| `artifacts/clean-drive.json` | the atob decode log (hsw executing) |
| `artifacts/getcaptcha-full.json` | hsw/hsj JWT tickets |
| `scripts/hc-launch-clean.sh` | the clean-launch recipe |
| `scripts/hc-attach.mjs` / `hc-attach2.mjs` | CDP attach (post-launch) inspection |
| `scripts/hc-clean-drive.mjs` | drive execute() + capture hsw activity |

## 6. Recipe to reproduce

```bash
# 1) launch real Chrome like a normal user (no automation flags)
google-chrome --user-data-dir=/tmp/hc-profile --no-first-run \
  --disable-blink-features=AutomationControlled --window-size=1280,900 \
  "https://accounts.hcaptcha.com/demo"

# 2) attach after launch (inspection only), call execute()
#    (see scripts/hc-clean-drive.mjs)
```
