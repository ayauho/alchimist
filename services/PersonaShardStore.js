/**
 * @file services/PersonaShardStore.js
 * @purpose Per-record persistence for the persona roster. Splits the single
 *          `personas` array into an ordered index (`personas_index`) plus one
 *          `persona:<id>` shard per record, with dirty-diff writes. A single-
 *          persona mutation (rename, usage bump, knowledge evolve, category
 *          assign, alchemy integrate) now writes ~one shard instead of
 *          recompressing the entire ~854KB roster on the main thread.
 *
 *  Contract: callers keep using Storage.get('personas') / Storage.set({personas})
 *  with a plain ordered array. This module is invoked ONLY from Storage.js.
 *
 *  Shards are stored UNCOMPRESSED (unlimitedStorage is granted), which removes
 *  LZMA from the persona write path entirely. Reads tolerate a legacy
 *  compressed shard wrapper ({ isCompressed, data }) for forward-safety.
 */
import { log } from '../utils/logger.js';
import { ArchiveResonance } from '../modules/ArchiveResonance.js';

const INDEX_KEY = 'personas_index';
const LEGACY_KEY = 'personas';
const SHARD_PREFIX = 'persona:';

// id -> JSON.stringify(persona) of the last persisted shard. Drives the
// dirty-diff so unchanged shards are never rewritten.
const _shardHashes = new Map();

// Single-flight guard: concurrent cold reads (multiple components hydrate at
// once) share one load/migration instead of racing the legacy-blob removal.
let _loadInFlight = null;

const _hasChrome = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local);

function _shardKey(id) { return SHARD_PREFIX + id; }

function _mintId(name) {
    let id;
    try { id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : null; } catch (e) { id = null; }
    if (!id) id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    log('w', 'PERSONA_SHARD_ID_MINTED', { name: name || '(unnamed)' });
    return id;
}

async function _rawGet(keys) {
    if (_hasChrome) return new Promise(resolve => chrome.storage.local.get(keys, res => resolve(res || {})));
    const out = {};
    keys.forEach(k => { try { out[k] = JSON.parse(localStorage.getItem(k)); } catch (e) { out[k] = undefined; } });
    return out;
}

async function _rawGetAll() {
    if (_hasChrome) return new Promise(resolve => chrome.storage.local.get(null, res => resolve(res || {})));
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        try { out[k] = JSON.parse(localStorage.getItem(k)); } catch (e) { /* skip */ }
    }
    return out;
}

async function _rawSet(obj) {
    if (_hasChrome) return new Promise(resolve => chrome.storage.local.set(obj, resolve));
    Object.entries(obj).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
}

async function _rawRemove(keys) {
    if (!keys || !keys.length) return;
    if (_hasChrome) return new Promise(resolve => chrome.storage.local.remove(keys, resolve));
    keys.forEach(k => localStorage.removeItem(k));
}

async function _decodeShard(raw) {
    if (raw && typeof raw === 'object' && raw.isCompressed) {
        const d = await ArchiveResonance.decompress(raw.data);
        return typeof d === 'string' ? JSON.parse(d) : d;
    }
    return raw;
}

export const PersonaShardStore = {
    async load() {
        if (_loadInFlight) return _loadInFlight;
        _loadInFlight = this._loadImpl().finally(() => { _loadInFlight = null; });
        return _loadInFlight;
    },

    async _loadImpl() {
        const idxWrap = await _rawGet([INDEX_KEY]);
        const index = idxWrap[INDEX_KEY];

        // --- Legacy migration: no index yet, but a monolithic blob may exist. ---
        if (!Array.isArray(index)) {
            const legacyWrap = await _rawGet([LEGACY_KEY]);
            let legacy = legacyWrap[LEGACY_KEY];
            if (legacy && typeof legacy === 'object' && legacy.isCompressed) {
                try {
                    const d = await ArchiveResonance.decompress(legacy.data);
                    legacy = typeof d === 'string' ? JSON.parse(d) : d;
                } catch (e) { log('e', 'PERSONA_SHARD_MIGRATE_DECOMPRESS_FAIL', e); legacy = null; }
            }
            if (Array.isArray(legacy) && legacy.length) {
                await this.save(legacy, { force: true });
                await _rawRemove([LEGACY_KEY]); // monolith is now redundant
                log('DATA', 'PERSONA_SHARD_MIGRATED', { count: legacy.length });
                return legacy;
            }
            return []; // nothing stored yet
        }

        // --- Normal sharded read: one batched get, reassemble in index order. ---
        const all = await _rawGetAll();
        const arr = [];
        _shardHashes.clear();
        for (const id of index) {
            const raw = all[_shardKey(id)];
            if (raw === undefined || raw === null) {
                log('w', 'PERSONA_SHARD_MISSING', { id }); // index references a vanished shard
                continue;
            }
            let persona;
            try { persona = await _decodeShard(raw); } catch (e) { log('e', 'PERSONA_SHARD_DECODE_FAIL', { id }); continue; }
            if (persona && typeof persona === 'object') {
                if (!persona.id) persona.id = id; // trust the index id if the body lost it
                arr.push(persona);
                _shardHashes.set(persona.id, JSON.stringify(persona));
            }
        }
        return arr;
    },

    async save(arr, opts) {
        const force = !!(opts && opts.force);
        if (!Array.isArray(arr)) { log('e', 'PERSONA_SHARD_SAVE_NONARRAY'); return; }

        const prevIds = new Set(_shardHashes.keys());
        const writeBatch = {};
        const newIndex = [];
        const newIdSet = new Set();
        let changed = 0;

        for (const p of arr) {
            if (!p || typeof p !== 'object') continue;
            if (!p.id) p.id = _mintId(p.name); // never silently drop an id-less persona
            newIndex.push(p.id);
            newIdSet.add(p.id);
            const h = JSON.stringify(p);
            if (force || _shardHashes.get(p.id) !== h) {
                writeBatch[_shardKey(p.id)] = p; // uncompressed
                _shardHashes.set(p.id, h);
                changed++;
            }
        }

        const removeKeys = [];
        for (const oldId of prevIds) {
            if (!newIdSet.has(oldId)) {
                removeKeys.push(_shardKey(oldId));
                _shardHashes.delete(oldId);
            }
        }

        writeBatch[INDEX_KEY] = newIndex; // index is always rewritten (small, cheap)
        await _rawSet(writeBatch);
        if (removeKeys.length) await _rawRemove(removeKeys);

        log('DATA', 'STORAGE_BUFFER_UPDATED', {
            key: 'personas',
            size: JSON.stringify(arr).length,
            shards_written: changed,
            shards_removed: removeKeys.length,
            mode: 'sharded'
        });
    },

    async clear() {
        const idxWrap = await _rawGet([INDEX_KEY]);
        const index = Array.isArray(idxWrap[INDEX_KEY]) ? idxWrap[INDEX_KEY] : [];
        const keys = index.map(_shardKey);
        keys.push(INDEX_KEY, LEGACY_KEY);
        _shardHashes.clear();
        await _rawRemove(keys);
        log('DATA', 'PERSONA_SHARD_CLEARED', { removed: index.length });
    }
};
