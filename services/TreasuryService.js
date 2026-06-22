/**
 * @file services/TreasuryService.js
 * @purpose Sovereign substrate-translocation service. Serializes user-data
 *          into a verifiable envelope, validates incoming envelopes, and
 *          orchestrates overwrite/integrate restoration with per-domain
 *          transactional walls.
 * @standard window-global per coding_standards.md "use window-global entities
 *          for core services to allow easy debugging/testing".
 */
import { Storage } from './Storage.js';
import { State } from './State.js';
import { Language } from './Language.js';
import { Logger, log } from '../utils/logger.js';

const SNAPSHOT_SCHEMA_VERSION = 1;
const KNOWN_SCHEMAS = ['treasury.v1'];

// Top-level protocol boolean keys mirroring the protocol switchers.
const PROTOCOL_KEYS = [
    'void_source_auditor', 'emoji_enhancement', 'kaomoji_enhancement',
    'boldify_enhancement', 'detailed_suggestions', 'resonance_buffer',
    'causal_anchor', 'entropy_shield', 'nexus_sync', 'image_prompt_addon',
    'cognitive_origin_auditor', 'engagement_kinetics', 'social_alchemy'
];

// [snap_key, storage_keys[], match_field, is_selection]
const DOMAIN_TABLE = [
    ['personas',          ['personas'],                                'id',                false],
    ['favorite_personas', ['favorite_personas'],                       null,                true ],
    ['personas_active',   ['personas_active_id'],                      null,                true ],
    ['tags',              ['tags_registry', 'tag_created_order'],      'name',              false],
    ['strategy',          ['interactionType'],                         null,                true ],
    ['mode',              ['mode'],                                    null,                true ],
    ['protocols',         PROTOCOL_KEYS,                               null,                true ],
    ['imperatives',       ['imperatives'],                             'text',              false],
    // [V14] Custom metrics — single-key domain; deduplication via 'name' match-field
    // (audit §8.6 enforces uniqueness against RESERVED_METRIC_NAMES at save time).
    ['metrics',           ['metrics'],                                 'name',              false],
    ['attachments',       ['attachments', 'attachments_registry'],     'content',           false],
    ['intelligence',      ['forge_active_peer_id', 'forge_active_intent_id'], null,         true ],
    ['articles',          ['articles', 'active_article_id'],           'attributes.title',  false],
    ['presets',           ['presets', 'active_preset_id', 'favorite_presets'], 'name',        false],
    // [TREASURY+] directive history producer key is alchimist_directive_history (Directive.js), not directive_history
    ['directive_history', ['alchimist_directive_history'],             null,                false],
    // [TREASURY+] persona categories — integrate additively by id (preserves persona.category_id refs)
    ['persona_categories',['persona_categories'],                      'id',                false],
    // [TREASURY+] .persona-sorting-tools instance states (default + 3 alchemy isolates) — overwrite-only
    ['persona_tools',     ['persona_active_tab','persona_sorting_prefs','persona_tag_sorting_prefs','persona_tag_view_state','alchemy_active_tab','alchemy_metric_active_tab','persona_active_id_alchemy_mutate','persona_active_tab_alchemy_mutate','persona_sort_prefs_alchemy_mutate','persona_tag_sorting_prefs_alchemy_mutate','persona_tag_view_state_alchemy_mutate','persona_active_id_alchemy_cross_1','persona_active_tab_alchemy_cross_1','persona_sort_prefs_alchemy_cross_1','persona_tag_sorting_prefs_alchemy_cross_1','persona_tag_view_state_alchemy_cross_1','persona_active_id_alchemy_cross_2','persona_active_tab_alchemy_cross_2','persona_sort_prefs_alchemy_cross_2','persona_tag_sorting_prefs_alchemy_cross_2','persona_tag_view_state_alchemy_cross_2'], null, true ],
    // [TREASURY+] bundles applied set — overwrite-only
    ['bundles',           ['applied_bundle_ids'],                      null,                true ],
    // [TREASURY+] config limit values — overwrite-only
    ['config',            ['config'],                                  null,                true ],
    // [TREASURY+] license state — overwrite-only (restored via upload->overwrite, behind premium gate)
    ['license',           ['license_status','license_email','license_key_hash','license_activated_at'], null, true ],
    ['profile',           ['profile_intelligence', 'profile_selected_integrations'], null,  false],
    ['characters',        ['feature_chars'],                           'name',              false],
    ['archetypes',        ['feature_archetypes'],                      'name',              false],
    ['schemes',           ['feature_schemes'],                         'name',              false],
    ['peers',             ['peers'],                                   'name',              false],
    ['intents',           ['intents'],                                 'text',              false]
];

// Populate on future schema changes: { old_key: new_key }. Missing fields silently skipped.
const _RENAME_MAP = {};

// ============================================================
// Internal helpers
// ============================================================

async function _sha256(str) {
    if (typeof crypto === 'undefined' || !crypto.subtle || !crypto.subtle.digest) {
        throw new Error('HASH_UNAVAILABLE');
    }
    const buf = new TextEncoder().encode(str);
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hashBuf))
        .map(b => b.toString(16).padStart(2, '0')).join('');
}

function _normalizeMatchKey(value, field) {
    if (value == null) return '';
    if (field === 'name' || field === 'text') return String(value).trim().toLowerCase();
    if (field === 'content') return String(value).trim();
    return String(value);
}

function _getMatchValue(item, field) {
    if (!field || item == null) return null;
    if (field.includes('.')) {
        return field.split('.').reduce((acc, k) => (acc != null) ? acc[k] : undefined, item);
    }
    return item[field];
}

function _applyRenameMap(data) {
    if (!data || typeof data !== 'object') return data;
    for (const [oldKey, newKey] of Object.entries(_RENAME_MAP)) {
        if (data[oldKey] !== undefined && data[newKey] === undefined) {
            data[newKey] = data[oldKey];
            delete data[oldKey];
        }
    }
    return data;
}

function _matchesExpectedShape(snapKey, value) {
    if (value == null) return true;
    // All domain payloads are objects (the storage_key → value sub-map) except a few
    if (typeof value !== 'object') return false;
    return true;
}

async function _captureDomain(storageKeys) {
    const result = {};
    for (const key of storageKeys) {
        const val = await Storage.get(key);
        if (val !== undefined && val !== null) result[key] = val;
    }
    return result;
}

function _label(token, params) {
    let text = Language.text(token) || token;
    if (params) for (const [k, v] of Object.entries(params)) text = text.replace('{' + k + '}', String(v));
    return text;
}

// ============================================================
// Overwrite path (pristine baseline restoration)
// ============================================================

async function _overwriteAll(data) {
    const result = { added: [], skipped: [], failed: [] };

    // Phase 1: volatile register sanitization — atomic nullification
    const zero = {};
    const arrayLikeKeys = new Set(['personas','favorite_personas','imperatives','attachments',
                                    'articles','presets','favorite_presets','peers','intents',
                                    'alchimist_directive_history','metrics','persona_categories','applied_bundle_ids',
                                    'feature_chars','feature_archetypes','feature_schemes']);
    for (const [, storageKeys] of DOMAIN_TABLE) {
        for (const sk of storageKeys) zero[sk] = arrayLikeKeys.has(sk) ? [] : null;
    }
    PROTOCOL_KEYS.forEach(k => { zero[k] = false; });
    State.update(zero);

    // Phase 2: sequential per-domain Storage writes (per-domain try/catch wall)
    for (const [snapKey, storageKeys] of DOMAIN_TABLE) {
        const domainData = data[snapKey];
        if (!domainData || typeof domainData !== 'object') continue;
        try {
            for (const sk of storageKeys) {
                if (domainData[sk] !== undefined) {
                    await Storage.set({ [sk]: domainData[sk] });
                }
            }
            result.added.push({ domain: snapKey, label: _label('LABEL_TREASURY_DOMAIN_RESTORED', { domain: snapKey }) });
            log('DATA', 'TREASURY_DOMAIN_WRITTEN', { domain: snapKey, mode: 'overwrite' });
        } catch (err) {
            result.failed.push({ domain: snapKey, reason: err.message, label: _label('LABEL_TREASURY_DOMAIN_FAILED', { domain: snapKey, err: err.message }) });
            log('e', 'TREASURY_DOMAIN_FAIL', { domain: snapKey, err: err.message });
        }
    }

    // Phase 2b: attachments selection SoT (attachments_active_ids) is DERIVED, not captured.
    // Attachment.loadItems treats attachments_active_ids as authoritative and overrides every
    // `used` flag from it; the snapshot omits that key, so without this step the restored
    // selection silently inherits the STALE pre-overwrite id-list and gatherCurrentState() can
    // never match a restored preset's snapshot. Reconstruct it from the restored `attachments`
    // light mirror's used flags (fallback registry) — correct for BOTH current and legacy files.
    if (data.attachments && typeof data.attachments === 'object') {
        try {
            const _att = Array.isArray(data.attachments.attachments)
                ? data.attachments.attachments
                : (Array.isArray(data.attachments.attachments_registry) ? data.attachments.attachments_registry : null);
            if (Array.isArray(_att)) {
                const _activeIds = _att.filter(a => a && a.used).map(a => a.id);
                await Storage.set({ attachments_active_ids: _activeIds });
                log('DATA', 'TREASURY_ATTACH_SELECTION_RECONCILED', { derived: _activeIds.length, source: 'used_flags' });
            }
        } catch (err) {
            result.failed.push({ domain: 'attachments_active_ids', reason: err.message, label: 'attachments_active_ids reconcile failed' });
            log('e', 'TREASURY_ATTACH_RECONCILE_FAIL', { err: err.message });
        }
    }

    // Phase 3: per-peer sidecar restoration
    if (data.peers_intelligence && typeof data.peers_intelligence === 'object') {
        for (const [peerId, intel] of Object.entries(data.peers_intelligence)) {
            try { await Storage.set({ ['peer_intelligence_' + peerId]: intel }); }
            catch (err) { result.failed.push({ domain: 'peer_intelligence', reason: err.message, label: 'peer_intelligence_' + peerId + ' failed' }); }
        }
    }

    // Phase 4: license re-warm — premium gates re-resolve live (overwrite restores license_* keys)
    if (data.license && typeof data.license === 'object' && data.license.license_status !== undefined) {
        State.set('license_status', data.license.license_status);
        window.dispatchEvent(new CustomEvent('LICENSE_STATUS_CHANGED', { detail: { status: data.license.license_status } }));
        log('DATA', 'TREASURY_LICENSE_REWARMED', { status: data.license.license_status });
    }
    return result;
}

// ============================================================
// Integrate path (additive merge with collision skip)
// ============================================================

async function _integrateDomain(snapKey, storageKeys, matchField, items) {
    const out = { added: [], skipped: [] };
    if (!items || typeof items !== 'object') return out;
    const primaryKey = storageKeys[0];
    const incoming = Array.isArray(items[primaryKey]) ? items[primaryKey] : (Array.isArray(items) ? items : []);
    if (incoming.length === 0) return out;

    const existingRaw = await Storage.get(primaryKey);
    const existing = Array.isArray(existingRaw) ? existingRaw : [];
    const existingKeys = new Set(existing.map(e => _normalizeMatchKey(_getMatchValue(e, matchField), matchField)));
    const merged = [...existing];

    for (const item of incoming) {
        const key = _normalizeMatchKey(_getMatchValue(item, matchField), matchField);
        if (!key) continue;
        if (existingKeys.has(key)) {
            out.skipped.push({ domain: snapKey, key });
        } else {
            merged.push(item);
            existingKeys.add(key);
            const displayName = item.name || item.text || (item.attributes && item.attributes.title) || _getMatchValue(item, matchField) || item.id || key;
            out.added.push({ domain: snapKey, key, id: item.id, label: _label('LABEL_TREASURY_RECORD_ADDED', { domain: snapKey, name: String(displayName) }) });
        }
    }

    await Storage.set({ [primaryKey]: merged });
    const verified = await Storage.get(primaryKey);
    log('DATA', 'TREASURY_DOMAIN_WRITTEN', { domain: snapKey, mode: 'integrate', added: out.added.length, skipped: out.skipped.length, verified: Array.isArray(verified) ? verified.length : 0 });
    return out;
}

async function _integrateTags(tagsData, result) {
    if (!tagsData || typeof tagsData !== 'object') return;
    const incomingRegistry = tagsData.tags_registry || {};
    if (typeof incomingRegistry !== 'object' || Array.isArray(incomingRegistry)) return;
    // [CRITICAL] tag_created_order is a NUMBER counter (next ID to assign),
    // mirroring Tag.js (`this.tag_created_order++`). NOT an array.
    const incomingOrder = (typeof tagsData.tag_created_order === 'number') ? tagsData.tag_created_order : 0;
    const existingRegistryRaw = await Storage.get('tags_registry');
    const existingRegistry = (existingRegistryRaw && typeof existingRegistryRaw === 'object' && !Array.isArray(existingRegistryRaw)) ? existingRegistryRaw : {};
    const existingOrderRaw = await Storage.get('tag_created_order');
    const existingOrder = (typeof existingOrderRaw === 'number') ? existingOrderRaw : 0;
    const existingNormalized = new Set(Object.keys(existingRegistry).map(n => String(n).trim().toLowerCase()));

    const mergedRegistry = { ...existingRegistry };
    for (const [name, stats] of Object.entries(incomingRegistry)) {
        const norm = String(name).trim().toLowerCase();
        if (existingNormalized.has(norm)) {
            result.skipped.push({ domain: 'tags', key: norm });
        } else {
            mergedRegistry[name] = stats;
            existingNormalized.add(norm);
            result.added.push({ domain: 'tags', label: _label('LABEL_TREASURY_RECORD_ADDED', { domain: 'tag', name }) });
        }
    }
    // Counter advances past any assigned created_order to prevent future collisions.
    const mergedOrder = Math.max(existingOrder, incomingOrder);
    await Storage.set({ tags_registry: mergedRegistry, tag_created_order: mergedOrder });
    log('DATA', 'TREASURY_DOMAIN_WRITTEN', { domain: 'tags', mode: 'integrate', added: result.added.filter(a => a.domain === 'tags').length });
}

async function _integrateDirectiveHistory(dh, result) {
    const incoming = Array.isArray(dh) ? dh : (dh && Array.isArray(dh.alchimist_directive_history) ? dh.alchimist_directive_history : []);
    if (incoming.length === 0) return;
    const existingRaw = await Storage.get('alchimist_directive_history');
    const existing = Array.isArray(existingRaw) ? existingRaw : [];
    const existingSet = new Set(existing.map(s => String(s)));
    const merged = [...existing];
    for (const d of incoming) {
        const k = String(d);
        if (!existingSet.has(k)) {
            merged.push(d);
            existingSet.add(k);
            result.added.push({ domain: 'directive_history', label: _label('LABEL_TREASURY_RECORD_ADDED', { domain: 'directive', name: k.substring(0, 30) }) });
        }
    }
    await Storage.set({ alchimist_directive_history: merged });
}

async function _integrateProfile(pd, result) {
    if (!pd || typeof pd !== 'object') return;
    const existing = await Storage.get('profile_intelligence');
    const hasProfile = existing && typeof existing === 'object' && Object.keys(existing).length > 0;
    if (hasProfile) { result.skipped.push({ domain: 'profile' }); return; }
    if (pd.profile_intelligence) {
        await Storage.set({ profile_intelligence: pd.profile_intelligence });
        result.added.push({ domain: 'profile', label: _label('LABEL_TREASURY_RECORD_ADDED', { domain: 'profile', name: 'intelligence' }) });
    }
    if (pd.profile_selected_integrations) {
        await Storage.set({ profile_selected_integrations: pd.profile_selected_integrations });
    }
}

async function _integratePair(intel, result) {
    if (!intel || typeof intel !== 'object') return;
    const peerId = intel.forge_active_peer_id;
    const intentId = intel.forge_active_intent_id;
    if (!peerId || !intentId) return;
    const peers = (await Storage.get('peers')) || [];
    const intents = (await Storage.get('intents')) || [];
    if (peers.some(p => p.id === peerId) && intents.some(i => i.id === intentId)) {
        await Storage.set({ forge_active_peer_id: peerId, forge_active_intent_id: intentId });
        result.added.push({ domain: 'intelligence', label: _label('LABEL_TREASURY_RECORD_ADDED', { domain: 'intelligence', name: 'active pair' }) });
    }
}

async function _integrateAll(data) {
    const result = { added: [], skipped: [], failed: [] };
    for (const [snapKey, storageKeys, matchField, isSelection] of DOMAIN_TABLE) {
        if (isSelection) continue;
        if (snapKey === 'protocols') continue;
        if (snapKey === 'intelligence') continue;
        try {
            if (snapKey === 'profile') await _integrateProfile(data.profile, result);
            else if (snapKey === 'directive_history') await _integrateDirectiveHistory(data.directive_history, result);
            else if (snapKey === 'tags') await _integrateTags(data.tags, result);
            else {
                const r = await _integrateDomain(snapKey, storageKeys, matchField, data[snapKey]);
                result.added.push(...r.added);
                result.skipped.push(...r.skipped);
            }
        } catch (err) {
            result.failed.push({ domain: snapKey, reason: err.message, label: _label('LABEL_TREASURY_DOMAIN_FAILED', { domain: snapKey, err: err.message }) });
            log('e', 'TREASURY_DOMAIN_FAIL', { domain: snapKey, err: err.message });
        }
    }
    if (!State.get('active_peer_id') || !State.get('active_intent_id')) {
        try { await _integratePair(data.intelligence, result); }
        catch (err) { result.failed.push({ domain: 'intelligence', reason: err.message, label: _label('LABEL_TREASURY_DOMAIN_FAILED', { domain: 'intelligence', err: err.message }) }); }
    }
    return result;
}

function _buildArtifactPayload(result) {
    const added = result.added.map(a => ({ label: a.label || a.domain }));
    const failed = result.failed.map(f => ({ label: f.label || f.domain }));
    return { added, failed, hasArtifacts: added.length > 0 || failed.length > 0 };
}

// ============================================================
// Public contract
// ============================================================

export const TreasuryService = {
    SNAPSHOT_SCHEMA_VERSION,
    KNOWN_SCHEMAS,
    DOMAIN_TABLE,
    PROTOCOL_KEYS,
    _RENAME_MAP,
    _sha256, _applyRenameMap, _normalizeMatchKey, _getMatchValue,
    _matchesExpectedShape, _captureDomain,
    _overwriteAll, _integrateAll, _integrateDomain, _integrateTags,
    _integrateProfile, _integrateDirectiveHistory, _integratePair,
    _buildArtifactPayload,

    async exportSnapshot(opts = {}) {
        log('UI', 'TREASURY_SAVE_CLICKED', {});
        const payload = {};
        for (const [snapKey, storageKeys] of DOMAIN_TABLE) {
            payload[snapKey] = await _captureDomain(storageKeys);
        }
        payload.peers_intelligence = {};
        const peersList = (payload.peers && Array.isArray(payload.peers.peers)) ? payload.peers.peers : [];
        for (const peer of peersList) {
            if (peer && peer.id) {
                const sidecar = await Storage.get('peer_intelligence_' + peer.id);
                if (sidecar) payload.peers_intelligence[peer.id] = sidecar;
            }
        }
        const dataJson = JSON.stringify(payload);
        const envelope = {
            version: SNAPSHOT_SCHEMA_VERSION,
            app_version: (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) ? chrome.runtime.getManifest().version : 'unknown',
            schema: 'treasury.v1',
            created_at: Date.now(),
            data: payload,
            hash: await _sha256(dataJson)
        };
        log('DATA', 'TREASURY_EXPORTED', { size: dataJson.length, hash_prefix: envelope.hash.slice(0, 8), domain_count: Object.keys(payload).length });

        if (!opts.skipDownload) {
            const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
            const filename = 'alchimist-treasury-' + Date.now() + '.json';
            const url = URL.createObjectURL(blob);
            try {
                if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
                    chrome.downloads.download({ url, filename, saveAs: true });
                } else {
                    const a = document.createElement('a');
                    a.href = url; a.download = filename;
                    document.body.appendChild(a); a.click(); a.remove();
                }
                log('DATA', 'TREASURY_DOWNLOAD_REQUESTED', { filename });
            } catch (err) {
                log('e', 'TREASURY_DOWNLOAD_FAIL', err.message);
            }
            Logger.userLog('LOG_SUC_SNAPSHOT_SAVED', 'success');
        }
        return envelope;
    },

    async validate(envelope) {
        log('LOGIC', 'TREASURY_VALIDATION_START', { schema: envelope && envelope.schema, version: envelope && envelope.version });
        if (!envelope || typeof envelope !== 'object' || !envelope.schema || !envelope.data || !envelope.hash) {
            return { ok: false, reason: 'INVALID_ENVELOPE' };
        }
        if (!KNOWN_SCHEMAS.includes(envelope.schema)) {
            return { ok: false, reason: 'UNKNOWN_SCHEMA', detail: envelope.schema };
        }
        envelope.data = _applyRenameMap(envelope.data);
        let computed;
        try { computed = await _sha256(JSON.stringify(envelope.data)); }
        catch (err) { return { ok: false, reason: 'HASH_UNAVAILABLE', detail: err.message }; }
        if (computed !== envelope.hash) return { ok: false, reason: 'HASH_MISMATCH' };
        for (const [snapKey] of DOMAIN_TABLE) {
            if (envelope.data[snapKey] !== undefined && !_matchesExpectedShape(snapKey, envelope.data[snapKey])) {
                return { ok: false, reason: 'SHAPE_FAULT', detail: snapKey };
            }
        }
        return { ok: true };
    },

    async integrate(envelope, mode) {
        const v = await this.validate(envelope);
        if (!v.ok) {
            Logger.userLog('LOG_ERR_SNAPSHOT_CORRUPTED', 'error');
            log('e', 'TREASURY_VALIDATION_FAIL', v);
            return { aborted: true, reason: v.reason, added: [], skipped: [], failed: [] };
        }

        State.set('is_integrating_treasury', true);
        log('LOGIC', 'TREASURY_WAIT_OPEN', { mode });
        try {
        let result;
        if (mode === 'overwrite') result = await _overwriteAll(envelope.data);
        else result = await _integrateAll(envelope.data);

        // Integrate-path sidecars: restore peer_intelligence_${id} for each newly added peer
        if (mode === 'integrate' && envelope.data.peers_intelligence && typeof envelope.data.peers_intelligence === 'object') {
            for (const added of result.added.filter(a => a.domain === 'peers' && a.id)) {
                const sidecar = envelope.data.peers_intelligence[added.id];
                if (sidecar) {
                    try { await Storage.set({ ['peer_intelligence_' + added.id]: sidecar }); }
                    catch (err) { result.failed.push({ domain: 'peer_intelligence', reason: err.message, label: 'peer_intelligence_' + added.id + ' failed' }); }
                }
            }
        }

        // SYNC: warm State from Storage for all touched keys (read-after-write consistency)
        const touched = new Set();
        for (const [snapKey, storageKeys] of DOMAIN_TABLE) {
            const wasTouched = (mode === 'overwrite') || result.added.some(a => a.domain === snapKey);
            if (wasTouched) storageKeys.forEach(k => touched.add(k));
        }
        for (const key of touched) {
            const val = await Storage.get(key);
            State.set(key, val);
        }

        // BROADCAST: canonical sovereign refresh event
        window.dispatchEvent(new CustomEvent('TREASURY_RESTORED', { detail: { mode, stats: result } }));

        // ARTIFACTS: dispatch BEFORE userLog so UserConsole correlates by record.timestamp
        const artifactPayload = _buildArtifactPayload(result);
        if (artifactPayload.hasArtifacts) {
            window.dispatchEvent(new CustomEvent('TRANSMUTATION_ARTIFACTS', { detail: { payload: { treasury: artifactPayload } } }));
            log('UI', 'TREASURY_ARTIFACTS_DISPATCHED', { count: artifactPayload.added.length + artifactPayload.failed.length });
        }

        // STATUS BAR
        const ok = result.failed.length === 0;
        if (mode === 'overwrite') Logger.userLog(ok ? 'LOG_SUC_SNAPSHOT_OVERWRITTEN' : 'LOG_WARN_SNAPSHOT_PARTIAL', ok ? 'success' : 'warning');
        else Logger.userLog(ok ? 'LOG_SUC_SNAPSHOT_INTEGRATED' : 'LOG_WARN_SNAPSHOT_PARTIAL', ok ? 'info' : 'warning');

        log('LOGIC', 'TREASURY_RESTORED', { mode, added: result.added.length, skipped: result.skipped.length, failed: result.failed.length });
        return result;
        } finally {
            State.set('is_integrating_treasury', false);
            log('LOGIC', 'TREASURY_WAIT_CLOSE', { mode });
        }
    }
};

// Sovereign Global Registration
if (typeof window !== 'undefined') window.TreasuryService = TreasuryService;
