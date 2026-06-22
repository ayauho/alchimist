/**
 * @file components/core/Forge/Attachment.js
 * @purpose UI: External knowledge baggage (Attachments) manager. Stage 1 & 2.
 */
import { Expander } from '../../reusable/Expander.js';
import { dom } from '../../../utils/dom.js';
import { State } from '../../../services/State.js';
import { log } from '../../../utils/logger.js';
import { Language } from '../../../services/Language.js';
import { Storage } from '../../../services/Storage.js';
import { ArchiveResonance } from '../../../modules/ArchiveResonance.js';
import { ICONS } from '../../../utils/assets.js';
import { Switcher } from '../../reusable/Switcher.js';
import { Confirmation } from '../../reusable/Confirmation.js';

export class Attachment {
    constructor(container) {
        this.container = container;
        this.id = 'exp-attachment';
        this.items = [];
        this.isEditing = false;
        this.editingId = null;

        this.handleUploadClicked = () => {
            log('LOGIC', 'ATTACHMENT_UPLOAD_SIGNAL_RECEIVED', { instance: this.id });
            if (this.fileInput) {
                this.fileInput.click();
            }
        };

        this.expander = new Expander({
            id: this.id,
            title: 'Attachments',
            isDominantConfig: true,
            groupId: 'forge-main',
            onToggle: (isExpanded) => {
                State.set('is_managing_attachments', isExpanded);
            }
        });

        window.addEventListener('ATTACHMENT_UPLOAD_CLICKED', this.handleUploadClicked);

        // [V18.13] Single SoT-driven handler (removes the prior duplicate assignment).
        // Both PRESET_APPLIED and TREASURY_RESTORED re-run the full loadItems() reconciliation
        // so `used` is derived from the attachments_active_ids selection SoT (empty list
        // honored) — never echoed from the lightweight 'attachments' mirror, which on preset
        // apply may still carry stale used:true.
        this.handlePresetApplied = async () => {
            if (this.expander && this.expander.body) await this.loadItems();
        };
        window.addEventListener('PRESET_APPLIED', this.handlePresetApplied);
        window.addEventListener('TREASURY_RESTORED', this.handlePresetApplied);
        log('LIFECYCLE', 'ATTACHMENT_INSTANCE_CREATED', { containerId: container?.id || 'unknown' });
    }

    async loadLibrary(url, globalObjectName) {
        if (window[globalObjectName]) return window[globalObjectName];
        if (globalObjectName === 'pdfjsLib' && window['pdfjs-dist/build/pdf']) return window['pdfjs-dist/build/pdf'];
        
        return new Promise((resolve, reject) => {
            log('LOGIC', 'LOADING_LIBRARY', { url });
            const script = document.createElement('script');
            script.src = url;
            script.onload = () => {
                const lib = window[globalObjectName] || (globalObjectName === 'pdfjsLib' ? window['pdfjs-dist/build/pdf'] : null);
                log('LOGIC', 'LIBRARY_LOADED', { url, found: !!lib });
                resolve(lib);
            };
            script.onerror = (e) => {
                log('e', 'LIBRARY_LOAD_ERROR', { url });
                reject(new Error(`Failed to load ${url}`));
            };
            document.head.appendChild(script);
        });
    }

    async processPdf(file) {
        log('LOGIC', 'PROCESS_PDF_START', { size: file.size });
        
        // Load main library
        const pdfjsLib = await this.loadLibrary('/libs/pdf.min.js', 'pdfjsLib');
        
        if (!pdfjsLib) {
            throw new Error("PDF.js library loaded but failed to expose global object.");
        }
        
        // Use proper binary worker
        const workerUrl = '/libs/pdf.worker.min.js';
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
        
        // Re-enable worker thread
        pdfjsLib.GlobalWorkerOptions.disableWorker = false;

        log('LOGIC', 'PDF_WORKER_CONFIGURED', { workerUrl, disableWorker: false });
        
        const buffer = await file.arrayBuffer();
        log('LOGIC', 'PDF_BUFFER_READY', { bytes: buffer.byteLength });
        
        const loadingTask = pdfjsLib.getDocument({ 
            data: buffer,
            disableWorker: false,
            useWorkerFetch: true
        });
        
        // 5-second timeout safety hatch. 
        const doc = await Promise.race([
            loadingTask.promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(
                "PDF Parsing Timed Out (5s).\n\n" +
                "Diagnostic: You requested to use '/libs/pdf.min.js' as the worker because 'pdf.worker.min.js' does not exist. " +
                "However, the standard Mozilla PDF.js UI bundle does not contain the binary parsing engine. " +
                "Loading it as a worker causes a silent thread deadlock.\n\n" +
                "Action Required: You MUST download 'pdf.worker.min.js' from the same CDN you got pdf.min.js and place it in your /libs folder."
            )), 5000))
        ]);
        
        log('LOGIC', 'PDF_DOC_PARSED', { pages: doc.numPages });
        
        let allBlocks = [];
        let globalFontSizes = [];

        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const textContent = await page.getTextContent();
            
            let currentBlock = [];
            let lastY = -1;
            const NEW_LINE_THRESHOLD = 5;

            textContent.items.forEach(item => {
                if (!item.str.trim() && currentBlock.length === 0) return;
                const y = item.transform[5];
                const fontSize = item.transform[0];
                globalFontSizes.push(fontSize);

                if (lastY !== -1 && Math.abs(lastY - y) > NEW_LINE_THRESHOLD) {
                    if (currentBlock.length > 0) {
                        allBlocks.push(currentBlock);
                        currentBlock = [];
                    }
                }
                currentBlock.push({ str: item.str, fontSize });
                lastY = y;
            });
            if (currentBlock.length > 0) allBlocks.push(currentBlock);
        }

        if (allBlocks.length === 0) return '';
        globalFontSizes.sort((a, b) => a - b);
        const medianFontSize = globalFontSizes[Math.floor(globalFontSizes.length / 2)] || 12;
        const h1Threshold = medianFontSize * 1.8;
        const h2Threshold = medianFontSize * 1.4;
        const h3Threshold = medianFontSize * 1.2;

        let md = '';
        allBlocks.forEach(block => {
            let lineText = block.map(el => el.str).join(' ');
            const avgFontSize = block.reduce((sum, el) => sum + el.fontSize, 0) / block.length;
            let prefix = '';
            if (avgFontSize >= h1Threshold) prefix = '# ';
            else if (avgFontSize >= h2Threshold) prefix = '## ';
            else if (avgFontSize >= h3Threshold) prefix = '### ';
            md += `${prefix}${lineText}\n\n`;
        });
        return md;
    }

    async processDocx(file) {
        log('LOGIC', 'PROCESS_DOCX_START', { size: file.size });
        const mammoth = await this.loadLibrary('/libs/mammoth.browser.min.js', 'mammoth');
        if (!mammoth) throw new Error("mammoth library not resolved");
        const buffer = await file.arrayBuffer();
        const result = await mammoth.convertToMarkdown({ arrayBuffer: buffer });
        return result.value;
    }

    async processHtml(file) {
        log('LOGIC', 'PROCESS_HTML_START', { size: file.size });
        const TurndownService = await this.loadLibrary('/libs/turndown.js', 'TurndownService');
        if (!TurndownService) throw new Error("TurndownService library not resolved");
        const text = await file.text();
        const turndown = new TurndownService();
        return turndown.turndown(text);
    }

    async processJson(file) {
        log('LOGIC', 'PROCESS_JSON_START', { size: file.size });
        const text = await file.text();
        const parsed = JSON.parse(text);
        const pretty = JSON.stringify(parsed, null, 2);
        log('DATA', 'ATTACHMENT_JSON_INGEST', { keys: parsed && typeof parsed === 'object' ? Object.keys(parsed).length : 0 });
        return '```json\n' + pretty + '\n```';
    }

    async convertFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        log('LOGIC', 'START_CONVERSION', { name: file.name, ext });
        
        try {
            if (ext === 'txt' || ext === 'md') {
                return await file.text();
            } else if (ext === 'pdf') {
                return await this.processPdf(file);
            } else if (ext === 'docx') {
                return await this.processDocx(file);
            } else if (ext === 'html') {
                return await this.processHtml(file);
            } else if (ext === 'json') {
                return await this.processJson(file);
            } else {
                throw new Error(Language.text('ERR_UNSUPPORTED_FORMAT') || 'Unsupported format');
            }
        } catch (e) {
            log('e', 'CONVERSION_FAILED', e);
            return `Error extracting content:\n\n${e.message}\n\nPlease verify that the required library files exist in the /libs folder.`;
        }
    }

    async render() {
        // Enforce strict min-w-0 to prevent layout blowouts
        const content = dom.create('div', 'flex flex-col w-full min-w-0 overflow-hidden');

        this.fileInput = dom.create('input', 'u-hidden', {
            type: 'file',
            accept: '.txt,.md,.pdf,.docx,.html,.json'
        });

        this.fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            log('DATA', 'ATTACHMENT_UPLOAD_STARTED', {
                filename: file.name,
                size: file.size,
                type: file.type || file.name.split('.').pop()
            });

            const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            this.mountEditorOverlay(nameWithoutExt, 'Extracting content... Please wait.');
            
            const mdContent = await this.convertFile(file);
            
            if (this.editorTextarea) {
                this.editorTextarea.value = mdContent;
            }
            
            this.fileInput.value = '';
        };

        content.appendChild(this.fileInput);
        
        // Enforce strict min-w-0 on the list container
        this.listContainer = dom.create('div', 'flex flex-col w-full min-w-0 overflow-hidden');
        content.appendChild(this.listContainer);

        const node = this.expander.render(content);
        this.container.appendChild(node);
        
        await this.loadItems();
        this.refreshHeader();
    }

    async loadItems() {
        try {
            // [MODEL-B] The list needs only lightweight metadata {id,name,preview,used}.
            // Content stays in `attachments_registry` and is de-archived lazily (once per
            // session, via Storage's memory mirror) only when actually read. Prefer the light
            // `attachments` slot; fall back to the heavy registry for cold/legacy installs and
            // project to the lightweight shape so opening the panel never de-archives content.
            let _source = await Storage.get('attachments');
            if (!Array.isArray(_source) || _source.length === 0) {
                _source = await this._loadRegistryRaw();
            }
            if (!Array.isArray(_source)) _source = [];

            this.items = _source.map(it => ({
                id: it.id,
                name: it.name,
                preview: it.preview || this._derivePreview(it.content || ''),
                used: !!it.used
            }));
            // [V18.13] ROOT FIX for "active attachments not active after reload".
            // V18.9 made preset-apply persist ONLY the tiny `attachments_active_ids` id-list
            // (not the heavy `attachments_registry`), so the registry on disk keeps used:false.
             // loadItems() previously read the registry verbatim and never reconciled the active
             // id-list, so every attachment hydrated as used:false — the `used` flags lived only
             // in volatile State and were lost on reload. This broke preset consistency
             // (gatherCurrentState() filters by `used`, yielding an empty list that never matches
             // a preset snapshot's attachments). Re-apply the persisted active id-list here so the
             // `used` flag is the source of truth across reloads.
             // [V18.13] Distinguish a PRESENT-but-empty id-list (a legitimate "no active
             // attachments" truth, e.g. after applying a preset that activates none) from an
             // ABSENT key (legacy cold install). Presence-gate on Array.isArray only; an empty
             // array deactivates every item. Mirrors the shell/Footer.js attachment resolution.
             const _activeIds = await Storage.get('attachments_active_ids');
             if (Array.isArray(_activeIds)) {
                 const _activeSet = new Set(_activeIds);
                 this.items.forEach(it => { it.used = _activeSet.has(it.id); });
                 log('DATA', 'ATTACHMENT_ACTIVE_IDS_REHYDRATED', { restored: _activeIds.length, total: this.items.length });
                 if (_activeIds.length === 0) log('DATA', 'ATTACHMENT_EMPTY_SELECTION_HONORED', { total: this.items.length });
             }
            State.set('attachments', this.items);
        } catch (e) {
            log('e', 'LOAD_ATTACHMENTS_FAILED', e);
            this.items = [];
        }
        this.refresh();
    }

    async saveItems() {
        try {
            // [MODEL-B] Reconstruct the heavy registry by merging stored content (de-archived
            // at most once per session, then served from the memory mirror) with any content
            // set on in-memory items by the editor. `this.items` is otherwise content-free.
            const _existing = await this._loadRegistryRaw();
            const _contentById = new Map(_existing.map(r => [r.id, r.content]));

            const _heavy = this.items.map(it => ({
                id: it.id,
                name: it.name,
                preview: it.preview || this._derivePreview(it.content || ''),
                used: !!it.used,
                content: (it.content != null) ? it.content : (_contentById.get(it.id) || '')
            }));
            await Storage.set({ 'attachments_registry': _heavy });

            // Lightweight metadata mirror (no content) — what the list and State consume.
            const _light = _heavy.map(({ id, name, preview, used }) => ({ id, name, preview, used }));
            this.items = _light;
            State.set('attachments', _light);

            // [V18.9] Active id-set kept in lockstep with content saves.
            const _activeIds = _light.filter(i => i.used).map(i => i.id);
            await Storage.set({ attachments_active_ids: _activeIds });
            log('DATA', 'ATTACHMENTS_SAVED', { count: _light.length });
        } catch (e) {
            log('e', 'SAVE_ATTACHMENTS_FAILED', e);
        }
    }

    // [MODEL-B] Raw registry loader. Storage.get normalizes the density-gate (isCompressed)
    // object case; this also tolerates a legacy raw-string payload. De-archives at most once
    // per session — the decompressed value is then served from Storage's memory mirror.
    async _loadRegistryRaw() {
        const stored = await Storage.get('attachments_registry');
        if (Array.isArray(stored)) return stored;
        if (typeof stored === 'string') {
            try {
                const raw = await ArchiveResonance.decompress(stored);
                const parsed = (typeof raw === 'string') ? JSON.parse(raw) : raw;
                if (Array.isArray(parsed)) return parsed;
            } catch (e1) {
                try { const p = JSON.parse(stored); if (Array.isArray(p)) return p; } catch (e2) {}
            }
        }
        return [];
    }

    // [MODEL-B] Canonical preview rule: first 200 raw symbols, newlines flattened.
    _derivePreview(content) {
        let p = String(content || '').substring(0, 200).replace(/\n/g, ' ');
        if (String(content || '').length > 200) p += '...';
        return p;
    }

    // [MODEL-B] Lazy content fetch for the editor (a read case). First call de-archives the
    // registry once; thereafter it is served from the memory mirror.
    async _getContent(id) {
        const reg = await this._loadRegistryRaw();
        const found = reg.find(x => x && x.id === id);
        return (found && found.content != null) ? found.content : '';
    }

    // [MODEL-B] Open the editor for an existing attachment, hydrating content lazily so the
    // first (cold) open does not block and never shows an empty body.
    async openForEdit(item) {
        this.mountEditorOverlay(item.name, '', item.id);
        if (this.editorTextarea) {
            this.editorTextarea.value = Language.text('MSG_LOADING') || 'Loading content…';
            this.editorTextarea.disabled = true;
        }
        const content = await this._getContent(item.id);
        if (this.editorTextarea && this.editingId === item.id) {
            this.editorTextarea.value = content;
            this.editorTextarea.disabled = false;
        }
    }

    refreshHeader() {
        if (!this.expander) return;
        
        const activeItems = this.items.filter(item => item.used);
        const indicators = activeItems.map(item => {
            // Use regex to handle spaces, dots, underscores, and dashes
            const words = item.name.trim().split(/[\s\._-]+/);
            
            return {
                abbrev: words[0] || '...',
                color: 'rgba(255, 255, 255, 0.4)',
                padding: '2px 4px 1px'
            };
        });

        if (typeof this.expander.updateIndicators === 'function') {
            this.expander.updateIndicators(indicators);
        }
    }

    mountEditorOverlay(initialName = '', initialContent = '', editingId = null) {
        if (this.editorBackdrop) return;
        
        this.isEditing = true;
        this.editingId = editingId;
        
        State.set('is_managing_attachments', true); 
        State.set('is_attachment_editor_active', true);

        this.editorBackdrop = dom.create('div', 'fixed inset-0 flex flex-col justify-end bg-black/70 backdrop-blur-sm transform-gpu', {
            style: 'z-index: 100000;'
        });

        this.editorBackdrop.onclick = (e) => {
            if (e.target === this.editorBackdrop) this.closeEditor();
        };

        const bottomSheet = dom.create('div', 'bg-bg-card w-full rounded-t-xl border-t border-border flex flex-col transform-gpu', {
            style: 'height: 70vh; box-shadow: 0 -10px 40px rgba(0,0,0,0.8);'
        });

        const container = dom.create('div', 'flex flex-col h-full p-4 gap-4');
        
        const title = dom.create('div', 'text-text-primary text-lg font-bold mb-2', {
            innerText: editingId ? 'Edit Attachment' : 'New Attachment'
        });

        const nameGroup = dom.create('div', 'input-group');
        const nameLabel = dom.create('label', 'input-label', { innerText: Language.text('LABEL_NAME') || 'NAME' });
        const nameInput = dom.create('input', 'alchimist-input w-full', {
            value: initialName,
            placeholder: 'Name...'
        });
        nameGroup.appendChild(nameLabel);
        nameGroup.appendChild(nameInput);

        const contentGroup = dom.create('div', 'input-group flex-1 flex flex-col min-h-0');
        const contentLabel = dom.create('label', 'input-label', { innerText: 'CONTENT' });
        this.editorTextarea = dom.create('textarea', 'alchimist-input w-full flex-1 resize-none', {
            placeholder: 'Markdown Content...',
            value: initialContent
        });
        contentGroup.appendChild(contentLabel);
        contentGroup.appendChild(this.editorTextarea);

        const footer = dom.create('div', 'pe-btn-group mt-auto pt-2');
        const cancelBtn = dom.create('button', 'pe-btn pe-btn--secondary', { innerText: 'Cancel' });
        const saveBtn = dom.create('button', 'pe-btn pe-btn--primary', { innerText: 'Save' });

        cancelBtn.onclick = () => this.closeEditor();
        saveBtn.onclick = async () => {
            const n = nameInput.value.trim();
            const c = this.editorTextarea.value.trim();
            if (n && c) {
                let preview = c.substring(0, 200).replace(/\n/g, ' ');
                if (c.length > 200) preview += '...';
                
                if (this.editingId) {
                    const it = this.items.find(x => x.id === this.editingId);
                    if (it) {
                        it.name = n;
                        it.content = c;
                        it.preview = preview;
                    }
                } else {
                    this.items.push({
                        id: 'att_' + Date.now().toString(),
                        name: n,
                        content: c,
                        preview: preview,
                        used: true
                    });
                }
                await this.saveItems();
                this.closeEditor();
            }
        };

        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);

        container.appendChild(title);
        container.appendChild(nameGroup);
        container.appendChild(contentGroup);
        container.appendChild(footer);
        
        bottomSheet.appendChild(container);
        this.editorBackdrop.appendChild(bottomSheet);
        document.body.appendChild(this.editorBackdrop);

        void this.editorBackdrop.offsetHeight;
        setTimeout(() => this.editorTextarea.focus(), 50);
    }

    closeEditor() {
        if (this.editorBackdrop) {
            this.editorBackdrop.remove();
            this.editorBackdrop = null;
            this.editorTextarea = null;
        }
        this.isEditing = false;
        this.editingId = null;
        State.set('is_attachment_editor_active', false);
        this.refresh();
    }

    refresh() {
        this.refreshHeader();
        this.listContainer.innerHTML = '';
        if (this.items.length === 0) {
            const placeholder = dom.create('div', 'text-text-secondary text-xs italic text-center py-10 px-4', {
                innerText: Language.text('MSG_NO_ATTACHMENTS') || 'No attachments found. Click "+ upload file" below to add knowledge baggage.'
            });
            this.listContainer.appendChild(placeholder);
            return;
        }

        this.items.forEach(item => {
            // Apply strict min-w-0 and w-full directly to the row to establish a strict mathematical boundary
            const row = dom.create('div', 'flex items-center justify-between p-3 border-b border-[#27272a] hover:bg-white/5 transition-colors group w-full min-w-0 overflow-hidden');
            
            // The "flex-1 w-0" trick is the definitive fix for flex blowout. 
            // It forces the flex item to start at 0 width and expand into available space, rather than fitting the long text.
            const left = dom.create('div', 'flex flex-col flex-1 w-0 min-w-0 overflow-hidden mr-4 cursor-pointer', {
                onclick: () => this.openForEdit(item)
            });
            const title = dom.create('div', 'text-sm font-medium text-text-primary truncate w-full', { innerText: item.name });
            const preview = dom.create('div', 'text-xs text-[#a1a1aa] truncate mt-1 w-full', { innerText: item.preview });
            left.appendChild(title);
            left.appendChild(preview);

            const right = dom.create('div', 'flex items-center gap-3 shrink-0');
            
            const editBtn = dom.create('button', 'text-white/50 hover:text-white transition-colors', { innerHTML: ICONS.EDIT });
            editBtn.onclick = () => this.openForEdit(item);

            const delBtn = dom.create('button', 'text-white/50 hover:text-red-400 transition-colors', { innerHTML: ICONS.TRASH });
            delBtn.onclick = async (e) => {
                e.stopPropagation();
                const confirmed = await Confirmation.show('Delete Attachment', 'Are you sure?');
                if (confirmed) {
                    this.items = this.items.filter(x => x.id !== item.id);
                    await this.saveItems();
                    window.dispatchEvent(new CustomEvent('ATTACHMENT_DELETED', { detail: { type: 'attachment', id: item.id } }));
                    this.refresh();
                }
            };

            const switcher = new Switcher({
                initialState: item.used,
                onChange: async (val) => {
                    this.items = this.items.map(x => 
                        x.id === item.id ? { ...x, used: val } : x
                    );
                    this.refreshHeader();
                    await this.saveItems();
                }
            });

            right.appendChild(editBtn);
            right.appendChild(delBtn);
            right.appendChild(switcher.render());

            row.appendChild(left);
            row.appendChild(right);
            this.listContainer.appendChild(row);
        });
    }

    destroy() {
        window.removeEventListener('ATTACHMENT_UPLOAD_CLICKED', this.handleUploadClicked);
        window.removeEventListener('PRESET_APPLIED', this.handlePresetApplied);
        window.removeEventListener('TREASURY_RESTORED', this.handlePresetApplied);
        if (this.expander) this.expander.destroy();
        if (this.fileInput) this.fileInput.remove();
    }
}