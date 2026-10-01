# SilentAd Basic

A lightweight Chrome extension that automatically **mutes** video ads on YouTube, Hulu, Peacock, and common HTML5 video websites, then **restores your audio** once the ad ends.

> **Does not block or skip ads.** It only silences them.

---

## What's New in Version 2

| Feature | v1 | v2 |
|---|---|---|
| YouTube ad muting | Yes | Yes |
| Hulu support | No | Yes |
| Peacock support | No | No |
| VAST/network ad signal (YouTube) | No | Yes |
| Live popup status ("Currently muting") | No | Yes |
| Per-site enable/disable | No | Yes |
| Show/hide on-page badge | No | Yes |
| Generic HTML5 sites | Basic | Basic |

---

## Full Feature Table

| Feature | Supported |
|---|---|
| Detect YouTube pre-roll / mid-roll ads | Yes |
| Detect Hulu ads | Yes (DOM-based) |
| Detect Peacock ads | Yes (DOM-based) |
| VAST network signal interception (YouTube) | Yes |
| Mute video element during ad | Yes |
| Mute tab during ad | Yes |
| Restore previous audio state after ad | Yes |
| Show "Ad Muted" badge on page | Yes (toggleable) |
| Live status in popup | Yes |
| Global enable/disable toggle | Yes |
| Per-site enable/disable toggle | Yes |
| Badge show/hide preference | Yes |
| Hulu / Peacock | Yes (v2) |
| Netflix / Disney+ | Not included |

---

## How to Load (Unpacked)

> Requires Chrome 111+ for the VAST network interception feature (`world: "MAIN"` content scripts).

1. Open **chrome://extensions** in Chrome.
2. Enable **Developer Mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the `silentad-basic` folder.
5. The extension icon will appear in your toolbar.

If you previously loaded v1, click the **reload** icon on the extension card after selecting the updated folder.

---

## Testing Instructions

### YouTube
1. Open [YouTube](https://www.youtube.com) and play a video likely to show ads.
2. When an ad starts:
   - Tab audio drops to zero.
   - **"Ad Muted"** badge appears in the bottom-right corner.
   - Popup shows **"Currently muting ad…"** with a pulsing dot.
3. Ad ends → audio restores, badge disappears.

### Hulu
1. Open [Hulu](https://www.hulu.com) and play any show or movie.
2. When a mid-roll ad plays, tab should mute and badge should appear.
3. Audio restores when content resumes.

### Popup Controls
| Control | What it does |
|---|---|
| **Mute Ads** toggle | Globally enable/disable for all sites |
| **Mute on this site** toggle | Disable only on the current hostname |
| **Show badge** toggle | Hide/show the on-page "Ad Muted" label |
| **Live status indicator** | Shows "Currently muting ad…" or "No ad playing" in real time |

### Console Debugging
Open DevTools → Console, filter by `[SilentAd]`:
```
[SilentAd v2] Loaded on: www.youtube.com
[SilentAd] VAST/network signal: /api/stats/ads?...
[SilentAd] Ad muted. (wasMuted: false vol: 1)
[SilentAd] Audio restored. (muted: false vol: 1)
```

---

## Permissions Used

| Permission | Why |
|---|---|
| `storage` | Save toggle states and per-site disabled list |
| `tabs` | Mute/unmute the browser tab during an ad |
| Host access | Inject content script on YouTube, Hulu, Peacock, and other sites |

No data is collected. No external requests are made. Everything runs locally.

---

## Limitations

- **YouTube** — works best; has both DOM class detection and VAST network signal.
- **Hulu / Peacock** — DOM-based only; class names may change with app updates.
- **Generic sites** — keyword detection; may produce false positives on pages with ad-related text.
- **Does not block or skip ads** — by design, to comply with platform terms of service.
- **Netflix / Disney+** — not included.
- **VAST network interception requires Chrome 111+** — the `world: "MAIN"` content script feature.
- **Firefox** — requires [webextension-polyfill](https://github.com/mozilla/webextension-polyfill) for full compatibility.

---

## Version 3 Ideas

- Netflix support (detect `[data-uia*="ad"]` markers).
- Disney+ support.
- Sidebar list in popup showing all disabled sites with remove buttons.
- Persistent mute log: count of ads muted this session.
- Auto-update Hulu/Peacock selectors via a remote config (optional, privacy-respecting).
- Firefox AMO release with webextension-polyfill bundled.
