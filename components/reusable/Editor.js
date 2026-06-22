/**
 * @file components/reusable/Editor.js
 * @purpose A sovereign UI factory for generating animated input overlays (bottom-sheet style).
 */
import { dom } from '../../utils/dom.js';
import { Language } from '../../services/Language.js';
import { Switcher } from './Switcher.js';
import { State } from '../../services/State.js';
import { log } from '../../utils/logger.js';

export class Editor {
    constructor(options = {}) {
        this.caption = options.caption || 'Edit';
        this.captionClass = options.captionClass || 'text-lg font-bold text-text-primary mb-2';
        this.saveText = options.saveText || Language.text('BTN_SAVE') || 'Save';
        this.cancelText = options.cancelText || Language.text('BTN_CANCEL') || 'Cancel';
        this.onSave = options.onSave || (() => {});
        this.onCancel = options.onCancel || (() => {});
        this.fields = new Map();
        this.overlay = null;
    }

    add(type, params) {
        const id = params.id || `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.fields.set(id, { type, params, value: params.value !== undefined ? params.value : params.initialState });
        return this; // fluent API
    }

    getValues() {
        const values = {};
        this.fields.forEach((field, id) => {
            if (field.type === 'input' || field.type === 'textarea') {
                values[id] = field.element.value;
            } else if (field.type === 'switcher') {
                values[id] = field.instance.state;
            }
        });
        return values;
    }

    // [V22] Imperatively re-run auto-grow for every textarea. Required after a programmatic
    // value injection (AI autofill) because a scripted .value assignment fires no 'input'
    // event. Safe/idempotent: height:auto -> scrollHeight is stable on re-apply.
    refreshHeights() {
        this.fields.forEach((field) => {
            if (typeof field._autoGrow === 'function') field._autoGrow();
        });
        log('UI', 'EDITOR_HEIGHTS_REFRESHED', { caption: this.caption });
    }

    render() {
        this.overlay = dom.create('div', 'alchimist-editor-overlay');
        const sheet = dom.create('div', 'alchimist-editor-sheet flex flex-col max-h-[90vh]');

        // Caption
        const header = dom.create('div', this.captionClass, { innerText: this.caption });
        header.classList.add('shrink-0', 'mb-2');
        sheet.appendChild(header);

        const content = dom.create('div', 'alchimist-editor-content flex-1 overflow-y-auto pr-2 custom-scrollbar');
        sheet.appendChild(content);

        // Fields
        this.fields.forEach((field, id) => {
            const wrapper = dom.create('div', 'input-group mb-3');
            
            if (field.type !== 'switcher' && field.params.label) {
                const label = dom.create('label', 'input-label text-sm text-text-secondary block mb-1', { 
                    innerText: Language.text(field.params.label) || field.params.label 
                });
                wrapper.appendChild(label);
            }

            if (field.type === 'textarea') {
                const defaultClass = 'alchimist-input w-full resize-none p-2 rounded bg-bg-main border border-border text-text-primary focus:border-accent focus:outline-none transition-colors';
                const input = dom.create('textarea', field.params.className || defaultClass, { 
                    placeholder: field.params.placeholder || '' 
                });
                if (field.params.rows) input.rows = field.params.rows;
                input.value = field.value || '';
                field.element = input;
                // [V17] Auto-adjusting height: textarea always reveals all text, no inner scroll.
                // Mirrors the keyInput pattern in modules/JsonPrime.js (height:auto -> scrollHeight).
                // [V22] autoGrow defaults ON; pass autoGrow:false on a field to opt out.
                if (field.params.autoGrow !== false) {
                    input.style.overflowY = 'hidden';
                    const _autoGrow = () => {
                        input.style.height = 'auto';
                        input.style.height = input.scrollHeight + 'px';
                    };
                    // [V22] Stored on the field so a programmatic value injection (AI autofill
                    // setting input.value directly) can re-run growth via refreshHeights(); the
                    // native 'input' event does NOT fire on a scripted .value assignment, so a
                    // listener-only approach misses saturated fields.
                    field._autoGrow = _autoGrow;
                    input.addEventListener('input', _autoGrow);
                    // Initial pass runs after show() synchronously attaches the overlay to the DOM,
                    // so scrollHeight is measurable. setTimeout(0) sequences after that attach.
                    setTimeout(_autoGrow, 0);
                }
                wrapper.appendChild(input);
            } else if (field.type === 'input') {
                const defaultClass = 'alchimist-input w-full p-2 rounded bg-bg-main border border-border text-text-primary focus:border-accent focus:outline-none transition-colors';
                const input = dom.create('input', field.params.className || defaultClass, { 
                    type: field.params.inputType || 'text',
                    placeholder: field.params.placeholder || '' 
                });
                input.value = field.value || '';
                field.element = input;
                wrapper.appendChild(input);
            } else if (field.type === 'switcher') {
                const switcherContainer = dom.create('div', 'flex justify-between items-center w-full mt-2 mb-2');
                const label = dom.create('span', 'text-sm text-text-primary', { 
                    innerText: Language.text(field.params.label) || field.params.label 
                });
                const switcher = new Switcher({
                    initialState: field.value || false,
                    onChange: (val) => { field.value = val; }
                });
                const sNode = switcher.render();
                field.instance = switcher;
                switcherContainer.appendChild(label);
                switcherContainer.appendChild(sNode);
                wrapper.appendChild(switcherContainer);
            }

            content.appendChild(wrapper);
        });

        // Footer
        const footer = dom.create('div', 'pe-btn-group');
        const cancelBtn = dom.create('button', 'pe-btn pe-btn--secondary', { 
            innerText: this.cancelText
        });
        const saveBtn = dom.create('button', 'pe-btn pe-btn--primary', { 
            innerText: this.saveText
        });

        cancelBtn.onclick = () => this.close();
        saveBtn.onclick = async () => {
            log('UI', 'SAVE_ATTEMPTED', { caption: this.caption });
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.5';
            try {
                const data = this.getValues();
                await this.onSave(data);
                this.close();
            } catch (e) {
                saveBtn.disabled = false;
                saveBtn.style.opacity = '1';
                log('LOGIC', 'EDITOR_SAVE_FAILED', { error: e.message });
            }
        };

        footer.classList.add('shrink-0');
        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);
        sheet.appendChild(footer);

        this.overlay.appendChild(sheet);
        
        // Block inner clicks from closing
        sheet.addEventListener('click', (e) => e.stopPropagation());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        return this.overlay;
    }

    show() {
        if (State.get('is_editor_active')) return;
        log('UI', 'EDITOR_OPENED', { caption: this.caption });
        State.set('is_editor_active', true);
        const node = this.render();
        document.body.appendChild(node);
        
        setTimeout(() => {
            const contentScroll = node.querySelector('.alchimist-editor-content');
            if (contentScroll) contentScroll.scrollTop = 0;
            const firstInput = node.querySelector('input, textarea');
            if (firstInput) firstInput.focus();
        }, 50);
    }

    close() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        State.set('is_editor_active', false); // Move before log to prevent async races
        log('UI', 'EDITOR_DISMISSED', { caption: this.caption });
        this.onCancel();
    }
}