/**
 * @file components/core/Forge/Intelligence.js
 * @purpose UI: Forge Intelligence selector — Peer + Intent dominant expanders.
 * @standard Follows Mode.js / Strategy.js selector pattern.
 *           Both Peer AND Intent must be selected for State injection; either alone is ignored.
 */
import { Expander } from '../../reusable/Expander.js';
import { Selector } from '../../reusable/Selector.js';
import { dom } from '../../../utils/dom.js';
import { Language } from '../../../services/Language.js';
import { Storage } from '../../../services/Storage.js';
import { State } from '../../../services/State.js';
import { log } from '../../../utils/logger.js';
import { ICONS } from '../../../utils/assets.js';

export class Intelligence {
    constructor(container) {
        this.container    = container;
        this.activePeerId   = null;
        this.activeIntentId = null;
        this.peerSelector   = null;
        this.intentSelector = null;
        this.peerExpander   = null;
        this.intentExpander = null;
        this.mainExpander   = null;
        this._clearBtn      = null;

        this.handlePresetApplied = () => this._restoreFromStorage();
        window.addEventListener('PRESET_APPLIED', this.handlePresetApplied);

        // [V13.S³] Record Annotation: stamp intelligence meta onto new output records
        this._outputsUpdatedHandler = async (e) => {
            const peerId     = State.get('active_peer_id');
            const intentId   = State.get('active_intent_id');
            const intentText = State.get('active_intent_text');
            if (!peerId || !intentId || !intentText) return;

            const recordId = e.detail?.lastRecordId;
            if (!recordId) return;

            const peers = await Storage.get('peers') || [];
            const peer  = peers.find(p => p.id === peerId);
            if (!peer) return;

            const currentMap = State.get('intelligence_record_map') || {};
            if (currentMap[recordId]) return;

            const updatedMap = {
                ...currentMap,
                [recordId]: { peer_name: peer.name, peer_id: peerId, intent_text: intentText, intent_id: intentId }
            };
            State.set('intelligence_record_map', updatedMap);
            await Storage.set({ intelligence_record_map: updatedMap });
            log('DATA', 'INTELLIGENCE_RECORD_ANNOTATED', { recordId, peer: peer.name, intent: intentText.substring(0, 40) });
        };
        window.addEventListener('alchimist:outputs-updated', this._outputsUpdatedHandler);

        // Deletion cascade: clear selection if active peer/intent is removed
        this._peerDeletedHandler = async (e) => {
            const deletedId = e.detail?.id;
            if (!deletedId) return;
            if (this.activePeerId === deletedId) await this._clearPeerSelection();
            if (this.peerSelector) {
                this.peerSelector.items = (this.peerSelector.items || []).filter(i => i.id !== deletedId);
                this.peerSelector.refresh();
            }
        };
        this._intentDeletedHandler = async (e) => {
            const deletedId = e.detail?.id;
            if (!deletedId) return;
            if (this.activeIntentId === deletedId) await this._clearIntentSelection();
            if (this.intentSelector) {
                this.intentSelector.items = (this.intentSelector.items || []).filter(i => i.id !== deletedId);
                this.intentSelector.refresh();
            }
        };
        window.addEventListener('PEER_DELETED',   this._peerDeletedHandler);
        window.addEventListener('INTENT_DELETED', this._intentDeletedHandler);
    }

    async render() {
        // [V18.4] Parallelize the four independent cold reads. Previously these were
        // four sequential awaits — each a full chrome.storage.local round-trip yielding
        // the event loop — which made Intelligence the slowest expander and caused it to
        // lose the concurrent-mount append race after a CONTEXT_WIPE evicted its buffer.
        const [peers, intents, savedPeerId, savedIntentId] = await Promise.all([
            Storage.get('peers').then(v => v || []),
            Storage.get('intents').then(v => v || []),
            Storage.get('forge_active_peer_id'),
            Storage.get('forge_active_intent_id')
        ]);

        // Restore persisted selections (validate against current lists)
        if (savedPeerId   && peers.some(p => p.id === savedPeerId))   this.activePeerId   = savedPeerId;
        if (savedIntentId && intents.some(i => i.id === savedIntentId)) this.activeIntentId = savedIntentId;

        // ── Peer sub-expander ──────────────────────────────────────────
        this.peerExpander = new Expander({
            id: 'exp-forge-peer',
            title: Language.text('TITLE_INTELLIGENCE_PEER') || 'Peer',
            isDominantConfig: true,
            groupId: 'forge-intelligence'
        });

        // Peers already carry {id, name} — directly usable by Selector
        this.peerSelector = new Selector({
            items: peers,
            activeId: this.activePeerId,
            onSelect: (item, isReSelect) => this._handlePeerSelect(item, isReSelect)
        });

        const peerContent = peers.length > 0
            ? this.peerSelector.render()
            : dom.create('div', 'text-xs text-[var(--text-secondary)] p-3 text-center italic', {
                innerText: 'No peers defined yet. Add peers in Features → Intelligence.'
              });

        const peerNode = this.peerExpander.render(peerContent);

        if (this.activePeerId) {
            const peer = peers.find(p => p.id === this.activePeerId);
            if (peer) this.peerExpander.updateSubtitle(peer.name);
        }

        // ── Intent sub-expander ────────────────────────────────────────
        this.intentExpander = new Expander({
            id: 'exp-forge-intent',
            title: Language.text('TITLE_INTELLIGENCE_INTENT') || 'Intent',
            isDominantConfig: true,
            groupId: 'forge-intelligence'
        });

        const intentItems = intents.map(i => ({ id: i.id, name: i.text }));
        this.intentSelector = new Selector({
            items: intentItems,
            activeId: this.activeIntentId,
            onSelect: (item, isReSelect) => this._handleIntentSelect(item, isReSelect)
        });

        const intentContent = intentItems.length > 0
            ? this.intentSelector.render()
            : dom.create('div', 'text-xs text-[var(--text-secondary)] p-3 text-center italic', {
                innerText: 'No intents defined yet. Add intents in Features → Intelligence.'
              });

        const intentNode = this.intentExpander.render(intentContent);

        if (this.activeIntentId) {
            const intent = intents.find(i => i.id === this.activeIntentId);
            if (intent) this.intentExpander.updateSubtitle(intent.text);
        }

        // ── Main orchestrator expander ─────────────────────────────────
        this.mainExpander = new Expander({
            id: 'exp-forge-intelligence',
            title: Language.text('TITLE_INTELLIGENCE') || 'Intelligence',
            isDominantConfig: true,
            groupId: 'forge-inputs'
        });

        const content = dom.create('div', 'flex flex-col space-y-1');
        content.appendChild(peerNode);
        content.appendChild(intentNode);
        this.container.appendChild(this.mainExpander.render(content));

        // Clear button on main expander header (Persona.js manageBtn pattern)
        // Initially hidden; _syncState() shows it only when both peer+intent are active
        if (this.mainExpander.header && this.mainExpander.iconEl) {
            this._clearBtn = dom.create('button', 'menu__item ml-1 z-10 relative text-white/30 hover:text-red-400 transition-colors', {
                innerHTML: ICONS.CLEAR,
                title: 'Clear Peer & Intent selection',
                onclick: (e) => { e.stopPropagation(); this._clearSelections(); }
            });
            this._clearBtn.style.display = 'none';
            this.mainExpander.header.insertBefore(this._clearBtn, this.mainExpander.iconEl);
        }

        // [V18.4] Pass the already-fetched peers/intents so _syncState skips its
        // duplicate reads of both keys on the mount path.
        await this._syncState(peers, intents);

        log('UI', 'FORGE_INTELLIGENCE_RENDERED', {
            peers:   peers.length,
            intents: intents.length,
            activePeer:   this.activePeerId,
            activeIntent: this.activeIntentId
        });
    }

    async _handlePeerSelect(item, isReSelect) {
        if (isReSelect) {
            await this._clearPeerSelection();
            return;
        }
        this.activePeerId = item.id;
        this.peerExpander.updateSubtitle(item.name);
        this.peerExpander.collapse();
        await Storage.set({ forge_active_peer_id: item.id });
        await this._syncState();
        log('LOGIC', 'FORGE_PEER_SELECTED', { id: item.id, name: item.name });
    }

    async _handleIntentSelect(item, isReSelect) {
        if (isReSelect) {
            await this._clearIntentSelection();
            return;
        }
        this.activeIntentId = item.id;
        this.intentExpander.updateSubtitle(item.name);
        this.intentExpander.collapse();
        await Storage.set({ forge_active_intent_id: item.id });
        await this._syncState();
        log('LOGIC', 'FORGE_INTENT_SELECTED', { id: item.id });
    }

    // Loads peer intelligence data and pushes all active_* keys to State.
    // Clears State if either selection is absent — enforcing the "both required" rule.
    // [V18.4] peers/intents may be passed by the render() mount path to avoid duplicate
    // reads; interaction-driven callers (select/clear) invoke with no args and fall back
    // to fetching, since they don't hold those collections in scope.
    async _syncState(peers = null, intents = null) {
        if (this.activePeerId && this.activeIntentId) {
            if (peers === null || intents === null) {
                const [fetchedPeers, fetchedIntents] = await Promise.all([
                    Storage.get('peers').then(v => v || []),
                    Storage.get('intents').then(v => v || [])
                ]);
                peers   = peers   === null ? fetchedPeers   : peers;
                intents = intents === null ? fetchedIntents : intents;
            }
            const peerData = await Storage.get(`peer_intelligence_${this.activePeerId}`) || null;
            const intent   = intents.find(i => i.id === this.activeIntentId);
            const peer     = peers.find(p => p.id === this.activePeerId);

            State.set('active_peer_id',          this.activePeerId);
            State.set('active_peer_intelligence', peerData);
            State.set('active_intent_id',         this.activeIntentId);
            State.set('active_intent_text',       intent ? intent.text : null);

            if (peer && intent) {
                const words = intent.text.split(' ');
                const short = words.slice(0, 5).join(' ') + (words.length > 5 ? '…' : '');
                this.mainExpander && this.mainExpander.updateSubtitle(`${peer.name} → ${short}`);
            } else if (peer) {
                this.mainExpander && this.mainExpander.updateSubtitle(peer.name);
            }

            log('LOGIC', 'FORGE_INTELLIGENCE_SYNCED', {
                peerId:      this.activePeerId,
                intentId:    this.activeIntentId,
                hasPeerData: !!(peerData && Object.keys(peerData).length)
            });
        } else {
            State.set('active_peer_id',          null);
            State.set('active_peer_intelligence', null);
            State.set('active_intent_id',         null);
            State.set('active_intent_text',       null);
            this.mainExpander && this.mainExpander.updateSubtitle('');
        }

        // Clear button visibility — OUTSIDE both branches so it updates on any selection change
        if (this._clearBtn) {
            this._clearBtn.style.display = (this.activePeerId && this.activeIntentId) ? '' : 'none';
        }
    }

    async _clearPeerSelection() {
        this.activePeerId = null;
        if (this.peerExpander) this.peerExpander.updateSubtitle('');
        if (this.peerSelector) { this.peerSelector.activeId = null; this.peerSelector.refresh(); }
        await Storage.set({ forge_active_peer_id: null });
        await this._syncState();
        log('LOGIC', 'FORGE_PEER_CLEARED');
    }

    async _clearIntentSelection() {
        this.activeIntentId = null;
        if (this.intentExpander) this.intentExpander.updateSubtitle('');
        if (this.intentSelector) { this.intentSelector.activeId = null; this.intentSelector.refresh(); }
        await Storage.set({ forge_active_intent_id: null });
        await this._syncState();
        log('LOGIC', 'FORGE_INTENT_CLEARED');
    }

    async _clearSelections() {
        this.activePeerId   = null;
        this.activeIntentId = null;
        if (this.peerExpander)   this.peerExpander.updateSubtitle('');
        if (this.intentExpander) this.intentExpander.updateSubtitle('');
        if (this.peerSelector)   { this.peerSelector.activeId = null;   this.peerSelector.refresh(); }
        if (this.intentSelector) { this.intentSelector.activeId = null; this.intentSelector.refresh(); }
        await Storage.set({ forge_active_peer_id: null, forge_active_intent_id: null });
        await this._syncState();
        log('LOGIC', 'FORGE_INTELLIGENCE_CLEARED');
    }

    // KEY FIX: always reset activePeerId/activeIntentId to null FIRST,
    // then restore from storage. Prevents stale in-memory values leaking
    // back into State via _syncState() after a preset without peer/intent is applied.
    async _restoreFromStorage() {
        const peers   = await Storage.get('peers')   || [];
        const intents = await Storage.get('intents') || [];
        const savedPeerId   = await Storage.get('forge_active_peer_id');
        const savedIntentId = await Storage.get('forge_active_intent_id');

        // Always reset first — prevents stale in-memory values surviving a preset restore
        this.activePeerId   = null;
        this.activeIntentId = null;
        if (this.peerExpander)   this.peerExpander.updateSubtitle('');
        if (this.intentExpander) this.intentExpander.updateSubtitle('');
        if (this.peerSelector)   { this.peerSelector.activeId = null;   this.peerSelector.refresh(); }
        if (this.intentSelector) { this.intentSelector.activeId = null; this.intentSelector.refresh(); }

        // Now restore from storage if values are valid
        if (savedPeerId && peers.some(p => p.id === savedPeerId)) {
            this.activePeerId = savedPeerId;
            const peer = peers.find(p => p.id === savedPeerId);
            if (peer && this.peerExpander) this.peerExpander.updateSubtitle(peer.name);
            if (this.peerSelector) { this.peerSelector.activeId = savedPeerId; this.peerSelector.refresh(); }
        }
        if (savedIntentId && intents.some(i => i.id === savedIntentId)) {
            this.activeIntentId = savedIntentId;
            const intent = intents.find(i => i.id === savedIntentId);
            if (intent && this.intentExpander) this.intentExpander.updateSubtitle(intent.text);
            if (this.intentSelector) { this.intentSelector.activeId = savedIntentId; this.intentSelector.refresh(); }
        }

        await this._syncState();
    }

    destroy() {
        window.removeEventListener('PRESET_APPLIED', this.handlePresetApplied);
        window.removeEventListener('alchimist:outputs-updated', this._outputsUpdatedHandler);
        window.removeEventListener('PEER_DELETED',   this._peerDeletedHandler);
        window.removeEventListener('INTENT_DELETED', this._intentDeletedHandler);
        if (this.mainExpander)   this.mainExpander.destroy();
        if (this.peerExpander)   this.peerExpander.destroy();
        if (this.intentExpander) this.intentExpander.destroy();
    }
}