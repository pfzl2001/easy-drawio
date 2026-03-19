/**
 * Easy Draw.io - Background Service Worker
 * Handles tab-specific side panel behavior and data isolation.
 */

// 1. Enable native toggling of the side panel when the extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

// 2. Setup the side panel to be tab-specific so its instance doesn't follow across tabs globally
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.sidePanel.setOptions({
    tabId: activeInfo.tabId,
    path: 'sidebar.html',
    enabled: true
  }).catch(() => { });
});

// Also re-enable when a tab is updated (like refreshing the page)
chrome.tabs.onUpdated.addListener((tabId) => {
  chrome.sidePanel.setOptions({
    tabId: tabId,
    path: 'sidebar.html',
    enabled: true
  }).catch(() => { });
});

// 3. Provide the Tab ID to the sidebar when requested
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTabId") {
    // `sender.tab` contains the info of the tab where the sidebar is opened
    if (sender.tab) {
      sendResponse({ tabId: sender.tab.id });
    } else {
      // Fallback: Query the active tab in the current window
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs && tabs.length > 0) {
          sendResponse({ tabId: tabs[0].id });
        } else {
          sendResponse({ tabId: null });
        }
      });
    }
    return true; // Keep the message channel open for asynchronous response
  }
});

// 4. Clean up storage data when a tab is closed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  const storageKey = `drawio_data_tab_${tabId}`;
  chrome.storage.local.remove(storageKey, () => {
    console.log(`Cleaned up storage for closed tab: ${storageKey}`);
  });
});
