/**
 * @file components/core/Features/Intelligence.js
 * @purpose UI: Intelligence Feature - Peer (extends Profile) and Intent management.
 * @standard PeerProfile inherits Profile fully; overrides storage keys per-peer.
 *           Peers orchestrator manages peer records list + PeerProfile instances.
 *           Intents follows Imperative.js click-to-edit pattern.
 */
import { dom } from '../../../utils/dom.js';
import { Expander } from '../../reusable/Expander.js';
import { Language } from '../../../services/Language.js';
import { Storage } from '../../../services/Storage.js';
import { State } from '../../../services/State.js';
import { log } from '../../../utils/logger.js';
import { LLM } from '../../../services/LLM.js';
import { PromptTemplates } from '../../../utils/promptTemplates.js';
import { PrimeManifold } from '../../../modules/JsonPrime.js';
import { Scraper } from '../../../modules/Scraper.js';
import { PermissionBroker } from '../../../services/PermissionBroker.js';
import Dropdown from '../../reusable/Dropdown.js';
import { Confirmation } from '../../reusable/Confirmation.js';
import { ICONS, DEFAULT_INTENTS } from '../../../utils/assets.js';
import { Editor } from '../../reusable/Editor.js';
import { Profile } from './Profile.js';

// ─── PeerProfile ─────────────────────────────────────────────────────────────
// Extends Profile with per-peer storage isolation and name-based subtitle.
// Inherits: mergeProfileData, flattenSelectedIntegrations, sanitizeToArray, fetchIntegrationList.
// Overrides: constructor, syncSubtitle, hydrateAndRenderBody, executeSiege,
//            mountAndRefreshDropdown, refreshIntegrationsDropdown, render, destroy.

class PeerProfile extends Profile {
    constructor(peerData, callbacks = {}) {
        super(); // sets up unsubscribers and base expander (destroyed below)

        // Peer identity
        this.peerId   = peerData.id;
        this.peerName = peerData.name;
        this._onEdit   = callbacks.onEdit   || (() => {});
        this._onDelete = callbacks.onDelete || (() => {});

        // Per-peer isolated storage keys
        this._key           = `peer_intelligence_${this.peerId}`;
        this._backupKey     = `peer_intelligence_backup_${this.peerId}`;
        this._selectionsKey = `peer_selected_integrations_${this.peerId}`;

        // Re-bind handlers to use peer storage keys (overwrites Profile's hardcoded ones)
        this.handleHarvest = async () => await this.executeSiege('PROFILE_GENERATE');
        this.handleUpdate  = async () => await this.executeSiege('PROFILE_UPDATE', await Storage.get(this._key));
        this.handleClear   = async () => {
            await Storage.set({ [this._key]: null, [this._backupKey]: null });
            State.set(this._key, null);
            await this.syncSubtitle();
            await this.hydrateAndRenderBody();
            log('DATA', 'PEER_PROFILE_CLEARED', { peerId: this.peerId });
        };
        this.handleUndo = async () => {
            const backup = await Storage.get(this._backupKey);
            if (backup) {
                await Storage.set({ [this._key]: backup, [this._backupKey]: null });
                State.set(this._key, backup);
                log('DATA', 'PEER_PROFILE_REVERTED', { peerId: this.peerId });
                await this.syncSubtitle();
                await this.hydrateAndRenderBody();
            }
        };

        // Replace Profile's expander with a peer-scoped one
        if (this.expander && typeof this.expander.destroy === 'function') this.expander.destroy();
        this.expander = new Expander({
            title: this.peerName,
            id: `exp-peer-${this.peerId}`,
            isExpanded: false,
            groupId: 'intelligence-peers',
            isDominantConfig: true,
            onToggle: async (isExpanded) => {
                State.set('is_peer_expanded', isExpanded);
                if (isExpanded) await this.mountAndRefreshDropdown();
            }
        });

        // Force fresh render
        this.node = null;
        this._buttonsAdded = false;

        log('LIFECYCLE', 'PEER_PROFILE_CONSTRUCTED', { peerId: this.peerId, name: this.peerName });
    }

    // Subtitle = peer name always (ignores harvested profile_name)
    async syncSubtitle() {
        // Title IS the peer name — subtitle intentionally empty to avoid duplication
    }

    // Full override — reads from this._key / this._backupKey
    async hydrateAndRenderBody() {
        if (!this.dynamicWrapper) return;

        const data   = await Storage.get(this._key);
        const backup = await Storage.get(this._backupKey);

        this.dynamicWrapper.innerHTML = '';

        if (this.expander && this.expander.isExpanded) {
            await this.mountAndRefreshDropdown();
        }

        if (!data || Object.keys(data).length === 0) {
            const harvestBtn = dom.create('button', 'profile-actions__harvest w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow text-sm font-medium transition-colors', {
                innerText: Language.text('BTN_HARVEST') || 'Harvest Peer Profile',
                onclick: this.handleHarvest
            });
            this.dynamicWrapper.appendChild(harvestBtn);
        } else {
            const jsonContainer = dom.create('div', 'w-full bg-gray-900 rounded border border-gray-700 p-2 json-prime-container');

            if (this.primeManifold && typeof this.primeManifold.destroy === 'function') {
                this.primeManifold.destroy();
            }
            this.primeManifold = new PrimeManifold(jsonContainer, (newState) => {
                Storage.set({ [this._key]: newState });
                State.set(this._key, newState);
            }, { initialData: data, copyLabel: 'COPY JSON' });

            this.dynamicWrapper.appendChild(jsonContainer);

            const actionGroup = dom.create('div', 'profile-actions flex gap-2 mt-2');

            if (backup) {
                actionGroup.appendChild(dom.create('button', 'flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded shadow text-sm font-medium transition-colors', {
                    innerText: Language.text('BTN_UNDO') || 'Undo',
                    onclick: this.handleUndo
                }));
            }
            actionGroup.appendChild(dom.create('button', 'flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow text-sm font-medium transition-colors', {
                innerText: Language.text('BTN_UPDATE') || 'Update Profile',
                onclick: this.handleUpdate
            }));
            actionGroup.appendChild(dom.create('button', 'flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded shadow text-sm font-medium transition-colors', {
                innerText: Language.text('BTN_CLEAR') || 'Clear Profile',
                onclick: this.handleClear
            }));

            this.dynamicWrapper.appendChild(actionGroup);
        }
    }

    // Full override — reads/writes this._key / this._backupKey
    async executeSiege(templateId, existingData = null) {
        const permitted = await PermissionBroker.ensurePermission();
        if (!permitted) {
            log('UI', 'PEER_HARVEST_ABORTED_NO_PERMISSION');
            return;
        }
        try {
            State.set('is_harvesting_profile', true);
            State.set('is_transmuting', true);

            const context_data = await Scraper.extract().catch(() => ({ ctrl_a_text: 'Fallback context.', context_structure: '' }));
            const context_block = PromptTemplates.get('CONTEXT_DATA', context_data).content;
            const template = PromptTemplates.get(templateId, { context: context_block, existing: existingData });

            const activeNodes = (this.integrationsDropdown && typeof this.integrationsDropdown.getSelectedOptions === 'function')
                ? this.integrationsDropdown.getSelectedOptions()
                : (this.integrationsDropdown ? this.integrationsDropdown.state.selectedNodes : []);

            if (activeNodes && activeNodes.length > 0) {
                const { chars, archetypes } = await this.flattenSelectedIntegrations(activeNodes);
                const isUpdate = templateId === 'PROFILE_UPDATE';
                if (chars.length > 0)      template.content += "\n\n" + PromptTemplates.get('PROFILE_INTEGRATION_CHAR', { chars, isUpdate }).content;
                if (archetypes.length > 0) template.content += "\n\n" + PromptTemplates.get('PROFILE_INTEGRATION_ARCH', { archetypes, isUpdate }).content;
                log('AI', 'PEER_INTEGRATIONS_PROMPT_COMPILED', { peerId: this.peerId, len: template.content.length });
            }

            log('DATA', 'PROMPT_RAW', template.content);

            const raw_json = await LLM.transmute(template.content);

            let clean_json = existingData || {};
            try {
                const match = raw_json.match(/\[[\s\S]*\]/);
                const parsed = match ? JSON.parse(match[0]) : JSON.parse(raw_json);
                clean_json = Array.isArray(parsed) ? (parsed[0] || {}) : parsed;
            } catch(e) { log('DATA', 'JSON_PARSE_ERROR', e); }

            if (existingData && templateId === 'PROFILE_UPDATE') {
                await Storage.set({ [this._backupKey]: existingData });
                clean_json = this.mergeProfileData(existingData, clean_json);
            } else if (Array.isArray(clean_json)) {
                clean_json = clean_json[0] || {};
            }

            await Storage.set({ [this._key]: clean_json });
            State.set(this._key, clean_json);
            log('DATA', 'PEER_STATE_HYDRATED', { peerId: this.peerId, len: JSON.stringify(clean_json).length });
            await this.syncSubtitle();
            await this.hydrateAndRenderBody();
        } catch (e) {
            log('AI', `PEER_${templateId}_ERROR`, e);
        } finally {
            State.set('is_harvesting_profile', false);
            State.set('is_transmuting', false);
        }
    }

    // Full override — sets up Dropdown with this._selectionsKey in onChange
    async mountAndRefreshDropdown() {
        if (!this.integrationsContainer) return;

        if (!document.body.contains(this.integrationsContainer)) {
            await new Promise(r => setTimeout(r, 50));
            if (!document.body.contains(this.integrationsContainer)) return;
        }

        if (!this.integrationsDropdown) {
            if (!document.getElementById('profile-dropdown-overrides')) {
                const style = dom.create('style', '', { id: 'profile-dropdown-overrides' });
                style.innerHTML = `
                    .profile-integrations-wrapper .dropdown__trigger { background-color: #18181b !important; color: #e4e4e7 !important; border-color: rgba(255,255,255,0.1) !important; }
                    .profile-integrations-wrapper .dropdown__caret { opacity: 0.6; }
                    .profile-integrations-menu { background-color: #1f1f22 !important; border-color: rgba(255,255,255,0.1) !important; box-shadow: 0 4px 15px rgba(0,0,0,0.5) !important; }
                    .profile-integrations-menu .dropdown__item { color: #e4e4e7 !important; position: relative; padding-right: 28px; }
                    .profile-integrations-menu .dropdown__item:hover { background-color: rgba(255,255,255,0.05) !important; }
                    .profile-integrations-menu .dropdown__group-label { color: #a1a1aa !important; font-size: 11px !important; text-transform: uppercase; letter-spacing: 0.05em; }
                    .profile-integrations-menu .is-selected { background-color: rgba(99,102,241,0.25) !important; color: #a5b4fc !important; font-weight: 500; }
                    .profile-integrations-menu .is-selected:not(:has(.dropdown__checkbox))::after { content: '✓'; position: absolute; right: 12px; font-weight: 900; color: #a5b4fc; }
                    .profile-integrations-menu [data-id="action_clear_selections"] { border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 4px; padding-bottom: 8px; color: #a1a1aa !important; justify-content: center; }
                    .profile-integrations-menu [data-id="action_clear_selections"]:hover { color: #f87171 !important; background-color: rgba(248,113,113,0.1) !important; }
                `;
                document.head.appendChild(style);
            }

            this.integrationsDropdown = new Dropdown(this.integrationsContainer, {
                defaultTriggerText: Language.text('INTEGRATIONS_DROPDOWN_PLACEHOLDER') || "Select integrations",
                portal: true
            });

            // onSelect: scheme dominance + upward consistency (identical logic to Profile)
            this.integrationsDropdown.onSelect = (event) => {
                if (event.id === 'action_clear_selections') {
                    this.integrationsDropdown.clearAllSelections();
                    this.integrationsDropdown.closeMenu();
                    return;
                }
                if (event.parentId === 'schemes') {
                    const scheme = (this.lastFetchedSchemes || []).find(s => s.id === event.id);
                    if (this.integrationsDropdown.options['chars'])      this.integrationsDropdown.options['chars'].clearSelection(true);
                    if (this.integrationsDropdown.options['archetypes'])  this.integrationsDropdown.options['archetypes'].clearSelection(true);
                    if (scheme) {
                        const el = scheme.elements || scheme.snapshot || {};
                        (el.chars || el.char || el.characters || []).forEach(id => this.integrationsDropdown.selectById(id, true));
                        (el.archetypes || el.archetype || []).forEach(id => this.integrationsDropdown.selectById(id, true));
                        log('LOGIC', 'PEER_SCHEME_TRIGGER_APPLIED', { peerId: this.peerId, scheme: scheme.name });
                    }
                    if (typeof this.integrationsDropdown.updateDOMSelectionState === 'function') this.integrationsDropdown.updateDOMSelectionState();
                    if (typeof this.integrationsDropdown.onChange === 'function') this.integrationsDropdown.onChange();
                } else if (event.parentId === 'chars' || event.parentId === 'archetypes') {
                    const selected        = this.integrationsDropdown.getSelectedOptions();
                    const selectedCharIds = selected.filter(n => n.parentId === 'chars').map(n => n.id);
                    const selectedArchIds = selected.filter(n => n.parentId === 'archetypes').map(n => n.id);
                    let matchedScheme = null;
                    for (const s of (this.lastFetchedSchemes || [])) {
                        const el = s.elements || s.snapshot || {};
                        const sC = (el.chars || el.char || el.characters || []).map(String);
                        const sA = (el.archetypes || el.archetype || []).map(String);
                        if (sC.length === selectedCharIds.length && sA.length === selectedArchIds.length &&
                            sC.every(id => selectedCharIds.includes(id)) && sA.every(id => selectedArchIds.includes(id))) {
                            matchedScheme = s; break;
                        }
                    }
                    if (this.integrationsDropdown.options['schemes']) this.integrationsDropdown.options['schemes'].clearSelection(true);
                    if (matchedScheme) this.integrationsDropdown.selectById(matchedScheme.id, true);
                    if (typeof this.integrationsDropdown.updateDOMSelectionState === 'function') this.integrationsDropdown.updateDOMSelectionState();
                    if (typeof this.integrationsDropdown.onChange === 'function') this.integrationsDropdown.onChange();
                }
            };

            // onChange: writes to peer-specific selections key (KEY DIFFERENCE from Profile)
            this.integrationsDropdown.onChange = () => {
                let parts = [];
                if (typeof this.integrationsDropdown.levelEntities === 'function') {
                    this.integrationsDropdown.levelEntities(1).forEach(entity => {
                        if (entity.id !== 'action_clear_selections' && entity.id !== 'schemes' && typeof entity.selectionCount === 'function') {
                            const count = entity.selectionCount();
                            if (count > 0) parts.push(`${entity.option}:(${count})`);
                        }
                    });
                }
                const activeCharsCount = (this.lastFetchedChars || []).filter(c => c.isActive || c.active || c.enabled).length;
                const activeArchsCount = (this.lastFetchedArchs || []).filter(a => a.isActive || a.active || a.enabled).length;
                if (parts.length > 0) {
                    this.integrationsDropdown.setTriggerText(parts.join(', '));
                } else if (!(activeCharsCount > 0 || activeArchsCount > 0)) {
                    this.integrationsDropdown.setTriggerText(Language.text('INTEGRATIONS_NO_ACTIVE_INTEGRATIONS') || "<i>no active integrations</i>");
                } else {
                    this.integrationsDropdown.setTriggerText(this.integrationsDropdown.defaultTriggerText || Language.text('INTEGRATIONS_DROPDOWN_PLACEHOLDER') || "Select integrations");
                }
                const currentSelections = this.integrationsDropdown.getSelectedOptions()
                    .map(opt => opt.id).filter(id => id !== 'action_clear_selections');
                const clearOpt = this.integrationsDropdown.menu?.querySelector('[data-id="action_clear_selections"]');
                if (clearOpt) clearOpt.style.display = currentSelections.length > 0 ? 'flex' : 'none';
                Storage.set({ [this._selectionsKey]: currentSelections });
                log('DATA', 'PEER_INTEGRATIONS_STATE_SAVED', { peerId: this.peerId, count: currentSelections.length });
            };
        }

        await this.refreshIntegrationsDropdown();
    }

    // Full override — restores from this._selectionsKey (KEY DIFFERENCE from Profile)
    async refreshIntegrationsDropdown() {
        try {
            const chars   = this.sanitizeToArray(await this.fetchIntegrationList('chars'));
            const archs   = this.sanitizeToArray(await this.fetchIntegrationList('archetypes'));
            const schemes = this.sanitizeToArray(await this.fetchIntegrationList('schemes'));

            this.lastFetchedChars   = chars;
            this.lastFetchedArchs   = archs;
            this.lastFetchedSchemes = schemes;

            // [V16] List ALL characters/archetypes (not only active) — full roster is selectable.
            const totalEntities = chars.length + archs.length + schemes.length;

            log('LOGIC', 'PEER_DROPDOWN_REFRESH', { peerId: this.peerId, chars: chars.length, archs: archs.length, schemes: schemes.length });

            if (!this.integrationsDropdown) return;

            if (!(chars.length > 0 || archs.length > 0)) {
                if (typeof this.integrationsDropdown.setTriggerText === 'function')
                    this.integrationsDropdown.setTriggerText(Language.text('INTEGRATIONS_NO_ACTIVE_INTEGRATIONS') || "<i>no active integrations</i>");
            }
            if (typeof this.integrationsDropdown.setDisabled === 'function')
                this.integrationsDropdown.setDisabled(totalEntities === 0);

            const empty = { option: Language.text('INTEGRATIONS_EMPTY_GROUP') || "None available", id: "empty", disabled: true };
            this.integrationsDropdown.refreshStructure([
                { option: "clear selections", html: "<i>clear selections</i>", id: "action_clear_selections" },
                { option: Language.text('INTEGRATIONS_CHARS_LABEL')      || "Characters",  id: "chars",      selection: "multiple", options: chars.length ? chars.map(c => ({ option: c.name, id: c.id })) : [{ ...empty, id: "empty-chars" }] },
                { option: Language.text('INTEGRATIONS_ARCHETYPES_LABEL') || "Archetypes",  id: "archetypes", selection: "multiple", options: archs.length ? archs.map(a => ({ option: a.name, id: a.id })) : [{ ...empty, id: "empty-archs" }] },
                { option: Language.text('INTEGRATIONS_SCHEMES_LABEL')    || "Schemes",     id: "schemes",    selection: "single",   options: schemes.length     ? schemes.map(s => ({ option: s.name, id: s.id }))     : [{ ...empty, id: "empty-schemes" }] }
            ]);

            if (this.integrationsDropdown.menu) this.integrationsDropdown.menu.classList.add('profile-integrations-menu');

            // Restore peer-specific dropdown selections
            const savedSelections = await Storage.get(this._selectionsKey) || [];
            const tempOnChange = this.integrationsDropdown.onChange;
            this.integrationsDropdown.onChange = null;
            this.integrationsDropdown.clearAllSelections();
            savedSelections.forEach(id => this.integrationsDropdown.selectById(id, true));
            this.integrationsDropdown.onChange = tempOnChange;
            if (typeof this.integrationsDropdown.onChange === 'function') this.integrationsDropdown.onChange();
        } catch (e) {
            log('DATA', 'PEER_INTEGRATIONS_FALLBACK', e.message || 'Failed');
        }
    }

    // Calls Profile.render() (uses overridden this.expander), then injects edit+delete header buttons
    render() {
        const node = super.render();

        if (!this._buttonsAdded && this.expander && this.expander.header) {
            this._buttonsAdded = true;

            const delBtn = dom.create('button', 'menu__item ml-1 z-10 relative text-white/40 hover:text-red-400 transition-colors', {
                innerHTML: ICONS.TRASH,
                title: 'Delete peer',
                onclick: (e) => { e.stopPropagation(); this._onDelete(); }
            });
            const editBtn = dom.create('button', 'menu__item ml-1 z-10 relative text-white/40 hover:text-[var(--accent)] transition-colors', {
                innerHTML: ICONS.EDIT,
                title: 'Edit peer name',
                onclick: (e) => { e.stopPropagation(); this._onEdit(); }
            });

            // Insert before chevron icon — same pattern as Persona.js manageBtn
            if (this.expander.iconEl) {
                this.expander.header.insertBefore(delBtn, this.expander.iconEl);
                this.expander.header.insertBefore(editBtn, delBtn);
            }
        }

        return node;
    }

    destroy() {
        super.destroy();
        log('LIFECYCLE', 'PEER_PROFILE_DESTROYED', { peerId: this.peerId });
    }
}

// ─── Peers ───────────────────────────────────────────────────────────────────
// Manages the ordered list of peer records {id, name} and their PeerProfile instances.

class Peers {
    constructor() {
        this.peerRecords   = [];
        this.peerInstances = {}; // { [id]: PeerProfile }

        this.handleCreateClicked = () => {
            log('LOGIC', 'CREATE_PEER_SIGNAL_RECEIVED');
            this.mountEditorOverlay();
        };
        window.addEventListener('CREATE_PEER_CLICKED', this.handleCreateClicked);
        // [V16] Refresh peer integration dropdown when a bundle mutates substrate while mounted.
        this._bundleSync = () => { if (this.integrationsDropdown) this.refreshIntegrationsDropdown(); };
        window.addEventListener('INTEGRATIONS_DATA_CHANGED', this._bundleSync);

        this.expander = new Expander({
            id: 'exp-peers',
            title: 'Peers',
            isDominantConfig: true,
            groupId: 'intelligence-sub',
            onToggle: (isExpanded) => { State.set('is_managing_peers', isExpanded); }
        });
    }

    async init() {
        const stored = await Storage.get('peers') || [];
        this.peerRecords = stored;
        this.renderList();
    }

    async savePeerRecord(name, id = null) {
        if (id) {
            this.peerRecords = this.peerRecords.map(r => r.id === id ? { ...r, name } : r);
            // Destroy old instance — new one with updated name created in renderList()
            if (this.peerInstances[id]) {
                this.peerInstances[id].destroy();
                delete this.peerInstances[id];
            }
        } else {
            this.peerRecords.push({ id: `peer-${Date.now()}`, name });
        }
        await Storage.set({ peers: this.peerRecords });
        log('DATA', 'PEER_RECORD_SAVED', { count: this.peerRecords.length });
        this.renderList();
    }

    async deleteRecord(id) {
        const confirmed = await Confirmation.show(
            Language.text('TITLE_DELETE') || 'Delete Peer',
            'Are you sure you want to delete this peer and all its harvested data?'
        );
        if (!confirmed) return;

        this.peerRecords = this.peerRecords.filter(r => r.id !== id);
        await Storage.set({
            peers: this.peerRecords,
            [`peer_intelligence_${id}`]: null,
            [`peer_intelligence_backup_${id}`]: null,
            [`peer_selected_integrations_${id}`]: null
        });

        if (this.peerInstances[id]) {
            this.peerInstances[id].destroy();
            delete this.peerInstances[id];
        }
        log('DATA', 'PEER_RECORD_DELETED', { id });
        window.dispatchEvent(new CustomEvent('PEER_DELETED', { detail: { type: 'peer', id } }));
        this.renderList();
    }

    mountEditorOverlay(id = null) {
        const record = id ? this.peerRecords.find(r => r.id === id) : null;

        const editor = new Editor({
            caption: id ? 'EDIT PEER' : 'CREATE PEER',
            captionClass: 'input-label text-[10px]',
            saveText: Language.text('BTN_SAVE') || 'Save',
            cancelText: Language.text('BTN_CANCEL') || 'Cancel',
            onSave: async (data) => {
                const val = data.peerName?.trim();
                if (val) await this.savePeerRecord(val, id);
                else throw new Error('Peer name cannot be empty');
            },
            onCancel: () => {}
        });

        editor.add('input', {
            id: 'peerName',
            placeholder: 'Peer name',
            value: record ? record.name : '',
            className: 'alchimist-input w-full text-sm p-3 bg-black/20 focus:outline-none',
            inputType: 'text'
        });

        editor.show();
    }

    renderList() {
        // [REQ-4] Single-writer volatile mirror of the peer roster. Footer's count-gate and the
        // ⚗ Unseal reconciler read State.get('peers'); Storage stays the awaited authoritative
        // store. Mirror BEFORE the container guard so init/save/delete all converge here.
        // Pass a COPY, not the live reference. savePeerRecord() creates the first peer via an
        // in-place Array.push, so State._data['peers'] (which would hold this same reference)
        // is already mutated by the time set() runs — its deep-equality guard then sees "no
        // change", suppresses notify(), and the Footer 'peers' subscriber never re-resolves,
        // so the ⚗ Unseal cover never appears on '+ create peer'. A fresh array keeps the
        // guard's before/after comparison honest across push/map/filter mutation paths.
        State.set('peers', [...this.peerRecords]);
        if (!this.listContainer) return;
        this.listContainer.innerHTML = '';

        if (this.peerRecords.length === 0) {
            this.listContainer.appendChild(dom.create('div', 'text-xs text-[var(--text-secondary)] p-2 text-center italic', {
                innerText: 'No peers defined.'
            }));
            if (this.expander) this.expander.updateSubtitle('');
            this.onChanged?.();
            return;
        }

        this.peerRecords.forEach(record => {
            if (!this.peerInstances[record.id]) {
                this.peerInstances[record.id] = new PeerProfile(record, {
                    onEdit:   () => this.mountEditorOverlay(record.id),
                    onDelete: () => this.deleteRecord(record.id)
                });
            }
            // Update name in case it changed
            this.peerInstances[record.id].peerName = record.name;
            this.listContainer.appendChild(this.peerInstances[record.id].render());
        });

        // Update Peers expander subtitle with count
        if (this.expander) {
            const count = this.peerRecords.length;
            this.expander.updateSubtitle(count > 0 ? `Peers (${count})` : '');
        }
        this.onChanged?.();
    }

    destroy() {
        window.removeEventListener('CREATE_PEER_CLICKED', this.handleCreateClicked);
        if (this._bundleSync) window.removeEventListener('INTEGRATIONS_DATA_CHANGED', this._bundleSync);
        Object.values(this.peerInstances).forEach(inst => inst.destroy());
        if (this.expander) this.expander.destroy();
    }
}

// ─── Intents ──────────────────────────────────────────────────────────────────
// Click-to-edit pattern (Imperative.js), delete-only button on row.

class Intents {
    constructor() {
        this.items     = [];
        this.editingId = null;

        this.handleCreateClicked = () => {
            log('LOGIC', 'CREATE_INTENT_SIGNAL_RECEIVED');
            this.mountEditorOverlay();
        };
        window.addEventListener('CREATE_INTENT_CLICKED', this.handleCreateClicked);

        this.expander = new Expander({
            id: 'exp-intents',
            title: 'Intents',
            isDominantConfig: true,
            groupId: 'intelligence-sub',
            onToggle: (isExpanded) => { State.set('is_managing_intents', isExpanded); }
        });
    }

    async init() {
        // [V16] Seed DEFAULT_INTENTS on genuine first run so the default bundle's intents
        // surface in Features -> Intelligence -> Intents (parity with chars/archetypes).
        let stored = await Storage.get('intents');
        if (!stored || stored.length === 0) {
            const isInit = await Storage.get('is_initialized');
            const seeded = await Storage.get('bundles_default_seeded');
            if (!isInit || !seeded) {
                stored = JSON.parse(JSON.stringify(DEFAULT_INTENTS));
                await Storage.set({ intents: stored });
            } else {
                stored = [];
            }
        }
        this.items = stored || [];
        this.refresh();
    }

    async saveItem(text) {
        if (this.editingId) {
            this.items = this.items.map(i => i.id === this.editingId ? { ...i, text } : i);
        } else {
            this.items.push({ id: `intent-${Date.now()}`, text });
        }
        await Storage.set({ intents: this.items });
        log('DATA', 'INTENT_SAVED', { count: this.items.length });
        this.editingId = null;
        this.refresh();
    }

    async deleteItem(id) {
        const confirmed = await Confirmation.show(
            Language.text('TITLE_DELETE') || 'Delete Intent',
            'Are you sure you want to delete this intent?'
        );
        if (confirmed) {
            this.items = this.items.filter(i => i.id !== id);
            await Storage.set({ intents: this.items });
            log('DATA', 'INTENT_DELETED', { id });
            window.dispatchEvent(new CustomEvent('INTENT_DELETED', { detail: { type: 'intent', id } }));
            this.refresh();
        }
    }

    mountEditorOverlay(item = null) {
        this.editingId = item ? item.id : null;

        const editor = new Editor({
            caption: item ? 'EDIT INTENT' : 'CREATE INTENT',
            captionClass: 'input-label text-[10px]',
            saveText: Language.text('BTN_SAVE') || 'Save',
            cancelText: Language.text('BTN_CANCEL') || 'Cancel',
            onSave: async (data) => {
                const val = data.intentText?.trim();
                if (val) await this.saveItem(val);
                else throw new Error('Intent description cannot be empty');
            },
            onCancel: () => { this.editingId = null; }
        });

        editor.add('textarea', {
            id: 'intentText',
            placeholder: 'Intent description...',
            value: item ? item.text : '',
            className: 'alchimist-input w-full resize-none text-sm p-3 bg-black/20 focus:outline-none min-h-[200px]'
        });

        editor.show();
    }

    renderList() {
        const frag = document.createDocumentFragment();
        if (this.items.length === 0) {
            frag.appendChild(dom.create('div', 'text-xs text-[var(--text-secondary)] p-2 text-center italic', {
                innerText: 'No intents defined.'
            }));
            return frag;
        }
        this.items.forEach(item => {
            const row = dom.create('div', 'flex items-center justify-between gap-3 p-2 bg-white/5 rounded border border-white/10 group cursor-pointer hover:bg-white/10 mb-1', {
                onclick: () => this.mountEditorOverlay(item)
            });
            const contentContainer = dom.create('div', 'flex-1 overflow-hidden min-w-0');
            contentContainer.appendChild(dom.create('div', 'text-xs text-text-secondary line-clamp-2 leading-tight', { innerText: item.text }));
            const delBtn = dom.create('button', 'p-1 hover:text-red-500 transition-colors flex-shrink-0', { innerHTML: ICONS.TRASH });
            delBtn.onclick = (e) => { e.stopPropagation(); this.deleteItem(item.id); };
            row.appendChild(contentContainer);
            row.appendChild(delBtn);
            frag.appendChild(row);
        });
        return frag;
    }

    refresh() {
        if (this.listContainer) {
            this.listContainer.innerHTML = '';
            this.listContainer.appendChild(this.renderList());
        }
        // Update Intents expander subtitle with count
        if (this.expander) {
            const count = this.items.length;
            this.expander.updateSubtitle(count > 0 ? `Intents (${count})` : '');
        }
        this.onChanged?.();
    }

    destroy() {
        window.removeEventListener('CREATE_INTENT_CLICKED', this.handleCreateClicked);
        if (this.expander) this.expander.destroy();
    }
}

// ─── Intelligence Orchestrator ────────────────────────────────────────────────

export class Intelligence {
    constructor() {
        this.peers   = new Peers();
        this.intents = new Intents();

        this.expander = new Expander({
            id: 'exp-intelligence',
            title: 'Intelligence',
            isDominantConfig: true,
            groupId: 'features-main'
        });

        this.container = dom.create('div', 'intelligence-wrapper w-full mt-4 min-w-0');
    }

    // Syncs the outer Intelligence expander subtitle: "Peers (N) & Intents (M)"
    _syncOuterSubtitle() {
        if (!this.expander) return;
        const pCount = this.peers.peerRecords.length;
        const iCount = this.intents.items.length;
        const parts  = [];
        if (pCount > 0) parts.push(`Peers (${pCount})`);
        if (iCount > 0) parts.push(`Intents (${iCount})`);
        this.expander.updateSubtitle(parts.join(' & '));
    }

    render() {
        const content = dom.create('div', 'flex flex-col space-y-1');

        const peersContainer = dom.create('div', 'integration-list w-full', { id: 'peers-list' });
        this.peers.listContainer = peersContainer;
        content.appendChild(this.peers.expander.render(peersContainer));

        const intentsContainer = dom.create('div', 'integration-list w-full', { id: 'intents-list' });
        this.intents.listContainer = intentsContainer;
        content.appendChild(this.intents.expander.render(intentsContainer));

        Promise.all([this.peers.init(), this.intents.init()]).then(() => {
            // Wire outer subtitle sync as onChange callback for both sub-managers
            this.peers.onChanged   = () => this._syncOuterSubtitle();
            this.intents.onChanged = () => this._syncOuterSubtitle();
            this._syncOuterSubtitle();
            log('LOGIC', 'INTELLIGENCE_LIFECYCLE_SETTLED', {
                peers:   this.peers.peerRecords.length,
                intents: this.intents.items.length
            });
        });

        this.container.appendChild(this.expander.render(content));
        return this.container;
    }

    destroy() {
        this.peers.destroy();
        this.intents.destroy();
        if (this.expander) this.expander.destroy();
    }
}