/**
 * @file components/core/Bundles.js
 * @purpose UI: Bundle provisioning area. Apply/revoke default & curated substrate bundles.
 * @standard Id-overlay over personas/feature_chars/feature_archetypes/intents. Cascade is
 *           SELF-SUFFICIENT: because consuming components (Preset/Char/Archetype/Scheme) may be
 *           unmounted when revoke runs from the Bundles tab, Bundles performs the storage mutation
 *           AND directly cleans dependent presets/peer-selections itself, in addition to dispatching
 *           the native deletion signals (which mounted observers also honor).
 */
import { dom } from '../../utils/dom.js';
import { Language } from '../../services/Language.js';
import { Storage } from '../../services/Storage.js';
import { State } from '../../services/State.js';
import { License } from '../../services/License.js';
import { log } from '../../utils/logger.js';
import { Confirmation } from '../reusable/Confirmation.js';
import { BUNDLES } from '../../utils/assets.js';

// Per-category indicator styling — mirrors Forge/Preset.js inline color+border vocabulary.
// Personas inherit Preset's persona color exactly. Chars/archetypes/intents each get one
// original single-category color.
const STRIP_STYLE = {
    persona:   'color: var(--color-persona, #a78bfa); border: 1px solid rgba(167,139,250,0.3);',
    char:      'color: var(--color-bundle-char, #2dd4bf); border: 1px solid rgba(45,212,191,0.3);',
    archetype: 'color: var(--color-bundle-arch, #f59e0b); border: 1px solid rgba(245,158,11,0.3);',
    intent:    'color: var(--color-bundle-intent, #818cf8); border: 1px solid rgba(129,140,248,0.4);'
};

export class Bundles {
    constructor() {
        this.bundles = BUNDLES || [];
        this.appliedIds = [];
        this.container = dom.create('div', 'bundles-area flex flex-col flex-1 min-h-0 w-full relative', { id: 'bundles-container' });
        window.__alchimist_bundles = this; // debug/global per architecture rule
        this._onLicenseChange = () => { if (this._scroll) this._renderCards(); };
        window.addEventListener('LICENSE_STATUS_CHANGED', this._onLicenseChange);
    }

    static isDefault(bundle) { return bundle && bundle.id === 'bundle-default'; }
    isApplied(id) { return this.appliedIds.includes(id); }

    // Normalize a bundle intent into the live store shape ({id,text}). Bundle intents come in two
    // shapes: curated tribes use {id,name,content,isActive}; the default bundle references
    // DEFAULT_INTENTS which are already {id,text}. Resolve text from any of them.
    static _toIntentRecord(i) {
        return { id: i.id, text: i.text || i.content || i.name || '' };
    }
    // Display label for an intent indicator — same dual-shape resolution.
    static _intentLabel(i) { return i.text || i.content || i.name || ''; }

    async _hydrate() {
        const stored = await Storage.get('applied_bundle_ids');
        this.appliedIds = Array.isArray(stored) ? stored : [];
        State.set('applied_bundle_ids', this.appliedIds);
    }

    render() {
        this.container.innerHTML = '';
        const scroll = dom.create('div', 'bundles-scroll flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-3 flex flex-col gap-3 w-full min-w-0');
        this.container.appendChild(scroll);
        this._scroll = scroll;
        this._hydrate().then(() => this._renderCards());
        return this.container;
    }

    _renderCards() {
        if (!this._scroll) return;
        this._scroll.innerHTML = '';
        this.bundles.forEach(bundle => this._scroll.appendChild(this._renderCard(bundle)));
        log('UI', 'BUNDLE_CARDS_RENDERED', { count: this.bundles.length, applied: this.appliedIds.length });
    }

    _renderCard(bundle) {
        const applied = this.isApplied(bundle.id);
        // .bundle-card-wrap is the hover host (mirrors .category-expander-wrap); the cover lives
        // inside it so it overlays the whole card and reveals on wrap:hover.
        const wrap = dom.create('div', `bundle-card-wrap relative w-full min-w-0 ${applied ? '' : 'bundle-card--unapplied'}`);
        wrap.dataset.id = bundle.id;
        const card = dom.create('div', 'bundle-card border border-white/10 rounded-lg p-4 bg-white/5 w-full min-w-0');

        card.appendChild(dom.create('div', 'bundle-card__name text-sm font-bold text-text-primary mb-2 break-words', { innerText: bundle.name }));

        if (!Bundles.isDefault(bundle)) {
            if (bundle.aesthetic) card.appendChild(this._field(Language.text('LABEL_BUNDLE_AESTHETIC'), bundle.aesthetic));
            if (bundle.coreVulnerability) card.appendChild(this._field(Language.text('LABEL_BUNDLE_VULNERABILITY'), bundle.coreVulnerability));
        }

        card.appendChild(this._strip(Language.text('BUNDLE_LABEL_PERSONAS'),   bundle.personas,   'persona',   p => p.name));
        card.appendChild(this._strip(Language.text('BUNDLE_LABEL_CHARS'),      bundle.characters, 'char',      c => c.name));
        card.appendChild(this._strip(Language.text('BUNDLE_LABEL_ARCHETYPES'), bundle.archetypes, 'archetype', a => a.name));
        card.appendChild(this._strip(Language.text('BUNDLE_LABEL_INTENTS'),    bundle.intents,    'intent',    Bundles._intentLabel));

        wrap.appendChild(card);
        // [PREMIUM] Default substrate: free users get no cover (immutable, always applied);
        // premium users get the cover so they can revoke it and re-apply if needed.
        if (!Bundles.isDefault(bundle) || License.isPremium()) wrap.appendChild(this._cover(bundle, applied));
        return wrap;
    }

    _field(label, value) {
        const f = dom.create('div', 'bundle-card__field mb-2');
        f.appendChild(dom.create('div', 'text-[10px] uppercase tracking-wide text-text-secondary mb-0.5', { innerText: label }));
        f.appendChild(dom.create('div', 'text-xs text-white/60 leading-snug break-words', { innerText: value }));
        return f;
    }

    // Full names, no truncation. Native CSS flex-wrap settles geometry — no JS slicing.
    // Each indicator carries the per-category inline color + border (Preset vocabulary).
    _strip(label, items, type, labelOf) {
        const block = dom.create('div', 'bundle-strip-block mb-2');
        block.appendChild(dom.create('div', 'text-[10px] uppercase tracking-wide text-text-secondary mb-1', { innerText: label }));
        const strip = dom.create('div', `bundle-indicator-strip bundle-indicator-strip--${type}`);
        (items || []).forEach(it => {
            const span = dom.create('span', 'protocol-indicator bundle-indicator', { innerText: (labelOf(it) || '').toString() });
            span.setAttribute('style', STRIP_STYLE[type] || '');
            strip.appendChild(span);
        });
        block.appendChild(strip);
        return block;
    }

    // Cover overlay — mirrors .category-assign-cover: absolute, hidden, centered, shown on
    // .bundle-card-wrap:hover. Single centered action button at the TOP-center.
    _cover(bundle, applied) {
        const cover = dom.create('div', 'bundle-card__cover');
        // [PREMIUM] Curated bundles require premium to apply; the action becomes a ⚗ Unseal gate.
        const premiumApply = !applied && !Bundles.isDefault(bundle) && !License.isPremium();
        const action = dom.create('button', 'bundle-card__action', {
            innerText: applied
                ? Language.text('BTN_REVOKE_BUNDLE')
                : (premiumApply ? (Language.text('BTN_PREMIUM') || '⚗ Unseal') : Language.text('BTN_APPLY_BUNDLE')),
            onclick: (e) => {
                e.stopPropagation();
                if (premiumApply) {
                    window.dispatchEvent(new CustomEvent('PREMIUM_GATE_OPEN', { detail: { actionId: `bundle:${bundle.id}` } }));
                    log('UI', 'PREMIUM_ACTION_BLOCKED', { actionId: `bundle:${bundle.id}` });
                    return;
                }
                log('UI', 'BUNDLE_HOVER_ACTION_SHOWN', { id: bundle.id, applied });
                if (applied) this.revokeBundle(bundle);
                else this.applyBundle(bundle);
            }
        });
        cover.appendChild(action);
        return cover;
    }

    // ── Apply: id-collision skip, atomic Storage-then-State per store ──────────
    async _mergeSkip(key, incoming) {
        const existing = (await Storage.get(key)) || [];
        const have = new Set(existing.map(x => x.id));
        let added = 0, skipped = 0;
        const next = [...existing];
        (incoming || []).forEach(it => {
            if (have.has(it.id)) { skipped++; return; }
            next.push(it); have.add(it.id); added++;
        });
        await Storage.set({ [key]: next });
        State.set(key, next);
        log('DATA', 'BUNDLE_SUBSTRATE_MERGED', { key, added, skipped });
        return next;
    }

    async applyBundle(bundle) {
        if (this.isApplied(bundle.id)) return;
        // [PREMIUM] Curated bundles require premium; default substrate is always free.
        if (!Bundles.isDefault(bundle) && !License.isPremium()) {
            window.dispatchEvent(new CustomEvent('PREMIUM_GATE_OPEN', { detail: { actionId: `bundle:${bundle.id}` } }));
            log('UI', 'PREMIUM_ACTION_BLOCKED', { actionId: `bundle:${bundle.id}` });
            return;
        }
        log('LOGIC', 'BUNDLE_APPLY_INITIATED', { id: bundle.id });

        await this._mergeSkip('personas', JSON.parse(JSON.stringify(bundle.personas || [])));
        const chars = await this._mergeSkip('feature_chars', JSON.parse(JSON.stringify(bundle.characters || [])));
        const archs = await this._mergeSkip('feature_archetypes', JSON.parse(JSON.stringify(bundle.archetypes || [])));
        await this._mergeSkip('intents', (bundle.intents || []).map(Bundles._toIntentRecord));

        State.set('chars_active_count', chars.filter(c => c.isActive).length);
        State.set('archetypes_active_count', archs.filter(a => a.isActive).length);

        this.appliedIds = [...this.appliedIds, bundle.id];
        await Storage.set({ applied_bundle_ids: this.appliedIds });
        State.set('applied_bundle_ids', this.appliedIds);

        window.dispatchEvent(new CustomEvent('BUNDLE_APPLIED', { detail: { id: bundle.id } }));
        // Authoritative refresh signal for any mounted Features/Intelligence dropdowns.
        window.dispatchEvent(new CustomEvent('INTEGRATIONS_DATA_CHANGED'));
        window.dispatchEvent(new CustomEvent('PERSONA_DATA_UPDATED'));
        log('LOGIC', 'BUNDLE_APPLY_COMPLETE', { id: bundle.id });
        this._renderCards();
    }

    // ── Revoke: id-based removal -> NATIVE deletion signals (skip missing ids) ─
    async _removeEntity(key, id, signal, type, countKey) {
        const arr = (await Storage.get(key)) || [];
        if (!arr.some(x => x.id === id)) return false; // skip-if-missing
        const next = arr.filter(x => x.id !== id);
        await Storage.set({ [key]: next });
        State.set(key, next);
        if (countKey) State.set(countKey, next.filter(x => x.isActive).length);
        window.dispatchEvent(new CustomEvent(signal, { detail: { type, id } }));
        return true;
    }

    async revokeBundle(bundle) {
        // [PREMIUM] Default substrate is revocable by premium only; mirror applyBundle's gate at
        // the commit seam so stripping the cosmetic cover can't actually revoke it on the free tier.
        if (Bundles.isDefault(bundle) && !License.isPremium()) {
            window.dispatchEvent(new CustomEvent('PREMIUM_GATE_OPEN', { detail: { actionId: `bundle:${bundle.id}` } }));
            log('UI', 'PREMIUM_ACTION_BLOCKED', { actionId: `bundle:${bundle.id}` });
            return;
        }
        const ok = await Confirmation.show(
            Language.text('TITLE_REVOKE_BUNDLE') || 'Revoke Bundle',
            Language.text('CONFIRM_REVOKE_BUNDLE') || 'Are you sure?'
        );
        if (!ok) return;
        log('LOGIC', 'BUNDLE_REVOKE_INITIATED', { id: bundle.id });
        let removed = 0, missing = 0;
        const tally = (did) => { did ? removed++ : missing++; };

        const personaIds = (bundle.personas || []).map(p => p.id);
        const charIds    = (bundle.characters || []).map(c => c.id);
        const archIds    = (bundle.archetypes || []).map(a => a.id);
        const intentIds  = (bundle.intents || []).map(i => i.id);

        for (const id of personaIds) tally(await this._removeEntity('personas', id, 'PERSONA_DELETED', 'persona'));
        for (const id of charIds)    tally(await this._removeEntity('feature_chars', id, 'CHAR_DELETED', 'char', 'chars_active_count'));
        for (const id of archIds)    tally(await this._removeEntity('feature_archetypes', id, 'ARCHETYPE_DELETED', 'archetype', 'archetypes_active_count'));
        for (const id of intentIds)  tally(await this._removeEntity('intents', id, 'INTENT_DELETED', 'intent'));
        log('DATA', 'BUNDLE_SUBSTRATE_PURGED', { id: bundle.id, removed, missingSkipped: missing });

        // [V16] Self-sufficient cleanup: the Forge/Features tabs (Preset, Scheme, peer selections)
        // are usually UNMOUNTED while the user is on the Bundles tab, so their live event listeners
        // won't fire. Perform the dependent-store cleanup directly here so revoke is complete
        // regardless of which tab is mounted. Mounted observers (if any) are idempotent on re-read.
        await this._cleanupPresets(personaIds, intentIds);
        await this._cleanupPeerSelections(charIds, archIds);

        this.appliedIds = this.appliedIds.filter(x => x !== bundle.id);
        await Storage.set({ applied_bundle_ids: this.appliedIds });
        State.set('applied_bundle_ids', this.appliedIds);

        await this._reconcileActivePersona();

        window.dispatchEvent(new CustomEvent('BUNDLE_REVOKED', { detail: { id: bundle.id } }));
        window.dispatchEvent(new CustomEvent('INTEGRATIONS_DATA_CHANGED'));
        window.dispatchEvent(new CustomEvent('PERSONA_DATA_UPDATED'));
        log('LOGIC', 'BUNDLE_REVOKE_COMPLETE', { id: bundle.id });
        this._renderCards();
    }

    // Remove presets whose snapshot references a removed persona; null out removed intents.
    // Mirrors Forge/Preset.handleIntegrityCleanup so behavior is identical when Preset is unmounted.
    async _cleanupPresets(personaIds, intentIds) {
        let presets = (await Storage.get('presets')) || [];
        if (presets.length === 0) return;
        const pset = new Set(personaIds), iset = new Set(intentIds);
        const activePresetId = await Storage.get('active_preset_id');
        let modified = false;

        const before = presets.length;
        presets = presets.filter(p => !pset.has(p.snapshot?.persona_id));
        if (presets.length !== before) modified = true;

        presets.forEach(p => {
            if (p.snapshot && iset.has(p.snapshot.intent_id)) {
                p.snapshot.peer_id = null; p.snapshot.peer = null;
                p.snapshot.intent_id = null; p.snapshot.intent = null;
                modified = true;
            }
        });

        if (modified) {
            await Storage.set({ presets });
            State.set('presets', presets);
            // Deactivate active preset if it was removed.
            if (activePresetId && !presets.some(p => p.id === activePresetId)) {
                await Storage.set({ active_preset_id: null });
                State.set('active_preset_id', null);
            }
            log('LOGIC', 'BUNDLE_PRESET_CASCADE', { remaining: presets.length });
        }
    }

    // Strip removed char/archetype ids out of every peer's saved integration selections.
    async _cleanupPeerSelections(charIds, archIds) {
        const dead = new Set([...charIds, ...archIds]);
        if (dead.size === 0) return;
        const peers = (await Storage.get('peers')) || [];
        for (const peer of peers) {
            const key = `peer_integrations_${peer.id}`;
            const sel = await Storage.get(key);
            if (Array.isArray(sel) && sel.some(id => dead.has(id))) {
                const next = sel.filter(id => !dead.has(id));
                await Storage.set({ [key]: next });
                State.set(key, next);
            }
        }
        // Profile-level (non-peer) integration selections, if present.
        const prof = await Storage.get('profile_integrations');
        if (Array.isArray(prof) && prof.some(id => dead.has(id))) {
            const next = prof.filter(id => !dead.has(id));
            await Storage.set({ profile_integrations: next });
            State.set('profile_integrations', next);
        }
    }

    // Active persona removed -> first by created_order ASC, else 'none'.
    async _reconcileActivePersona() {
        const personas = (await Storage.get('personas')) || [];
        const activeId = await Storage.get('personas_active_id');
        if (personas.some(p => p.id === activeId)) return;
        const sorted = [...personas].sort((a, b) => (Number(a.created_order) || 0) - (Number(b.created_order) || 0));
        const next = sorted[0] ? sorted[0].id : 'none';
        State.set('personas_active_id', next);
        await Storage.set({ personas_active_id: next });
        window.dispatchEvent(new CustomEvent('PERSONA_SELECTED', { detail: { id: next } }));
        log('LOGIC', 'PERSONA_ACTIVE_RECONCILED', { next });
    }

    destroy() {
        if (window.__alchimist_bundles === this) window.__alchimist_bundles = null;
        if (this._onLicenseChange) window.removeEventListener('LICENSE_STATUS_CHANGED', this._onLicenseChange);
    }
}
