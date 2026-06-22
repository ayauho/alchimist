/**
 * @file components/reusable/dropdown.js
 * @purpose REUSABLE UI: Advanced selector component with nested dropdown support.
 * @standard BEM, Class-based modules, Validation-wrapped data.
 */

/**
 * @class DropdownNode
 * @purpose Internal Wrapper for tree entities to expose API per node.
 */
export class DropdownNode {
    constructor(data, instance, parentId, level) {
        this.id = data.id || 'node_' + Math.random().toString(36).substr(2, 9);
        this.option = data.option || data.text || data.label || '';
        this.selection = data.selection || 'single';
        this.parentId = parentId;
        this.level = level;
        this.instance = instance;
        this.data = data; 
        this.optionsList = [];

        const children = data.options || data.items;
        if (children && Array.isArray(children)) {
            children.forEach(childData => {
                this.optionsList.push(new DropdownNode(childData, instance, this.id, level + 1));
            });
        }
    }

    // Expose the group clear method
    clearSelection(recursive = true) {
        this.instance._clearSelection(this.id, recursive);
        this.instance.updateDOMSelectionState();
        this.instance.updateClearButton();
    }

    // Count selected children
    selectionCount() {
        return this.instance._getSelectionCount(this.id);
    }
}

export default class Dropdown {
    static stylesInjected = false;

    setDisabled(isDisabled) {
        this.state.disabled = isDisabled;
        if (this.trigger) {
            this.trigger.style.opacity = isDisabled ? '0.5' : '1';
            this.trigger.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
            this.trigger.style.pointerEvents = isDisabled ? 'none' : 'auto';
        }
        if (this.el) {
            if (isDisabled) this.el.classList.add('dropdown--disabled');
            else this.el.classList.remove('dropdown--disabled');
        }
        if (isDisabled && this.state.isOpen) this.closeMenu();
    }

    static injectStyles() {
        if (this.stylesInjected) return;
        const style = document.createElement('style');
        style.textContent = `
            /* --- Dropdown Core CSS (BEM approach) --- */
            .dropdown {
                position: relative;
                display: inline-block;
                font-family: inherit;
                color: var(--dd-color);
                --dd-bg: #fff;
                --dd-color: #333;
                --dd-border: #ccc;
                --dd-hover-bg: #f0f0f0;
                --dd-max-width: 250px;
            }
            .dropdown__trigger {
                background: var(--dd-bg);
                color: var(--dd-color);
                border: 1px solid var(--dd-border);
                padding: 10px 15px;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
                min-width: 150px;
                max-width: var(--dd-max-width);
                user-select: none;
                transition: all 0.2s ease;
            }
            .dropdown__trigger:hover {
                border-color: #888;
            }
            .dropdown__trigger-text {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                margin-right: 10px;
                flex: 1;
                min-width: 0;
            }
            .dropdown__clear {
                display: none; font-size: 16px; font-weight: bold; padding-left: 8px; margin-left: 8px;
                color: #aaa; cursor: pointer; transition: color 0.2s; border-left: 1px solid #ccc;
                line-height: 1;
            }
            .dropdown__clear:hover { color: #d33; }
            .dropdown__caret {
                font-size: 0.8em;
                transition: transform 0.2s ease;
                padding-top: 3px;
                display: inline-block;
            }
            .dropdown.is-open > .dropdown__trigger > .dropdown__caret {
                transform: rotate(180deg);
            }
            
            /* Flexible width modifiers */
            .dropdown--flexible .dropdown__trigger {
                min-width: auto;
                max-width: none;
                width: max-content;
            }
            
            /* Scrollbar & Height limitations */
            .dropdown__menu {
                position: absolute;
                top: calc(100% + 5px);
                left: 0;
                background: var(--dd-bg);
                border: 1px solid var(--dd-border);
                border-radius: 6px;
                box-shadow: 0 8px 16px rgba(0,0,0,0.1);
                min-width: 100%;
                max-width: var(--dd-max-width);
                z-index: 1000;
                display: none;
                flex-direction: column;
                padding: 5px 0;
                opacity: 0;
                transition: opacity 0.2s ease;
                max-height: 300px;
                overflow-y: auto; overflow-x: hidden;
            }
            
            /* Custom Scrollbar */
            .dropdown__menu::-webkit-scrollbar { width: 6px; }
            .dropdown__menu::-webkit-scrollbar-track { background: transparent; }
            .dropdown__menu::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 3px; }

            .dropdown__menu.is-visible {
                display: flex;
                background-color: black;
            }
            .dropdown__menu.is-animating {
                opacity: 1;
            }
            
            .dropdown__item {
                padding: 8px 15px;
                cursor: pointer;
                color: var(--dd-color);
                display: flex;
                align-items: center;
                position: relative;
                user-select: none;
                transition: background 0.1s ease;
            }
            .dropdown__item:hover {
                background: var(--dd-hover-bg);
            }
            .dropdown__item--disabled { opacity: 0.5; pointer-events: none; font-style: italic; }
            
            .dropdown__item-content {
                flex: 1;
                display: flex;
                align-items: center;
                gap: 8px;
                min-width: 0;
                color: inherit;
            }
            .dropdown__item-text {
                flex: 1;
                min-width: 0;
            }
            .dropdown--truncate .dropdown__item-text {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                display: block;
            }
            .dropdown__checkbox {
                margin-right: 8px;
                pointer-events: none;
            }
            
            /* Nested Menus */
            .dropdown__item--has-nested > .dropdown__menu {
                top: -5px; 
                left: 100%; 
                margin-left: 2px;
            }
            .dropdown__item--has-nested > .dropdown__menu--left {
                left: auto;
                right: 100%;
                margin-left: 0;
                margin-right: 2px;
            }
            .dropdown__nested-icon {
                font-size: 0.8em;
                margin-left: auto;
                padding-left: 10px;
            }
            
            /* Tooltip */
            .dropdown__tooltip {
                position: fixed;
                background: rgba(30, 30, 46, 0.95);
                color: #fff;
                padding: 6px 10px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 10001;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s ease;
                max-width: 250px;
                word-wrap: break-word;
                box-shadow: 0 4px 6px rgba(0,0,0,0.2);
                backdrop-filter: blur(4px);
            }
            .dropdown__tooltip.is-visible {
                opacity: 1;
            }
        `;
        document.head.appendChild(style);
        this.stylesInjected = true;
    }

    constructor(targetSelector, config = {}) {
        Dropdown.injectStyles();
        this.target = typeof targetSelector === 'string' ? document.querySelector(targetSelector) : targetSelector;
        if (!this.target) throw new Error(`Target ${targetSelector} not found.`);

        this.config = {
            placeholder: 'Select an option...',
            multiSelect: false,
            portal: false,
            truncateStrings: true,
            equalizeHeights: false,
            maxWidth: '250px',
            maxVisibleOptions: 8,
            flexibleWidth: false,
            showClearButton: false, // Legacy compliant: off by default
            outerContainer: null,
            theme: {
                bgColor: '#ffffff',
                fontColor: '#333333',
                borderColor: '#cccccc',
                hoverBg: '#f0f4f8'
            },
            events: {
                onselect: () => {},
                onopen: () => {},
                onclose: () => {},
                oncheck: () => {},
                onnestedopen: () => {}
            },
            structure: [],
            ...config
        };

        // Backward compatibility: map legacy `items` prop to `structure`
        if (config.items && (!config.structure || config.structure.length === 0)) {
            this.config.structure = config.items;
        }

        // Core State
        this.defaultTriggerText = this.config.placeholder;
        this.state = { isOpen: false };
        this.selectedIds = new Set();
        
        // Expose public map for specific requested API
        this.options = {}; 
        this.nodes = {}; 
        this.levelMap = {}; 
        this.structure = []; 
        
        if (this.config.outerContainer) {
            this.containerNode = typeof this.config.outerContainer === 'string' 
                ? document.querySelector(this.config.outerContainer) 
                : this.config.outerContainer;
        }

        this.initDOM();
        this.applyTheme();
        this.initTooltip();
        this.bindGlobalEvents();

        // Will inherently construct empty menu boundary if array is empty
        this.refreshStructure(this.config.structure);
        
        // Allow direct assignment of user event listeners on the instance
        this.onSelect = this.config.onSelect || null;
        this.onChange = this.config.onChange || null;

        // Backward compatibility: Restore initial programmatic selection logic
        const initialTarget = this.config.selectedId || this.config.current;
        if (initialTarget) {
            this.selectById(initialTarget, true);
        }
    }

    applyTheme() {
        this.el.style.setProperty('--dd-bg', this.config.theme.bgColor);
        this.el.style.setProperty('--dd-color', this.config.theme.fontColor);
        this.el.style.setProperty('--dd-border', this.config.theme.borderColor);
        this.el.style.setProperty('--dd-hover-bg', this.config.theme.hoverBg);
        this.el.style.setProperty('--dd-max-width', this.config.maxWidth);
        if (this.config.truncateStrings) {
            this.el.classList.add('dropdown--truncate');
        }
    }

    initDOM() {
        this.el = document.createElement('div');
        this.el.className = 'dropdown';
        if (this.config.flexibleWidth) {
            this.el.classList.add('dropdown--flexible');
        }

        this.trigger = document.createElement('div');
        this.trigger.className = 'dropdown__trigger';
        
        this.triggerText = document.createElement('span');
        this.triggerText.className = 'dropdown__trigger-text';
        this.triggerText.innerHTML = this.defaultTriggerText;
        
        this.caret = document.createElement('span');
        this.caret.className = 'dropdown__caret';
        this.caret.innerHTML = '▼';

        this.trigger.appendChild(this.triggerText);
        this.trigger.appendChild(this.caret);
        
        if (this.config.showClearButton) {
            this.clearBtn = document.createElement('span');
            this.clearBtn.className = 'dropdown__clear';
            this.clearBtn.innerHTML = '⨯';
            this.clearBtn.title = 'Clear selections';
            this.trigger.appendChild(this.clearBtn);
            
            this.clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.clearAllSelections();
            });
        }
        
        this.el.appendChild(this.trigger);
        this.target.appendChild(this.el);

        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMenu();
        });
    }

    /** Structure parsing and re-rendering */
    refreshStructure(structure) {
        this.structure = structure || [];
        this.options = {};
        this.nodes = {};
        this.levelMap = {};

        const buildIndex = (items, parentId, level) => {
            if (!this.levelMap[level]) this.levelMap[level] = [];
            items.forEach(item => {
                const node = new DropdownNode(item, this, parentId, level);
                this.nodes[node.id] = node;
                this.options[node.id] = node; // Allow instance.options['id'] access
                this.levelMap[level].push(node);
                if (item.options || item.items) buildIndex(item.options || item.items, node.id, level + 1);
            });
        };

        buildIndex(this.structure, null, 1);
        
        // Prune selected IDs that no longer exist
        for (let id of this.selectedIds) {
            if (!this.nodes[id]) this.selectedIds.delete(id);
        }

        this.renderMenu();
        this.updateDOMSelectionState();
        this.updateClearButton();
    }

    renderMenu() {
        if (this.menu) this.menu.remove();
        this.menu = this._createMenuDOM(this.levelMap[1] || [], 1, 'right');
        this.el.appendChild(this.menu);
    }

    _createMenuDOM(nodes, level, preferredDirection = 'right') {
        const menu = document.createElement('div');
        menu.className = 'dropdown__menu';
        menu.dataset.preferredDir = preferredDirection;

        // Close nested menus on scroll
        menu.addEventListener('scroll', () => {
            Array.from(menu.children).forEach(sib => {
                const m = sib.querySelector('.dropdown__menu.is-visible');
                if (m) { m.classList.remove('is-animating', 'is-visible'); }
            });
        });

        nodes.forEach(node => {
            const itemEl = document.createElement('div');
            itemEl.className = 'dropdown__item';
            itemEl.dataset.id = node.id;
            
            const content = document.createElement('div');
            content.className = 'dropdown__item-content';

            // Ascertain group selection type. Map legacy multiSelect if needed.
            const parentNode = node.parentId ? this.nodes[node.parentId] : null;
            let mode = parentNode ? parentNode.selection : 'single';
            if (!parentNode && this.config.multiSelect) {
                mode = 'multiple';
            }

            if (mode === 'multiple' && (!node.optionsList || node.optionsList.length === 0)) {
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.className = 'dropdown__checkbox';
                content.appendChild(cb);
            }

            const textSpan = document.createElement('span');
            textSpan.className = 'dropdown__item-text';
            if (node.data.html) {
                textSpan.innerHTML = node.data.html;
            } else {
                textSpan.textContent = node.option;
            }
            content.appendChild(textSpan);
            itemEl.appendChild(content);

            // Tooltip handler logic restored
            itemEl.addEventListener('mouseenter', () => {
                if (this.config.truncateStrings && textSpan.scrollWidth > textSpan.clientWidth) {
                    this.showTooltip(itemEl, textSpan.textContent.trim());
                }
            });
            itemEl.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });

            if (node.data.disabled) {
                itemEl.classList.add('dropdown__item--disabled');
                itemEl.style.pointerEvents = 'none';
                itemEl.style.opacity = '0.5';
                itemEl.style.fontStyle = 'italic';
            } else if (node.optionsList && node.optionsList.length > 0) {
                // If has children, act as group/folder
                itemEl.classList.add('dropdown__item--has-nested');
                const icon = document.createElement('span');
                icon.className = 'dropdown__nested-icon';
                icon.textContent = '▶';
                itemEl.appendChild(icon);

                const nestedMenu = this._createMenuDOM(node.optionsList, level + 1, 'right');
                itemEl.appendChild(nestedMenu);

                itemEl.addEventListener('mouseenter', () => {
                    Array.from(menu.children).forEach(sib => {
                        if (sib !== itemEl) {
                            const m = sib.querySelector('.dropdown__menu.is-visible');
                            if(m) { m.classList.remove('is-animating', 'is-visible'); }
                        }
                    });
                    
                    // JS Positioning for nested menu to escape overflow clipping
                    nestedMenu.style.position = 'fixed';
                    
                    // Reset positioning to calculate natural size accurately
                    nestedMenu.style.top = '0px';
                    nestedMenu.style.left = '0px';
                    
                    nestedMenu.classList.add('is-visible');
                    
                    const rect = itemEl.getBoundingClientRect();
                    
                    // Ensure nested menu is at least as wide as the parent item
                    nestedMenu.style.minWidth = rect.width + 'px';
                    
                    const nestedRect = nestedMenu.getBoundingClientRect();
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;
                    
                    let top = rect.top - 5;
                    let left = rect.right + 2;
                    let showLeft = false;
                    
                    // Handle horizontal (right edge) collision
                    if (left + nestedRect.width > viewportWidth) {
                        let leftSide = rect.left - nestedRect.width - 2;
                        if (leftSide > 10) { // Fits on the left side
                            left = leftSide;
                            showLeft = true;
                        } else { // Doesn't fit on either side, clamp to right edge
                            left = viewportWidth - nestedRect.width - 10;
                        }
                    }
                    
                    icon.textContent = showLeft ? '◀' : '▶';
                    
                    // Handle vertical (bottom edge) collision
                    if (top + nestedRect.height > viewportHeight) {
                        top = viewportHeight - nestedRect.height - 10;
                        if (top < 10) top = 10; // Prevent top clipping if the menu is very tall
                    }
                    
                    nestedMenu.style.top = top + 'px';
                    nestedMenu.style.left = left + 'px';

                    setTimeout(() => nestedMenu.classList.add('is-animating'), 10);
                    
                    if(this.config.events?.onnestedopen) this.config.events.onnestedopen(nestedMenu, itemEl);
                });
            } else {
                // Leaf selection
                itemEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleNodeSelect(node);
                });
                itemEl.addEventListener('mouseenter', () => {
                    Array.from(menu.children).forEach(sib => {
                        const m = sib.querySelector('.dropdown__menu.is-visible');
                        if(m) { m.classList.remove('is-animating', 'is-visible'); }
                    });
                });
            }
            menu.appendChild(itemEl);
        });
        return menu;
    }

    /** Core Selection Logic */
    handleNodeSelect(node, silent = false) {
        const parent = node.parentId ? this.nodes[node.parentId] : null;
        let mode = parent ? parent.selection : 'single';
        if (!parent && this.config.multiSelect) mode = 'multiple';

        if (mode === 'single') {
            // Clear siblings
            if (parent) {
                parent.optionsList.forEach(child => this.selectedIds.delete(child.id));
            } else {
                this.levelMap[node.level].forEach(n => this.selectedIds.delete(n.id));
            }
        }

        // Toggle Selection
        if (this.selectedIds.has(node.id) && mode === 'multiple') {
            this.selectedIds.delete(node.id);
        } else {
            this.selectedIds.add(node.id);
        }

        this.updateDOMSelectionState();
        this.updateClearButton();

        if (mode === 'single') {
            this.setTriggerText(node.data.html || node.option);
        }

        // Broad event payload to cover old parameter demands (.id vs enriched event node)
        if (!silent) {
            // [V16] `item` must be a NON-CIRCULAR snapshot of the node. A live DropdownNode carries
            // `.instance` (back-ref to this Dropdown) and `.optionsList` (child DropdownNodes that
            // also back-ref the instance), forming a cycle. When a consumer persists the payload
            // (e.g. Configuration model-select -> Storage.set -> JSON.stringify), the cycle throws
            // "Converting circular structure to JSON" and aborts the calling flow. Expose a flat,
            // serializable view with the same useful fields instead of the live node.
            const itemSnapshot = {
                id: node.id,
                option: node.option,
                selection: node.selection,
                parentId: node.parentId,
                level: node.level,
                data: node.data
            };
            const eventPayload = { ...node.data, item: itemSnapshot, parentId: node.parentId, option: node.option };
            if (this.onSelect) this.onSelect(eventPayload);
            if (this.config.events?.onselect) this.config.events.onselect(eventPayload);
            if (this.config.events?.oncheck && mode === 'multiple') {
                this.config.events.oncheck({
                    lastToggled: eventPayload,
                    isChecked: this.selectedIds.has(node.id),
                    allChecked: this.getSelectedOptions()
                });
            }
            if (this.onChange) this.onChange({ action: 'select', item: itemSnapshot });
        }

        if (mode === 'single' && !silent) this.closeMenu();
    }

    _clearSelection(id, recursive) {
        const node = this.nodes[id];
        if (!node) return;
        this.selectedIds.delete(id);
        
        if (recursive && node.optionsList) {
            node.optionsList.forEach(child => this._clearSelection(child.id, recursive));
        }
    }

    _getSelectionCount(id) {
        let count = 0;
        const node = this.nodes[id];
        if (!node) return 0;
        const recurse = (n) => {
            if (this.selectedIds.has(n.id)) count++;
            n.optionsList.forEach(c => recurse(c));
        };
        node.optionsList.forEach(c => recurse(c));
        return count;
    }

    updateDOMSelectionState() {
        if(!this.menu) return;
        this.menu.querySelectorAll('.dropdown__item').forEach(el => {
            const id = el.dataset.id;
            const isSelected = this.selectedIds.has(id);
            const cb = el.querySelector('.dropdown__checkbox');
            if (cb) cb.checked = isSelected;
            
            // Reverted the .is-selected class assignment that enforced bright blue background styling.
            // Component is now fully inheriting external dark theme classes natively.
            if (isSelected) el.classList.add('is-selected');
            else el.classList.remove('is-selected');
        });
    }

    updateClearButton() {
        if (this.clearBtn) {
            this.clearBtn.style.display = this.selectedIds.size > 0 ? 'block' : 'none';
        }
    }

    /** Tooltip Boundary Management (Restored) */
    initTooltip() {
        if (this.tooltip) return;
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'dropdown__tooltip';
        this.tooltip.setAttribute('data-owner', this.instanceId || 'unknown');
        document.body.appendChild(this.tooltip);
    }

    showTooltip(targetEl, text) {
        if (!this.tooltip) return;
        this.tooltip.textContent = text;
        this.tooltip.classList.add('is-visible');
        
        const targetRect = targetEl.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();
        const boundary = this.getBoundaryRect();

        let top = targetRect.top - tooltipRect.height - 5;
        let left = targetRect.left;

        if (left + tooltipRect.width > boundary.right) {
            left = boundary.right - tooltipRect.width - 5;
        }
        if (left < boundary.left) {
            left = boundary.left + 5;
        }
        if (top < boundary.top) {
            top = targetRect.bottom + 5;
        }

        this.tooltip.style.top = `${top}px`;
        this.tooltip.style.left = `${left}px`;
    }

    hideTooltip() {
        if(this.tooltip) this.tooltip.classList.remove('is-visible');
    }

    getClippingParent(node) {
        let parent = node.parentElement;
        while (parent) {
            const style = window.getComputedStyle(parent);
            if (style.overflow !== 'visible' || style.overflowX !== 'visible' || style.overflowY !== 'visible') {
                return parent;
            }
            parent = parent.parentElement;
        }
        return window;
    }

    getBoundaryRect() {
        const boundaryNode = this.containerNode || this.getClippingParent(this.el);
        if (boundaryNode === window || boundaryNode === document.documentElement || boundaryNode === document.body) {
            return { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: window.innerHeight };
        }
        return boundaryNode.getBoundingClientRect();
    }

    /** Programmatic API */
    setTriggerText(htmlString) {
        this.triggerText.innerHTML = htmlString;
    }

    setDefaultTriggerText(htmlString) {
        this.defaultTriggerText = htmlString;
        if (this.selectedIds.size === 0) {
            this.setTriggerText(htmlString);
        }
    }

    levelEntities(level) {
        return this.levelMap[level] || [];
    }
    // Alias for requested typo resilience
    levelEntites(level) { return this.levelEntities(level); }

    clearAllSelections() {
        this.selectedIds.clear();
        this.updateDOMSelectionState();
        this.updateClearButton();
        if (this.onChange) this.onChange({ action: 'clear' });
    }

    selectById(id, silent = false) {
        const node = this.nodes[id];
        if (node) this.handleNodeSelect(node, silent);
    }

    deselectById(id) {
        this.selectedIds.delete(id);
        this.updateDOMSelectionState();
        this.updateClearButton();
        if (this.onChange) this.onChange({ action: 'deselect' });
    }

    addOption(parentId, optionConfig) {
        const parentNode = this.nodes[parentId];
        if (parentNode) {
            if (!parentNode.data.options) parentNode.data.options = [];
            parentNode.data.options.push(optionConfig);
        } else {
            this.structure.push(optionConfig);
        }
        this.refreshStructure(this.structure);
    }

    removeOption(id) {
        const removeRecursive = (items) => {
            for (let i = 0; i < items.length; i++) {
                if (items[i].id === id) { items.splice(i, 1); return true; }
                if (items[i].options && removeRecursive(items[i].options)) return true;
            }
            return false;
        };
        removeRecursive(this.structure);
        this.refreshStructure(this.structure);
    }

    getOptionById(id) {
        return this.nodes[id] ? this.nodes[id].data : null;
    }

    getIdByOption(optionStr) {
        const node = Object.values(this.nodes).find(n => n.option === optionStr);
        return node ? node.id : null;
    }

    getSelectedOptions() {
        return Array.from(this.selectedIds).map(id => {
            const n = this.nodes[id];
            return { option: n.option, id: n.id, parentId: n.parentId, ...n.data };
        });
    }

    /** Global Menu Handling */
    toggleMenu() {
        this.state.isOpen ? this.closeMenu() : this.openMenu();
    }

    performEqualizeHeights(menuEl) {
        const items = Array.from(menuEl.children);
        items.forEach(i => i.style.height = 'auto'); 
        let maxH = 0;
        items.forEach(i => {
            const h = i.getBoundingClientRect().height;
            if(h > maxH) maxH = h;
        });
        items.forEach(i => i.style.height = maxH + 'px');
    }

    adjustLayout(menuEl) {
        if (this.config.portal) {
            const rect = this.trigger.getBoundingClientRect();
            menuEl.style.position = 'fixed';
            menuEl.style.top = `${rect.bottom + 4}px`;
            menuEl.style.left = `${rect.left}px`;
            menuEl.style.minWidth = `${rect.width}px`;
            menuEl.style.width = 'max-content';
            menuEl.style.maxWidth = `${window.innerWidth - rect.left - 16}px`;
            menuEl.style.zIndex = '100000';
            return;
        }
        
        const rect = menuEl.getBoundingClientRect();
        const boundary = this.getBoundaryRect();

        if (rect.right > boundary.right) {
            menuEl.style.left = 'auto';
            menuEl.style.right = '0';
        }
        if (rect.bottom > boundary.bottom) {
            menuEl.style.top = `-${rect.height + 10}px`;
        }
    }

    openMenu() {
        this.state.isOpen = true;
        this.el.classList.add('is-open');
        
        if (this.config.portal && this.menu.parentNode !== document.body) {
            document.body.appendChild(this.menu);
        }

        this.menu.classList.add('is-visible');
        
        if (this.config.equalizeHeights) this.performEqualizeHeights(this.menu);
        this.adjustLayout(this.menu);

        setTimeout(() => this.menu.classList.add('is-animating'), 10);
        if (this.config.events?.onopen) this.config.events.onopen(this);
    }

    closeMenu() {
        this.state.isOpen = false;
        this.el.classList.remove('is-open');
        this.menu.classList.remove('is-animating');
        this.menu.querySelectorAll('.dropdown__menu.is-visible').forEach(m => m.classList.remove('is-visible', 'is-animating'));
        
        this.hideTooltip();

        setTimeout(() => {
            this.menu.classList.remove('is-visible');
            if (this.config.portal && this.menu.parentNode === document.body) {
                this.el.appendChild(this.menu);
            }
        }, 200);

        if (this.config.events?.onclose) this.config.events.onclose(this);
    }

    bindGlobalEvents() {
        if (!this.instanceId) {
            this.instanceId = 'dd-' + Math.random().toString(36).substring(2, 11);
            
            setTimeout(() => {
                document.querySelectorAll('.dropdown__tooltip:not([data-owner])').forEach(t => {
                    t.setAttribute('data-owner', this.instanceId);
                });
            }, 0);

            this.lifecycleObserver = new MutationObserver(() => {
                if (this.el && !document.body.contains(this.el)) {
                    this.destroy();
                }
            });
            this.lifecycleObserver.observe(document.body, { childList: true, subtree: true });
        }

        this._clickListener = (e) => {
            if (this.state.isOpen && !this.el.contains(e.target) && !this.menu.contains(e.target)) {
                this.closeMenu();
            }
        };
        document.addEventListener('click', this._clickListener);

        this.el.addEventListener('mouseenter', (e) => {
            if (e.target?.classList?.contains('dropdown__item')) {
                if (this.tooltip) this.tooltip.style.display = 'none';
            }
        }, true);

        this.el.addEventListener('mouseleave', () => {
            if (this.tooltip) this.tooltip.style.display = 'none';
        });
    }

    destroy() {
        if (this._clickListener) {
            document.removeEventListener('click', this._clickListener);
            this._clickListener = null;
        }

        if (this.lifecycleObserver) {
            this.lifecycleObserver.disconnect();
            this.lifecycleObserver = null;
        }
        
        if (this.tooltip) {
            if (this.tooltip.parentNode) this.tooltip.parentNode.removeChild(this.tooltip);
            this.tooltip = null;
        }

        if (this.instanceId) {
            document.querySelectorAll(`.dropdown__tooltip[data-owner="${this.instanceId}"]`).forEach(t => t.remove());
        }
        
        if (this.el && this.el.parentNode) {
            this.el.parentNode.removeChild(this.el);
        }
        
        if (this.config.portal && this.menu && this.menu.parentNode) {
            this.menu.parentNode.removeChild(this.menu);
        }
    }
}