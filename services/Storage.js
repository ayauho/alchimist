/**
 * @file services/Storage.js
 * @purpose Persistence Layer (chrome.storage abstraction)
 */
import { log } from '../utils/logger.js';
import { Language } from './Language.js';
import { ArchiveResonance } from '../modules/ArchiveResonance.js';
import { PersonaShardStore } from './PersonaShardStore.js';

const _resonanceBuffer = new Map();
const _volatileMirror = new Map();
const _outputCompressionCache = new Map();
// [V18.6] Delta-compression cache for the generic Density Gate, mirroring
// _outputCompressionCache. Keyed by storage key -> { hash, data }. When a large
// value's serialized form is byte-identical to the last compression for that key,
// the cached compressed payload is reused instead of re-running main-thread LZMA.
const _densityCompressionCache = new Map();

export const Storage = {
    buffer_mirror(recordId, text) {
        _volatileMirror.set(recordId, text);
        log('DATA', 'MIRROR_WARMED', { id: recordId, length: text?.length || 0 });
    },

    get_context_truth(recordId) {
        return _volatileMirror.get(recordId);
    },

    async save(key, data) {
        let finalData = data;
        const serialized = JSON.stringify(data);

        // [V13.S³] Density Gate: Compress items over 4KB
        if (serialized.length > 4096 && key !== 'currentOutputs') {
            try {
                const compressed = await ArchiveResonance.compress(serialized);
                finalData = { isCompressed: true, data: compressed };
                log('DATA', 'ARCHIVE_DENSITY_GATE', { key, original: serialized.length, compressed: compressed.length });
            } catch (err) {
                log('e', 'COMPRESS_FAIL', `Failed to pack ${key}`);
            }
        }

        _resonanceBuffer.set(key, data);
        
        if (typeof chrome !== 'undefined' && chrome.storage) {
            return new Promise(resolve => {
                chrome.storage.local.set({ [key]: finalData }, () => {
                    log('DATA', 'STORAGE_BUFFER_UPDATED', { key, size: serialized.length });
                    //console.trace('STORAGE_BUFFER_UPDATED', { key, size: serialized.length })
                    resolve();
                });
            });
        } else {
            localStorage.setItem(key, JSON.stringify(finalData));
            log('DATA', 'STORAGE_BUFFER_UPDATED', { key, size: serialized.length });
            //console.trace('STORAGE_BUFFER_UPDATED', { key, size: serialized.length })
        }
    },

    async archiveOutputRecords(records) {
        if (!Array.isArray(records)) return records;
        const archived = [];
        for (const rec of records) {
            // [V17] Bundle the heavy fields — output + config + scraped context (dna) — into one
            // LZMA payload. Light fields (id, timestamp, kind, articleId, meta) stay raw so the
            // FIFO timestamp-sort and list-card headers work without decompression.
            if (rec.output && !rec.isArchived) {
                try {
                    const _bundle = { output: rec.output, config: rec.config, dna: rec.dna };
                    const currentHash = JSON.stringify(_bundle);
                    let compressed = null;

                    if (rec.id) {
                        const cached = _outputCompressionCache.get(rec.id);
                        if (cached && cached.hash === currentHash) {
                            compressed = cached.data;
                        } else {
                            compressed = await ArchiveResonance.compress(_bundle);
                            _outputCompressionCache.set(rec.id, { hash: currentHash, data: compressed });
                        }
                    } else {
                        compressed = await ArchiveResonance.compress(_bundle);
                    }

                    archived.push({
                        ...rec,
                        output: null,
                        config: null,
                        dna: null,
                        _archivedOutput: compressed,
                        _archiveV: 2,
                        isArchived: true
                    });
                } catch(e) {
                    log('e', 'OUTPUT_ARCHIVE_FAIL', e);
                    archived.push(rec);
                }
            } else {
                archived.push(rec);
            }
        }
        return archived;
    },

    async dearchiveOutputRecords(records) {
        if (!Array.isArray(records)) return records;
        const dearchived = [];
        for (const rec of records) {
            if (rec.isArchived && rec._archivedOutput) {
                try {
                    const decompressed = await ArchiveResonance.decompress(rec._archivedOutput);
                    const parsed = typeof decompressed === 'string' ? JSON.parse(decompressed) : decompressed;

                    if (rec._archiveV === 2) {
                        // [V17] Bundle format: payload is { output, config, dna } compressed together.
                        const _rewarm = { output: parsed.output, config: parsed.config, dna: parsed.dna };
                        if (rec.id) {
                            _outputCompressionCache.set(rec.id, { hash: JSON.stringify(_rewarm), data: rec._archivedOutput });
                        }
                        dearchived.push({
                            ...rec,
                            output: parsed.output,
                            config: parsed.config,
                            dna: parsed.dna,
                            _archivedOutput: null,
                            _archiveV: undefined,
                            isArchived: false
                        });
                    } else {
                        // Legacy format: payload is the output only; config/dna already raw on rec.
                        dearchived.push({
                            ...rec,
                            output: parsed,
                            _archivedOutput: null,
                            isArchived: false
                        });
                    }
                } catch(e) {
                    log('e', 'OUTPUT_DEARCHIVE_FAIL', e);
                    dearchived.push(rec);
                }
            } else {
                dearchived.push(rec);
            }
        }
        return dearchived;
    },

    async set(items) {
        const processedItems = { ...items };
        
        for (let [key, val] of Object.entries(processedItems)) {
            // [CRITICAL FIX] Removed early _resonanceBuffer.set() to prevent Phantom Data desync.
           
            if (key === 'currentOutputs' || key === 'outputs') {
                // Enforce FIFO Storage Limit
                const config = await this.get('config') || {};
                const limit = config.maxSavedOutputs || 20;
               
                if (Array.isArray(val) && val.length > limit) {
                    val.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                    const purged = val.length - limit;
                    val = val.slice(0, limit);
                    log('DATA', 'FIFO_PURGE', { key, purged, limit });
                }

                // Update Memory Mirror with the final logical state (sliced but raw objects)
                _resonanceBuffer.set(key, val);

                val = await this.archiveOutputRecords(val);
                processedItems[key] = val;
               
                const mass = JSON.stringify(val).length;
                log('DATA', 'STORAGE_BUFFER_UPDATED', { key, size: mass, status: 'Smart-Archived' });
                //console.trace('STORAGE_BUFFER_UPDATED', { key, size: mass, status: 'Smart-Archived' })
                continue; // Skip generic density gate for this specific key
            }

             if (key === 'libraryArticles') {
                 // [ARTICLE] FIFO Storage Limit (default 10 per spec)
                 const config = await this.get('config') || {};
                 const limit = (config.maxSavedArticles == null) ? 10 : config.maxSavedArticles;

                 if (Array.isArray(val) && val.length > limit) {
                     val.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                     const purged = val.length - limit;
                     val = val.slice(0, limit);
                     log('DATA', 'LIBRARY_FIFO_PURGE', { key, purged, limit });
                 }

                 _resonanceBuffer.set(key, val);
                 val = await this.archiveOutputRecords(val);
                 processedItems[key] = val;
                 const mass = JSON.stringify(val).length;
                 log('DATA', 'STORAGE_BUFFER_UPDATED', { key, size: mass, status: 'Smart-Archived' });
                 //console.trace('STORAGE_BUFFER_UPDATED', { key, size: mass, status: 'Smart-Archived' })
                 continue;
             }
           
             // [V19] Per-record persona persistence. Delegate the roster to the
             // shard store (index + persona:<id> shards, dirty-diff, uncompressed)
             // so a single-persona mutation no longer recompresses the whole
             // ~854KB array. Pulled out of processedItems so the generic Density
             // Gate below never sees it. Catches every writer — explicit,
             // reactive (State._persist), and fire-and-forget — since all reach here.
             if (key === 'personas') {
                 await PersonaShardStore.save(val);
                 _resonanceBuffer.set('personas', val);
                 delete processedItems['personas'];
                 continue;
             }

            const mass = JSON.stringify(val).length;
            log('DATA', 'STORAGE_BUFFER_UPDATED', { key, size: mass });
            //console.trace('STORAGE_BUFFER_UPDATED', { key, size: mass })
            const _serialized = JSON.stringify(val);
            const _mass = _serialized.length;

            // [V13.S³] Threshold-Default Archival Gate
            if (_mass > 1536) {
                // Shield redundant Density Gate logs for already tracked buffers
                if (val && typeof val === 'object' && !val._archivedLogged) {
                    try { Object.defineProperty(val, '_archivedLogged', { value: true, enumerable: false }); } catch(e) {}
                    if (!Storage._lastArchiveLog || (Date.now() - Storage._lastArchiveLog > 1000)) {
                        Storage._lastArchiveLog = Date.now();
                        log('DATA', 'ARCHIVE', Language.text('MSG_ARCHIVE_GATE_TRIGGERED') || `Density Gate triggered for: ${key}`);
                    }
                } else if (!val) {
                    if (!Storage._lastArchiveLog || (Date.now() - Storage._lastArchiveLog > 1000)) {
                        Storage._lastArchiveLog = Date.now();
                        log('DATA', 'ARCHIVE', Language.text('MSG_ARCHIVE_GATE_TRIGGERED') || `Density Gate triggered for: ${key}`);
                    }
                }
                try {
                    // [V18.6] Reuse cached compression when the serialized payload is
                    // unchanged for this key — skips the synchronous main-thread LZMA pass.
                    const _cached = _densityCompressionCache.get(key);
                    let _compressed;
                    if (_cached && _cached.hash === _serialized) {
                        _compressed = _cached.data;
                        log('DATA', 'DENSITY_CACHE_HIT', { key, size: _mass });
                    } else {
                        _compressed = await ArchiveResonance.compress(val);
                        _densityCompressionCache.set(key, { hash: _serialized, data: _compressed });
                    }
                    processedItems[key] = {
                        isCompressed: true,
                        _originalMass: _mass,
                        data: _compressed,
                        _v: 'V18.6'
                    };
                } catch (err) {
                    log('e', 'ARCHIVE_FAIL', `Compression failed for ${key}`, err);
                }
            }
            
            // Immediate Luminous Handshake (Memory Mirror) - Set after processing but using raw 'val' reference
            _resonanceBuffer.set(key, val);
        }

        if (typeof chrome !== 'undefined' && chrome.storage) {
            return new Promise(resolve => chrome.storage.local.set(processedItems, resolve));
        }
        Object.entries(processedItems).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
    },
    
    async get(key) {
        // Memory Mirror Priority
        if (_resonanceBuffer.has(key)) return _resonanceBuffer.get(key);

        // [V19] Reassemble the roster from per-record shards (migrates a legacy
        // monolithic blob on first read). Buffer is set so later reads are O(1).
        if (key === 'personas') {
            const arr = await PersonaShardStore.load();
            _resonanceBuffer.set('personas', arr);
            return arr;
        }
       
       let raw = null;
        if (typeof chrome !== 'undefined' && chrome.storage) {
            raw = await new Promise(resolve => chrome.storage.local.get([key], result => resolve(result[key])));
        } else {
            try { raw = JSON.parse(localStorage.getItem(key)); } catch(e) {}
        }

        if (raw) {
            if (key === 'currentOutputs' || key === 'outputs' || key === 'libraryArticles') {
                raw = await this.dearchiveOutputRecords(raw);
            } else if (typeof raw === 'object' && raw.isCompressed) {
                try {
                    const decompressed = await ArchiveResonance.decompress(raw.data);
                    raw = typeof decompressed === 'string' ? JSON.parse(decompressed) : decompressed;
                } catch (err) {
                    log('e', 'DECOMPRESS_FAIL', `Failed to unpack ${key}`);
                    return null;
                }
            }
        }

        if (raw !== null) _resonanceBuffer.set(key, raw);
        return raw;
    },

    async get_raw_all() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            return new Promise(resolve => chrome.storage.local.get(null, resolve));
        }
        return { ...localStorage };
    },

    async remove(keys) {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        
        keysArray.forEach(k => {
            _resonanceBuffer.delete(k);
            _volatileMirror.delete(k);
            _densityCompressionCache.delete(k);
        });

        // [V19] Removing the roster must purge every shard + index, not a
        // (now non-existent) monolithic 'personas' key.
        if (keysArray.includes('personas')) {
            await PersonaShardStore.clear();
        }

        if (typeof chrome !== 'undefined' && chrome.storage) {
            return new Promise(resolve => chrome.storage.local.remove(keysArray, resolve));
        }
        keysArray.forEach(k => localStorage.removeItem(k));
    }
};