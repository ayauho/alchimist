/**
 * @file components/core/Library.js
 * @purpose UI: Long-form article archive — generation output manifold.
 *          Mirrors Sanctuary's hydration/focus/anti-flicker; adds attributes expander + multi-image-prompt array.
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
import { log, Logger } from '../../utils/logger.js';
import { ArchiveResonance } from '../../modules/ArchiveResonance.js';

function dispatchClipboardInjection(payloadText) {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'EXECUTE_CLIPBOARD_INJECTION', payload: payloadText }).catch(() => {});
            }
        });
    }
}

export class Library {
    constructor() {
        this.isDestroyed = false;
        this.isHydrating = false;
        this.container = dom.create('div', 'u-flex u-flex-col flex-1 h-full u-w-full u-max-w-full overflow-hidden u-min-w-0');

        // Global listener to stop waiting animations upon successful render
        window.addEventListener('alchimist:render-complete', () => {
            State.set('is_increasing_value', false);
            State.set('is_decreasing_value', false);
        });

        this.updateHandler = async (e) => {
            const lastId = e && e.detail && e.detail.lastRecordId;
            await this.hydrateList(lastId);
        };
        window.addEventListener('library:articles-updated', this.updateHandler);
    }

    destroy() {
        this.isDestroyed = true;
        window.removeEventListener('library:articles-updated', this.updateHandler);
    }

    render() {
        this.listContainer = dom.create('div', 'library-list u-w-full u-max-w-full u-overflow-x-hidden u-min-w-0 flex-1 overflow-y-auto p-2 u-flex u-flex-col gap-2 relative pb-[85vh] u-min-h-0');
        this.container.innerHTML = '';
        this.container.appendChild(this.listContainer);
        this.hydrateList();
        return this.container;
    }

    async hydrateList(targetId = null) {
        if (this.isHydrating || this.isDestroyed || !this.listContainer) return;
        this.isHydrating = true;
        try {
            const records = (await Storage.get('libraryArticles')) || [];

            // [DEFENSIVE] If Storage.get did not dearchive (legacy bundle / race), restore output locally
            // so metrics/suggestions/text survive page reloads.
            for (const rec of records) {
                if (rec && rec.isArchived && rec._archivedOutput && (rec.output == null)) {
                    try {
                        const decompressed = await ArchiveResonance.decompress(rec._archivedOutput);
                        const parsed = (typeof decompressed === 'string') ? JSON.parse(decompressed) : decompressed;
                        if (rec._archiveV === 2) {
                            rec.output = parsed.output;
                            rec.config = parsed.config;
                            rec.dna = parsed.dna;
                            rec._archiveV = undefined;
                        } else {
                            rec.output = parsed;
                        }
                        rec.isArchived = false;
                        rec._archivedOutput = null;
                        log('DATA', 'LIBRARY_DEARCHIVE_FALLBACK', { id: rec.id, restored: !!rec.output });
                    } catch (deErr) {
                        log('e', 'LIBRARY_DEARCHIVE_FALLBACK_FAIL', { id: rec.id, msg: deErr.message });
                    }
                }
            }

            if (this.isDestroyed) return;
            if (records.length === 0) {
                this.listContainer.innerHTML = '';
                this.listContainer.appendChild(this.createPlaceholder());
                return;
            }
            // [V17] Display cap mirrors Config.maxSavedArticles; re-write to trigger Storage.set
            // FIFO if accumulated records exceed the limit (parallels the Sanctuary output cap).
            const _libCfg = await Storage.get('config') || {};
            const _libLimit = (_libCfg.maxSavedArticles == null) ? 10 : _libCfg.maxSavedArticles;
            if (records.length > _libLimit) {
                await Storage.set({ libraryArticles: records });
            }
            const sorted = [...records].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            const focusId = targetId || sorted[0].id;
            this.listContainer.style.opacity = '0';
            this.listContainer.innerHTML = '';
            sorted.slice(0, _libLimit).forEach(r => this.listContainer.appendChild(this.renderCardShell(r)));
            log('UI', 'LIBRARY_RENDER', { count: Math.min(sorted.length, _libLimit), total: records.length, limit: _libLimit });
            if (focusId) {
                setTimeout(() => this.engageFocus(focusId, true), 25);
            }
            setTimeout(() => { if (this.listContainer && !this.isDestroyed) this.listContainer.style.opacity = '1'; }, 30);
        } catch (err) {
            log('e', 'LIBRARY_HYDRATION_FAILED', err);
            State.set('is_error', err);
        } finally {
            this.isHydrating = false;
        }
    }

    createPlaceholder() {
        const p = dom.create('div', 'view-placeholder flex-1 flex flex-col items-center justify-center opacity-50 m-auto mt-10');
        p.innerHTML = `
            <div class="mb-4 text-accent/50">${ICONS.BOOK_OPEN || ICONS.FLASK || ''}</div>
            <p class="text-xs uppercase tracking-widest font-bold text-white">${Language.text('TITLE_LIBRARY')}</p>
            <p class="text-[10px] mt-2 text-text-secondary">${Language.text('MSG_LIBRARY_EMPTY')}</p>
        `;
        return p;
    }

    async engageFocus(focusId, instant = false) {
        if (this.isDestroyed || !this.listContainer) return;
        const target = this.listContainer.querySelector(`[data-record-id="${focusId}"]`);
        if (!target) return;
        const header = target.querySelector('.expandable-header');
        if (header && !target.classList.contains('is-expanded')) {
            target.dataset.programmaticExpand = 'true';
            header.click();
        }
        setTimeout(() => {
            delete target.dataset.scrollLock;
            delete target.dataset.programmaticExpand;
            const targetScroll = Math.max(0, target.offsetTop - 8);
            this.listContainer.scrollTo({ top: targetScroll, behavior: instant ? 'auto' : 'smooth' });
            log('UI', 'LIBRARY_FOCUS_ENGAGED', { id: focusId });
        }, instant ? 30 : 350);
    }

    renderCardShell(record) {
        const meta = record.meta || {};
        const data = Array.isArray(record.output) ? record.output[0] : record.output || {};
        const preview = (typeof data.text === 'string' ? data.text : (data.context_data_in_one_sentence || '')).substring(0, 120).replace(/</g, '&lt;');
        const expander = new Expander({
            stretchTitle: true,
            title: `<div class="flex items-center gap-[6px] text-[10px] u-w-full u-max-w-full u-min-w-0"><span class="text-accent font-bold truncate flex-shrink-1">${meta.articleTitle || 'Article'}</span></div>`,
            id: `exp-${record.id}`,
            lazy: true,
            onToggle: (isExpanded) => {
                if (isExpanded) {
                    if (typeof log === 'function') log('UI', 'LIBRARY_FOCUS_ENGAGED', { id: record.id });
                    setTimeout(() => {
                        if (this.isDestroyed || !this.listContainer) return;
                        const el = document.getElementById(`exp-${record.id}`);
                        if (el) {
                            const targetScroll = Math.max(0, el.offsetTop - 8);
                            this.listContainer.scrollTo({ top: targetScroll, behavior: 'smooth' });
                            if (typeof log === 'function') log('DATA', 'GEOMETRY_FINALITY', { id: record.id, targetScroll });
                        }
                    }, 420);
                }
            },
            onFirstExpand: (exp) => {
                this.renderCardContent(record, exp.contentWrapper);
                requestAnimationFrame(() => {
                    if (this.isDestroyed) return;
                    const targetH = exp.contentWrapper.scrollHeight;
                    exp.body.style.maxHeight = targetH + 'px';
                });
            }
        });
        const node = expander.render();
        node.dataset.recordId = record.id;
        const sub = dom.create('div', 'library-subtitle text-[#a1a1aa] text-[10px] u-truncate-single mt-[2px] opacity-80', { innerHTML: preview });
        expander.header.querySelector('.expandable-title-group').appendChild(sub);
        return node;
    }

    renderCardContent(record, wrapper) {
        const data = Array.isArray(record.output) ? record.output[0] : record.output || {};
        const card = dom.create('div', 'result-card article-card u-flex u-flex-col u-w-full u-max-w-full u-min-w-0');
        card.setAttribute('data-record-id', record.id);

        // 1) Attributes expander — placed BEFORE signal-header per spec
        const attrs = (record.dna && record.dna.attributes) || {};
        const attrBody = dom.create('div', 'article-attributes-body flex flex-col gap-2 text-[12px] leading-relaxed');
        // Canonical attribute order — mirrors the Article.js editor field sequence so
        // Library rows match Forge -> Article create/edit exactly. Object.entries()
        // follows insertion order, which varies across autofill / partial-save paths.
        const ATTR_ORDER = [
            'title', 'theme', 'audience', 'tone', 'narrativeModel', 'narrativeAnchor',
            'complication', 'format', 'wordCount', 'requiredContent', 'verification'
        ];
        const orderedKeys = [
            ...ATTR_ORDER.filter(k => k in attrs),
            ...Object.keys(attrs).filter(k => !ATTR_ORDER.includes(k))
        ];
        for (const key of orderedKeys) {
            const value = attrs[key];
            if (value == null || value === '') continue;
            const row = dom.create('div', 'article-attribute-row flex gap-2');
            row.appendChild(dom.create('span', 'article-attribute-key font-bold text-text-secondary', { innerText: key + ':' }));
            row.appendChild(dom.create('span', 'article-attribute-val text-text-primary break-words', { innerText: String(value) }));
            attrBody.appendChild(row);
        }
        const attrExpander = new Expander({
            title: `<span class="text-accent font-bold">${attrs.title || Language.text('LABEL_ARTICLE_ATTRIBUTES')}</span>`,
            id: `exp-attrs-${record.id}`,
            groupId: `attrs-${record.id}`,
            onToggle: (isExp) => log('UI', 'ATTRIBUTES_EXPANDER_TOGGLED', { recordId: record.id, expanded: isExp })
        });
        const attrNode = attrExpander.render(attrBody);
        attrNode.classList.add('article-attributes-expander');
        card.appendChild(attrNode);

        // 2) Signal header
        const signalHeader = dom.create('div', 'article-signal-header sanctuary-signal-header mt-1', {
            innerText: data.context_data_in_one_sentence || ''
        });
        if (!data.context_data_in_one_sentence) signalHeader.classList.add('u-hidden');
        card.appendChild(signalHeader);

        // 3) Output text
        const textNode = dom.create('div', 'output-text-content relative flex flex-col w-full text-[13px] leading-relaxed text-white/90 whitespace-pre-wrap');
        textNode.innerHTML = (data.text || '').replace(/</g, '&lt;');
        card.appendChild(textNode);

        // 4) Metrics
        const metricsWrapper = dom.create('div', 'metrics-wrapper w-full');
        metricsWrapper.appendChild(Metrics.render(data.metrics, record.id, 0, record.config && record.config.directive || ''));
        card.appendChild(metricsWrapper);

        // 5) Suggestions
        const suggestionsWrapper = dom.create('div', 'suggestions-wrapper-main w-full');
        suggestionsWrapper.appendChild(Suggestions.render(data.suggestions, record.id, 0, record.config && record.config.directive || ''));
        card.appendChild(suggestionsWrapper);

        // 6) Actions
        const actions = dom.create('div', 'sanctuary-actions-area');
        actions.innerHTML = `<span class="sanctuary-actions-label">Actions</span>`;
        const copyBtn = dom.create('button', 'copy-trigger', {
            innerHTML: `${ICONS.PASTE || ''} <span class="text-[10px] font-bold tracking-wider uppercase">${Language.text('BTN_COPY')}</span>`
        });
        copyBtn.onclick = () => this.handleCopy(copyBtn, data.text || '');
        actions.appendChild(copyBtn);
        card.appendChild(actions);

        // 7) Length controls inline
        this.injectLengthControls(textNode, record.id, 0, record.config && record.config.directive || '');

        // 8) Multiple image prompts (1..3)
        this.injectMultipleImagePrompts(card, record, data);

        wrapper.appendChild(card);
    }

    handleCopy(btn, text) {
        if (Logger.lockSync) Logger.lockSync(500);
        navigator.clipboard.writeText(text).then(() => {
            dispatchClipboardInjection(text);
            const original = btn.innerHTML;
            btn.innerHTML = `${ICONS.CHECK || '✓'} <span class="text-[10px] font-bold">COPIED</span>`;
            setTimeout(() => { btn.innerHTML = original; }, 500);
        }).catch(err => log('e', 'COPY_ERROR', err.message));
    }

    injectLengthControls(contentNode, recordId, targetIdx, directive) {
        if (!contentNode || contentNode.querySelector('.output-text__inline-actions')) return;
        const actions = dom.create('span', 'output-text__inline-actions');
        const dispatch = (token) => {
            const suggestion = Language.text(token);
            if (token === 'SUGGESTION_INCREASE_LENGTH') State.set('is_increasing_length', true);
            if (token === 'SUGGESTION_DECREASE_LENGTH') State.set('is_decreasing_length', true);
            window.dispatchEvent(new CustomEvent('REFINEMENT_REQUEST', { detail: { suggestion, originalId: recordId, targetIdx, directive } }));
        };
        const dec = dom.create('button', '', { innerText: '◀', title: 'Decrease Length', onclick: () => dispatch('SUGGESTION_DECREASE_LENGTH') });
        const inc = dom.create('button', '', { innerText: '▶', title: 'Increase Length', onclick: () => dispatch('SUGGESTION_INCREASE_LENGTH') });
        actions.append(dec, inc);
        contentNode.appendChild(actions);
    }

    injectMultipleImagePrompts(card, record, data) {
        let prompts = data && data.image_prompt;
        if (prompts == null) return;
        if (typeof prompts === 'string') prompts = [prompts];
        if (!Array.isArray(prompts) || prompts.length === 0) return;
        prompts.forEach((prompt, idx) => {
            if (!prompt) return;
            this._buildImagePromptExpander(card, record, prompt, idx);
        });
    }

    _buildImagePromptExpander(card, record, prompt, idx) {
        const wrapper = dom.create('div', 'addon-image-prompt-wrapper w-full mt-2 mb-2 px-3');
        const truncate = (str, len) => str && str.length > len ? str.substring(0, len) + '...' : str;
        const titleN = Language.text('LABEL_IMAGE_PROMPT_TITLE_N').replace('{n}', idx + 1);
        const collapsedTitle = `🖼️ ${titleN} — ${truncate(prompt, 40)}`;
        const expandedTitle = `🖼️ ${titleN}`;
        const expander = new Expander({
            title: collapsedTitle,
            id: `exp-img-${record.id}-${idx}`,
            groupId: `img-prompt-${record.id}`,
            onToggle: (isExpanded) => {
                const titleNode = wrapper.querySelector('.expandable-title');
                if (titleNode) titleNode.innerText = isExpanded ? expandedTitle : collapsedTitle;
            }
        });

        const content = dom.create('div', 'flex flex-col gap-2 p-2');
        const promptText = dom.create('div', 'text-xs text-white/80 whitespace-pre-wrap select-text', { innerText: prompt });
        const actionsRow = dom.create('div', 'flex items-center gap-4 mt-1');

        const improveBtn = dom.create('button', 'flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-indigo-400 hover:text-indigo-300 transition-colors py-1 w-fit');
        improveBtn.innerHTML = `${ICONS.REFRESH || '◌'} ${Language.text('LABEL_IMPROVE_PROMPT')}`;
        improveBtn.addEventListener('click', async () => {
            const records = (await Storage.get('libraryArticles')) || [];
            const rec = records.find(r => r.id === record.id);
            if (!rec) return;
            const recData = Array.isArray(rec.output) ? rec.output[0] : rec.output || {};
            const originalPrompt = promptText.innerText.replace(/\[!!\].*/g, '').trim();
            const generatedText = recData.text || '';
            improveBtn.disabled = true;
            improveBtn.innerHTML = `<span class="animate-spin mr-1">◌</span> ${Language.text('MSG_IMPROVING')}`;
            State.set('is_improving_prompt', true);
            try {
                const activePersonaId = (rec.meta && rec.meta.personaId) || State.get('active_persona_id');
                const personas = (await Storage.get('personas')) || [];
                const activePersona = personas.find(p => p.id === activePersonaId) || {};
                const _resolvedMaterials = window.ArticleMaterialsService
                    ? await window.ArticleMaterialsService.resolveMaterials(rec)
                    : ((rec.dna && rec.dna.materials) || []);
                const forgeRequest = PromptCompiler.compile({
                    type: 'image_prompt_improvement',
                    context_kind: 'article',
                    materials: _resolvedMaterials,
                    persona: activePersona,
                    config: { sigil: 'ALPHA' },
                    generatedText,
                    originalPrompt
                });
                const raw = await LLM.transmute(forgeRequest);
                const parsed = LLM.unbox(raw);
                let refinedPrompt = Array.isArray(parsed) ? parsed[0]?.image_prompt : parsed?.image_prompt;
                if (!refinedPrompt) throw new Error('Invalid AI response');
                refinedPrompt = String(refinedPrompt).replace(/\[!!\].*/g, '').trim();
                // Update the array slot for this idx
                const arr = Array.isArray(recData.image_prompt) ? recData.image_prompt.slice() : [recData.image_prompt];
                arr[idx] = refinedPrompt;
                recData.image_prompt = arr;
                await Storage.set({ libraryArticles: records });
                promptText.innerText = refinedPrompt;
                log('AI', 'ARTICLE_IMAGE_PROMPT_IMPROVED', { recordId: record.id, idx });
            } catch (err) {
                log('e', 'ARTICLE_IMPROVE_DISPATCH_ERROR', err.message);
                promptText.innerText = prompt + `\n\n[!!] ${Language.text('ERR_IMPROVE_FAILED')}`;
            } finally {
                improveBtn.disabled = false;
                improveBtn.innerHTML = `${ICONS.REFRESH || '◌'} ${Language.text('LABEL_IMPROVE_PROMPT')}`;
                State.set('is_improving_prompt', false);
            }
        });

        const copyBtn = dom.create('button', 'flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-[#d4af37] hover:text-white transition-colors py-1 w-fit');
        copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy Prompt`;
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (Logger.lockSync) Logger.lockSync(500);
            navigator.clipboard.writeText(promptText.innerText).then(() => {
                dispatchClipboardInjection(promptText.innerText);
                log('UI', 'IMAGE_PROMPT_COPIED', { recordId: record.id, idx });
            }).catch(err => log('e', 'COPY_ERROR', err.message));
        });

        content.appendChild(promptText);
        actionsRow.appendChild(improveBtn);
        actionsRow.appendChild(copyBtn);
        content.appendChild(actionsRow);
        wrapper.appendChild(expander.render(content));
        card.appendChild(wrapper);
    }
}
