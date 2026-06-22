/**
 * @file services/PermissionBroker.js
 * @purpose Sovereign Global: on-demand activeTab / optional-origin permission flow (CWS compliance).
 *          Replaces blanket <all_urls> with explicit, user-granted, per-origin access.
 */
import { State } from './State.js';
import { Storage } from './Storage.js';
import { log } from '../utils/logger.js';

export const PermissionBroker = {
    has(name) {
        return new Promise((resolve) =>
            chrome.permissions.contains({ permissions: [name] }, (g) => resolve(!!g)));
    },

    hasOrigin(origin) {
        return new Promise((resolve) =>
            chrome.permissions.contains({ origins: [origin] }, (g) => resolve(!!g)));
    },

    async getActiveTabOrigin() {
        return new Promise((resolve) => {
            if (typeof chrome === 'undefined' || !chrome.tabs) {
                resolve(null);
                return;
            }
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (!tabs || tabs.length === 0) {
                    resolve(null);
                    return;
                }
                const tab = tabs[0];
                if (!tab || !tab.url) {
                    resolve(null);
                    return;
                }
                try {
                    const urlObj = new URL(tab.url);
                    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
                        resolve(null);
                        return;
                    }
                    resolve(`${urlObj.protocol}//${urlObj.hostname}/*`);
                } catch (e) {
                    resolve(null);
                }
            });
        });
    },

    async ensurePermission() {
        const origin = await this.getActiveTabOrigin();
        if (!origin) return true;

        const alreadyGranted = await this.hasOrigin(origin);
        if (alreadyGranted) return true;

        const granted = await new Promise((resolve) =>
            chrome.permissions.request({ origins: [origin] }, (g) => resolve(!!g)));
        if (granted) {
            const current = State.get('granted_origins') || [];
            if (!current.includes(origin)) {
                const updated = [...current, origin];
                State.set('granted_origins', updated);
                Storage.set({ granted_origins: updated });
            }
            log('LOGIC', 'permission_gate_resolved', `granted:${origin}`);
        }
        return granted;
    },

    async requestOrigin(origin) {
        const granted = await new Promise((resolve) =>
            chrome.permissions.request({ origins: [origin] }, (g) => resolve(!!g)));
        if (granted) {
            const current = State.get('granted_origins') || [];
            if (!current.includes(origin)) State.set('granted_origins', [...current, origin]);
            log('LOGIC', 'permission_gate_resolved', `granted:${origin}`);
        }
        return granted;
    },

    async revokeOrigin(origin) {
        const removed = await new Promise((resolve) =>
            chrome.permissions.remove({ origins: [origin] }, (g) => resolve(!!g)));
        if (removed) {
            const current = State.get('granted_origins') || [];
            State.set('granted_origins', current.filter((o) => o !== origin));
            log('LOGIC', 'permission_gate_resolved', `revoked:${origin}`);
        }
        return removed;
    }
};

if (typeof window !== 'undefined') window.PermissionBroker = PermissionBroker;
