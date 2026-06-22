/**
 * @file background.js
 * @purpose SERVICE WORKER: Dynamic Substrate Orchestrator.
 */
import { log } from './utils/logger.js';

log('LOGIC', 'Background Sentinel Awakening...');

// Active Substrate Heartbeat
const ensureSubstrate = async (tabId) => {
    try {
        const check = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => typeof window.__alchimist_anchor !== 'undefined'
        });
        
        const isAlive = check && check[0] && check[0].result;
        if (!isAlive) {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['anchor.js']
            });
            log('LOGIC', 'SUBSTRATE_AWAKENED', `Force-injected into tab ${tabId}`);
        }
    } catch (err) {
        log('e', 'INJECTION_FAILED', `Tab ${tabId}: ${err.message}`);
    }
};

// [CWS] Compliance-safe persistent presence. Restores the legacy "always present" reliability
// WITHOUT <all_urls>: anchor.js is registered ONLY for origins the user has already granted
// (chrome.permissions.getAll is the authoritative grant source). Re-synced on lifecycle events
// and whenever a grant is added/removed. New navigations to granted origins auto-inject at
// document_start; already-open tabs are covered by the onActivated heartbeat below.
const ANCHOR_SCRIPT_ID = 'alchimist-anchor';
const syncAnchorRegistration = async () => {
    try {
        const all = await chrome.permissions.getAll();
        const matches = (all.origins || []).filter(o => o.startsWith('http'));

        const existing = await chrome.scripting
            .getRegisteredContentScripts({ ids: [ANCHOR_SCRIPT_ID] })
            .catch(() => []);
        if (existing && existing.length) {
            await chrome.scripting.unregisterContentScripts({ ids: [ANCHOR_SCRIPT_ID] });
        }
        if (matches.length === 0) {
            log('LOGIC', 'SUBSTRATE', 'No granted origins yet; anchor registration cleared.');
            return;
        }
        await chrome.scripting.registerContentScripts([{
            id: ANCHOR_SCRIPT_ID,
            js: ['anchor.js'],
            matches,
            allFrames: true,
            runAt: 'document_start',
            world: 'ISOLATED'
        }]);
        log('LOGIC', 'SUBSTRATE', `Anchor registered for ${matches.length} granted origin(s).`);
    } catch (err) {
        log('e', 'SUBSTRATE_REG_ERROR', err.message);
    }
};

chrome.runtime.onInstalled.addListener(syncAnchorRegistration);
chrome.runtime.onStartup.addListener(syncAnchorRegistration);
chrome.permissions.onAdded.addListener(syncAnchorRegistration);
chrome.permissions.onRemoved.addListener(syncAnchorRegistration);

// Side Panel Opening Logic
chrome.action.onClicked.addListener((tab) => {
    ensureSubstrate(tab.id);
    chrome.sidePanel.open({ tabId: tab.id });
});

// [RESTORED] Re-ensure the substrate on tab switch (legacy parity). Registration only covers
// NEW navigations to granted origins; this covers tabs already open at grant time and tabs
// whose script died. ensureSubstrate self-catches on ungranted tabs (no access without permission).
chrome.tabs.onActivated.addListener((activeInfo) => {
    ensureSubstrate(activeInfo.tabId);
});

// Telemetry Hub
chrome.runtime.onMessage.addListener((request, sender) => {
    if (request.action === 'CLEAR_LOGS') {
        console.clear();
    }

    if (request.action === 'NATIVE_LOG') {
        const { type, aspect, args } = request.payload;
        const source = sender.tab ? `Tab:${sender.tab.id}` : 'SidePanel';
        log(type, `[Relayed:${source}] ${aspect}`, ...args);
    }
});