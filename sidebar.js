/**
 * Easy Draw.io - Sidebar Controller
 * Handles communication with Draw.io iframe, tab isolation, and UI interactions.
 */

(function () {
    'use strict';

    // ==========================================
    // Constants & State
    // ==========================================

    const EMPTY_DIAGRAM = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';

    let currentTabId = null;
    let drawioIsReady = false;
    let pendingExportName = null;

    // DOM References
    const iframe = document.getElementById('drawio-frame');
    const statusText = document.getElementById('status-text');
    const statusFile = document.getElementById('status-file');
    const exportMenu = document.getElementById('export-menu');
    const codeModal = document.getElementById('code-modal');

    // ==========================================
    // Toast Notification System
    // ==========================================

    let toastContainer = null;

    function showToast(message, type = 'info') {
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 3000);
    }

    // ==========================================
    // Draw.io Communication & Tab Data Loading
    // ==========================================

    /**
     * Get the current Tab ID from the Background script to isolate data.
     */
    chrome.runtime.sendMessage({ action: "getTabId" }, function (response) {
        if (response && response.tabId) {
            currentTabId = response.tabId;
            statusFile.textContent = `Tab Context: #${currentTabId}`;
            if (drawioIsReady) {
                loadDataForCurrentTab();
            }
        } else {
            showToast('Warning: Running outside standard tab context', 'warning');
            statusFile.textContent = `Global Context`;
        }
    });

    function getStorageKey() {
        return currentTabId ? `drawio_data_tab_${currentTabId}` : 'drawio_data_global';
    }

    function loadDataForCurrentTab() {
        if (!currentTabId) return;
        const storageKey = getStorageKey();
        chrome.storage.local.get([storageKey], function (result) {
            if (result[storageKey]) {
                renderXmlToDrawio(result[storageKey]);
            } else {
                renderXmlToDrawio(EMPTY_DIAGRAM);
            }
        });
    }

    /**
     * Send an action to the Draw.io iframe using the embed protocol.
     */
    function sendToDrawio(message) {
        if (iframe.contentWindow) {
            iframe.contentWindow.postMessage(JSON.stringify(message), '*');
        }
    }

    /**
     * Handle all messages coming from the Draw.io iframe.
     */
    window.addEventListener('message', function (event) {
        if (!event.data || typeof event.data !== 'string') return;
        try {
            const msg = JSON.parse(event.data);
            handleDrawioMessage(msg);
        } catch (e) {
            // Not a JSON message, ignore
        }
    });

    function handleDrawioMessage(msg) {
        switch (msg.event) {
            case 'init':
                drawioIsReady = true;
                updateStatus('Connected', true);

                // If we already resolved the tabId, load the right data
                // Otherwise it will be loaded later when the tabId message returns
                if (currentTabId !== null) {
                    loadDataForCurrentTab();
                }
                break;

            case 'save':
            case 'autosave':
                if (msg.xml) {
                    const storageKey = getStorageKey();
                    chrome.storage.local.set({ [storageKey]: msg.xml }, () => {
                        updateStatus(msg.event === 'autosave' ? 'Auto-saved' : 'Saved', true);
                        if (msg.event === 'save') {
                            showToast('Diagram saved for this tab', 'success');
                            // Tell Draw.io save successful
                            sendToDrawio({ action: 'status', message: 'Saved', modified: false });
                        }
                    });
                }
                break;

            case 'export':
                handleExport(msg);
                break;

            case 'load':
                updateStatus('Ready', true);
                break;

            case 'configure':
                sendToDrawio({
                    action: 'configure',
                    config: {
                        defaultFonts: ['Inter', 'Helvetica', 'Times New Roman', 'Arial'],
                    },
                });
                break;
        }
    }

    /**
     * Master function: rendering XML directly to Draw.io
     * @param {string} xmlString Draw.io format XML model data
     */
    function renderXmlToDrawio(xmlString) {
        if (!drawioIsReady) {
            console.warn("Draw.io is not ready yet.");
            showToast('Rendering queued (Draw.io not ready)', 'warning');
            return;
        }

        sendToDrawio({
            action: 'load',
            xml: xmlString,
            autosave: 1, // trigger autosave after load
        });
    }

    // ==========================================
    // Export & Download
    // ==========================================

    function handleExport(msg) {
        if (!msg.data) return;
        const fileName = pendingExportName || `diagram_tab_${currentTabId || 'export'}`;
        pendingExportName = null; // reset

        if (msg.format === 'xml' || msg.format === 'svg') {
            downloadTextFile(msg.data, `${fileName}.${msg.format}`, `application/${msg.format === 'svg' ? 'svg+xml' : 'xml'}`);
        } else if (msg.format === 'png') {
            downloadDataUrl(msg.data, `${fileName}.png`);
        }

        showToast(`Exported as ${msg.format.toUpperCase()}`, 'success');
    }

    function downloadTextFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        triggerDownload(url, filename);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    function downloadDataUrl(dataUrl, filename) {
        triggerDownload(dataUrl, filename);
    }

    function triggerDownload(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function requestExport(format) {
        const defaultName = `diagram_tab_${currentTabId || 'export'}`;
        let customName = prompt("Enter file name for export:", defaultName);
        if (customName === null || customName.trim() === '') return; // User cancelled

        // Clean up extension if user accidentally typed it
        customName = customName.replace(/\.(xml|png|svg|drawio)$/i, '').trim() || defaultName;

        if (format === 'xml' || format === 'drawio') {
            // Get latest state directly from storage instead of asking iframe
            const storageKey = getStorageKey();
            chrome.storage.local.get([storageKey], function (result) {
                if (result[storageKey]) {
                    const extension = format === 'drawio' ? '.drawio' : '.xml';
                    downloadTextFile(result[storageKey], `${customName}${extension}`, 'application/xml');
                    showToast(`Exported as ${format.toUpperCase()}`, 'success');
                } else {
                    showToast('No diagram to export', 'error');
                }
            });
        } else {
            pendingExportName = customName;
            sendToDrawio({
                action: 'export',
                format: format,
                spin: 'Exporting...',
            });
        }
        closeExportMenu();
    }

    // ==========================================
    // UI: Status
    // ==========================================

    function updateStatus(text, connected = false) {
        statusText.innerHTML = `<span class="status-dot ${connected ? 'connected' : ''}"></span> ${escapeHtml(text)}`;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ==========================================
    // Code-to-Diagram Interface
    // ==========================================

    function insertDiagramFromCode(codeType, codeString) {
        if (!codeString || !codeString.trim()) {
            showToast('Please enter some code/XML', 'error');
            return;
        }

        let xml;

        if (codeType === 'drawio-xml') {
            // Direct XML rendering (fulfilling Requirement 1)
            renderXmlToDrawio(codeString.trim());
            showToast('Imported Draw.io XML', 'success');
            closeCodeModal();
            return;
        } else if (codeType === 'mermaid') {
            const encodedCode = codeString.trim();
            xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
          <mxCell id="2" value="" style="shape=mxgraph.mermaid.abstract.mermaid;link=data:text/plain,${encodeURIComponent(encodedCode)};" vertex="1" parent="1">
            <mxGeometry x="20" y="20" width="400" height="300" as="geometry"/>
          </mxCell>
        </root></mxGraphModel>`;
        } else if (codeType === 'plantuml') {
            const encodedCode = codeString.trim();
            xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
          <mxCell id="2" value="" style="shape=image;editableCssRules=.*;image=https://www.plantuml.com/plantuml/svg/~1${plantumlEncode(encodedCode)};" vertex="1" parent="1">
            <mxGeometry x="20" y="20" width="400" height="300" as="geometry"/>
          </mxCell>
        </root></mxGraphModel>`;
        }

        renderXmlToDrawio(xml);
        showToast(`Inserted ${codeType} diagram`, 'success');
        closeCodeModal();
    }

    function plantumlEncode(text) {
        return btoa(unescape(encodeURIComponent(text)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    // ==========================================
    // Auto-Detect XML from AI Pages
    // ==========================================

    let autoUpdateEnabled = true; // default ON
    let pendingXml = null;
    const notifyBar = document.getElementById('notify-bar');
    const btnAutoUpdate = document.getElementById('btn-auto-update');

    // Load auto-update preference
    chrome.storage.local.get(['easydrawio_auto_update'], (result) => {
        if (result.easydrawio_auto_update !== undefined) {
            autoUpdateEnabled = result.easydrawio_auto_update;
        }
        updateAutoUpdateUI();
    });

    function updateAutoUpdateUI() {
        if (btnAutoUpdate) {
            btnAutoUpdate.classList.toggle('auto-on', autoUpdateEnabled);
            btnAutoUpdate.classList.toggle('auto-off', !autoUpdateEnabled);
            btnAutoUpdate.title = `Auto-update: ${autoUpdateEnabled ? 'ON' : 'OFF'} (click to toggle)`;
        }
    }

    function toggleAutoUpdate() {
        autoUpdateEnabled = !autoUpdateEnabled;
        chrome.storage.local.set({ easydrawio_auto_update: autoUpdateEnabled });
        updateAutoUpdateUI();
        showToast(`Auto-update ${autoUpdateEnabled ? 'enabled' : 'disabled'}`, 'info');
    }

    function showNotifyBar(xml) {
        pendingXml = xml;
        if (notifyBar) notifyBar.classList.add('visible');
    }

    function hideNotifyBar() {
        pendingXml = null;
        if (notifyBar) notifyBar.classList.remove('visible');
    }

    function applyPendingXml() {
        if (pendingXml) {
            renderXmlToDrawio(pendingXml);
            showToast('Diagram updated from AI response!', 'success');
            hideNotifyBar();
        }
    }

    // Listen for XML detected messages from background (relayed from content script)
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'xmlDetectedForSidebar' && request.xml) {
            // Only accept if it's from the same tab we're bound to
            if (currentTabId !== null && request.sourceTabId !== null && request.sourceTabId !== currentTabId) {
                return; // Ignore XML from other tabs
            }

            if (autoUpdateEnabled) {
                // Auto-update: render immediately
                renderXmlToDrawio(request.xml);
                showToast('Diagram auto-updated from AI!', 'success');
            } else {
                // Manual mode: show notification bar
                showNotifyBar(request.xml);
            }
        }
    });

    // Bind auto-update toggle button
    if (btnAutoUpdate) btnAutoUpdate.addEventListener('click', toggleAutoUpdate);

    // Bind notification bar buttons
    const btnNotifyUpdate = document.getElementById('btn-notify-update');
    if (btnNotifyUpdate) btnNotifyUpdate.addEventListener('click', applyPendingXml);

    const btnNotifyDismiss = document.getElementById('btn-notify-dismiss');
    if (btnNotifyDismiss) btnNotifyDismiss.addEventListener('click', hideNotifyBar);

    // ==========================================
    // UI: Toggles & Event Listeners
    // ==========================================

    function toggleExportMenu() {
        const isOpen = exportMenu.classList.contains('open');
        closeAllMenus();
        if (!isOpen) {
            exportMenu.classList.add('open');
            document.getElementById('btn-export').classList.add('active');
        }
    }

    function closeExportMenu() {
        exportMenu.classList.remove('open');
        const btn = document.getElementById('btn-export');
        if (btn) btn.classList.remove('active');
    }

    function openCodeModal() {
        closeAllMenus();
        codeModal.classList.add('open');
    }

    function closeCodeModal() {
        codeModal.classList.remove('open');
        document.getElementById('code-input').value = '';
    }

    function closeAllMenus() {
        closeExportMenu();
    }

    function triggerSave() {
        sendToDrawio({ action: 'export', format: 'xmlsvg', exit: false });
    }

    // Bind Buttons
    const btnNew = document.getElementById('btn-new');
    if (btnNew) {
        btnNew.addEventListener('click', () => {
            if (confirm('Create a new diagram? This will clear current work in this isolated tab.')) {
                renderXmlToDrawio(EMPTY_DIAGRAM);
                const storageKey = getStorageKey();
                chrome.storage.local.set({ [storageKey]: EMPTY_DIAGRAM });
            }
        });
    }

    const btnSave = document.getElementById('btn-save');
    if (btnSave) btnSave.addEventListener('click', triggerSave);

    const btnExport = document.getElementById('btn-export');
    if (btnExport) btnExport.addEventListener('click', toggleExportMenu);

    const btnCode = document.getElementById('btn-code');
    if (btnCode) btnCode.addEventListener('click', openCodeModal);

    document.querySelectorAll('.dropdown-item[data-format]').forEach((btn) => {
        btn.addEventListener('click', () => {
            requestExport(btn.dataset.format);
        });
    });

    const btnCloseCode = document.getElementById('btn-close-code');
    if (btnCloseCode) btnCloseCode.addEventListener('click', closeCodeModal);

    const btnCancelCode = document.getElementById('btn-cancel-code');
    if (btnCancelCode) btnCancelCode.addEventListener('click', closeCodeModal);

    const btnInsertCode = document.getElementById('btn-insert-code');
    if (btnInsertCode) {
        btnInsertCode.addEventListener('click', () => {
            const codeType = document.getElementById('code-type').value;
            const codeString = document.getElementById('code-input').value;
            insertDiagramFromCode(codeType, codeString);
        });
    }

    if (codeModal) {
        codeModal.addEventListener('click', (e) => {
            if (e.target === codeModal) closeCodeModal();
        });
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#export-menu') && !e.target.closest('#btn-export')) {
            closeExportMenu();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 's' || e.key === 'S') {
                e.preventDefault();
                triggerSave();
            }
        }
        if (e.key === 'Escape') {
            closeAllMenus();
            closeCodeModal();
        }
    });

    // Init
    updateStatus('Loading...', false);

})();
