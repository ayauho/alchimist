/**
 * @file components/core/Sanctuary.js
 * @purpose Orchestrates the output repository, applying design-system hooks, lifecycle guards, and top-first rendering.
 */
import { dom } from '../../utils/dom.js';
import { Storage } from '../../services/Storage.js';
import { Language } from '../../services/Language.js';
import { State } from '../../services/State.js';
import { Expander } from '../reusable/Expander.js';
import { Metrics } from './Sanctuary/Metrics.js';
import { Suggestions } from './Sanctuary/Suggestions.js';
import { ICONS } from '../../utils/assets.js';
import { LLM } from '../../services/LLM.js';
import { PromptCompiler } from '../../services/PromptCompiler.js';
import { Scraper } from '../../modules/Scraper.js';
import { log, Logger } from '../../utils/logger.js';
import { License } from '../../services/License.js';

/**
 * [V13.16] Cross-Boundary Injection Dispatcher
 * Transmits payload to the active substrate immediately after shell copy.
 */
function dispatchClipboardInjection(payloadText) {
    // [REVERT] Proven baseline: panel -> tab in ONE hop. No background relay and no
    // ensureSubstrate between focus-capture and injection — that relay re-ran injection logic
    // and broke the path that previously worked on Gemini. The script's presence is handled
    // separately (registration for granted origins + ensureSubstrate at panel-open / tab-switch).
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || !tabs.length) return;
        const tabId = tabs[0].id;
        chrome.tabs.sendMessage(tabId, { action: 'EXECUTE_CLIPBOARD_INJECTION', payload: payloadText })
            .catch(() => {});
        log('SYS', 'INJECTION_DISPATCHED', { tab: tabId, bytes: payloadText.length });
    });
}

/**
 * [V13.S³] Mathematical Alphanumeric Bold Mapper
 * Converts standard alphanumeric characters to Unicode Bold equivalents.
 */
function toUnicodeBold(str) {
    const map = {
        'A': '𝐀', 'B': '𝐁', 'C': '𝐂', 'D': '𝐃', 'E': '𝐄', 'F': '𝐅', 'G': '𝐆', 'H': '𝐇', 'I': '𝐈', 'J': '𝐉', 'K': '𝐊', 'L': '𝐋', 'M': '𝐌', 'N': '𝐍', 'O': '𝐎', 'P': '𝐏', 'Q': '𝐐', 'R': '𝐑', 'S': '𝐒', 'T': '𝐓', 'U': '𝐔', 'V': '𝐕', 'W': '𝐖', 'X': '𝐗', 'Y': '𝐘', 'Z': '𝐙',
        'a': '𝐚', 'b': '𝐛', 'c': '𝐜', 'd': '𝐝', 'e': '𝐞', 'f': '𝐟', 'g': '𝐠', 'h': '𝐡', 'i': '𝐢', 'j': '𝐣', 'k': '𝐤', 'l': '𝐥', 'm': '𝐦', 'n': '𝐧', 'o': '𝐨', 'p': '𝐩', 'q': '𝐪', 'r': '𝐫', 's': '𝐬', 't': '𝐭', 'u': '𝐮', 'v': '𝐯', 'w': '𝐰', 'x': '𝐱', 'y': '𝐲', 'z': '𝐳',
        '0': '𝟎', '1': '𝟏', '2': '𝟐', '3': '𝟑', '4': '𝟒', '5': '𝟓', '6': '𝟔', '7': '𝟕', '8': '𝟖', '9': '𝟗'
    };
    return str.split('').map(c => map[c] || c).join('');
}

/**
 * Scans text for **[...]** patterns and converts the content to Unicode Bold.
 */
function processBoldify(text) {
    if (!text) return text;
    return text.replace(/\*\*(.*?)\*\*/g, (match, p1) => toUnicodeBold(p1));
}

export class Sanctuary {
    constructor() {
        // [V13.FIX] State Isolation: Deliberately omitting is_error subscription to prevent UI collapse on ErrorCover dismissal
        this.isDestroyed = false;
        this.isHydrating = false;
        this.container = dom.create('div', 'u-flex u-flex-col flex-1 h-full u-w-full u-max-w-full overflow-hidden u-min-w-0');
        
        // Global listener to stop waiting animations upon successful render
        window.addEventListener('alchimist:render-complete', () => {
            State.set('is_increasing_value', false);
            State.set('is_decreasing_value', false);
        });

        // [V13.S³] Resident Logic Handshake
        this.updateHandler = async (e) => {
            // Suppress O(N) log spam during bulk list hydration
            if (Logger && Logger.setSilent) Logger.setSilent(true);
            try {
                const lastId = e.detail?.lastRecordId;
                await this.hydrateList(lastId);
            } finally {
                if (Logger && Logger.setSilent) Logger.setSilent(false);
                log('UI', 'SANCTUARY_STABILIZED', { action: 'hydrateList_complete' });
            }
        };
        window.addEventListener('alchimist:outputs-updated', this.updateHandler);
    }

    destroy() {
        this.isDestroyed = true;
        window.removeEventListener('alchimist:outputs-updated', this.updateHandler);
        
        // [V13.S³] Capture volatile posture before incineration
        if (this.listContainer) {
            const expanded = this.listContainer.querySelector('.is-expanded');
            State.update('sanctuary_state', {
                expandedId: expanded ? expanded.dataset.recordId : null,
                scrollPos: this.listContainer.scrollTop
            });
        }
    }

    render() {
        this.listContainer = dom.create('div', 'outputs-list u-w-full u-max-w-full u-overflow-x-hidden u-min-w-0 flex-1 overflow-y-auto p-2 u-flex u-flex-col gap-2 relative pb-[85vh] u-min-h-0');
        this.container.innerHTML = ''; 
        this.container.appendChild(this.listContainer);

        this.hydrateList();

        return this.container;
    }

    async hydrateList(targetId = null, retries = 3) {
        
        if (this.isHydrating || this.isDestroyed || !this.listContainer) return;
        
        this.isHydrating = true;
        let expectedId = targetId || window.__alchimistExpectedRecordId;
        const volatile = State.get('sanctuary_state') || { isFirstEntry: true, expandedId: null, scrollPos: 0 };

        try {
            const records = await Storage.get('currentOutputs') || [];
            if (this.isDestroyed) return;

            // [V13.S³] Intelligence Map: pre-load into State so renderCardContent (lazy) can access it synchronously
            const intelligenceMap = await Storage.get('intelligence_record_map') || {};
            State.set('intelligence_record_map', intelligenceMap);

            const isStale = expectedId && !records.find(r => r.id === expectedId);
            
            if (records.length === 0 || isStale) {
                if (retries > 0) {
                    await new Promise(r => requestAnimationFrame(r));
                    this.isHydrating = false;
                    return this.hydrateList(targetId, retries - 1);
                }
                // [FIX] Retries exhausted. A genuinely empty store shows the placeholder
                // and stops. But if records exist and only the expected id is unresolvable
                // (stale / cross-type / FIFO-pruned), do NOT bail — clear the dead focus
                // target and fall through to render what we actually have.
                if (records.length === 0) {
                    this.listContainer.innerHTML = '';
                    this.listContainer.appendChild(this.createPlaceholder());
                    window.dispatchEvent(new CustomEvent('alchimist:render-complete'));
                    return;
                }
                window.__alchimistExpectedRecordId = null;
                expectedId = null;
            }

            // [V17] Proactive storage prune + display cap: enforce Config.maxSavedOutputs on
            // both the rendered list and chrome.storage. Storage.set's FIFO interceptor handles
            // the timestamp-sorted slice; the local .slice() cap is the immediate display guard.
            const _limCfg = await Storage.get('config') || {};
            const _dispLimit = _limCfg.maxSavedOutputs || 20;
            if (records.length > _dispLimit) {
                await Storage.set({ currentOutputs: records });
            }

            // [V13.S³] Top-First Rendering Strategy
            const sorted = [...records].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            
            // [V13.S³] Transactional Focus Protocol
            let focusId = expectedId && !isStale ? expectedId : volatile.expandedId;
            if (expectedId && !isStale) {
                window.__alchimistExpectedRecordId = null;
            } else if (volatile.isFirstEntry && sorted.length > 0) {
                focusId = sorted[0].id; // Expand top item on virgin visit
                State.update('sanctuary_state', { isFirstEntry: false });
            }

            // [V13.S³] Anti-Flicker Cloak
            this.listContainer.style.opacity = '0';

            this.listContainer.innerHTML = '';
            sorted.slice(0, _dispLimit).forEach(r => this.listContainer.appendChild(this.renderCardShell(r)));

            log('DATA', 'SUBSTRATE_SETTLED', { count: Math.min(sorted.length, _dispLimit), total: records.length, limit: _dispLimit });
            
            if (focusId) {
                const isInstant = !expectedId;
                // If we have volatile scrollPos, skip the focus scroll so volatile pos takes precedence
                const skipFocusScroll = isInstant && volatile.scrollPos > 0;
                this.engageFocus(focusId, isInstant, skipFocusScroll);
            }
            
            // [V13.S³] Precise State Restoration Gate
            const isRestoring = volatile.scrollPos > 0 && !expectedId;
            if (isRestoring) {
                setTimeout(() => {
                    if (this.listContainer && !this.isDestroyed) {
                        this.listContainer.scrollTop = volatile.scrollPos;
                        this.listContainer.style.opacity = '1';
                        log('DATA', 'GEOMETRY_FINALITY', { id: 'restoration', actualH: this.listContainer.scrollHeight, targetScroll: volatile.scrollPos });
                        log('DATA', 'SCROLL_METRICS', { scrollTop: this.listContainer.scrollTop, expected: volatile.scrollPos });
                    }
                    window.dispatchEvent(new CustomEvent('alchimist:render-complete'));
                }, 30); // Allow native Expander rAF to evaluate heights
            } else {
                setTimeout(() => {
                    if (this.listContainer && !this.isDestroyed) {
                        this.listContainer.style.opacity = '1';
                    }
                    window.dispatchEvent(new CustomEvent('alchimist:render-complete'));
                }, 10);
            }

        } catch (error) {
            log('e', 'SANCTUARY_HYDRATION_FAILED', error);
            State.set('is_error', error);
        } finally {
            this.isHydrating = false;
        }
    }

    async engageFocus(focusId, instant = false, skipScroll = false) {
        if (this.isDestroyed || !this.listContainer) return;
        
        const target = this.listContainer.querySelector(`[data-record-id="${focusId}"]`) || 
                       Array.from(this.listContainer.children).find(c => c.innerHTML.includes(focusId));

        if (target) {
            // Guard against redundant ongoing scroll commands for this target
            if (target.dataset.scrollLock) return;
            target.dataset.scrollLock = 'true';

            const header = target.querySelector('.expander-header') || target.firstElementChild;

            if (header && !target.classList.contains('is-expanded')) {
                // Set flag to prevent onExpand from triggering another engageFocus loop
                target.dataset.programmaticExpand = 'true';
                header.click();
            }
            
            // [V13.S³] Geometric Finality Yield
            const executeScroll = () => {
                if (this.isDestroyed || !this.listContainer) return;
                delete target.dataset.scrollLock;
                delete target.dataset.programmaticExpand;
                
                if (!skipScroll) {
                    const targetScroll = Math.max(0, target.offsetTop - 8);
                    this.listContainer.scrollTo({ top: targetScroll, behavior: instant ? 'auto' : 'smooth' });
                    log('DATA', 'GEOMETRY_FINALITY', { id: focusId, actualH: this.listContainer.scrollHeight, targetScroll });
                    log('DATA', 'SCROLL_METRICS', { scrollTop: this.listContainer.scrollTop, expected: targetScroll });
                }
                log('UI', 'FOCUS_ENGAGED', { id: focusId });
            };

            if (instant) {
                setTimeout(() => executeScroll(), 25);
            } else {
                setTimeout(() => executeScroll(), 350);
            }
        }
    }

    createPlaceholder() {
        const p = dom.create('div', 'view-placeholder flex-1 flex flex-col items-center justify-center opacity-50 m-auto mt-10');
        p.innerHTML = `
            <div class="mb-4 text-accent/50">${ICONS.FLASK || ''}</div>
            <p class="text-xs uppercase tracking-widest font-bold text-white">${Language.text('MSG_CRUCIBLE_COLD')}</p>
            <p class="text-[10px] mt-2 text-text-secondary">${Language.text('MSG_CRUCIBLE_SUBTITLE')}</p>
        `;
        return p;
    }

    renderNexusThread(texts, recordId) {
        const threadContainer = dom.create('div', 'nexus-thread-container flex flex-col gap-2 mt-2 w-full');
        const groupId = `nexus-${recordId}`;

        const truncateHeader = (text) => {
            const clean = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
            return clean.length > 60 ? clean.substring(0, 60) + '...' : clean;
        };

        texts.forEach((text, index) => {
            const partNum = index + 1;
            const isFirst = index === 0;
            
            const partExpander = new Expander({
                title: `<span class="u-truncate-single block w-full">${isFirst ? `Part ${partNum}` : truncateHeader(text)}</span>`,
                isExpanded: isFirst,
                groupId: groupId,
                onToggle: (isExpanded) => {
                    const titleEl = partExpander.header ? (partExpander.header.querySelector('.expander-title') || partExpander.header.querySelector('.expandable-title')) : null;
                    if (titleEl) {
                        titleEl.classList.add('u-min-w-0', 'u-w-full');
                        titleEl.innerHTML = `<span class="u-truncate-single block w-full">${isExpanded ? `Part ${partNum}` : truncateHeader(text)}</span>`;
                    }
                }
            });

            const content = dom.create('div', 'nexus-part-content text-[13px] leading-relaxed opacity-90 p-2 whitespace-pre-wrap relative group');
            const processedText = State.get('boldify_enhancement') ? processBoldify(text) : text;
            content.innerHTML = `<div class="nexus-text-substrate">${processedText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
            
            // Tiny Inline Copy Button
            const copyBtn = dom.create('button', 'nexus-inline-copy absolute top-1 right-1 p-1 rounded bg-white/5 border border-white/10 text-text-secondary hover:text-white hover:bg-white/10 transition-all opacity-40 group-hover:opacity-100 flex items-center justify-center');
            copyBtn.style.width = '18px';
            copyBtn.style.height = '18px';
            copyBtn.title = Language.text('LABEL_COPY') || 'Copy Part';
            copyBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
            
            copyBtn.onclick = (e) => {
                e.stopPropagation();
                if (Logger.lockSync) Logger.lockSync(500);
                navigator.clipboard.writeText(text).then(() => {
                    dispatchClipboardInjection(text);
                    log('UI', 'NEXUS_PART_COPIED', { part: partNum, recordId });
                    const original = copyBtn.innerHTML;
                    copyBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00ff9f" stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                    setTimeout(() => { if (document.body.contains(copyBtn)) copyBtn.innerHTML = original; }, 300);
                }).catch(err => {
                    log('e', 'COPY_ERROR', err.message);
                });
            };
            
            content.appendChild(copyBtn);
            
            threadContainer.appendChild(partExpander.render(content));
        });

        return threadContainer;
    }

    // [V13.FIX] Output text sanitization (Comma logic)
    _sanitize(text) {
        if (!text || typeof text !== 'string') return text || '';
        text = text.replace(/,([^\s])/g, ', $1');
        text = text.replace(/ ,/g, ',');
        text = text.replace(/(\d), (\d)/g, '$1,$2');
        return text;
    }

    renderCardShell(record) {
        const meta = record.meta || {};
        const data = Array.isArray(record.output) ? record.output[0] : record.output || {};
        
        // [V13.FIX] Subtitle propagation logic recalibration (Data-driven mode detection)
        const hasVariations = Array.isArray(data.variations) && data.variations.length > 0;
        const targetData = hasVariations ? data.variations[0] : data;
        const rawPreview = typeof targetData === 'string' ? targetData : (targetData?.text || targetData?.content || '');
        const preview = this._sanitize(typeof rawPreview === 'string' ? rawPreview : '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const expander = new Expander({
            stretchTitle: true,
            title: `
                <div class="flex items-center gap-[6px] text-[10px] u-w-full u-max-w-full u-min-w-0">
                    <span class="text-accent font-bold truncate flex-shrink-1">${meta.personaName || 'Unknown'}</span>
                    <span class="text-[#333] flex-shrink-0">・</span>
                    <span class="text-[#d1d5db] uppercase font-bold tracking-wider truncate flex-shrink-1">${meta.strategyLabel || 'REWRITE'}</span>
                </div>`,
            id: `exp-${record.id}`,
            lazy: true,
            onExpand: (container) => {
                if (container && !container.dataset.programmaticExpand) {
                    this.engageFocus(record.id, false);
                }
            },
            onFirstExpand: (exp) => {
                exp.body.style.visibility = 'hidden';
                exp.body.style.height = '0px';
                exp.body.style.overflow = 'hidden';
                
                this.renderCardContent(record, exp.contentWrapper);
                
                requestAnimationFrame(() => {
                    if (this.isDestroyed) return;
                    const targetH = exp.contentWrapper.scrollHeight;
                    exp.body.style.visibility = 'visible';
                    exp.body.style.height = ''; 
                    exp.body.style.maxHeight = targetH + 'px';
                    log('UI', 'CARD_EXPANDED', { id: record.id });
                });
            }
        });

        const node = expander.render();
        node.dataset.recordId = record.id;
        
        // [V13.S³] Native Scroll-Authority Fallback for Manual Clicks
        const expanderHeader = node.querySelector('.expander-header') || node.firstElementChild;
        if (expanderHeader) {
            expanderHeader.addEventListener('click', () => {
                if (!node.dataset.programmaticExpand) {
                    setTimeout(() => {
                        if (node.classList.contains('is-expanded')) {
                            this.engageFocus(record.id, false);
                        }
                    }, 10);
                }
            });
        }

        const sub = dom.create('div', 'sanctuary-subtitle text-[#a1a1aa] text-[10px] u-truncate-single mt-[2px] opacity-80', { 
            innerHTML: preview 
        });
        expander.header.querySelector('.expandable-title-group').appendChild(sub);

        return node;
    }

    renderCardContent(record, wrapper) {
        const data = Array.isArray(record.output) ? record.output[0] : record.output || {};
        const variations = data.variations && Array.isArray(data.variations) ? data.variations : null;
        
        const card = dom.create('div', 'result-card u-flex u-flex-col u-w-full u-max-w-full u-min-w-0');
        card.setAttribute('data-record-id', record.id);
        
        // 1. Header Area
        const header = dom.create('div', 'card-header u-flex u-flex-col gap-1 u-w-full u-max-w-full u-min-w-0 u-items-stretch');
        header.innerHTML = `<span class="text-[#a1a1aa] text-[10px] font-medium italic leading-tight">${record.meta?.personaDescription || ''}</span>`;

        // [V13.S³] Peer-Intent Intelligence Context Display
        const _intelMap  = State.get('intelligence_record_map') || {};
        const _intelMeta = _intelMap[record.id];
        if (_intelMeta && _intelMeta.peer_name && _intelMeta.intent_text) {
            const peerIntentEl = dom.create('div', 'peer-intent flex flex-col gap-0.5 mt-1 pb-1 border-b border-white/5');
            const truncIntent  = _intelMeta.intent_text.length > 60 ? _intelMeta.intent_text.substring(0, 60) + '…' : _intelMeta.intent_text;
            peerIntentEl.innerHTML = `<span class="text-[10px] text-[#6366f1] font-medium leading-tight">⊕ ${_intelMeta.peer_name}</span><span class="text-[9px] text-[#a1a1aa] italic truncate leading-tight">${truncIntent}</span>`;
            header.appendChild(peerIntentEl);
        }

        const signalHeader = dom.create('div', 'sanctuary-signal-header mt-1 u-hidden');
        header.appendChild(signalHeader);
        const aiSignal = dom.create('div', 'sanctuary-ai-signal font-bold text-white u-hidden');
        header.appendChild(aiSignal);
        card.appendChild(header);

        // 2. Variation Tabs
        if (variations) {
            const tabsContainer = dom.create('div', 'variation-tabs flex gap-1 mb-2 w-full');
            variations.forEach((_, idx) => {
                const v = variations[idx];
                const label = (v.emoji && v.mood) ? `${v.emoji} ${v.mood}` : `${Language.text('LABEL_VARIATION')} ${idx + 1}`;
                const btn = dom.create('button', `variation-tab ${idx === 0 ? 'variation-tab--active' : ''}`, {
                    innerText: label,
                    title: label,
                    onclick: () => this.applyVariation(card, record, v, idx)
                });
                tabsContainer.appendChild(btn);
            });
            card.appendChild(tabsContainer);
        }

        // 3. Dynamic Content Wrappers
        card.appendChild(dom.create('div', 'output-text-content relative flex flex-col w-full text-[13px] leading-relaxed text-white/90 whitespace-pre-wrap'));
        card.appendChild(dom.create('div', 'metrics-wrapper w-full'));
        card.appendChild(dom.create('div', 'suggestions-wrapper-main w-full'));

        // 4. Actions Area
        const actions = dom.create('div', 'sanctuary-actions-area');
        actions.innerHTML = `<span class="sanctuary-actions-label">Actions</span>`;
        const copyBtn = dom.create('button', 'copy-trigger', {
            innerHTML: `${ICONS.PASTE || ''} <span class="text-[10px] font-bold tracking-wider uppercase">${Language.text('BTN_COPY')}</span>`
        });
        actions.appendChild(copyBtn);
        card.appendChild(actions);
        wrapper.appendChild(card);

        // 5. Initial Hydration
        this.applyVariation(card, record, variations ? variations[0] : data, 0);
    }

    applyVariation(card, record, data, index) {
        if (!data) return;
        
        // [V13.S³] State Synchronization Restoration
        State.update({
            ...(record.config || {}),
            'active_record_id': record.id,
            'active_variation_index': index
        });

        const isNexus = Array.isArray(data.text);
        
        let textsToRender = isNexus ? [...data.text] : null;
        const baseText = isNexus 
            ? textsToRender.join('\n\n')
            : this._sanitize(data.text || data.content || data.material_audit || '');

        const snappedDirective = record.directive || record.config?.directive || '';
        
        // [V16.SIG] Sovereign Mirroring — substrate truth ONLY (signature-free).
        // INVARIANT: MIRROR(record.id) ≡ baseText so REFINEMENT_CONTEXT inherits a pristine
        // [PREVIOUS_GENERATION_STATE]. Signature exists strictly downstream of this seam.
        Storage.buffer_mirror(record.id, baseText);

        // [V16.SIG] Terminal Visual Posture — derive signature-decorated projection for UI + clipboard.
        // Boldify is NOT applied here; it remains owned by each terminal sink to prevent double-application.
        const displaySpec = this.decorateForOutput(baseText, textsToRender, isNexus);
        const contentText = State.get('boldify_enhancement') ? processBoldify(displaySpec.text) : displaySpec.text;

        const contentNode = card.querySelector('.output-text-content');
        if (isNexus) {
            contentNode.innerHTML = '';
            contentNode.appendChild(this.renderNexusThread(displaySpec.parts, record.id));
        } else {
            contentNode.innerHTML = contentText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        // Forensic Signal Update
        const signalHeader = card.querySelector('.sanctuary-signal-header');
        const parentData = Array.isArray(record.output) ? record.output[0] : record.output || {};
        const signalText = data.context_data_in_one_sentence || parentData.context_data_in_one_sentence;

        if (signalText) {
            signalHeader.innerText = signalText;
            signalHeader.classList.remove('u-hidden');
        } else {
            signalHeader.classList.add('u-hidden');
        }

        // AI Detection Signal Update
        const aiSignal = card.querySelector('.sanctuary-ai-signal');
        const aiData = data.input_linguistic_none_naturalness_score || parentData.input_linguistic_none_naturalness_score;
        if (aiData) {
            const metricsValues = Object.values(aiData);
            const average = metricsValues.reduce((a, b) => parseInt(a) + parseInt(b), 0) / metricsValues.length;
            const naturalness = Math.max(0, 100 - Math.round(average * 10));
            aiSignal.innerText = `${window.text('METRIC_NATURALNESS')}: ${naturalness}%`;
            aiSignal.classList.remove('u-hidden');
        } else {
            aiSignal.classList.add('u-hidden');
        }

        // Geometric Metrics Refresh
        const metricsWrapper = card.querySelector('.metrics-wrapper');
        metricsWrapper.innerHTML = '';
        metricsWrapper.appendChild(Metrics.render(data.metrics, record.id, index, snappedDirective));

        // Suggestion Chip Deployment
        const suggestionsWrapper = card.querySelector('.suggestions-wrapper-main');
        suggestionsWrapper.innerHTML = '';
        suggestionsWrapper.appendChild(Suggestions.render(data.suggestions, record.id, index, snappedDirective));

        // Tab Posture
        card.querySelectorAll('.variation-tab').forEach((tab, idx) => {
            if (idx === index) {
                tab.classList.add('variation-tab--active');
            } else {
                tab.classList.remove('variation-tab--active');
            }
        });

        // Copy Interlock
        const copyBtn = card.querySelector('.copy-trigger');
        copyBtn.onclick = (e) => this.handleCopy(e.currentTarget, displaySpec.text);

        log('UI', 'MATRIX_TAB_CLICKED', { recordId: record.id, index });

        // [V13.S³] Inject length controls inline at the end of the content
        this.injectLengthControls(contentNode, record.id, index, snappedDirective);

        // [V13.S³] Image Prompt Injection
        const textNode = card.querySelector('.output-text-content');
        const metricsWrapperNode = card.querySelector('.metrics-wrapper');
        if (textNode && metricsWrapperNode) {
            this._injectImagePrompt(card, textNode, metricsWrapperNode, data, record.id, index);
        }
    }

    // [V16.SIG] Render-phase decorator — SOLE owner of the Signature seam.
    // Returns { text, parts }: `text` is the joined string for non-nexus UI + global clipboard;
    // `parts` is the per-part array (signature on last element) for nexus render + per-part copy.
    // Pure projection: never persisted, never mirrored, mutates no state.
    decorateForOutput(baseText, textsToRender, isNexus) {
        // [PREMIUM] Free tier: signature is force-applied (watermark) and cannot be removed,
        // regardless of the toggle's DOM/State value (devtools-proof enforcement seam).
        const _forceSig = !License.isPremium();
        const isSigActive = _forceSig || State.get('signature');
        const sigText = _forceSig
            ? (Language.text('SIGNATURE_DEFAULT') || 'Transmuted via ΔLCHIMIST 🧪')
            : State.get('protocol_signature_text');

        if (!isSigActive || !sigText) {
            return { text: baseText, parts: isNexus ? [...textsToRender] : null };
        }

        if (isNexus && Array.isArray(textsToRender) && textsToRender.length > 0) {
            const parts = [...textsToRender];
            parts[parts.length - 1] += '\n\n' + sigText;
            log('UI', 'SIGNATURE_DECORATED', { isNexus: true, sigLen: sigText.length });
            return { text: parts.join('\n\n'), parts };
        }

        log('UI', 'SIGNATURE_DECORATED', { isNexus: false, sigLen: sigText.length });
        return { text: baseText + '\n\n' + sigText, parts: null };
    }

    handleCopy(btn, text) {
        // [V13.S³] Claim Clipboard Sovereignty
        if (Logger.lockSync) Logger.lockSync(500);

        const finalizedText = State.get('boldify_enhancement') ? processBoldify(text) : text;

        navigator.clipboard.writeText(finalizedText).then(() => {
            dispatchClipboardInjection(finalizedText);
            const originalHtml = btn.innerHTML;
            btn.innerHTML = `${ICONS.CHECK || '✓'} <span class="text-[10px] font-bold">COPIED</span>`;
            btn.classList.add('text-success');
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.classList.remove('text-success');
            }, 500);
        }).catch(err => {
            log('e', 'COPY_ERROR', err.message);
            State.set('is_error', err);
        });
    }

    /**
     * [V13.S³] Inline Length Modulators
     * Dispatches REFINEMENT_REQUEST via global Event Bridge.
     */
    injectLengthControls(contentNode, recordId, targetIdx, directive) {
        if (!contentNode || contentNode.querySelector('.output-text__inline-actions')) return;
        
        const actions = dom.create('span', 'output-text__inline-actions');
        
        const dispatch = (token) => {
            const suggestion = Language.text(token);
            log('UI', 'LENGTH_MOD_REQUEST', { suggestion, recordId });
            
            if (token === 'SUGGESTION_INCREASE_LENGTH') State.set('is_increasing_length', true);
            if (token === 'SUGGESTION_DECREASE_LENGTH') State.set('is_decreasing_length', true);

            window.dispatchEvent(new CustomEvent('REFINEMENT_REQUEST', {
                detail: { suggestion, originalId: recordId, targetIdx, directive }
            }));
        };

        const decBtn = dom.create('button', '', { 
            innerText: '◀', 
            title: 'Decrease Length',
            onclick: () => dispatch('SUGGESTION_DECREASE_LENGTH')
        });
        
        const incBtn = dom.create('button', '', { 
            innerText: '▶', 
            title: 'Increase Length',
            onclick: () => dispatch('SUGGESTION_INCREASE_LENGTH')
        });
        
        actions.append(decBtn, incBtn);
        contentNode.appendChild(actions);
    }

    _injectImagePrompt(card, textNode, metricsWrapper, data, recordId, activeIndex = 0) {
        log('LOGIC', 'INJECT_START', { recordId, activeIndex });
        
        const existing = card.querySelector('.addon-image-prompt-wrapper');
        if (existing) existing.remove();

        const targetPrompt = data?.image_prompt;
        
        log('DATA', 'PROMPT_RESOLVED', { targetPrompt: targetPrompt ? 'Found' : 'Missing' });

        if (!targetPrompt) return;

        const wrapper = dom.create('div', 'addon-image-prompt-wrapper w-full mt-2 mb-2 px-3');
        
        const truncate = (str, len) => str && str.length > len ? str.substring(0, len) + '...' : str;
        const collapsedTitle = `🖼️ ${truncate(targetPrompt, 40)}`;
        const expandedTitle = `🖼️ ${Language.text('LABEL_IMAGE_PROMPT_TITLE') || 'Image Prompt'}`;

        const expander = new Expander({
            title: collapsedTitle,
            id: `exp-img-${recordId || Math.random().toString(36).substr(2, 9)}-${activeIndex}`,
            groupId: `img-prompt-${recordId || 'untracked'}`,
            isDominantConfig: false,
            onToggle: (isExpanded) => {
                const titleNode = wrapper.querySelector('.expandable-title');
                if (titleNode) {
                    titleNode.innerText = isExpanded ? expandedTitle : collapsedTitle;
                }
            }
        });

        const content = dom.create('div', 'flex flex-col gap-2 p-2');
        const promptText = dom.create('div', 'text-xs text-white/80 whitespace-pre-wrap select-text', { innerText: targetPrompt });
        
        const actionsRow = dom.create('div', 'flex items-center gap-4 mt-1');

        const improveBtn = dom.create('button', 'flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-indigo-400 hover:text-indigo-300 transition-colors py-1 w-fit');
        improveBtn.innerHTML = `${ICONS.REFRESH || '◌'} ${Language.text('LABEL_IMPROVE_PROMPT')}`;

        improveBtn.addEventListener('click', async () => {
            const records = await Storage.get('currentOutputs') || [];
            const record = records.find(r => r.id === recordId);
            if (!record) return;

            const targetData = Array.isArray(record.output) ? record.output[0] : record.output || {};
            const isVariant = Array.isArray(targetData.variations);
            
            const originalPrompt = promptText.innerText.replace(/\[!!\].*/g, '').trim();
            const generatedText = isVariant ? targetData.variations[activeIndex].text : targetData.text;

            improveBtn.disabled = true;
            improveBtn.innerHTML = `<span class="animate-spin mr-1">◌</span> ${Language.text('MSG_IMPROVING')}`;

            // [V13] UI Orchestration: Trigger global waiting cover
            State.set('is_improving_prompt', true);

            try {
    const contextSnapshot = (record.dna && Object.keys(record.dna).length > 0) 
        ? record.dna 
        : await Scraper.extract().catch(() => ({ 
            ctrl_a_text: State.get('ctrl_a_text') || '',
            selected_text: State.get('selected_text') || '',
            context_structure: State.get('context_structure') || ''
        }));
                
    const activePersonaId = record.meta?.personaId || State.get('active_persona_id');
    const personas = await Storage.get('personas') || [];
    const activePersona = personas.find(p => p.id === activePersonaId) || {};

    const forgeRequest = PromptCompiler.compile({
        type: 'image_prompt_improvement',
        context: contextSnapshot,
        persona: activePersona,
        config: { sigil: 'ALPHA' },
        generatedText,
                    originalPrompt
                });

                log('DATA', 'PROMPT_FORGE_VERIFICATION', forgeRequest);

                const raw_response = await LLM.transmute(forgeRequest);
                const parsed = LLM.unbox(raw_response);
                
                let refinedPrompt = Array.isArray(parsed) ? parsed[0]?.image_prompt : parsed?.image_prompt;

                if (!refinedPrompt) throw new Error("Invalid JSON schema or Empty AI response");
                
                refinedPrompt = String(refinedPrompt).replace(/\[!!\].*/g, '').trim();

                if (isVariant && targetData.variations[activeIndex]) targetData.variations[activeIndex].image_prompt = refinedPrompt;
                else targetData.image_prompt = refinedPrompt;
                
                await Storage.set({ currentOutputs: records });
                promptText.innerText = refinedPrompt;
                log('AI', 'IMAGE_PROMPT_IMPROVED', { recordId, activeIndex });
            } catch (err) {
                log('e', 'IMPROVE_DISPATCH_ERROR', err.message);
                //promptText.innerText = originalPrompt + `\n\n[!!] ${Language.text('ERR_IMPROVE_FAILED')}`;
            } finally {
                improveBtn.disabled = false;
                improveBtn.innerHTML = `${ICONS.REFRESH || '◌'} ${Language.text('LABEL_IMPROVE_PROMPT')}`;
                // [V13] UI Orchestration: Release global waiting cover
                State.set('is_improving_prompt', false);
            }
        });

        const copyBtn = dom.create('button', 'flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-[#d4af37] hover:text-white transition-colors py-1 w-fit');
        copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy Prompt`;
        
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (Logger.lockSync) Logger.lockSync(500);
            const text = promptText.innerText.replace(/\r\n/g, '\n');
            navigator.clipboard.writeText(text).then(() => {
                dispatchClipboardInjection(promptText.innerText);
                log('UI', 'IMAGE_PROMPT_COPIED', { recordId: recordId });
                copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
                setTimeout(() => {
                    if (document.body.contains(copyBtn)) {
                        copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy Prompt`;
                    }
                }, 500);
            }).catch(err => {
                log('e', 'COPY_ERROR', err.message);
            });
        });

        content.appendChild(promptText);
        actionsRow.appendChild(improveBtn);
        actionsRow.appendChild(copyBtn);
        content.appendChild(actionsRow);

        wrapper.appendChild(expander.render(content));
        metricsWrapper.parentNode.insertBefore(wrapper, metricsWrapper);
        log('UI', 'EXPANDER_MOUNTED', { recordId });
    }
}