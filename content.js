/**
 * Easy Draw.io - Content Script
 * Uses MutationObserver to detect Draw.io XML (<mxGraphModel>) in AI chat responses.
 * Event-driven, zero polling. Debounced to handle streaming token output.
 */

(function () {
  'use strict';

  // Track already-detected XML to avoid re-notifying
  const detectedHashes = new Set();
  let debounceTimer = null;
  const DEBOUNCE_MS = 1500; // Wait 1.5s of DOM silence before scanning

  // Regex to extract complete <mxGraphModel ...>...</mxGraphModel> blocks
  const MX_REGEX = /<mxGraphModel[\s\S]*?<\/mxGraphModel>/g;

  /**
   * Simple fast hash for deduplication (djb2)
   */
  function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
    }
    return hash.toString(36);
  }

  /**
   * Scan newly added nodes for Draw.io XML content.
   * Only checks text inside <code>, <pre>, or generic text nodes.
   */
  function scanForXml(nodes) {
    for (const node of nodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      // Get text content from code blocks and pre tags primarily
      const codeBlocks = node.querySelectorAll
        ? node.querySelectorAll('code, pre')
        : [];

      const targets = codeBlocks.length > 0 ? codeBlocks : [node];

      for (const target of targets) {
        const text = target.textContent || '';
        if (text.length < 30 || !text.includes('<mxGraphModel')) continue;

        const matches = text.match(MX_REGEX);
        if (!matches) continue;

        for (const xml of matches) {
          const hash = hashString(xml);
          if (detectedHashes.has(hash)) continue;

          detectedHashes.add(hash);

          // Send the detected XML to the background service worker
          try {
            chrome.runtime.sendMessage({
              action: 'xmlDetected',
              xml: xml,
            });
          } catch (e) {
            // Extension context invalidated, ignore
          }
        }
      }
    }
  }

  /**
   * MutationObserver callback — debounced to handle streaming AI output.
   */
  function onMutation(mutations) {
    clearTimeout(debounceTimer);

    // Collect all newly added nodes across all mutations
    const addedNodes = [];
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          addedNodes.push(node);
        }
      }
    }

    if (addedNodes.length === 0) return;

    // Debounce: wait for DOM to settle (AI finishes streaming)
    debounceTimer = setTimeout(() => {
      scanForXml(addedNodes);
    }, DEBOUNCE_MS);
  }

  // Start observing once DOM is ready
  const observer = new MutationObserver(onMutation);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

})();
