// SilentAd Basic — Background Service Worker
// Handles tab-level mute/unmute on behalf of content scripts.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  if (!tabId) {
    sendResponse({ ok: false, error: "No tab ID" });
    return true;
  }

  if (message.type === "MUTE_TAB") {
    chrome.tabs.update(tabId, { muted: true }, () => {
      if (chrome.runtime.lastError) {
        console.warn("[SilentAd] MUTE_TAB error:", chrome.runtime.lastError.message);
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        console.log("[SilentAd] Tab muted:", tabId);
        sendResponse({ ok: true });
      }
    });
    return true; // keep channel open for async sendResponse
  }

  if (message.type === "UNMUTE_TAB") {
    chrome.tabs.update(tabId, { muted: false }, () => {
      if (chrome.runtime.lastError) {
        console.warn("[SilentAd] UNMUTE_TAB error:", chrome.runtime.lastError.message);
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        console.log("[SilentAd] Tab unmuted:", tabId);
        sendResponse({ ok: true });
      }
    });
    return true;
  }

  sendResponse({ ok: false, error: "Unknown message type" });
  return true;
});
