// SilentAd Basic v2 — Popup Script

const toggle      = document.getElementById("toggle");
const siteToggle  = document.getElementById("site-toggle");
const badgeToggle = document.getElementById("badge-toggle");
const skipToggle  = document.getElementById("skip-toggle");
const currentSiteEl = document.getElementById("current-site");
const liveStatus  = document.getElementById("live-status");
const liveText    = document.getElementById("live-text");

let currentHostname = "";
let activeTabId = null; // null means "no content script available"

// ─── Live Status ──────────────────────────────────────────────────────────────

function setLiveStatus(adActive, globalEnabled, siteEnabled) {
  if (!globalEnabled || !siteEnabled) {
    liveStatus.className = "live-status live-off";
    liveText.textContent = "Extension off for this site";
    return;
  }
  if (adActive) {
    liveStatus.className = "live-status live-muting";
    liveText.textContent = "Currently muting ad…";
  } else {
    liveStatus.className = "live-status live-idle";
    liveText.textContent = "No ad playing";
  }
}

function queryLiveStatus() {
  if (!activeTabId) return;
  chrome.tabs.sendMessage(activeTabId, { type: "GET_AD_STATUS" }, (resp) => {
    if (chrome.runtime.lastError || !resp) {
      void chrome.runtime.lastError; // clear to suppress extension error log
      liveStatus.className = "live-status live-off";
      liveText.textContent = "Not active on this page";
      return;
    }
    setLiveStatus(resp.adActive, resp.extensionEnabled, resp.siteEnabled);
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs[0]) return;

  const url = tabs[0].url || "";
  const isWebPage = url.startsWith("http://") || url.startsWith("https://");

  // Only allow tab messaging on real web pages. chrome://, about:, file:// etc.
  // have no content script, so attempting sendMessage would throw the error.
  if (isWebPage) {
    activeTabId = tabs[0].id;
  } else {
    liveStatus.className = "live-status live-off";
    liveText.textContent = "Not available on this page";
  }

  try {
    currentHostname = new URL(url).hostname;
  } catch {
    currentHostname = "";
  }
  currentSiteEl.textContent = currentHostname || "—";

  chrome.storage.local.get(
    { enabled: true, disabledSites: [], showBadge: true, skipAds: true },
    (result) => {
      toggle.checked      = result.enabled;
      siteToggle.checked  = !result.disabledSites.includes(currentHostname);
      badgeToggle.checked = result.showBadge;
      skipToggle.checked  = result.skipAds;
    }
  );

  if (isWebPage) queryLiveStatus();
});

// ─── Global Toggle ────────────────────────────────────────────────────────────

toggle.addEventListener("change", () => {
  const enabled = toggle.checked;
  chrome.storage.local.set({ enabled });
  sendToTab({ type: "SET_ENABLED", enabled });
  setTimeout(queryLiveStatus, 120);
});

// ─── Per-Site Toggle ──────────────────────────────────────────────────────────

siteToggle.addEventListener("change", () => {
  const enabled = siteToggle.checked;
  chrome.storage.local.get({ disabledSites: [] }, (result) => {
    let sites = result.disabledSites;
    if (enabled) {
      sites = sites.filter((s) => s !== currentHostname);
    } else {
      if (currentHostname && !sites.includes(currentHostname)) {
        sites.push(currentHostname);
      }
    }
    chrome.storage.local.set({ disabledSites: sites });
    sendToTab({ type: "SET_SITE_ENABLED", enabled });
    setTimeout(queryLiveStatus, 120);
  });
});

// ─── Badge Toggle ─────────────────────────────────────────────────────────────

badgeToggle.addEventListener("change", () => {
  const showBadge = badgeToggle.checked;
  chrome.storage.local.set({ showBadge });
  sendToTab({ type: "SET_SHOW_BADGE", showBadge });
});

// ─── Skip Toggle ──────────────────────────────────────────────────────────────

skipToggle.addEventListener("change", () => {
  const skipAds = skipToggle.checked;
  chrome.storage.local.set({ skipAds });
  sendToTab({ type: "SET_SKIP_ENABLED", skipAds });
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function sendToTab(message) {
  if (!activeTabId) return; // no content script available
  chrome.tabs.sendMessage(activeTabId, message, () => {
    void chrome.runtime.lastError; // clear to suppress extension error log
  });
}
