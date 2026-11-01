# dfp-redteam-hcaptcha — hCaptcha (Intuition Machines)

Full details in `HCAPTCHA_ASSESSMENT_2026_10_31.md` (and the clean-launch
writeup).

---

## What we observed

**The client is not the boundary.** hCaptcha is a JWT-ticketed, hash-pinned,
WASM-backed secure module (`hsw.js`):

- Server-issued **JWT tickets** (`hsw`/`hsj`) pin **hash-verified** bundle URLs.
- Challenge request is encrypted (`enc_get_req`) — **captured, opaque by design**.
- The WASM module's strings never decode and the module **never instantiates
  under automation**; the gate fires server-side on first contact
  ("Please try again").

There is nothing client-mintable: the token only exists after server-side
acceptance + a human challenge solve (the ML/CV problem, not RE).

## Status

- 🟡 Read payload: encrypted envelope captured (`enc_get_req`), opaque
- 🔴 Tamper with payload: no payload to edit; client never mints anything
- 🔴 Mint token: server-issued after human challenge solve

## Files

- writeups: `HCAPTCHA_ASSESSMENT_2026_10_31.md`, `HCAPTCHA_CLEAN_LAUNCH_2026_10_31.md`
- scripts/artifacts per the writeups
