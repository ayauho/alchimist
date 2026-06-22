/**
 * @file modules/JsonPrime.js
 * @purpose EXTERNAL MODULE: Logic for editing and viewing JSON structures. Use for: Identity Anchor, [PEER] -> Inted Data, Global State Management -> [SNAPSHOT]
 */
import { log, l, w, e } from '../utils/logger.js';

/**
 * @standard BEM, Class-based modules, Validation-wrapped data.
 */

export class PrimeManifold {
    static parse_string = false;

    /**
     * @param {HTMLElement} container - The DOM element to inject the manifold into.
     * @param {Function} onSave - Callback(state) when data changes.
     * @param {Object} options - { copyLabel: "SEAL JSON", enableWipe: true, initialData: {}, readOnly: false, hideViewControls: false }
     */
    constructor(container, onSave, options = {}) {
        this.container = container;
        this.onSave = onSave;
        this.options = Object.assign({ readOnly: false }, options);
        
        this.state = {};
        this.path = [];
        this.insertMode = false;

        // Bindings
        this.render = this.render.bind(this);
        
        // Init Structure
        this.buildStructure();
        
        // Load Data
        this.init(options.initialData || {});
    }

    _injectTreeStyles() {
        if (document.getElementById('prime-manifold-tree-styles')) return;
        const style = document.createElement('style');
        style.id = 'prime-manifold-tree-styles';
        style.textContent = `
            .prime-tree-node { margin-left: 18px; border-left: 1px solid rgba(255, 255, 255, 0.05); padding-left: 10px; }
            .prime-node-header { display: flex; align-items: flex-start; padding: 4px 6px; border-radius: 4px; cursor: pointer; gap: 6px; min-height: 24px; }
            .prime-node-header:hover { background: rgba(255, 255, 255, 0.03); }
            .prime-chevron { width: 10px; height: 10px; transition: transform 0.1s ease; color: var(--text-secondary, #64748b); flex-shrink: 0; margin-top: 5px; }
            .prime-node-wrapper.collapsed > .prime-node-header .prime-chevron { transform: rotate(-90deg); }
            .prime-node-wrapper.collapsed > .prime-node-children { display: none; }
            .prime-node-wrapper.collapsed > .prime-node-header .prime-header-preview { display: inline-flex; align-items: center; }
            .prime-header-preview { display: none; font-size: 11px; color: var(--text-secondary, #64748b); margin-left: 8px; font-style: italic; }
            .prime-copy-path-btn { opacity: 0; font-size: 10px; color: var(--text-secondary, #64748b); margin-left: auto; padding: 0 4px; border: 1px solid transparent; border-radius: 3px; transition: all 0.2s; background: transparent; cursor: pointer; flex-shrink: 0; }
            .prime-node-header:hover .prime-copy-path-btn { opacity: 1; }
            .prime-copy-path-btn:hover { border-color: var(--accent, #6366f1); color: var(--accent, #6366f1); background: rgba(99, 102, 241, 0.1); }
            .prime-match-highlight { background: rgba(234, 179, 8, 0.3); border-bottom: 1px solid #eab308; border-radius: 1px; }
            .prime-node-key { flex-shrink: 0; }
            .prime-node-val { word-break: break-word; white-space: pre-wrap; }
            .prime-viewer { font-family: 'ui-monospace', 'SFMono-Regular', Consolas, monospace; font-size: 13px; line-height: 1.6; }
        `;
        document.head.appendChild(style);
    }

    buildStructure() {
        this._injectTreeStyles();

        this.container.innerHTML = '';
        this.container.classList.add('prime-manifold-host');
        // Ensure container has flex layout if not set by CSS
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.height = '100%';
        this.container.style.overflow = 'hidden';

        // 1. Header
        this.header = document.createElement('div');
        this.header.className = 'prime-header';
        this.header.style.cssText = 'padding: 10px 14px; border-bottom: 1px solid var(--border); background: rgba(255, 255, 255, 0.02); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-shrink: 0; min-height: 40px;';

        this.backBtn = document.createElement('button');
        this.backBtn.className = 'icon-btn back-btn';
        this.backBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
        this.backBtn.style.display = 'none';
        this.backBtn.style.padding = '4px';
        this.backBtn.onclick = () => this.goBack();

        this.pathDisplay = document.createElement('div');
        this.pathDisplay.className = 'prime-path';
        this.pathDisplay.style.cssText = 'font-size: 11px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; flex: 1; margin-left: 4px; display: flex; align-items: center;';
        this.pathDisplay.innerText = 'ROOT';

        this.insertToggle = document.createElement('button');
        this.insertToggle.className = 'icon-btn';
        this.insertToggle.style.cssText = 'padding: 2px; width: 20px; height: 20px; border-radius: 4px; border-color: #333; display: flex; align-items: center; justify-content: center; cursor: pointer; background: transparent; color: var(--text-secondary);';
        this.insertToggle.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /><path d="M12 9v6" /><path d="M9 12h6" /></svg>`;
        this.insertToggle.onclick = () => this.toggleInsertMode();
        
        // Search Container (View-Only Mode)
        this.searchContainer = document.createElement('div');
        this.searchContainer.style.cssText = 'position: relative; flex: 1; display: none;';
        
        this.searchInput = document.createElement('input');
        this.searchInput.type = 'text';
        this.searchInput.placeholder = 'Filter keys or values...';
        this.searchInput.style.cssText = 'width: 100%; background: rgba(0,0,0,0.2); border: 1px solid var(--border, #333); border-radius: 4px; padding: 6px 10px; font-size: 12px; color: var(--text-primary); outline: none; box-sizing: border-box;';
        this.searchInput.oninput = (e) => this.filterTree(e.target.value);

        this.searchMatchCount = document.createElement('div');
        this.searchMatchCount.style.cssText = 'position: absolute; right: 10px; top: 8px; font-size: 10px; text-transform: uppercase; font-weight: bold; color: var(--text-secondary); pointer-events: none;';

        this.searchContainer.appendChild(this.searchInput);
        this.searchContainer.appendChild(this.searchMatchCount);

        this.header.appendChild(this.backBtn);
        this.header.appendChild(this.pathDisplay);
        this.header.appendChild(this.insertToggle);
        this.header.appendChild(this.searchContainer);

        // Hide edit tools and show search if readOnly
        if (this.options.readOnly) {
            this.backBtn.style.display = 'none';
            this.pathDisplay.style.display = 'none';
            this.insertToggle.style.display = 'none';
            this.searchContainer.style.display = this.options.hideViewControls ? 'none' : 'block';
            // [VIEW-CONTROLS] With controls hidden, the header has nothing left to show
            // (back/path/insert are already hidden), so collapse the empty bar too.
            if (this.options.hideViewControls) this.header.style.display = 'none';
        }

        // 2. View Area
        this.viewEl = document.createElement('div');
        this.viewEl.className = 'prime-node-view';
        this.viewEl.style.cssText = 'flex: 1; padding: 10px; overflow-y: auto; overflow-x: hidden;';

        // 3. Footer
        this.footer = document.createElement('div');
        this.footer.className = 'prime-footer';
        this.footer.style.cssText = 'padding: 8px; border-top: 1px solid var(--border); background: rgba(255, 255, 255, 0.03); display: flex; justify-content: flex-end; gap: 8px; flex-shrink: 0;';

        // Clear Branch Button
        this.btnClear = document.createElement('button');
        this.btnClear.className = 'prime-btn';
        this.btnClear.textContent = 'CLR';
        this.btnClear.title = "Clear this branch (Click twice to confirm)";
        this.btnClear.style.cssText = 'margin-right: 6px; padding: 2px 8px; min-width: 36px; font-size: 11px; opacity: 0.8;';
        
        this.btnClear.onclick = () => {
            if (this.btnClear.dataset.confirm === '1') {
                this.performClear();
                this.btnClear.textContent = 'CLR';
                this.btnClear.dataset.confirm = '0';
                this.btnClear.style.color = '';
                this.btnClear.style.borderColor = '';
            } else {
                this.btnClear.dataset.confirm = '1';
                this.btnClear.textContent = 'SURE?';
                this.btnClear.style.color = '#ef4444'; 
                this.btnClear.style.borderColor = '#ef4444';
                setTimeout(() => {
                    this.btnClear.dataset.confirm = '0';
                    this.btnClear.textContent = 'CLR';
                    this.btnClear.style.color = '';
                    this.btnClear.style.borderColor = '';
                }, 2000);
            }
        };

        this.copyBtn = document.createElement('button');
        this.copyBtn.className = 'prime-btn';
        this.copyBtn.style.cssText = 'width: 100%; flex: 1; border: 1px solid #333; padding: 6px; cursor: pointer; background: transparent; color: var(--text-primary); border-radius: 4px;';
        this.copyBtn.innerText = this.options.copyLabel || 'COPY JSON';
        this.copyBtn.onclick = () => this.copyToClipboard();

        if (!this.options.readOnly) {
            this.footer.appendChild(this.btnClear);
        }

        if (!this.options.hideCopy && !this.options.hideViewControls) {
            this.footer.appendChild(this.copyBtn);
        }

        if (this.options.enableWipe && !this.options.readOnly) {
            this.wipeBtn = document.createElement('button');
            this.wipeBtn.className = 'prime-btn prime-btn-del';
            this.wipeBtn.style.width = '30px';
            this.wipeBtn.innerText = '×';
            this.wipeBtn.title = "Wipe Current View";
            this.wipeBtn.onclick = () => this.handleWipe();
            this.footer.appendChild(this.wipeBtn);
        }

        if (this.options.readOnly && (this.options.hideCopy || this.options.hideViewControls)) {
            this.footer.style.display = 'none';
        }

        // Assemble
        this.container.appendChild(this.header);
        this.container.appendChild(this.viewEl);
        this.container.appendChild(this.footer);
    }

    resolvePath(obj, path) {
        return path.reduce((prev, curr) => prev && prev[curr], obj);
    }

    _deepParseStrings(obj) {
        if (typeof obj === 'string') {
            try {
                const parsed = JSON.parse(obj);
                if (typeof parsed === 'object' && parsed !== null) {
                    return this._deepParseStrings(parsed);
                }
                return parsed;
            } catch (e) {
                return obj;
            }
        } else if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                obj[i] = this._deepParseStrings(obj[i]);
            }
        } else if (typeof obj === 'object' && obj !== null) {
            for (let key in obj) {
                obj[key] = this._deepParseStrings(obj[key]);
            }
        }
        return obj;
    }

    init(initialData) {
        try {
            this.state = typeof initialData === 'string' ? JSON.parse(initialData) : initialData;
        } catch (e) {
            this.state = { "raw_text": initialData || "" };
        }

        // Deep-parse embedded JSON strings if configured
        if (PrimeManifold.parse_string || this.options.parse_string) {
            this.state = this._deepParseStrings(this.state);
        }

        // Deep copy to avoid mutating the original reference if not intended
        this.state = JSON.parse(JSON.stringify(this.state)); 
        if (!this.state || typeof this.state !== 'object') this.state = {};
        this.path = [];
        this.insertMode = false;
        this.render();
    }

    toggleInsertMode() {
        if (this.options.readOnly) return;
        this.insertMode = !this.insertMode;
        this.render();
        // Visual Update for Button
        this.insertToggle.style.color = this.insertMode ? 'var(--accent)' : 'var(--text-secondary)';
        this.insertToggle.style.borderColor = this.insertMode ? 'var(--accent)' : '#333';
        this.insertToggle.style.background = this.insertMode ? 'rgba(99, 102, 241, 0.1)' : 'transparent';
    }

    getRaw() {
        return JSON.stringify(this.state, null, 2);
    }
    
    persist() {
        if(this.onSave && !this.options.readOnly) this.onSave(this.state);
    }

    copyToClipboard() {
        navigator.clipboard.writeText(this.getRaw()).then(() => {
            const original = this.copyBtn.innerText;
            this.copyBtn.innerText = "COPIED!";
            this.copyBtn.style.color = "var(--success, #4ade80)";
            this.copyBtn.style.borderColor = "var(--success, #4ade80)";
            setTimeout(() => {
                this.copyBtn.innerText = original;
                this.copyBtn.style.color = "";
                this.copyBtn.style.borderColor = "";
            }, 1500);
        });
    }

    handleWipe() {
        if (this.options.readOnly) return;
        const isRoot = this.path.length === 0;
        const msg = isRoot 
            ? "WIPE ROOT: Clear entire JSON structure?" 
            : `WIPE BRANCH: Clear data in current branch?`;
        
        if(confirm(msg)) {
            if(isRoot) {
                this.init({});
            } else {
                let target = this.state;
                for (let i = 0; i < this.path.length - 1; i++) {
                    target = target[this.path[i]];
                }
                const lastKey = this.path[this.path.length - 1];
                target[lastKey] = {};
                this.render();
            }
            this.persist();
        }
    }

    getShortType(val) {
        if (Array.isArray(val)) return 'arr';
        if (val === null) return 'null';
        const t = typeof val;
        return t === 'string' ? 'str' : t === 'number' ? 'num' : t === 'boolean' ? 'bool' : 'obj';
    }

    createPhantomRow(index, isArray = false) {
        const phantom = document.createElement('div');
        phantom.className = 'prime-phantom-row';
        phantom.style.cssText = 'display: flex; gap: 8px; margin-top: 8px;';
        
        const pInput = document.createElement('input');
        pInput.className = 'prime-phantom-input';
        pInput.placeholder = this.insertMode ? '+ add key' : '+ new key';
        pInput.style.cssText = 'flex: 1; background: transparent; border: 1px dashed #444; color: var(--text-primary); padding: 4px;';
        
        const arrLabel = document.createElement('div');
        arrLabel.style.cssText = 'flex: 1; display: flex; align-items: center; color: #52525b; font-family: monospace; font-size: 13px; font-style: italic; padding-left: 4px;';
        arrLabel.innerText = this.insertMode ? `[ insert at index ${index} ]` : `+ new item`;

        const pControls = document.createElement('div');
        pControls.className = 'prime-phantom-controls';
        pControls.style.cssText = 'display: flex; gap: 4px;';
        
        let pType = 'string';
        const pTypeBtn = document.createElement('button');
        pTypeBtn.className = 'prime-btn';
        pTypeBtn.innerText = 'STR';
        pTypeBtn.style.cssText = 'background: transparent; border: 1px solid #444; color: var(--text-secondary); cursor: pointer; font-size: 10px; padding: 2px 6px;';
        
        pTypeBtn.onclick = () => {
            const types = ['string', 'object', 'array', 'number', 'boolean'];
            pType = types[(types.indexOf(pType) + 1) % types.length];
            const typeLabels = { 'string': 'STR', 'object': 'OBJ', 'array': 'ARR', 'number': 'NUM', 'boolean': 'BOOL' };
            pTypeBtn.innerText = typeLabels[pType];
        };
        
        const pAddBtn = document.createElement('button');
        pAddBtn.className = 'prime-btn';
        pAddBtn.innerText = 'ADD';
        pAddBtn.style.cssText = 'background: transparent; border: 1px solid var(--accent); color: var(--accent); cursor: pointer; font-size: 10px; padding: 2px 6px;';
        
        const executeAdd = () => {
            const k = isArray ? '' : (pInput.value.trim() || ("key_" + Math.random().toString(36).substring(7)));
            this.manifestAt(index, k, pType);
            if (!isArray) pInput.value = ''; 
            if(this.insertMode) this.toggleInsertMode(); 
        };

        pAddBtn.onclick = executeAdd;
        pInput.onkeydown = (e) => { if(e.key==='Enter') executeAdd(); };

        if (isArray) {
            phantom.appendChild(arrLabel);
        } else {
            phantom.appendChild(pInput);
        }
        
        pControls.appendChild(pTypeBtn);
        pControls.appendChild(pAddBtn);
        phantom.appendChild(pControls);
        return phantom;
    }

    // --- VIEW-ONLY TREE LOGIC ---
    
    createTreeNode(key, value, path = []) {
        const type = Array.isArray(value) ? 'array' : (value === null ? 'null' : typeof value);
        const isCollapsible = type === 'object' || type === 'array';
        const currentPath = [...path, key].join('.');

        const nodeWrapper = document.createElement('div');
        nodeWrapper.className = 'prime-node-wrapper';
        nodeWrapper.dataset.key = String(key).toLowerCase();
        nodeWrapper.dataset.val = String(value).toLowerCase();

        const header = document.createElement('div');
        header.className = 'prime-node-header';
        
        if (isCollapsible) {
            header.innerHTML += `
                <svg class="prime-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            `;
            header.onclick = () => nodeWrapper.classList.toggle('collapsed');
        } else {
            header.innerHTML += `<span style="width: 10px; display: inline-block; flex-shrink: 0;"></span>`;
        }

        const keySpan = document.createElement('span');
        keySpan.style.color = 'var(--key-color, #9cdcfe)';
        keySpan.className = 'prime-node-key';
        keySpan.innerText = key + ':';
        header.appendChild(keySpan);

        if (!isCollapsible) {
            const valSpan = document.createElement('span');
            valSpan.className = 'prime-node-val';
            valSpan.style.color = type === 'string' ? 'var(--str-color, #ce9178)' : 
                                 (type === 'number' ? 'var(--num-color, #b5cea8)' : 
                                 (type === 'boolean' ? 'var(--bool-color, #569cd6)' : 'var(--null-color, #808080)'));
            valSpan.innerText = type === 'string' ? `"${value}"` : String(value);
            header.appendChild(valSpan);
        } else {
            const count = Object.keys(value || {}).length;
            const preview = document.createElement('span');
            preview.className = 'prime-header-preview';
            preview.innerText = `{ ${count} items }`;
            header.appendChild(preview);
        }

        const copyPath = document.createElement('button');
        copyPath.className = 'prime-copy-path-btn';
        copyPath.innerText = 'PATH';
        copyPath.onclick = (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(currentPath).then(() => {
                const original = copyPath.innerText;
                copyPath.innerText = 'COPIED';
                setTimeout(() => copyPath.innerText = original, 1000);
            }).catch(() => {
                const textarea = document.createElement('textarea');
                textarea.value = currentPath;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                const original = copyPath.innerText;
                copyPath.innerText = 'COPIED';
                setTimeout(() => copyPath.innerText = original, 1000);
            });
        };
        header.appendChild(copyPath);

        nodeWrapper.appendChild(header);

        if (isCollapsible) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'prime-node-children prime-tree-node';
            
            Object.keys(value).forEach(k => {
                childrenContainer.appendChild(this.createTreeNode(k, value[k], [...path, key]));
            });
            nodeWrapper.appendChild(childrenContainer);
        }

        return nodeWrapper;
    }

    filterTree(query) {
        if (!this.viewEl) return;
        const wrappers = Array.from(this.viewEl.querySelectorAll('.prime-node-wrapper'));
        let matchCount = 0;
        
        // Clean up previous highlights and resets
        wrappers.forEach(w => {
            w.style.display = 'none';
            w.dataset.hasMatch = "false";
            const kEl = w.querySelector('.prime-node-key');
            if (kEl) kEl.innerHTML = kEl.innerText;
            const vEl = w.querySelector('.prime-node-val');
            if (vEl) vEl.innerHTML = vEl.innerText;
        });

        if (!query) {
            wrappers.forEach(w => w.style.display = 'block');
            if (this.searchMatchCount) this.searchMatchCount.innerText = '';
            return;
        }

        const q = query.toLowerCase();
        
        // Phase 1: Identify direct matches and highlight them
        wrappers.forEach(w => {
            const keyText = w.dataset.key || '';
            const valText = w.dataset.val || '';
            if (keyText.includes(q) || valText.includes(q)) {
                w.dataset.hasMatch = "true";
                matchCount++;
                
                const kEl = w.querySelector('.prime-node-key');
                if (kEl) kEl.innerHTML = kEl.innerText.replace(new RegExp(`(${query})`, 'gi'), '<span class="prime-match-highlight">$1</span>');
                const vEl = w.querySelector('.prime-node-val');
                if (vEl) vEl.innerHTML = vEl.innerText.replace(new RegExp(`(${query})`, 'gi'), '<span class="prime-match-highlight">$1</span>');
            }
        });

        // Phase 2: Show direct matches and their parents (uncollapsing them)
        wrappers.forEach(w => {
            if (w.dataset.hasMatch === "true") {
                w.style.display = 'block';
                
                // Show all children if this matched node is a container
                const subtree = w.querySelectorAll('.prime-node-wrapper');
                subtree.forEach(child => child.style.display = 'block');

                // Show all parents and ensure they aren't collapsed
                let parent = w.parentElement;
                while (parent && parent !== this.viewEl && parent !== this.container) {
                    if (parent.classList.contains('prime-node-wrapper')) {
                        parent.style.display = 'block';
                        parent.classList.remove('collapsed');
                    }
                    parent = parent.parentElement;
                }
            }
        });

        if (this.searchMatchCount) this.searchMatchCount.innerText = `${matchCount} matches`;
    }

    renderTreeView() {
        this.viewEl.innerHTML = '';
        this.viewEl.classList.add('prime-viewer');

        Object.keys(this.state).forEach(k => {
            this.viewEl.appendChild(this.createTreeNode(k, this.state[k]));
        });

        if (this.searchInput && this.searchInput.value) {
            this.filterTree(this.searchInput.value);
        }
    }

    // --- MAIN RENDER LOGIC ---

    render(shouldFocus = false) {
        if (this.options.readOnly) {
            return this.renderTreeView();
        }

        const activeNode = this.resolvePath(this.state, this.path);
        
        this.viewEl.innerHTML = '';
        this.viewEl.classList.remove('prime-viewer');

        // Header Updates
        if (this.path.length > 0) {
            this.backBtn.style.display = 'block';
        } else {
            this.backBtn.style.display = 'none';
        }

        // Breadcrumbs
        this.renderBreadcrumbs();

        if (typeof activeNode !== 'object' || activeNode === null) {
            this.viewEl.innerHTML = '<div style="padding:10px; color:#666;">[Terminal Node]</div>';
            return;
        }

        const keys = Object.keys(activeNode);
        const isArray = Array.isArray(activeNode);

        keys.forEach((key, index) => {
            if (this.insertMode) {
                this.viewEl.appendChild(this.createPhantomRow(index, isArray));
            }

            const value = activeNode[key];
            const type = Array.isArray(value) ? 'array' : (value === null ? 'null' : typeof value);
            
            const row = document.createElement('div');
            row.className = 'prime-row';
            row.style.cssText = 'display: flex; align-items: flex-start; margin: 6px 0; gap: 8px;';

            const rowMeta = document.createElement('div');
            rowMeta.className = 'prime-row-meta';
            rowMeta.style.cssText = 'flex: 0 0 30%; max-width: 150px; display: flex; align-items: center; height: stretch;';

            const valContainer = document.createElement('div');
            valContainer.className = 'prime-val-container';
            valContainer.style.cssText = 'flex: 1; display: flex; gap: 8px; min-width: 0;';

            // Key Generation (Edit Mode Only)
            if (['string', 'number', 'boolean', 'null'].includes(type)) {
                if (!isArray) {
                    const keyInput = document.createElement('textarea');
                    keyInput.className = 'prime-key-input';
                    keyInput.style.cssText = "height: auto; min-height: 20px; overflow: hidden; resize: none; width: 100%; border: none; border-bottom: 1px dashed rgba(255,255,255,0.1); background: transparent; color: var(--text-primary); padding: 2px 0; word-break: break-all; white-space: pre-wrap; font-family: monospace; align-self: end;";
                    keyInput.value = key;
        
                    const adjustKeyHeight = () => {
                        keyInput.style.height = 'auto';
                        keyInput.style.height = keyInput.scrollHeight + 'px';
                    };
                    keyInput.addEventListener('input', adjustKeyHeight);
                    setTimeout(adjustKeyHeight, 0);
                    let initialKey = key;
                    keyInput.onblur = (e) => {
                         if(e.target.value !== initialKey) {
                             this.renameKey(initialKey, e.target.value);
                         }
                    };
                    keyInput.onkeydown = (e) => { if(e.key==='Enter') e.target.blur(); };
                    rowMeta.appendChild(keyInput);
                } else {
                    rowMeta.innerHTML = `<span class="prime-key-input" style="color:#52525b; font-family: monospace; font-size: 13px;">[${key}]</span>`;
                }

                // Value Generation (Edit Mode Only)
                let valInput;
                if (type === 'string') {
                    valInput = document.createElement('textarea');
                    valInput.className = 'prime-val-textarea';
                    valInput.style.cssText = "width: 100%; border: 1px solid #333; background: transparent; color: var(--text-primary); padding: 4px; border-radius: 4px; resize: none; overflow: hidden; font-family: monospace;";
                } else {
                    valInput = document.createElement('input');
                    valInput.className = 'prime-val-input';
                    valInput.style.cssText = "width: 100%; border: 1px solid #333; background: transparent; color: var(--text-primary); padding: 4px; border-radius: 4px; font-family: monospace;";
                }

                valInput.value = value === null ? 'null' : value;
                let initialVal = valInput.value;

                if (type === 'string') {
                    const adjustHeight = (isFocused) => {
                        if (valInput.offsetWidth === 0 && !isFocused) return;
                        
                        const dummy = document.createElement('div');
                        const computed = window.getComputedStyle(valInput);
                        const stylesToCopy = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'boxSizing', 'width'];
                        stylesToCopy.forEach(key => dummy.style[key] = computed[key]);
                        dummy.style.whiteSpace = 'pre-wrap';
                        dummy.style.wordBreak = 'break-word';
                        dummy.style.position = 'absolute';
                        dummy.style.visibility = 'hidden';
                        document.body.appendChild(dummy);

                        dummy.textContent = 'M';
                        const row1Height = dummy.offsetHeight;
                        dummy.textContent = 'M\nM';
                        const row2Height = dummy.offsetHeight;
                        dummy.textContent = (valInput.value || '') + '\u200b';
                        const contentHeight = dummy.offsetHeight;
                        document.body.removeChild(dummy);

                        if (isFocused) {
                            valInput.style.height = `${Math.max(contentHeight, row1Height)}px`;
                        } else {
                            valInput.style.height = (contentHeight > row1Height + 1) ? `${row2Height}px` : `${row1Height}px`;
                        }
                    };

                    valInput.addEventListener('focus', () => adjustHeight(true));
                    valInput.addEventListener('input', () => adjustHeight(true));
                    valInput.onblur = (e) => {
                        adjustHeight(false);
                        if(e.target.value !== initialVal) this.updateValue(key, e.target.value);
                    };
                    
                    const observer = new ResizeObserver(() => {
                        if (valInput.scrollHeight > 0) { adjustHeight(false); observer.disconnect(); }
                    });
                    observer.observe(valInput);
                } else {
                    valInput.onblur = (e) => {
                        if(e.target.value !== initialVal) this.updateValue(key, e.target.value);
                    };
                    valInput.onkeydown = (e) => { if(e.key==='Enter') e.target.blur(); };
                }
                valContainer.appendChild(valInput);

            } else {
                // Object/Array (Edit Mode Only)
                if (!isArray) {
                    const keyInput = document.createElement('input');
                    keyInput.className = 'prime-key-input';
                    keyInput.style.cssText = "width: 100%; border: none; border-bottom: 1px dashed rgba(255,255,255,0.1); background: transparent; color: var(--text-primary); padding: 2px 0; font-family: monospace; height:100%;";
                    keyInput.value = key;
                    let initialKey = key;
                    keyInput.onblur = (e) => {
                         if(e.target.value !== initialKey) this.renameKey(initialKey, e.target.value);
                    };
                    rowMeta.appendChild(keyInput);
                } else {
                    rowMeta.innerHTML = `<span class="prime-key-input" style="color:#52525b; font-family: monospace; font-size: 13px;">[${key}]</span>`;
                }

                const trigger = document.createElement('button');
                trigger.className = 'prime-nested-trigger';
                trigger.style.cssText = "flex: 1; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); border: 1px solid #333; color: var(--text-primary); padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;";
                const count = Object.keys(value || {}).length;
                trigger.innerHTML = `<span style="color: ${type === 'array' ? '#4ade80' : '#c084fc'}">${type === 'array' ? 'ARRAY' : 'OBJECT'} [${count}]</span> <span>➔</span>`;
                trigger.onclick = () => this.drillDown(key);
                valContainer.appendChild(trigger);
            }

            // Controls (Type Cycle / Delete) 
            const controls = document.createElement('div');
            controls.style.display = 'flex';
            controls.style.gap = '4px';
            
            const typeBtn = document.createElement('button');
            typeBtn.className = 'prime-btn';
            typeBtn.innerText = this.getShortType(value).toUpperCase();
            typeBtn.title = "Cycle Type";
            typeBtn.style.cssText = 'background: transparent; border: 1px solid #444; color: var(--text-secondary); cursor: pointer; font-size: 10px; padding: 2px 6px; border-radius: 4px;';
            typeBtn.onclick = () => this.cycleType(key, type);
            
            const delBtn = document.createElement('button');
            delBtn.className = 'prime-btn prime-btn-del';
            delBtn.innerText = '×';
            delBtn.style.cssText = 'background: transparent; border: 1px solid #ef4444; color: #ef4444; cursor: pointer; font-size: 12px; padding: 2px 6px; border-radius: 4px;';
            delBtn.onclick = () => this.deleteField(key);

            controls.appendChild(typeBtn);
            controls.appendChild(delBtn);
            
            valContainer.appendChild(controls);
            
            row.appendChild(rowMeta);
            row.appendChild(valContainer);
            this.viewEl.appendChild(row);
        });

        const endRow = this.createPhantomRow(keys.length, isArray);
        this.viewEl.appendChild(endRow);

        if (shouldFocus && !isArray) {
            setTimeout(() => {
                const input = endRow.querySelector('input');
                if (input) input.focus();
            }, 50);
        }
    }

    renderBreadcrumbs() {
        const pathDisplay = this.pathDisplay;
        pathDisplay.innerHTML = '';
        
        const render = (startIndex) => {
            pathDisplay.innerHTML = '';
            
            const rootSpan = document.createElement('span');
            rootSpan.innerText = 'ROOT';
            rootSpan.style.cursor = 'pointer';
            rootSpan.style.padding = '2px 4px';
            rootSpan.style.borderRadius = '4px';
            if (this.path.length === 0) {
                rootSpan.style.color = 'var(--accent)';
                rootSpan.style.fontWeight = '900';
            } else {
                rootSpan.style.color = '#52525b';
                rootSpan.onclick = () => { this.path = []; this.render(true); };
            }
            pathDisplay.appendChild(rootSpan);

            if (startIndex > 0) {
                const sep = document.createElement('span');
                sep.innerText = '/...';
                sep.style.color = '#333';
                sep.style.margin = '0 2px';
                pathDisplay.appendChild(sep);
            }

            const visiblePath = this.path.slice(startIndex);
            visiblePath.forEach((key, i) => {
                const realIdx = startIndex + i;
                const sep = document.createElement('span');
                sep.innerText = '/';
                sep.style.color = '#333';
                sep.style.margin = '0 2px';
                pathDisplay.appendChild(sep);

                const seg = document.createElement('span');
                seg.innerText = key;
                seg.style.padding = '2px 4px';
                seg.style.borderRadius = '4px';
                
                if (realIdx === this.path.length - 1) {
                    seg.style.color = 'var(--text-primary)';
                    seg.style.fontWeight = 'bold';
                } else {
                    seg.style.cursor = 'pointer';
                    seg.style.color = '#52525b';
                    seg.onclick = () => {
                        this.path = this.path.slice(0, realIdx + 1);
                        this.render(true);
                    };
                }
                pathDisplay.appendChild(seg);
            });
        };

        let startIdx = 0;
        render(startIdx);
        // Basic overflow handling (could be improved with ResizeObserver)
        while (pathDisplay.scrollWidth > pathDisplay.offsetWidth && startIdx < this.path.length - 1) {
             startIdx++;
             render(startIdx);
        }
    }

    drillDown(key) {
        this.path.push(key);
        this.render(true);
    }

    goBack() {
        this.path.pop();
        this.render();
    }

    updateValue(key, val) {
        const node = this.resolvePath(this.state, this.path);
        let processed = val;
        if (val === 'true') processed = true;
        else if (val === 'false') processed = false;
        else if (val === 'null') processed = null;
        else if (!isNaN(Number(val)) && val.trim() !== '') processed = Number(val);
        
        node[key] = processed;
        this.persist();
    }

    renameKey(oldKey, newKey) {
        if (oldKey === newKey || !newKey) return;
        const node = this.resolvePath(this.state, this.path);
        if (Array.isArray(node)) return;

        const keys = Object.keys(node);
        const temp = {};
        keys.forEach(k => {
            if (k === oldKey) temp[newKey] = node[oldKey];
            else temp[k] = node[k];
        });
        keys.forEach(k => delete node[k]);
        Object.assign(node, temp);
        this.persist();
        this.render();
    }

    cycleType(key, currentType) {
        const node = this.resolvePath(this.state, this.path);
        const types = ['string', 'object', 'array', 'number', 'boolean', 'null'];
        let nextType = types[(types.indexOf(currentType) + 1) % types.length];
        let newVal;
        switch(nextType) {
            case 'string': newVal = "void_text"; break;
            case 'object': newVal = {}; break;
            case 'array': newVal = []; break;
            case 'number': newVal = 0; break;
            case 'boolean': newVal = true; break;
            case 'null': newVal = null; break;
        }
        node[key] = newVal;
        this.persist();
        this.render();
    }

    deleteField(key) {
        const node = this.resolvePath(this.state, this.path);
        if (Array.isArray(node)) node.splice(key, 1);
        else delete node[key];
        this.persist();
        this.render();
    }

    performClear() {
        const node = this.resolvePath(this.state, this.path);
        if (Array.isArray(node)) {
            node.length = 0;
        } else if (typeof node === 'object' && node !== null) {
            Object.keys(node).forEach(k => delete node[k]);
        }
        this.persist();
        this.render();
    }

    manifestAt(index, key, type) {
        const node = this.resolvePath(this.state, this.path);
        let newVal;
         switch(type) {
            case 'string': newVal = "void_text"; break;
            case 'object': newVal = {}; break;
            case 'array': newVal = []; break;
            case 'number': newVal = 0; break;
            case 'boolean': newVal = true; break;
        }
        
        if (Array.isArray(node)) {
            node.splice(index, 0, newVal);
        } else {
            const keys = Object.keys(node);
            const temp = {};
            if (index >= keys.length) {
                temp[key] = newVal;
                keys.forEach(k => temp[k] = node[k]);
                delete temp[key];
                node[key] = newVal;
            } else {
                keys.forEach((k, i) => {
                    if (i === index) temp[key] = newVal;
                    temp[k] = node[k];
                });
                keys.forEach(k => delete node[k]);
                Object.assign(node, temp);
            }
        }
        this.persist();
        this.render();
    }
}