/**
 * Easy Draw.io - Content Script
 * Detects Draw.io XML / Mermaid / PlantUML in AI chat responses via MutationObserver.
 * Full-document scanning with debounce — robust against streaming token output.
 */

(function () {
  'use strict';

  const detectedHashes = new Set();
  let debounceTimer = null;
  const DEBOUNCE_MS = 1500;

  const MX_REGEX = /<mxGraphModel[\s\S]*?<\/mxGraphModel>/g;

  /**
   * djb2 hash for fast deduplication
   */
  function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
    }
    return hash.toString(36);
  }

  function sendDetected(payload, type) {
    try {
      chrome.runtime.sendMessage({
        action: 'xmlDetected',
        xml: payload,
        type: type || 'xml',
      });
    } catch (e) {
      // Extension context invalidated — silently ignore
    }
  }

  /**
   * Scan the ENTIRE document for recognizable diagram code blocks.
   * This avoids the problem of only scanning recently-added nodes
   * (which breaks under streaming output where earlier batches are lost by debounce).
   */
  function scanDocument() {
    const codeBlocks = document.querySelectorAll('code, pre');

    for (const block of codeBlocks) {
      const text = block.textContent || '';

      // --- Draw.io XML detection ---
      if (text.length >= 30 && text.includes('<mxGraphModel')) {
        const matches = text.match(MX_REGEX);
        if (matches) {
          for (const xml of matches) {
            const hash = hashString(xml);
            if (detectedHashes.has(hash)) continue;
            detectedHashes.add(hash);
            sendDetected(xml, 'xml');
          }
        }
      }

      // --- Mermaid detection (code blocks with language-mermaid class) ---
      if (block.tagName === 'CODE') {
        const cls = block.className || '';
        if (cls.includes('mermaid') || cls.includes('language-mermaid')) {
          const trimmed = text.trim();
          if (trimmed.length >= 10) {
            const hash = hashString('mermaid:' + trimmed);
            if (!detectedHashes.has(hash)) {
              detectedHashes.add(hash);
              sendDetected(trimmed, 'mermaid');
            }
          }
        }

        // --- PlantUML detection ---
        if (cls.includes('plantuml') || cls.includes('language-plantuml') || cls.includes('puml') || cls.includes('language-puml')) {
          const trimmed = text.trim();
          if (trimmed.length >= 10) {
            const hash = hashString('plantuml:' + trimmed);
            if (!detectedHashes.has(hash)) {
              detectedHashes.add(hash);
              sendDetected(trimmed, 'plantuml');
            }
          }
        }
      }
    }
  }

  /**
   * Debounced handler — any DOM change schedules a full scan after 1.5s of silence.
   */
  function onMutation() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scanDocument, DEBOUNCE_MS);
  }

  // Start observing — childList + characterData + subtree covers all streaming patterns
  if (document.body) {
    const observer = new MutationObserver(onMutation);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  // Initial scan for content already present when the script loads
  if (document.readyState === 'complete') {
    setTimeout(scanDocument, 1000);
  } else {
    window.addEventListener('load', () => setTimeout(scanDocument, 1000));
  }

})();
