/**
 * @file utils/logger.js
 * @purpose LOGGER: Unified Telemetry Bridge for UI and Service Worker.
 */

const isBackground = typeof ServiceWorkerGlobalScope !== 'undefined';

let logHistory = [];
let _syncLock = false;
let userLogHistory = [];

// [SWITCH] Master diagnostic-log visibility. When false, dev logs are neither displayed
// (console / forensic overlay) nor auto-synced to the clipboard. Toggle at runtime via
// window.Logger.show_logs = false. User-facing status telemetry (userLog) is unaffected.
let show_logs = false;

export const Logger = {
    // [SWITCH] Runtime accessor for the master log-visibility switch.
    get show_logs() { return show_logs; },
    set show_logs(v) { show_logs = !!v; },

    /**
     * [V13.S³] Sync Mutex
     * Prevents auto-sync from overwriting manual copy operations.
     */
    lockSync(duration = 200) {
        _syncLock = true;
        setTimeout(() => { _syncLock = false; }, duration);
    },

    isSyncLocked() {
        return _syncLock;
    },

    /**
     * [LXXIV] Forensic Grounding
     * Outputs to local console and relays to Background if in UI context.
     */
    ground(type, aspect, ...args) {
        const method = type === 'e' ? 'error' : type === 'w' ? 'warn' : 'log';
        const prefix = `[${aspect}]`;

        // Format custom H:i:s timestamp securely without AM/PM or date strings
        const now = new Date();
        const timestamp = [
            String(now.getHours()).padStart(2, '0'),
            String(now.getMinutes()).padStart(2, '0'),
            String(now.getSeconds()).padStart(2, '0')
        ].join(':');

        // Is log record deactivated?
        let all_not_false = true;
        for(let i=0;i<args.length;i++) if(args[i] === false) all_not_false = false;
        if(!all_not_false) return;

        // [V13.S4] Telemetry Auto-Mapper (Ruin Prevention for dynamic UI triggers)
        if (aspect === 'LOGIC' && args[0] === 'GATEWAY_INVOKED' && args[1]?.action === 'alchemy:transmute') {
            Logger.userLog('LOG_INIT_TRANSMUTE', 'initiated');
        } else if (aspect === 'LOGIC' && typeof args[0] === 'string' && args[0].includes('Resonance Stabilized')) {
            Logger.userLog('LOG_SUC_TRANSMUTE', 'success');
        } else if (aspect === 'e' && typeof args[0] === 'string' && (args[0] === 'TRANSMUTE_ERROR' || args[0] === 'TRANSMUTATION_ERROR')) {
            Logger.userLog('LOG_ERR_TRANSMUTE', 'error');
        } else if (aspect === 'LOGIC' && args[0] === 'METRICS_RECALIBRATED') {
            Logger.userLog('LOG_SUC_RECALIBRATE', 'success');
        } else if (aspect === 'UI' && args[0] === 'SUGGESTION_APPLIED') {
            Logger.userLog('LOG_SUC_SUGGESTION', 'success');
        } else if (aspect === 'LOGIC' && args[0] === 'APPLYING_SUGGESTION_START') {
            Logger.userLog('LOG_INIT_SUGGESTION', 'initiated');
        } else if (aspect === 'e' && args[0] === 'REFINEMENT_ERROR') {
            Logger.userLog('LOG_ERR_SUGGESTION', 'error');
        }

        // [SWITCH] When show_logs is false, suppress the dev-log reservoir, the LOG_ADDED event
        // (which also drives the Footer's automatic clipboard sync), the dev-console output, and
        // the background relay. The user-facing status feed above is intentionally exempt.
        if (!show_logs) return;

        // Maintain Reservoir
        const entry = `[${timestamp}] ${prefix} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`;
        logHistory.push(entry);
        if (logHistory.length > 500) logHistory.shift();

        if (typeof window !== 'undefined') {
            // [FOX_ISSUE.FIX.V2] Decouple telemetry rendering from synchronous logic flow
            requestAnimationFrame(() => {
                window.dispatchEvent(new CustomEvent('LOG_ADDED', { detail: entry }));
            });
        }

        // 1. Local Grounding with standard [H:i:s] Prefix in Dev Console
        console[method](`[${timestamp}] ${prefix}`, ...args);

        // 2. Native Relay (Forwarding to Background)
        if (!isBackground && typeof chrome !== 'undefined' && chrome.runtime?.id) {
            chrome.runtime.sendMessage({
                action: 'NATIVE_LOG',
                payload: { type, aspect, args }
            }).catch(() => {}); // Silent if receiver not ready
        }
    },

    /**
     * [CXV] Substrate Purge
     * Clears local console and sends signal to clear Service Worker console.
     */
    clear() {
        console.clear();
        if (!isBackground && typeof chrome !== 'undefined' && chrome.runtime?.id) {
            chrome.runtime.sendMessage({ action: 'CLEAR_LOGS' }).catch(() => {});
        }
    },

    /**
     * [CXVI] Forensic Export
     * Returns the session reservoir for clipboard operations.
     */
    getHistory() {
        return logHistory.join('\n');
    },

    /**
     * [CXVII] Latest Telemetry
     * Returns the most recent log entry for the status bar.
     */
    getLatest() {
        return logHistory.length > 0 ? logHistory[logHistory.length - 1] : '';
    },

    /**
     * UI-Specific Telemetry
     * Bypasses standard developer log noise. Emits to window for UserConsole.
     */
    userLog(token_id, status) {
        // Format custom H:i:s timestamp securely
        const now = new Date();
        const timestamp = [
            String(now.getHours()).padStart(2, '0'),
            String(now.getMinutes()).padStart(2, '0'),
            String(now.getSeconds()).padStart(2, '0')
        ].join(':');
        const record = { token_id, status, timestamp };
        
        userLogHistory.unshift(record);
        if (userLogHistory.length > 100) userLogHistory.pop();
        
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('USER_LOG_EMITTED', { detail: record }));
        }
    },

    getUserHistory() {
        return userLogHistory;
    }
};

export const log = (aspect, ...args) => Logger.ground('l', aspect, ...args);
export const l = log;
export const w = (aspect, ...args) => Logger.ground('w', aspect, ...args);
export const e = (aspect, ...args) => Logger.ground('e', aspect, ...args);
export const userLog = (token, status) => Logger.userLog(token, status);

// Attach to window for debug visibility
if (!isBackground) window.Logger = Logger;