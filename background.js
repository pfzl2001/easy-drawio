/**
 * Easy Draw.io - Background Service Worker
 * Handles tab-specific side panel behavior, message relay, and data isolation.
 */

// Enable native toggling of the side panel when the extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

// Tab-specific side panel setup + notify sidebar on tab switch
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.sidePanel.setOptions({
    tabId: activeInfo.tabId,
    path: 'sidebar.html',
    enabled: true,
  }).catch(() => {});

  chrome.runtime.sendMessage({
    action: 'tabActivated',
    tabId: activeInfo.tabId,
  }).catch(() => {});
});

// Re-enable panel on tab refresh and notify sidebar when navigation completes
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  chrome.sidePanel.setOptions({
    tabId: tabId,
    path: 'sidebar.html',
    enabled: true,
  }).catch(() => {});

  if (changeInfo.status === 'complete') {
    chrome.runtime.sendMessage({
      action: 'tabUpdated',
      tabId: tabId,
    }).catch(() => {});
  }
});

// Central message router
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // Provide the active Tab ID to the sidebar
  if (request.action === 'getTabId') {
    if (sender.tab) {
      sendResponse({ tabId: sender.tab.id });
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        sendResponse({ tabId: (tabs && tabs.length > 0) ? tabs[0].id : null });
      });
    }
    return true; // async sendResponse
  }

  // Relay detected diagram code from content script → sidebar
  if (request.action === 'xmlDetected' && request.xml) {
    const sourceTabId = sender.tab ? sender.tab.id : null;
    chrome.runtime.sendMessage({
      action: 'xmlDetectedForSidebar',
      xml: request.xml,
      type: request.type || 'xml',
      sourceTabId: sourceTabId,
    }).catch(() => {});
    sendResponse({ received: true });
    return false;
  }
});

// Clean up storage data when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  const storageKey = `drawio_data_tab_${tabId}`;
  chrome.storage.local.remove(storageKey);
});
