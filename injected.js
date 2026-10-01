// SilentAd Basic v2 — Page Context Injector (MAIN world, YouTube only)
// Runs at document_start in the MAIN world alongside YouTube's own JS.
// Responsibilities:
//   1. Intercept fetch/XHR → signal content.js of ad network requests
//   2. Auto-skip ads using a three-strategy cascade

(function () {

  // ── Ad Network Detection ────────────────────────────────────────────────────

  const AD_PATTERNS = [
    "/api/stats/ads",
    "doubleclick.net/pagead",
    "/pagead/adview",
    "ad.doubleclick.net",
    "googleads.g.doubleclick.net",
    "/generate_204?adformat",
  ];

  function isAdUrl(url) {
    if (!url || typeof url !== "string") return false;
    return AD_PATTERNS.some((p) => url.includes(p));
  }

  function signal(url) {
    window.postMessage({ type: "SILENTAD_AD_NETWORK", url }, "*");
  }

  const _fetch = window.fetch;
  window.fetch = function (...args) {
    const url = typeof args[0] === "string" ? args[0] : (args[0]?.url || "");
    if (isAdUrl(url)) signal(url);
    return _fetch.apply(this, args);
  };

  const _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (isAdUrl(String(url || ""))) signal(String(url));
    return _open.apply(this, arguments);
  };

  // ── Skip Logic ──────────────────────────────────────────────────────────────

  let skipEnabled = true;
  let lastSkipTime = 0;

  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    if (e.data?.type === "SILENTAD_SET_SKIP") {
      skipEnabled = e.data.enabled;
    }
  });

  const SKIP_SELECTORS = [
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button-modern",
    ".ytp-ad-skip-button",
  ];

  // Strategy 1: call YouTube's internal player.skipAd() API directly.
  // This bypasses isTrusted checks entirely — no DOM click needed.
  function tryPlayerApi() {
    const player = document.getElementById("movie_player");
    if (!player) return false;
    if (typeof player.skipAd === "function") {
      player.skipAd();
      return true;
    }
    // Fallback: some player versions expose it under a different key
    const skipKey = Object.keys(player).find(
      (k) => k.toLowerCase().includes("skipad") || k.toLowerCase() === "skipad"
    );
    if (skipKey && typeof player[skipKey] === "function") {
      player[skipKey]();
      return true;
    }
    return false;
  }

  // Strategy 2: full mouse event sequence on the visible skip button.
  function tryDomClick() {
    for (const sel of SKIP_SELECTORS) {
      try {
        const el = document.querySelector(sel);
        if (!el) continue;
        const s = window.getComputedStyle(el);
        if (
          s.display === "none" ||
          s.visibility === "hidden" ||
          s.opacity === "0" ||
          s.pointerEvents === "none"
        ) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;

        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const opts = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy };

        el.dispatchEvent(new MouseEvent("mousedown", opts));
        el.dispatchEvent(new MouseEvent("mouseup",   opts));
        el.dispatchEvent(new MouseEvent("click",     opts));
        el.click();

        // Also try the inner child (button or span) in case the listener
        // is attached deeper in the element tree
        const child = el.querySelector("button, [role='button'], span");
        if (child) {
          child.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          child.click();
        }
        return true;
      } catch {}
    }
    return false;
  }

  // Strategy 3: jump the ad video to its end — YouTube processes the `ended`
  // event and switches to the main video. Works regardless of isTrusted.
  function trySeekToEnd() {
    const video =
      document.querySelector("video.html5-main-video") ||
      document.querySelector("video");
    if (!video || !isFinite(video.duration) || video.duration <= 0) return false;
    video.currentTime = video.duration;
    return true;
  }

  function trySkip() {
    if (!skipEnabled) return;

    // Gate on the player being in ad-showing state — don't wait for the skip
    // button to appear, because we can seek past the ad immediately.
    const player = document.getElementById("movie_player");
    if (!player?.classList.contains("ad-showing")) return;

    const now = Date.now();
    if (now - lastSkipTime < 500) return;
    lastSkipTime = now;

    // Strategy order: seek-to-end before DOM click because DOM click always
    // "succeeds" (events dispatch fine) but YouTube rejects isTrusted:false.
    // Seeking the video element directly bypasses that check entirely.
    if (tryPlayerApi()) {
      window.postMessage({ type: "SILENTAD_SKIP_CLICKED", method: "player API" }, "*");
      return;
    }
    if (trySeekToEnd()) {
      // Give YouTube 3 seconds to process the ad end before retrying,
      // so we don't spam DOM clicks during the ad→video transition.
      lastSkipTime = now + 3000;
      window.postMessage({ type: "SILENTAD_SKIP_CLICKED", method: "seek-to-end" }, "*");
      return;
    }
    if (tryDomClick()) {
      window.postMessage({ type: "SILENTAD_SKIP_CLICKED", method: "DOM click" }, "*");
    }
  }

  setInterval(trySkip, 300);

})();
