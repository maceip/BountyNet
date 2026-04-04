# Demo video — B-roll, audio & prep checklist (BountyNet)

Use this before filming. Check items off; anything pre-recorded reduces day-of risk.

---

## 0. Voice & tone (on-camera / VO)

**You:** super blunt, funny, **honest guy**—peer-to-peer, not keynote.

**Signature lines** (use, riff, or shorten):

- “I don’t know if you’re like me, but **I hate CI**.”
- “**Red. Red. RED.** Those emails give me anxiety.”

**Rules of thumb**

- **One joke per beat**, then land a **hard fact** (Arc, Dynamic, ENS, oracle)—judges still need receipts.
- **Roast CI**, not sponsors.
- **Pause after punchlines**—let the meme land before you tab-share.
- If you flub a line, **keep rolling**; editors love overlap.

Full beat sheet with this voice is in [`SUBMISSION.md`](SUBMISSION.md) under **Demo video**.

---

## 1. Screen captures to record in advance (clean browser profile)

Record at **1920×1080** (or 4K if you downscale), **60 fps** if possible. **Hide bookmarks bar**, notifications, Slack, personal email. Use a **dedicated Chrome profile** or incognito + extensions off.

| ID | What to capture | URL / action | Notes |
|----|-----------------|--------------|--------|
| S1 | Landing / hero | https://bountynet.stare.network | Slow scroll 5–8s; pause on headline |
| S2 | Dynamic login start | Same → click Sign in / widget | Start recording *before* click; 2–3s dwell |
| S3 | Post-login dashboard | After auth | Network card, Arc block, escrow labels (`App.tsx` stats from `/health`) |
| S4 | Bounty list / feed | Dashboard bounties card | Even if empty: show “no bounties” OR seed one test bounty |
| S5 | Android auth page | https://bountynet.stare.network/android-auth | For B-roll of “same login as web” |
| S6 | ENS / agent line | Dashboard “Agent” card with ENS | If logged in; `agent-N.maceip.eth` visible |
| S7 | GitHub (optional) | Repo with BountyNet / install page | Blur org secrets if any; show **public** context only |
| S8 | Arc explorer (optional B-roll) | https://testnet.arcscan.app | Search contract addresses from `contracts/deployments.json` if you show txs |
| S9 | VS Code / terminal (oracle) | `oracle-tee` log line or `main.py` header comment | 5–10s max; large font terminal |
| S10 | README architecture diagram | `README.md` in GitHub or local render | Static zoom or slow Ken Burns |

**Export naming:** `broll-web-01-hero.mp4`, `broll-web-02-login.mp4`, …

---

## 2. Device B-roll (foldable / Android)

| ID | Shot | Notes |
|----|------|--------|
| D1 | Phone **closed** — lock screen → unlock | 3–5s; clean lock screen wallpaper |
| D2 | **Open app** from launcher (`BountyNet`) | App icon visible |
| D3 | **Unfold** mid-app — two-pane emerges | **Steady hands** or tripod mini clamp; record **2–3 takes** |
| D4 | Tap **SIGN IN** → half-height Chrome sheet appears | Ensure `WEB_AUTH_URL` points at prod `/android-auth` for release build |
| D5 | Close sheet / return to app | Completes the story |
| D6 | (Optional) **External** angle: device + face reflection | “Human using product” 2s insert |

**Settings:** Do Not Disturb on; **charge cable** taped so it doesn’t wobble frame.

---

## 3. Audio components

| Item | Purpose | Prep |
|------|---------|------|
| **Room tone** | 10–20s silence in shoot space | For noise reduction under music |
| **VO script** | Narration | Paste **Talking points** from `SUBMISSION.md` → Teleprompter / Notion; record **dry VO** in quiet closet (blankets) or **USB dynamic mic** |
| **Wild lines** | Pickups | Record **URL** slowly: “bountynet dot stare dot network” ×2; grab extra **rant** takes (“RED RED RED”, “I hate CI”) for cutting flexibility |
| **SFX (optional)** | Whoosh on chapter cuts | Royalty-free pack; **-18 LUFS** mix target for web |
| **Music (optional)** | Under bed | Instrumental, **no lyrics**, license cleared (Artlist, Epidemic, YouTube Audio Library) |
| **Laptop fan** | Kill noise | Lap desk / elevate laptop; turn off noisy lights |

**Deliverable:** `voiceover-master.wav` (48 kHz 24-bit) + backup `voiceover-phone.m4a`.

---

## 4. Graphics & stills (prep as PNG / SVG)

| Asset | Source in repo / web | Use |
|-------|----------------------|-----|
| Logo / wordmark | README image or `web/public/logo.jpg` | Lower-third, end card |
| Architecture block diagram | `README.md` “Architecture” ASCII → remake in **Figma** as clean boxes | 10–15s insert |
| Sponsor logos (if allowed) | Official **press kits** only | Lower-thirds **once each**; don’t invent branding |
| **Title card** | Project name + URL + “ETHGlobal Cannes 2026” | 3s at end |
| **QR to site (optional)** | https://bountynet.stare.network | End slate for IRL viewing |

---

## 5. Code / terminal B-roll (optional, short)

**Large font** (18–22 pt), **high contrast**, no personal paths in `~/`.

- `contracts/src/BountyEscrow.vy` — function names / EURC comment (5s)
- `gateway/routes/ens.py` — `PARENT = "maceip.eth"` or CCIP comment (5s)
- `oracle-tee/main.py` — module docstring “Flare TEE” (5s)
- `web/src/wallet/circle.ts` — `arcTestnet` chain def (5s)

Don’t linger; judges care about **product**, not LOC.

---

## 6. Accounts, keys & safety (before hitting Record)

- [ ] **Dynamic** test user: GitHub + email login both work on **bountynet.stare.network**
- [ ] **Dynamic** `/android-auth` redirect → `bountynet://auth/callback` with **staging JWT** OK on device
- [ ] **Gateway** `https://gateway.stare.network/health` returns **ok** during shoot window
- [ ] **No API keys / `.env` values** visible in OBS or screen share
- [ ] **Wallet** balances / txs you show are **testnet**-appropriate; blur if needed
- [ ] Browser: **password manager popups disabled** during capture

---

## 7. Backup “de-risk” package (if live fails)

| Clip | Content |
|------|---------|
| `backup-demo-full.mp4` | **One** good dry run of full flow recorded **the day before** |
| `backup-arc-stats.png` | Screenshot of Network card with numbers |
| `backup-ens.png` | Screenshot of ENS line on dashboard |
| Still of **GitHub green check** or PR (if you have permission) | Caption: “Representative CI outcome” |

Label honestly in edit: *“Recorded [date]”* if not live.

---

## 8. Shoot-day kit (hardware)

- Phone **tripod** or **MagSafe** mount; **bluetooth remote** shutter for device recording
- **HDMI capture** (optional): Android screen → capture card for crisp device UI
- **Lapel mic** for on-camera bits; **clap** or sync tone if multicam
- **Power**: laptop on AC; phone **100%** + power bank

---

## 9. Post-production handoff

| Deliverable | Spec |
|-------------|------|
| **Timeline** | 1080p minimum; **H.264** or **H.265**; **stereo** audio |
| **Captions** | Burn-in or SRT (YouTube/discord friendly); spell **bountynet.stare.network** correctly |
| **End card** | 5s: logo + URL + “Built for ETHGlobal Cannes 2026” |
| **Run time** | Target **2:30** cut + **4:30** cut from same selects |

---

## 10. Quick reference — URLs & paths

| What | Where |
|------|--------|
| Live app | https://bountynet.stare.network |
| Android auth path | https://bountynet.stare.network/android-auth |
| Default gateway API | `VITE_GATEWAY_URL` → https://gateway.stare.network (`web/src/auth/useAuth.ts`) |
| Arc RPC (B-roll text) | https://rpc.testnet.arc.network |
| Repo root | This monorepo |

---

*Tick boxes as you go; ship backups before you need them.*
