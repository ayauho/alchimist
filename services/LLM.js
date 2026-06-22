/**
 * @file services/LLM.js
 * @purpose Crucible Void communication layer with Gemini API.
 */
import { log, Logger } from '../utils/logger.js';
import { Language } from './Language.js';
import { Storage } from './Storage.js';
import { State } from './State.js';
import { MODEL_HIERARCHY, INITIAL_SLOT_STATE } from '../utils/constants.js';

let currentController = null;

// Unified Void Interruption Listener
window.addEventListener('INTERRUPT_ALCHIMIST_VOID', () => {
    if (currentController) {
        log('LOGIC', 'LLM', 'Interruption signal received. Aborting active fetch.');
        currentController.abort();
        currentController = null;
    }
});

export const LLM = {
    async transmute(promptRaw, iterationCount = 0) {
        log('LOGIC', 'LLM', Language.text('MSG_TRANSMUTE_STARTED'));
        
        currentController = new AbortController();
        const signal = currentController.signal;
        
        let slots = await Storage.get('api_slots');
        if (!Array.isArray(slots)) slots = [];
        
        if (slots.length === 0) {
            slots = [1, 2, 3, 4, 5].map(i => INITIAL_SLOT_STATE(i));
            const legacyKey = await Storage.get('geminiApiKey');
            if (legacyKey) {
                slots[0].apiKey = legacyKey;
            }
            await Storage.set({ api_slots: slots });
        }
        
        // [V13.S³] Pre-Flight Targeting Check: Prevent Nuclear Exhaustion loop if totally empty
        const hasAnyKey = slots.some(slot => slot && typeof slot.apiKey === 'string' && slot.apiKey.trim() !== '');
        if (!hasAnyKey) {
            log('w', 'LLM_AUTH_FAIL', 'PRE_FLIGHT_EXIT: Missing API key. Triggering targeting scenario.');
            // Immediate state shutdown across all potential active processes
            ['is_transmuting', 'is_synthesizing', 'is_forging', 'is_recalibrating', 'is_suggesting'].forEach(s => State.set(s, false));
            if (window.TargetingInstance) {
                window.TargetingInstance.run('GEMINI_API_KEY_MISSING').catch(e => log('e', 'TARGETING_CRASH', e));
            }
            return new Promise(() => {}); 
        }

        if (iterationCount > slots.length * MODEL_HIERARCHY.length) {
            throw new Error("NUCLEAR_EXHAUSTION: All keys and models exhausted.");
        }
        
        const activeIndex = slots.findIndex(s => s.isActive) !== -1 ? slots.findIndex(s => s.isActive) : 0;
        const currentSlot = slots[activeIndex];
        
        /**
         * [V13.S³] Tier Recovery Protocol
         * If currently downgraded, check if the Top Tier cooldown has expired for any slot.
         */
        const TOP_TIER = MODEL_HIERARCHY[0];
        const COOLDOWN = 24 * 60 * 60 * 1000;
        
        // Ensure modelExhaustion map exists for state isolation
        slots.forEach(s => { if (!s.modelExhaustion) s.modelExhaustion = {}; });

         // [HEAL] Substrate type sovereignty: earlier builds persisted the dropdown event payload
         // object ({id, label, ...}) into currentModel/preferredModel, yielding "models/[object Object]".
         // Some slots hold a string, others an object. Coerce any object-typed model field back to its
         // canonical string id before ANY consumer reads it (endpoint, TOP_TIER compare, exhaustion keys).
         let _modelTypeHealed = false;
         const _coerceModelId = (m) => (m && typeof m === 'object') ? (m.id || m.option) : m;
         slots.forEach(s => {
             const cm = _coerceModelId(s.currentModel);
             const pm = _coerceModelId(s.preferredModel);
             if (cm !== s.currentModel) { s.currentModel = cm; _modelTypeHealed = true; }
             if (pm !== s.preferredModel) { s.preferredModel = pm; _modelTypeHealed = true; }
         });
         if (_modelTypeHealed) {
             await Storage.set({ api_slots: slots });
             log('w', 'MODEL_TYPE_HEAL', 'Coerced object-typed model field(s) to canonical string id.');
         }

        if (currentSlot.currentModel !== TOP_TIER) {
            for (let i = 0; i < slots.length; i++) {
                const proExhaustedAt = slots[i].modelExhaustion[TOP_TIER];
                 // Only slots that actually WANT the top tier are recovery candidates.
                 // A slot the user pinned to a lower tier keeps currentModel below TOP_TIER
                 // even after "restoration", so selecting it re-enters this block forever:
                 // the recursive transmute() call does not increment iterationCount, so the
                 // NUCLEAR_EXHAUSTION guard never trips. Mirrors the forEach below, which
                 // only raises currentModel for (!preferredModel || preferredModel === TOP_TIER).
                 const wantsTopTier = !slots[i].preferredModel || slots[i].preferredModel === TOP_TIER;
                 const isRecovered = wantsTopTier && proExhaustedAt && (Date.now() - proExhaustedAt > COOLDOWN);
                 const isUntested = wantsTopTier && !proExhaustedAt && slots[i].apiKey;
               
                if (isRecovered || isUntested) {
                    log('i', 'API_ORCHESTRATOR', `Top Tier availability detected in Slot ${slots[i].id}. Restoring hierarchy.`);
                     slots.forEach(s => {
                         s.isActive = false;
                         // Only restore TOP_TIER if the slot's preferred model is TOP_TIER (or unset)
                         if (!s.preferredModel || s.preferredModel === TOP_TIER) {
                             s.currentModel = TOP_TIER;
                         }
                         // Only clear PRO exhaustion if 24h passed
                        if (s.modelExhaustion[TOP_TIER] && (Date.now() - s.modelExhaustion[TOP_TIER] > COOLDOWN)) {
                            delete s.modelExhaustion[TOP_TIER];
                        }
                    });
                    slots[i].isActive = true;
                    await Storage.set({ api_slots: slots });
                    await Storage.set({ active_slot_index: i });
                    window.dispatchEvent(new CustomEvent('alchimist:api-rotation'));
                    return this.transmute(promptRaw, iterationCount);
                }
            }
        }

        /**
         * [V13.S³] Usage Gate
         * Skip slot if key is missing or model-tier is currently exhausted.
         */
        const isTierExhausted = currentSlot.modelExhaustion[currentSlot.currentModel] && (Date.now() - currentSlot.modelExhaustion[currentSlot.currentModel] < COOLDOWN);
        if (!currentSlot.apiKey || isTierExhausted) {
            if (!currentSlot.apiKey) {
                log('w', 'API_ORCHESTRATOR', `Slot ${currentSlot.id} is empty. Moving to next.`);
            }
            await this.rotate_slot(slots, activeIndex);
            return this.transmute(promptRaw, iterationCount + 1);
        }
        
        try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentSlot.currentModel}:generateContent?key=${currentSlot.apiKey}`;
            log('AI', 'CRUCIBLE', `Invoking Slot ${currentSlot.id} using model: ${currentSlot.currentModel}`);
            
            const payload = { contents: [{ parts: [{ text: promptRaw }] }] };
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: signal
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({ error: 'NON_JSON_ERROR', raw: response.statusText }));
                log('e', 'CRUCIBLE_VOID', { status: response.status, details: errData });
                throw new Error(`API Error ${response.status}: ${JSON.stringify(errData)}`);
            }
            
            if (currentSlot.modelExhaustion[currentSlot.currentModel]) {
                delete currentSlot.modelExhaustion[currentSlot.currentModel];
                await Storage.set({ api_slots: slots });
            }

            const data = await response.json();
            let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error("Empty response from Crucible.");
           
            // [V14.S³] Void-Source Auditor: Aggressive Em-dash Scrubbing
            text = text.replace(/—/g, ',');
           
            log('DATA', 'LLM_RAW_RESPONSE', text);
           
            return text;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                log('w', 'LLM_ABORT', 'Request aborted by user.');
                // Clear active transmuting flags locally to reset layout state immediately
                const loadingFlags = ['is_transmuting', 'is_synthesizing', 'is_mutating', 'is_crossbreeding', 'is_refining', 'is_improving_prompt', 'is_forging', 'is_recalibrating', 'is_suggesting'];
                loadingFlags.forEach(flag => {
                    if (State.get(flag)) State.set(flag, false);
                });
                return; // Silent settlement: skip terminal error hooks and state pollution
            }

            const isQuotaError = error.message.includes('429') || error.message.toLowerCase().includes('quota') || error.message.toLowerCase().includes('limit');
            if (isQuotaError) {
                log('w', 'API_ORCHESTRATOR', `Slot ${currentSlot.id} exhausted for ${currentSlot.currentModel}. Rotating.`);
                currentSlot.modelExhaustion[currentSlot.currentModel] = Date.now();
                await this.rotate_slot(slots, activeIndex);
                return this.transmute(promptRaw, iterationCount + 1);
            }

            // [V13.E-RECOVERY] Holistic Terminal Error Handler
            const loadingFlags = ['is_transmuting', 'is_synthesizing', 'is_mutating', 'is_crossbreeding', 'is_refining', 'is_improving_prompt', 'is_forging', 'is_recalibrating', 'is_suggesting'];
            loadingFlags.forEach(flag => {
                if (State.get(flag)) State.set(flag, false);
            });
            State.set('is_error', error.message || error);
            Logger.userLog('ERR_VOID_REJECTION', 'error');
            
            throw error;
        }
    },

    async rotate_slot(slots, currentIndex) {
         // [V15.S³] Deterministic (tier × key) descent.
         // The user's preferredModel on the slot we are rotating from is the CEILING (upper bound).
         // We descend one tier at a time, never skipping, and for each tier we sweep every key
         // from the first. Selection keys off the TIER UNDER EVALUATION, not slots[i].currentModel,
         // so a LIVE intermediate tier can never be skipped in favour of a lower LIVE tier.
         const COOLDOWN = 24 * 60 * 60 * 1000;
         const now = Date.now();
         const isExpired = (slot, model) => {
             const t = slot.modelExhaustion?.[model];
             return !!t && (now - t < COOLDOWN);
         };

         const ceilingModel = slots[currentIndex].preferredModel || MODEL_HIERARCHY[0];
         let ceilingTier = MODEL_HIERARCHY.indexOf(ceilingModel);
         if (ceilingTier < 0) ceilingTier = 0;

         slots.forEach(s => { s.isActive = false; });

         for (let tierIndex = ceilingTier; tierIndex < MODEL_HIERARCHY.length; tierIndex++) {
             const model = MODEL_HIERARCHY[tierIndex];
             for (let i = 0; i < slots.length; i++) {
                 if (slots[i].apiKey && !isExpired(slots[i], model)) {
                     slots[i].isActive = true;
                     slots[i].currentModel = model; // chosen slot only; preferredModel (intent) untouched
                     if (tierIndex > ceilingTier) {
                         log('w', 'TIER_DESCENT', `Descending to ${model} on Slot ${slots[i].id}`);
                     }
                     log('LOGIC', 'KEY_TIER_SELECTED', { slot: slots[i].id, model });
                     await Storage.set({ api_slots: slots });
                     await Storage.set({ active_slot_index: i });
                     window.dispatchEvent(new CustomEvent('alchimist:api-rotation'));
                     return;
                 }
             }
         }

         // No (key, tier) pair selectable across the whole descent space.
         // Leave no slot active; transmute's iteration guard surfaces NUCLEAR_EXHAUSTION.
         log('w', 'API_ORCHESTRATOR', 'No non-expired (key, tier) pair available across descent space.');
         await Storage.set({ api_slots: slots });
         window.dispatchEvent(new CustomEvent('alchimist:api-rotation'));
    },

    repair(content) {
        let text = content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
        
        if (!text.startsWith("{")) text = "{" + text;
        if (!text.endsWith("}")) text += "}";
        
        text = text.replace(/("\s*:\s*")(.*?)("\s*[,}\]])/gs, (m, g1, g2, g3) => {
            return g1 + g2.replace(/\\"/g, '"').replace(/"/g, '\\"').replace(/\r?\n|\r/g, ' ') + g3;
        });

        try {
            const json = JSON.parse(text);
            log('DATA', 'LLM_RECOVERY_SUCCESS', '#resilience: Salvaged JSON via structural repair');
            return json;
        } catch (e) {
            log('e', 'LLM_RECOVERY_FAIL', '#critical: Structural repair failed.');
            return null;
        }
    },

    unbox(rawResponse) {
        // [ABORT-SETTLE] Aborted/suspended transmute resolves to null/undefined; empty or non-string
        // input carries no payload. Return a null sentinel instead of throwing on .trim() — callers
        // treat null as "no result, no error", so a user Cancel never reaches the ErrorCover.
        if (rawResponse == null || typeof rawResponse !== 'string' || rawResponse.trim() === '') {
            log('AI', 'UNBOX_NULL_GUARD', { reason: 'abort_or_empty' });
            return null;
        }
        let cleanText = rawResponse.trim();
        
        const originalText = cleanText;
        cleanText = cleanText.replace(/\}\s*\}\s*\]/g, ']\n  }\n]');
        cleanText = cleanText.replace(/\[\/[A-Z_]+\]$/i, '');

        // [V13.S³] Bracket-Mismatch Walker — repairs `]` where `}` is expected (and vice versa)
        // common LLM hallucination in nested score objects (output_linguistic_none_naturalness_score, forbidden_words, etc.)
        const _walked = LLM._repairBracketMismatches(cleanText);
        if (_walked !== cleanText) {
            cleanText = _walked;
            log('LOGIC', 'JSON_HEALER', 'Bracket-mismatch walker repaired closing tokens.');
        }

        if (originalText !== cleanText) {
            log('LOGIC', 'JSON_HEALER', 'Payload structurally sanitized prior to parsing.');
        }

        try {
            // [V18.7] Outermost Code-Block Heuristic: Fixes nested code block extraction issues.
            // When nested code blocks reside inside JSON text fields, standard lazy matches break.
            // We resolve this by programmatically tracking outer bounds.
            let blockMatch = null;
            if (/^\s*```/.test(cleanText)) {
                const lastBackticks = cleanText.lastIndexOf('```');
                if (lastBackticks > 0 && lastBackticks !== cleanText.indexOf('```')) {
                    const firstBackticksEnd = cleanText.indexOf('```') + 3;
                    let content = cleanText.substring(firstBackticksEnd, lastBackticks).trim();
                    if (content.startsWith('json')) {
                        content = content.substring(4).trim();
                    }
                    blockMatch = [null, content];
                }
            }

            if (blockMatch) {
                cleanText = blockMatch[1].trim();
            } else {
                // [Healer] Defensive fallback for narrow patterns the walker may have missed
                cleanText = cleanText.replace(/("is_(?:input|output)_ai_generated_score"\s*:\s*\{[^{}\[\]]*?)\]/g, '$1}');

                const firstBrace = cleanText.indexOf('{');
                const firstBracket = cleanText.indexOf('[');
                
                let start = (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) ? firstBrace : firstBracket;
                if (start === -1) throw new Error("No JSON boundaries found");

                const closeChar = cleanText[start] === '{' ? '}' : ']';
                let lastPossible = cleanText.lastIndexOf(closeChar);

                // Walk backwards from the last closing char to find the largest valid JSON chunk
                while (lastPossible > start) {
                    const candidate = cleanText.substring(start, lastPossible + 1);
                    try {
                        return JSON.parse(candidate);
                    } catch (inner) {
                        lastPossible = cleanText.lastIndexOf(closeChar, lastPossible - 1);
                    }
                }

                const salvaged = this.repair(cleanText);
                if (salvaged) return salvaged;

                throw new Error("UNBOX_WALK_FAIL");
            }
            return JSON.parse(cleanText);
        } catch (e) {
            log('e', 'LLM_UNBOX_CRITICAL_FAIL', { reason: e.message, raw: cleanText });
            const payload = { message: e.message, raw: cleanText };
            throw new Error(`UNBOX_FAIL: ${JSON.stringify(payload)}`);
        }
    },

    /**
     * Walk JSON text char-by-char honoring string/escape boundaries and a bracket stack.
     * When a closer arrives that does not match the innermost opener, replace it with
     * the expected closer. Symmetric for `}↔]`. Robust to nested arrays-in-objects.
     */
    _repairBracketMismatches(text) {
        let result = '';
        const stack = [];
        let inString = false;
        let escape = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (escape) { escape = false; result += c; continue; }
            if (c === '\\') { escape = true; result += c; continue; }
            if (c === '"') { inString = !inString; result += c; continue; }
            if (inString) { result += c; continue; }
            if (c === '{' || c === '[') {
                stack.push(c);
                result += c;
            } else if (c === '}' || c === ']') {
                if (stack.length === 0) { result += c; continue; }
                const opener = stack[stack.length - 1];
                const expected = (opener === '{') ? '}' : ']';
                if (expected !== c) {
                    result += expected;
                } else {
                    result += c;
                }
                stack.pop();
            } else {
                result += c;
            }
        }
        return result;
    }
};