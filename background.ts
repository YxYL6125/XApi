
// background.ts

const MAX_LOGS = 100;
const EXTENSION_ID = chrome.runtime.id;



const updateBadge = (recording: boolean) => {
  if (chrome.action) {
    if (recording) {
      chrome.action.setBadgeText({ text: "REC" });
      chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  }
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ isRecording: false, logs: [] });
  updateBadge(false);
  // Clear any existing dynamic rules on startup
  chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [1]
  });
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.isRecording) {
    updateBadge(changes.isRecording.newValue);
  }
});

// --- DNR Rule Manager for Header Overrides ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SET_REQUEST_HEADERS') {
    const { url, headers } = message;
    const ruleId = 1;
    const requestHeaders = headers.map((h: any) => ({
      header: h.key || h.name,
      operation: chrome.declarativeNetRequest.HeaderOperation.SET,
      value: h.value
    }));

    const cleanUrl = url.split('?')[0];

    const rule = {
      id: ruleId,
      priority: 999,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        requestHeaders: requestHeaders
      },
      condition: {
        urlFilter: cleanUrl,
        resourceTypes: [
          chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
          chrome.declarativeNetRequest.ResourceType.OTHER
        ]
      }
    };

    chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [ruleId],
      addRules: [rule]
    }).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (message.type === 'CLEAR_REQUEST_HEADERS') {
    chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [1]
    }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});
