/**
 * @file components/core/Forge/Article.js
 * @purpose UI: Article substrate manager — Forge → Articles expander.
 *          Owns the article list, edit/delete, selection, and stage-aware subtitle.
 */
import { Expander } from '../../reusable/Expander.js';
import { dom } from '../../../utils/dom.js';
import { State } from '../../../services/State.js';
import { log } from '../../../utils/logger.js';
import { Storage } from '../../../services/Storage.js';
import { ICONS } from '../../../utils/assets.js';
import { Confirmation } from '../../reusable/Confirmation.js';
import { Editor } from '../../reusable/Editor.js';
import { Language } from '../../../services/Language.js';
import { LLM } from '../../../services/LLM.js';
import { PromptCompiler } from '../../../services/PromptCompiler.js';
import { Logger } from '../../../utils/logger.js';
import { ArticleTutorial } from '../../tutorial/ArticleTutorial.js';

export class Article {
    constructor(container) {
        this.container = container;
        this.id = 'exp-article';
        this.items = [];
        this.isEditing = false;
        this.editingId = null;
        this.editorInstance = null;

        this.handleCreateClicked = () => {
            log('LOGIC', 'CREATE_ARTICLE_SIGNAL_RECEIVED', { instance: this.id });
            this.mountEditorOverlay();
        };
        this.handleNewMaterials = (e) => this._onNewMaterials(e.detail || {});

        this.unsubscribers = [];
        const debouncedSubtitle = () => {
            clearTimeout(this._subtitleTimer);
            this._subtitleTimer = setTimeout(() => this.updateExpanderSubtitleByStage(), 60);
        };
        this.unsubscribers.push(State.subscribe('active_article_id', () => { debouncedSubtitle(); this.refresh(); }));
        this.unsubscribers.push(State.subscribe('interactionType',   debouncedSubtitle));
        this.unsubscribers.push(State.subscribe('articles',          (items) => { if (Array.isArray(items)) { this.items = items; this.refresh(); }}));

        this.expander = new Expander({
            id: this.id,
            title: Language.text('TITLE_ARTICLES'),
            isDominantConfig: true,
            premiumLocked: true,
            groupId: 'forge-main',
            onToggle: (isExpanded) => State.set('is_managing_articles', isExpanded)
        });

        window.addEventListener('CREATE_ARTICLE_CLICKED', this.handleCreateClicked);
        window.addEventListener('TRANSMUTATION_NEW_MATERIALS', this.handleNewMaterials);
        log('LIFECYCLE', 'ARTICLE_INSTANCE_CREATED', { containerId: container.id });
    }

    // [V18.2] Renamed initialize() -> render() to conform to the orchestrator's
    // awaitable mount contract. Forge.render() now awaits this inside Promise.all,
    // so the article expander settles within the FORGE_HYDRATION_SETTLED window.
    async render() {
        const stored = await Storage.get('articles');
        this.items = Array.isArray(stored) ? stored : [];
        State.set('articles', this.items);

        const savedActive = await Storage.get('active_article_id');
        State.set('active_article_id', savedActive || null);

        const node = this.expander.render();
        this.container.appendChild(node);

         // [V13] Inline X clear button on the expander header — mirrors the pattern used in
         // Forge/Intelligence._clearBtn. Visibility is reconciled by updateExpanderSubtitleByStage()
         // based on the presence of an active_article_id. Initially hidden because no article is
         // selected at mount time unless one was persisted; updateExpanderSubtitleByStage() is
         // invoked immediately below and will reveal the button if so.
         if (this.expander.header && this.expander.iconEl) {
             this._clearBtn = dom.create('button', 'menu__item ml-1 z-10 relative text-white/30 hover:text-red-400 transition-colors', {
                 innerHTML: ICONS.CLEAR,
                 title: 'Clear active article',
                 onclick: (e) => { e.stopPropagation(); this._clearActiveArticle(); }
             });
             this._clearBtn.style.display = 'none';
             this.expander.header.insertBefore(this._clearBtn, this.expander.iconEl);
         }

        this.refresh();
        this.updateExpanderSubtitleByStage();
        log('UI', 'ARTICLE_EXPANDER_RENDERED', { count: this.items.length });
    }

    updateExpanderSubtitleByStage() {
        if (!this.expander) return;
        const activeId = State.get('active_article_id');
         // Header clear-button visibility tracks selection presence — gated here so all entry
         // points (selection, deselection, deletion, preset restore) converge on a single rule.
         if (this._clearBtn) this._clearBtn.style.display = activeId ? '' : 'none';
         if (!activeId) { this.expander.updateSubtitle(null); return; }
         const article = this.items.find(a => a.id === activeId);
         if (!article) { this.expander.updateSubtitle(null); return; }
         const strategy = State.get('interactionType') || 'rewrite';
         const token = (strategy === 'article') ? 'STAGE_ARTICLE_GENERATION' : 'STAGE_ARTICLE_PREPARATION';
         const title = (article.attributes && article.attributes.title) || '?';

         // [V13] Two-tone subtitle: the article title (with its surrounding quote characters) renders
         // in full white; the "Stage: article" prefix and the "preparation"/"generation" suffix render
         // dimmed via opacity-50. The template's quote characters that frame {title} are pulled out of
         // the prefix/suffix segments so the title visually owns its punctuation and the dimming does
         // not bleed onto the quotes immediately adjacent to the white title text.
         const tmpl = Language.text(token);
         const parts = tmpl.split('{title}');
         const escape = (s) => String(s)
             .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
         const beforeRaw = (parts[0] || '').replace(/"\s*$/, '');
         const afterRaw  = (parts[1] || '').replace(/^\s*"/, '');
         const html = `<span class="opacity-50">${escape(beforeRaw)}</span><span>"${escape(title)}"</span><span class="opacity-50">${escape(afterRaw)}</span>`;
         this.expander.updateSubtitleHTML(html);
         log('LOGIC', 'ARTICLE_STAGE_SWITCH', { stage: strategy === 'article' ? 'generation' : 'preparation' });
    }

    refresh() {
        const body = this.expander && this.expander.body;
        if (!body) return;
        body.innerHTML = '';
        body.appendChild(this.renderList());
    }

    renderList() {
        const listWrapper = dom.create('div', 'article-list flex flex-col w-full');
        if (!this.items || this.items.length === 0) {
            listWrapper.appendChild(dom.create('div', 'text-xs text-text-secondary italic text-center p-4', {
                innerText: Language.text('MSG_NO_ARTICLES')
            }));
            return listWrapper;
        }

        const activeId = State.get('active_article_id');
        this.items.forEach(item => {
            const isActive = activeId === item.id;
            const row = dom.create('div', 'article-item item-row flex items-center justify-between p-3 border-b border-zinc-800 hover:bg-white/5 transition-colors cursor-pointer w-full min-w-0 overflow-hidden');
            row.onclick = () => this.handleRowClick(item);

            const left = dom.create('div', 'item-row__left flex-shrink-0 mr-4');
            left.innerHTML = `<div class="radio-indicator w-4 h-4 rounded-full border-2 border-zinc-600 ${isActive ? 'bg-zinc-600 border-zinc-600 is-checked' : ''}"></div>`;
            left.onclick = (e) => { e.stopPropagation(); this.handleRowClick(item); };

            const middle = dom.create('div', 'item-row__middle flex flex-col flex-1 w-0 min-w-0 overflow-hidden py-1 gap-1');
            const titleEl = dom.create('div', 'article-name font-bold text-sm text-text-primary break-words leading-tight', {
                innerText: (item.attributes && item.attributes.title) || '(untitled)'
            });
            const countWrap = dom.create('div', 'materials-count text-[10px] text-text-secondary flex items-center gap-1', {
                innerText: Language.text('LABEL_MATERIALS_COUNT').replace('{n}', item.materialsCount || 0)
            });
            const lastBatchAdded = (typeof item.lastBatchAddedCount === 'number') ? item.lastBatchAddedCount : 0;
            if (lastBatchAdded > 0) {
                const deltaEl = dom.create('span', 'materials-count__delta ml-1', { innerText: `+${lastBatchAdded}` });
                countWrap.appendChild(deltaEl);
                log('UI', 'ARTICLE_DELTA_REVEALED', { id: item.id, delta: lastBatchAdded });
            }
            middle.appendChild(titleEl);
            middle.appendChild(countWrap);
            if (item.advice && typeof item.advice === 'string' && item.advice.trim()) {
                 // [V13] Advice row: text + inline copy button. copy-trigger class exempts the
                 // button from Expander's outside-click collapse guard so a clipboard tap never
                 // accidentally collapses the Articles expander.
                 const adviceWrap = dom.create('div', 'flex items-start gap-1.5 min-w-0');
                 const adviceEl = dom.create('div', 'materials-advice text-[11px] text-text-secondary italic break-words leading-tight opacity-80 flex-1 min-w-0', {
                     innerText: Language.text('LABEL_MATERIALS_ADVICE').replace('{advice}', item.advice.trim())
                 });
                 const copyAdviceBtn = dom.create('button', 'copy-trigger text-zinc-600 hover:text-blue-400 transition-colors shrink-0 flex items-center justify-center rounded p-0.5 hover:bg-white/5', {
                     title: 'Copy advice',
                     innerHTML: ICONS.PASTE
                 });
                 copyAdviceBtn.onclick = (e) => {
                     e.stopPropagation();
                     const text = item.advice.trim();
                     log('UI', 'ARTICLE_ADVICE_COPY', { id: item.id });
                     navigator.clipboard.writeText(text).then(() => {
                         copyAdviceBtn.innerHTML = ICONS.CHECK;
                         setTimeout(() => { copyAdviceBtn.innerHTML = ICONS.PASTE; }, 1500);
                     }).catch((err) => {
                         log('e', 'ARTICLE_ADVICE_COPY_FAIL', { id: item.id, err: err.message });
                     });
                 };
                 adviceWrap.appendChild(adviceEl);
                 adviceWrap.appendChild(copyAdviceBtn);
                 middle.appendChild(adviceWrap);
            }

            const right = dom.create('div', 'item-row__right flex items-center gap-1 shrink-0 pr-2');
            const btnClass = 'text-zinc-600 hover:text-blue-400 transition-colors p-1.5 rounded flex items-center justify-center hover:bg-white/5';
            const btnEdit = dom.create('button', btnClass, { title: 'Edit Article' });
            btnEdit.innerHTML = ICONS.EDIT || '✎';
             const svgE = btnEdit.querySelector('svg');
             if (svgE) { svgE.style.width = '16px'; svgE.style.height = '16px'; } else { btnEdit.style.fontSize = '16px'; }
            btnEdit.onclick = (e) => { e.stopPropagation(); this.mountEditorOverlay(item); };
            const btnDelete = dom.create('button', btnClass.replace('hover:text-blue-400', 'hover:text-red-400'), { title: 'Delete Article' });
            btnDelete.innerHTML = ICONS.TRASH || '✕';
             const svgD = btnDelete.querySelector('svg');
             if (svgD) { svgD.style.width = '16px'; svgD.style.height = '16px'; } else { btnDelete.style.fontSize = '16px'; }
            btnDelete.onclick = async (e) => {
                e.stopPropagation();
                const ok = await Confirmation.show(Language.text('BTN_DELETE'), Language.text('CONFIRM_DELETE_ARTICLE'));
                if (ok) await this.deleteArticle(item.id);
            };
            right.appendChild(btnEdit);
            right.appendChild(btnDelete);

            row.appendChild(left);
            row.appendChild(middle);
            row.appendChild(right);
            listWrapper.appendChild(row);
        });

        return listWrapper;
    }

    async handleRowClick(item) {
        const currentActive = State.get('active_article_id');
        const isReselect = (currentActive === item.id);
        if (isReselect) {
            State.set('active_article_id', null);
            await Storage.set({ active_article_id: null });
            log('UI', 'ARTICLE_DESELECTED', { id: item.id });
        } else {
            State.set('active_article_id', item.id);
            await Storage.set({ active_article_id: item.id });
            // Reset latest-batch accent on the selected item (acknowledgement)
            const target = this.items.find(a => a.id === item.id);
            if (target) {
                target.lastBatchAddedCount = 0;
                await Storage.set({ articles: this.items });
                State.set('articles', this.items);
            }
            log('UI', 'ARTICLE_SELECTED', { id: item.id });
        }
        this.updateExpanderSubtitleByStage();
        this.refresh();
    }

    async _onNewMaterials({ articleId, addedCount }) {
        if (!articleId) return;
        const article = this.items.find(a => a.id === articleId);
        if (!article) return;
        article.materialsCount = (article.materials || []).length;
        // lastSyncCount NOT touched here — selection event owns the reset
        await Storage.set({ articles: this.items });
        State.set('articles', this.items);
        log('DATA', 'ARTICLE_NEW_MATERIALS_DELTA', { articleId, addedCount });
        this.refresh();
    }

    mountEditorOverlay(item = null) {
        if (State.get('is_editor_active')) return;
        if (this.isEditing) return;
        this.isEditing = true;
        this.editingId = item ? item.id : null;
        State.set('is_article_editor_active', true);

        const attrs = (item && item.attributes) || {};
        const editor = new Editor({
            caption: item ? Language.text('TITLE_EDIT_ARTICLE') : Language.text('TITLE_CREATE_ARTICLE'),
            captionClass: 'input-label text-[10px]',
            saveText:   Language.text('BTN_SAVE'),
            cancelText: Language.text('BTN_CANCEL'),
            onSave: async (data) => {
                const title = (data.articleTitle || '').trim();
                if (!title) throw new Error('Article title required');
                const attributes = {
                    title,
                    theme:           (data.articleTheme || '').trim(),
                    audience:        (data.articleAudience || '').trim(),
                    tone:            (data.articleTone || '').trim(),
                    narrativeModel:  (data.articleNarrativeModel || '').trim() || 'wsj_kabob',
                    narrativeAnchor: (data.articleNarrativeAnchor || '').trim(),
                    complication:    (data.articleComplication || '').trim(),
                    format:          (data.articleFormat || '').trim(),
                    wordCount:       (data.articleWordCount || '').toString().trim(),
                    requiredContent: (data.articleRequiredContent || '').trim(),
                    verification:    (data.articleVerification || '').trim()
                };
                if (this.editingId) {
                    const target = this.items.find(x => x.id === this.editingId);
                    if (target) target.attributes = attributes;
                } else {
                    await this.createArticle(attributes);
                }
                await Storage.set({ articles: this.items });
                State.set('articles', this.items);
            },
            onCancel: () => this.closeEditor()
        });

        editor.add('input',    { id: 'articleTitle',           label: 'LABEL_ARTICLE_TITLE',           value: attrs.title,           placeholder: Language.text('PLACEHOLDER_ARTICLE_TITLE') });
        editor.add('textarea', { id: 'articleTheme',           label: 'LABEL_ARTICLE_THEME',           value: attrs.theme });
        editor.add('textarea', { id: 'articleAudience',        label: 'LABEL_ARTICLE_AUDIENCE',        value: attrs.audience });
        editor.add('textarea', { id: 'articleTone',            label: 'LABEL_ARTICLE_TONE',            value: attrs.tone });
        editor.add('input',    { id: 'articleNarrativeModel',  label: 'LABEL_ARTICLE_NARRATIVE_MODEL', value: attrs.narrativeModel,  placeholder: 'wsj_kabob | jon_franklin | high_fives | right_side_up_pyramid | inverted_pyramid' });
        editor.add('textarea', { id: 'articleNarrativeAnchor', label: 'LABEL_ARTICLE_ANCHOR',          value: attrs.narrativeAnchor });
        editor.add('textarea', { id: 'articleComplication',    label: 'LABEL_ARTICLE_COMPLICATION',    value: attrs.complication });
        editor.add('input',    { id: 'articleFormat',          label: 'LABEL_ARTICLE_FORMAT',          value: attrs.format });
        editor.add('input',    { id: 'articleWordCount',       label: 'LABEL_ARTICLE_WORD_COUNT',      value: attrs.wordCount,       inputType: 'number' });
        editor.add('textarea', { id: 'articleRequiredContent', label: 'LABEL_ARTICLE_REQUIRED_CONTENT',value: attrs.requiredContent });
        editor.add('textarea', { id: 'articleVerification',    label: 'LABEL_ARTICLE_VERIFICATION',    value: attrs.verification });

        this.editorInstance = editor;
        editor.show();
        // [V17] Inject the AI auto-fill control into the editor header (.input-label caption).
        this._mountAutoFillButton(editor);
        // [ARTICLE] Inject the "how it works" help control beside the editor title.
        this._mountHelpButton(editor);
    }

    // [V17] Article field IDs paired with their i18n label tokens — single source for
    // both the auto-fill prompt's field roster and the empty-field reconciler.
    _articleFieldLabels() {
        return {
            articleTitle:           'LABEL_ARTICLE_TITLE',
            articleTheme:           'LABEL_ARTICLE_THEME',
            articleAudience:        'LABEL_ARTICLE_AUDIENCE',
            articleTone:            'LABEL_ARTICLE_TONE',
            articleNarrativeModel:  'LABEL_ARTICLE_NARRATIVE_MODEL',
            articleNarrativeAnchor: 'LABEL_ARTICLE_ANCHOR',
            articleComplication:    'LABEL_ARTICLE_COMPLICATION',
            articleFormat:          'LABEL_ARTICLE_FORMAT',
            articleWordCount:       'LABEL_ARTICLE_WORD_COUNT',
            articleRequiredContent: 'LABEL_ARTICLE_REQUIRED_CONTENT',
            articleVerification:    'LABEL_ARTICLE_VERIFICATION'
        };
    }

    _mountAutoFillButton(editor) {
        // The Editor overlay is appended to document.body on show(); its header carries the
        // captionClass (.input-label). Anchor the button at the right of that caption node.
        const overlay = editor.overlay;
        if (!overlay) return;
        const caption = overlay.querySelector('.input-label');
        if (!caption) return;
        caption.classList.add('flex', 'items-center', 'justify-between', 'gap-2');

        const btn = dom.create('button', 'article-autofill-btn', {
            innerText: Language.text('BTN_AUTOFILL_ARTICLE'),
            title: 'You can use imperatives and attachments to clarify requirements'
        });
        btn.setAttribute('data-action', 'article:autofill');
        btn.onclick = (e) => { e.stopPropagation(); this._handleAutoFill(editor, btn); };
        caption.appendChild(btn);
        this._autoFillBtn = btn;

        // Live enable/disable reconciliation across every field.
        const reconcile = () => this._reconcileAutoFill(editor, btn);
        editor.fields.forEach((field) => {
            if (field.element) field.element.addEventListener('input', reconcile);
        });
        this._autoFillReconcile = reconcile;
        // Reconcile when the in-flight flag flips so the button re-enables on completion.
        this._autoFillUnsub = State.subscribe('is_completing_article', reconcile);
        reconcile();
        log('UI', 'ARTICLE_AUTOFILL_BTN_MOUNTED', {});
    }

    // [ARTICLE] Mount a bright "?" help control to the RIGHT of the editor title.
    // Reuses ICONS.HOW_IT_WORKS (help-circle); clicking opens the article tutorial.
    // Runs after _mountAutoFillButton, so the autofill control already lives in the
    // caption; we group [title + "?"] on the left and let justify-between keep the
    // autofill button on the right.
    _mountHelpButton(editor) {
        const overlay = editor && editor.overlay;
        if (!overlay) return;
        const caption = overlay.querySelector('.input-label');
        if (!caption) return;
        if (caption.querySelector('.article-help-btn')) return;
        caption.classList.add('flex', 'items-center', 'justify-between', 'gap-2');

        const title = this.editingId ? Language.text('TITLE_EDIT_ARTICLE') : Language.text('TITLE_CREATE_ARTICLE');
        const leftGroup = dom.create('div', 'flex items-center gap-1.5 min-w-0');
        const titleSpan = dom.create('span', 'truncate', { innerText: title });

        const helpBtn = dom.create('button', 'article-help-btn text-white/70 hover:text-white transition-colors shrink-0 flex items-center justify-center rounded p-0.5 hover:bg-white/5', {
            title: Language.text('ART_TUT_HELP_TOOLTIP'),
            innerHTML: ICONS.HOW_IT_WORKS
        });
        const svg = helpBtn.querySelector('svg');
        if (svg) { svg.style.width = '14px'; svg.style.height = '14px'; }
        helpBtn.onclick = (e) => { e.stopPropagation(); ArticleTutorial.forceShow(); };

        leftGroup.appendChild(titleSpan);
        leftGroup.appendChild(helpBtn);

        // Strip the original bare title text node, then anchor the grouped title at the front.
        Array.from(caption.childNodes).forEach((n) => { if (n.nodeType === Node.TEXT_NODE) caption.removeChild(n); });
        caption.insertBefore(leftGroup, caption.firstChild);
        log('UI', 'ARTICLE_HELP_BTN_MOUNTED', {});
    }

    _reconcileAutoFill(editor, btn) {
        if (!btn || !editor) return;
        const titleField = editor.fields.get('articleTitle');
        const title = (titleField && titleField.element) ? titleField.element.value.trim() : '';
        const ids = Object.keys(this._articleFieldLabels());
        const hasEmpty = ids.some(id => {
            const f = editor.fields.get(id);
            return f && f.element && f.element.value.trim() === '';
        });
        const inFlight = !!State.get('is_completing_article');
        const enabled = title.length >= 10 && hasEmpty && !inFlight;
        btn.disabled = !enabled;
    }

    async _handleAutoFill(editor, btn) {
        if (btn && btn.disabled) return;
        const titleField = editor.fields.get('articleTitle');
        const title = (titleField && titleField.element) ? titleField.element.value.trim() : '';
        if (title.length < 10) { Logger.userLog('MSG_AUTOFILL_NO_TITLE', 'warning'); return; }

        State.set('is_completing_article', true);
        log('AI', 'ARTICLE_AUTOFILL_STARTED', { titleLen: title.length });
        try {
            const values = editor.getValues();
            const fieldLabels = {};
            const labelTokens = this._articleFieldLabels();
            Object.keys(labelTokens).forEach(id => { fieldLabels[id] = Language.text(labelTokens[id]); });

            const imperatives = await Storage.get('imperatives') || [];
            // [MODEL-B] Align with Footer: selection SoT is the active id-set; fall back to
            // `.used` for pre-id-set data. The registry still carries content for the prompt.
            const _reg = (await Storage.get('attachments_registry')) || [];
            const _activeIds = await Storage.get('attachments_active_ids');
            const attachments = Array.isArray(_activeIds)
                ? _reg.filter(a => a && _activeIds.includes(a.id))
                : _reg.filter(a => a && a.used);

            const prompt = PromptCompiler.compile({
                type: 'article_attributes_completion',
                attributes: values,
                fieldLabels,
                imperatives,
                attachments
            });
            log('AI', 'ARTICLE_AUTOFILL_PROMPT', prompt);
            console.log('[ARTICLE_AUTOFILL_PROMPT]\n' + prompt);
            const raw = await LLM.transmute(prompt);
            const json = LLM.unbox(raw);

            if (json && typeof json === 'object') {
                Object.keys(json).forEach(id => {
                    const f = editor.fields.get(id);
                    const val = json[id];
                    if (f && f.element && f.element.value.trim() === '' && val !== undefined && val !== null && String(val).trim()) {
                        f.element.value = String(val).trim();
                    }
                });
                // [V22] AI autofill assigns input.value directly, which fires no 'input'
                // event — re-run the editor's textarea growth so saturated fields expand to
                // reveal their full content (matches the typing path).
                editor.refreshHeights();
                log('DATA', 'ARTICLE_AUTOFILL_APPLIED', { keys: Object.keys(json).length });
                Logger.userLog('MSG_AUTOFILL_DONE', 'success');
            }
        } catch (e) {
            if (e && e.name === 'AbortError') { log('w', 'ARTICLE_AUTOFILL_ABORTED', {}); }
            else { log('AI', 'ARTICLE_AUTOFILL_ERROR', { error: e && e.message }); }
        } finally {
            State.set('is_completing_article', false);
            if (this._autoFillReconcile) this._autoFillReconcile();
        }
    }

    closeEditor() {
        this.isEditing = false;
        this.editingId = null;
        this.editorInstance = null;
        if (this._autoFillUnsub) { this._autoFillUnsub(); this._autoFillUnsub = null; }
        this._autoFillBtn = null;
        this._autoFillReconcile = null;
        State.set('is_article_editor_active', false);
        this.refresh();
    }

    async createArticle(attributes) {
        const record = {
            id: 'article_' + crypto.randomUUID(),
            attributes,
            materials: [],
            materialsCount: 0,
            lastSyncCount: 0,
            createdAt: Date.now()
        };
        this.items.push(record);
        State.set('active_article_id', record.id);
        await Storage.set({ active_article_id: record.id });
        log('DATA', 'ARTICLE_CREATED', { id: record.id, title: attributes.title });
    }

    async deleteArticle(id) {
        this.items = this.items.filter(a => a.id !== id);
        await Storage.set({ articles: this.items });
        State.set('articles', this.items);
        if (State.get('active_article_id') === id) {
            State.set('active_article_id', null);
            await Storage.set({ active_article_id: null });
        }
        log('DATA', 'ARTICLE_DELETED', { id });
        window.dispatchEvent(new CustomEvent('ARTICLE_DELETED', { detail: { type: 'article', id } }));
        this.updateExpanderSubtitleByStage();
        this.refresh();
    }

     // [V13] Header X-button clear: wipes active selection without touching the underlying article list.
     // Storage write precedes State.set return so the persistent substrate is the single source of truth;
     // updateExpanderSubtitleByStage() then collapses the subtitle and hides the X-button itself, and the
     // list refresh repaints the radio indicators with no active row.
     async _clearActiveArticle() {
         State.set('active_article_id', null);
         await Storage.set({ active_article_id: null });
         log('UI', 'ARTICLE_CLEARED_VIA_HEADER_BTN');
         this.updateExpanderSubtitleByStage();
         this.refresh();
     }

    destroy() {
        window.removeEventListener('CREATE_ARTICLE_CLICKED', this.handleCreateClicked);
        window.removeEventListener('TRANSMUTATION_NEW_MATERIALS', this.handleNewMaterials);
        if (this.unsubscribers) this.unsubscribers.forEach(u => u());
        clearTimeout(this._subtitleTimer);
        if (this.expander && typeof this.expander.destroy === 'function') this.expander.destroy();
    }
}
