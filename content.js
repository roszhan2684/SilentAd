// SilentAd Basic v2 — Content Script
// Detects ads on YouTube, Hulu, Peacock, and generic HTML5 sites.
// Mutes video/tab during ad, restores audio after.

// ─── State ───────────────────────────────────────────────────────────────────

let adActive = false;
let previousVideoMutedState = false;
let previousVideoVolume = 1;
let extensionEnabled = true;
let siteEnabled = true;   // per-site toggle
let badgeEnabled = true;  // show/hide on-page badge
let skipEnabled = true;   // auto-click skip button when available
let debounceTimer = null;

// ─── Settings ────────────────────────────────────────────────────────────────

function loadSettings(callback) {
  if (!isContextValid()) return;
  const hostname = window.location.hostname;
  chrome.storage.local.get(
    { enabled: true, disabledSites: [], showBadge: true, skipAds: true },
    (result) => {
      extensionEnabled = result.enabled;
      siteEnabled = !result.disabledSites.includes(hostname);
      badgeEnabled = result.showBadge;
      skipEnabled = result.skipAds;
      console.log(
        "[SilentAd] Settings — global:", extensionEnabled,
        "site:", siteEnabled,
        "badge:", badgeEnabled,
        "skip:", skipEnabled
      );
      if (callback) callback();
    }
  );
}

function isActive() {
  return extensionEnabled && siteEnabled;
}

// Returns false once the extension has been reloaded/updated and this
// content script instance is orphaned. Prevents "context invalidated" throws.
function isContextValid() {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

// ─── Video Element ────────────────────────────────────────────────────────────

function getMainVideo() {
  const videos = Array.from(document.querySelectorAll("video"));
  if (videos.length === 0) return null;
  if (videos.length === 1) return videos[0];
  return (
    videos
      .filter((v) => v.offsetWidth > 0 && v.offsetHeight > 0)
      .sort(
        (a, b) =>
          b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight
      )[0] || videos[0]
  );
}

// ─── Ad Detectors ─────────────────────────────────────────────────────────────

function isYouTubeAd() {
  // Only selectors that are dynamically injected by YouTube strictly during
  // ad playback and removed when the ad ends. Permanent container elements
  // like .video-ads and .ytp-ad-module are intentionally excluded — they live
  // in the DOM at all times and cause false positives on normal video.
  const selectors = [
    ".ad-showing",                // added to #movie_player only while ad plays
    ".ytp-ad-player-overlay",     // full-screen ad overlay
    ".ytp-ad-preview-container",  // pre-roll countdown
    ".ytp-ad-skip-button-modern", // skip button (current YouTube style)
    ".ytp-ad-skip-button",        // skip button (legacy YouTube style)
  ];
  const found = selectors.find((sel) => {
    try { return !!document.querySelector(sel); } catch { return false; }
  });
  if (found) console.log("[SilentAd] Ad selector matched:", found);
  return !!found;
}

function isHuluAd() {
  // Selectors confirmed from live Hulu DOM inspection during ad playback.
  // AdUnitView__adBar__timer is the most specific — it's a countdown timer
  // that only exists while an ad is actively playing.
  return [
    ".AdUnitView__adBar__timer",  // countdown timer — most reliable signal
    ".AdUnitView__adBar",         // ad control bar shown during ads
    ".Timeline__playhead--ad",    // timeline playhead switches class during ads
  ].some((sel) => {
    try { return !!document.querySelector(sel); } catch { return false; }
  });
}

function isPeacockAd() {
  return [
    "[data-testid='ad-banner']",
    "[data-testid*='ad-ui']",
    "[class*='Advertisement']",
    "[class*='AdPlayer']",
    ".ad-indicator",
    "[class*='AdOverlay']",
    "[class*='AdCounter']",
  ].some((sel) => {
    try { return !!document.querySelector(sel); } catch { return false; }
  });
}

function isGenericAd() {
  const phrases = [
    "advertisement",
    "sponsored",
    "skip ad",
    "ad will end",
    "your video will resume",
  ];
  const text = document.body?.innerText?.toLowerCase() || "";
  return phrases.some((p) => text.includes(p));
}

function detectAd() {
  const host = window.location.hostname;
  if (host.includes("youtube.com")) return isYouTubeAd();
  if (host.includes("hulu.com")) return isHuluAd();
  if (host.includes("peacocktv.com")) return isPeacockAd();
  return isGenericAd();
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function showAdBadge() {
  if (!badgeEnabled || document.getElementById("silentad-badge")) return;
  const badge = document.createElement("div");
  badge.id = "silentad-badge";
  badge.textContent = "Ad Muted";
  Object.assign(badge.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "2147483647",
    background: "rgba(0,0,0,0.78)",
    color: "#fff",
    fontSize: "13px",
    fontFamily: "sans-serif",
    padding: "6px 14px",
    borderRadius: "20px",
    pointerEvents: "none",
    letterSpacing: "0.5px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
  });
  document.body.appendChild(badge);
}

function removeAdBadge() {
  document.getElementById("silentad-badge")?.remove();
}

// ─── Mute / Restore ───────────────────────────────────────────────────────────

function muteForAd(video) {
  previousVideoMutedState = video.muted;
  previousVideoVolume = video.volume;
  video.muted = true;
  video.volume = 0;
  try {
    chrome.runtime.sendMessage({ type: "MUTE_TAB" }, (resp) => {
      if (chrome.runtime.lastError) return;
      console.log("[SilentAd] MUTE_TAB:", resp);
    });
  } catch {}
  showAdBadge();
  console.log(
    "[SilentAd] Ad muted. (wasMuted:", previousVideoMutedState,
    "vol:", previousVideoVolume, ")"
  );
}

function restoreAudio(video) {
  video.muted = previousVideoMutedState;
  video.volume = previousVideoVolume;
  try {
    chrome.runtime.sendMessage({ type: "UNMUTE_TAB" }, (resp) => {
      if (chrome.runtime.lastError) return;
      console.log("[SilentAd] UNMUTE_TAB:", resp);
    });
  } catch {}
  removeAdBadge();
  console.log(
    "[SilentAd] Audio restored. (muted:", previousVideoMutedState,
    "vol:", previousVideoVolume, ")"
  );
}

// ─── Skip Ad ──────────────────────────────────────────────────────────────────
// Actual clicking is handled by injected.js (MAIN world) so the events are
// seen by YouTube's player as same-context interactions. content.js only:
//   • forwards the skip toggle setting to injected.js
//   • listens for the skip-clicked confirmation to log it

function notifyInjectedSkipSetting() {
  window.postMessage({ type: "SILENTAD_SET_SKIP", enabled: skipEnabled }, "*");
}

// Receive skip-clicked confirmation from injected.js
window.addEventListener("message", (e) => {
  if (e.source !== window || e.data?.type !== "SILENTAD_SKIP_CLICKED") return;
  console.log("[SilentAd] Ad skipped via:", e.data.method);
});

// ─── Core Scan ────────────────────────────────────────────────────────────────

function scan() {
  if (!isContextValid()) return;
  if (!isActive()) {
    if (adActive) {
      const v = getMainVideo();
      if (v) restoreAudio(v);
      adActive = false;
    }
    return;
  }

  const adNow = detectAd();
  const video = getMainVideo();

  if (adNow && !adActive) {
    adActive = true;
    if (video) muteForAd(video);
  } else if (!adNow && adActive) {
    adActive = false;
    if (video) restoreAudio(video);
  }

}

// ─── VAST Network Signal (from injected.js, YouTube only) ─────────────────────
// Used only to trigger an early scan — DOM is the source of truth for ad state.

window.addEventListener("message", (e) => {
  if (e.source !== window || e.data?.type !== "SILENTAD_AD_NETWORK") return;
  if (!isContextValid()) return;
  console.log("[SilentAd] VAST/network signal:", e.data.url);
  scan();
});

// ─── MutationObserver (primary trigger) ───────────────────────────────────────

new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(scan, 150);
}).observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "style"],
});

// ─── Interval Fallback ────────────────────────────────────────────────────────

setInterval(scan, 700);

// Skip polling is handled entirely by injected.js (MAIN world) — see injected.js

// ─── SPA Navigation Reset ─────────────────────────────────────────────────────

let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href === lastUrl) return;
  lastUrl = location.href;
  adActive = false;
  removeAdBadge();
  console.log("[SilentAd] Navigation — state reset.");
}).observe(document, { subtree: true, childList: true });

// ─── Message Listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case "SET_ENABLED":
      extensionEnabled = message.enabled;
      console.log("[SilentAd] Global toggle:", extensionEnabled);
      scan();
      sendResponse({ ok: true });
      break;

    case "SET_SITE_ENABLED":
      siteEnabled = message.enabled;
      console.log("[SilentAd] Site toggle:", siteEnabled);
      scan();
      sendResponse({ ok: true });
      break;

    case "SET_SHOW_BADGE":
      badgeEnabled = message.showBadge;
      if (!badgeEnabled) removeAdBadge();
      else if (adActive) showAdBadge();
      sendResponse({ ok: true });
      break;

    case "SET_SKIP_ENABLED":
      skipEnabled = message.skipAds;
      notifyInjectedSkipSetting(); // forward to injected.js (MAIN world)
      console.log("[SilentAd] Skip toggle:", skipEnabled);
      sendResponse({ ok: true });
      break;

    case "GET_AD_STATUS":
      sendResponse({
        adActive,
        extensionEnabled,
        siteEnabled,
        hostname: window.location.hostname,
      });
      break;
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

loadSettings(() => notifyInjectedSkipSetting());
console.log("[SilentAd v2] Loaded on:", window.location.hostname);
