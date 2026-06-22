/**
 * @file components/reusable/Expander.js
 * @purpose UI: Reusable expansion logic with Tailwind/BEM integration.
 */
import { dom } from '../../utils/dom.js';
import { log } from '../../utils/logger.js';
import { License } from '../../services/License.js';
import { Language } from '../../services/Language.js';

export class Expander {
    constructor(options = {}) {
        this.title = options.title || 'Untitled';
        this.id = options.id || `exp-${Math.random().toString(36).substr(2, 9)}`;
        this.isExpanded = options.isExpanded || false;
        this.subtitle = '';
        this.onToggle = options.onToggle || null;
        this.isDominant = false;
        this.isDominantConfig = options.isDominantConfig || false;
        this.isSilent = options.isSilent || false;
        this.groupId = options.groupId || 'default';
        this.lazy = options.lazy || false;
        this.show_all = options.show_all || false;
        this.onFirstExpand = options.onFirstExpand || null;
        this.hasExpandedOnce = false;
        this.stretchTitle = options.stretchTitle || false;
        this.premiumLocked = options.premiumLocked || false;

        this.handleCloseOthers = (e) => {
            if (e.detail.groupId === this.groupId && e.detail.initiator !== this.id && this.isExpanded) {
                this.collapse();
            }
        };
        
        this.handleExpanderAction = (e) => {
            if (e.detail && e.detail.id === this.id) {
                if (e.detail.action === 'expand' && !this.isExpanded && typeof this.expand === 'function') this.expand();
                else if (e.detail.action === 'collapse' && this.isExpanded && typeof this.collapse === 'function') this.collapse();
                else if (e.detail.action === 'toggle' && typeof this.toggle === 'function') this.toggle();
            }
        };

        this.handleOutsideClick = (e) => {
            if (e.target && e.target.closest && (e.target.closest('.copy-trigger') || e.target.closest('.copy-btn'))) {
                //log('UI', 'EXPANDER_OUTSIDE_CLICK_BYPASS', { reason: 'copy_action', id: this.id });
                return;
            }
            if (!this.isExpanded) return;

            // [Detached Node Guard]: If the target was removed from DOM (e.g. during tab switch)
            // we ignore it to prevent accidental collapse.
            if (!e.target || !e.target.isConnected) return;
            
            // [IMMUNITY RULE]: Dominant expanders control their own containment.
            if (this.isDominant) {
                log('LOGIC', 'DOMINANT_IMMUNITY_TRIGGERED', { id: this.id });
                return;
            }

            const rootNode = this.element || this.container || this.host || this.body?.parentElement;
            if (rootNode && rootNode.contains(e.target)) return;
                
            // Exempt portals, modals, and overlays
            const isIgnoredPortal = e.target.closest && (
                e.target.closest('.alchimist-editor-overlay') ||
                e.target.closest('.editor-backdrop') ||
                e.target.closest('.pe-backdrop') ||
                e.target.closest('.c-dropdown-menu') ||
                e.target.closest('.c-confirmation-overlay') ||
                e.target.closest('.c-dropdown') ||
                e.target.closest('.c-modal') ||
                e.target.closest('.c-toast') ||
                e.target.closest('.c-context-menu') ||
                e.target.closest('.c-error-cover') // [V13.FIX] Exempt ErrorCover clicks during suggestion refinement errors
            );
            
            if (isIgnoredPortal) {
                log('UI', 'EXPANDER:OUTSIDE_CLICK_IGNORED', {
                    id: this.id, 
                    target: typeof e.target.className === 'string' ? e.target.className : 'unknown'
                });
                return;
            }

            // [V13.S³] Exclusion Directive: Do not collapse if click targets an excluded area (e.g., footer buttons)
            if (e.target.closest('.expander-ignore, [data-expander-ignore="true"]')) return;

            // [Phantom Suppression Guard]: Ignore clicks immediately after opening due to event bubbling
            if (Date.now() - (this._expandTimestamp || 0) < 100) return;
                
            this.collapse();
        };

        window.addEventListener('EXPANDER:CLOSE_OTHERS', this.handleCloseOthers);
        window.addEventListener('EXPANDER', this.handleExpanderAction);
        window.addEventListener('resize', this.reconcileDominantGeometry);
        document.addEventListener('click', this.handleOutsideClick);
    }

    render(contentNode) {
        this.container = dom.create('div', 'expandable-container', { id: this.id });
        if (this.isExpanded) this.container.classList.add('is-expanded');
        
        // Header
        this.header = dom.create('div', 'expandable-header', {
            onclick: () => this.toggle()
        });

        const titleGroup = dom.create('div', 'expandable-title-group');
        this.titleEl = dom.create('span', 'expandable-title w-full min-w-0');
        this.titleEl.innerHTML = this.title;
        this.subtitleEl = dom.create('span', 'expandable-subtitle', {
            innerText: this.subtitle
        });
        
        if (!this.subtitle) this.subtitleEl.classList.add('u-hidden');

        titleGroup.appendChild(this.titleEl);
        titleGroup.appendChild(this.subtitleEl);

        this.iconEl = dom.create('div', 'expandable-icon', {
            innerHTML: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>'
        });

        this.headerMiddle = dom.create('div', 'expandable-header__middle');
        if (this.stretchTitle) {
            this.headerMiddle.classList.add('hidden');
            this.headerMiddle.classList.remove('flex-1');
            titleGroup.classList.add('flex-1');
        }

        this.header.appendChild(titleGroup);
        this.header.appendChild(this.headerMiddle);
        if (this.premiumLocked && !License.isPremium()) {
            this.header.classList.add('expander--premium-locked');
            const pill = dom.create('span', 'expander__premium-pill', {
                innerHTML: (Language.text('BTN_PREMIUM') || '⚗ Unseal'),
                style: 'margin-left:auto;margin-right:8px;padding:2px 8px;font-size:10px;font-weight:700;color:#0a0a0a;background:linear-gradient(90deg,#d4af37,#f0c75e);border-radius:9999px;white-space:nowrap;'
            });
            this.header.appendChild(pill);
        }
        this.header.appendChild(this.iconEl);

        // Body
        this.body = dom.create('div', 'expandable-body', {
            style: this.isExpanded ? '' : 'max-height: 0px !important; opacity: 0; pointer-events: none;'
        });
        
        this.contentWrapper = dom.create('div', 'expandable-content');
        if (contentNode) this.contentWrapper.appendChild(contentNode);
        this.body.appendChild(this.contentWrapper);

        // Auto-recalculate height on dynamic content injection (Sanctuary fix)
        this.observer = new MutationObserver(() => {
            if (this.isExpanded && !this.isDominantConfig && !this.show_all) {
                requestAnimationFrame(() => {
                    if (this.body.style.maxHeight !== 'none' && !this.body.classList.contains('is-animating')) {
                        const height = this.contentWrapper.scrollHeight;
                        this.body.style.setProperty('max-height', height + 'px', 'important');
                    }
                });
            }
        });
        this.observer.observe(this.contentWrapper, { childList: true, subtree: true, characterData: true });

        // Void area click to collapse
        this.body.addEventListener('click', (e) => {
            if (!this.isExpanded) return;
            
            // [Phantom Suppression Guard]: Ignore synthetic clicks during layout shifts
            if (Date.now() - (this._expandTimestamp || 0) < 500) return;
            
            // Protect interactive elements, clickable rows, tools, and text content
            if (e.target.closest('button, input, textarea, select, a, .item-row, .preset-item, .integration-row, .selector-item, .switcher-container, .cursor-pointer, .persona-tools, .persona-tools__tab, .c-tag, label, .output-text-content, .protocol-row')) {
                return;
            }

            // Prevent collapse if the user is selecting text
            const selection = window.getSelection();
            if (selection && selection.toString().trim().length > 0) return;

            // [V13.FIX] Strict Void Check: Collapse ONLY on the structural background itself.
            // If the user clicks on ANY child (even if not explicitly protected), it is not a void click.
            const isVoid = e.target === this.body || e.target === this.contentWrapper;

            if (isVoid) {
                // [NESTING GUARD]: When a nested expander is open inside this body,
                // suppress self-collapse — only the innermost expanded child should collapse.
                // That inner collapse is handled naturally by handleOutsideClick on document.
                if (this.body.querySelector('.expandable-container.is-expanded')) return;

                log('UI', 'EXPANDER_COLLAPSE_VOID', { id: this.id });
                this.collapse();
            }
        });

        this.container.appendChild(this.header);
        this.container.appendChild(this.body);

        if (this.isExpanded) this.expand(true);

        return this.container;
    }

    updateSubtitle(text) {
        this.subtitle = text;
        if (this.subtitleEl) {
            this.subtitleEl.innerText = text;
            this.subtitleEl.classList.toggle('u-hidden', !text || this.isExpanded);
        }
    }

     // [V13] Rich-content sibling of updateSubtitle. Accepts a pre-built HTML string so callers can
     // apply per-segment styling (e.g. dimmed prefix/suffix wrapping a white-emphasis title) without
     // their markup being neutralized by innerText. Callers are responsible for HTML-escaping any
     // user-supplied substrings before composing the value passed in.
     updateSubtitleHTML(html) {
         const value = html || '';
         this.subtitle = value;
         if (this.subtitleEl) {
             this.subtitleEl.innerHTML = value;
             this.subtitleEl.classList.toggle('u-hidden', !value || this.isExpanded);
         }
     }

    /**
     * Updates middle container with indicator tags.
     * @param {Array<{abbrev: string, color: string}>} indicators 
     */
    updateIndicators(indicators = []) {
        if (!this.headerMiddle) return;
        this.headerMiddle.innerHTML = '';
        indicators.forEach(ind => {
            const tag = dom.create('div', 'protocol-indicator', { innerText: ind.abbrev });
            if (ind.cssText) {
                tag.style.cssText += ind.cssText;
            } else {
                tag.style.color = ind.color;
                tag.style.border = `1px solid ${ind.color}`;
            }
            if(ind.padding) tag.style.padding = ind.padding
            this.headerMiddle.appendChild(tag);
        });
    }

    toggle() {
        if (this.premiumLocked && !License.isPremium()) {
            window.dispatchEvent(new CustomEvent('PREMIUM_GATE_OPEN', { detail: { actionId: `expander:${this.id}` } }));
            log('UI', 'PREMIUM_ACTION_BLOCKED', { actionId: `expander:${this.id}` });
            return;
        }
        this.isExpanded ? this.collapse() : this.expand();
    }

    expand(instant = false) {
        log('LOGIC', 'EXPANDER_EMIT_CLOSE_OTHERS', { id: this.id, groupId: this.groupId, isSilent: this.isSilent });
        if (!this.isSilent) {
            window.dispatchEvent(new CustomEvent('EXPANDER:CLOSE_OTHERS', {
                detail: { groupId: this.groupId, initiator: this.id }
            }));
        }
        
        this._expandTimestamp = Date.now();
        this.isExpanded = true;
        this.container.classList.add('is-expanded');
        if (this.onToggle) this.onToggle(true);

        // Clear deterministic geometry flush from collapse
        this.body.style.height = '';
        this.body.style.overflowY = '';

        if (this.isDominantConfig) {
            this.setDominantMode(true);
            // In dominant mode, we bypass fixed pixel heights to allow flex-1 to work
            this.body.style.setProperty('max-height', 'none', 'important');
        } else {
            requestAnimationFrame(() => {
                if (this.show_all) {
                    this.body.style.setProperty('max-height', 'none', 'important');
                    this.body.style.overflowY = 'visible';
                } else {
                    const height = this.contentWrapper.scrollHeight;
                    this.body.style.setProperty('max-height', height + 'px', 'important');
                }
            });
        }

        this.titleEl.classList.add('expandable-title--active');
        this.iconEl.classList.add('expandable-icon--active');
        this.subtitleEl.classList.add('u-hidden');
        
        this.body.style.opacity = '1';
        this.body.style.pointerEvents = 'auto';

        if (this.lazy && !this.hasExpandedOnce) {
            this.hasExpandedOnce = true;
            if (this.onFirstExpand) this.onFirstExpand(this);
            this.notifyGeometryChange('expanded');
            return; // Parent handles geometry lock
        }

        // Active-First Scroll Alignment
        if (this.isDominantConfig) {
            setTimeout(() => {
                const activeItem = this.contentWrapper.querySelector('.selector-item--active');
                if (activeItem) {
                    activeItem.scrollIntoView({ block: 'start', behavior: 'instant' });
                    
                    // Account for absolutely positioned Tools Pane overlaying the content
                    if (this.contentWrapper.querySelector('.has-tools')) {
                        const toolsHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--persona-tools-height')) || 38;
                        this.contentWrapper.scrollTop -= toolsHeight;
                    }
                }
            }, 10);
        }

        log('UI', 'EXPANDER', { id: this.id, action: 'expand' });
        if (this.onExpandCb) this.onExpandCb(this.container);
        this.notifyGeometryChange('expanded');
    }

    collapse() {
        // [NESTING TEARDOWN] A dominant descendant expander is position:absolute / z-index:100 and keeps
        // pointer-events:auto, so this parent's collapse (max-height:0 + ancestor opacity:0) leaves it as
        // an INVISIBLE but click-stealing full-viewport overlay — clicks meant for this header land on the
        // orphaned child and fire its row handlers. Collapse dominant descendants first so they exit
        // dominant mode (drop the overlay) and clear their own management flags via onToggle(false).
        this.body.querySelectorAll('.expandable-container--dominant').forEach(child => {
            window.dispatchEvent(new CustomEvent('EXPANDER', { detail: { id: child.id, action: 'collapse' } }));
        });

        this.isExpanded = false;
        if (this.onToggle) this.onToggle(false);

        if (this.isDominantConfig) {
            this.setDominantMode(false);
        }

        log('UI', 'EXPANDER_COLLAPSE_INTERNAL', { id: this.id });

        this.container.classList.remove('is-expanded');
        this.titleEl.classList.remove('expandable-title--active');
        this.iconEl.classList.remove('expandable-icon--active');
        if (this.subtitle) this.subtitleEl.classList.remove('u-hidden');

        this.body.style.setProperty('max-height', '0px', 'important');
        // Deterministic Geometry Flush: Clear any dominant-mode overrides
        this.body.style.height = '0px'; 
        this.body.style.overflowY = 'hidden';
        
        this.body.style.opacity = '0';
        this.body.style.pointerEvents = 'none';

        log('UI', 'EXPANDER', { id: this.id, action: 'collapse' });
        this.notifyGeometryChange('collapsed');
    }

    setDominantMode(isActive) {
        if (this.isDominant === isActive) return;
        this.isDominant = isActive;

        if (isActive) {
            this.container.classList.add('expandable-container--dominant');
            const mainContent = document.getElementById('main-content');
            if (mainContent) mainContent.classList.add('u-scroll-lock');
            this.body.style.maxHeight = 'none';
            
            // Active calculation of pixel height
            this.reconcileDominantGeometry();
        } else {
            this.container.classList.remove('expandable-container--dominant');
            const mainContent = document.getElementById('main-content');
            if (mainContent) mainContent.classList.remove('u-scroll-lock');
            
            // Restore defaults
            this.body.style.height = '';
            this.body.style.overflowY = '';

            if (this.isExpanded) {
                requestAnimationFrame(() => {
                    this.body.style.maxHeight = this.contentWrapper.scrollHeight + 'px';
                });
            } else {
                this.body.style.maxHeight = '0px';
            }
        }

        if (this.isSilent) return;

        // Dispatch global event for other orchestrators (e.g., Footer)
        const dominanceEvent = new CustomEvent('UI_DOMINANCE_CHANGE', {
            detail: { id: this.id, source: this.id, isDominant: isActive },
            bubbles: true
        });
        
        if (this.container) {
            this.container.dispatchEvent(dominanceEvent);
        } else {
            document.dispatchEvent(dominanceEvent);
        }
        
        // Fallback for legacy window listeners
        window.dispatchEvent(new CustomEvent('UI_DOMINANCE_CHANGE', {
            detail: { id: this.id, source: this.id, isDominant: isActive }
        }));

        // Dispatch specific settlement event
        if (isActive) {
            window.dispatchEvent(new CustomEvent('DOMINANCE_SETTLED', {
                detail: { id: this.id }
            }));
        }

        log('UI', 'EXPANDER_DOMINANCE', { id: this.id, isDominant: isActive });
    }

    reconcileDominantGeometry() {
        if (!this.isDominant || !this.container.parentElement) return;
        requestAnimationFrame(() => {
            const parentH = this.container.parentElement.clientHeight;
            if (parentH === 0) return; // Prevent negative geometry cascade
            const headerH = this.header.offsetHeight;
            const targetBodyH = parentH - headerH;
            
            log('LOGIC', 'GEOMETRY_CRASH_CHECK', { id: this.id, parentH, headerH, targetBodyH, isSilent: this.isSilent });
            this.body.style.height = `${targetBodyH}px`;
            this.body.style.maxHeight = `${targetBodyH}px`;
            this.body.style.overflowY = 'auto';
            log('UI', 'EXPANDER_BODY_CALC', { id: this.id, bodyHeight: targetBodyH });
        });
    }

    notifyGeometryChange(targetState) {
        this.body.classList.add('is-animating');
        
        window.dispatchEvent(new CustomEvent('UI:GEOMETRY_CHANGE', { 
            detail: { origin: this.id, state: targetState, phase: 'start' }
        }));

        // Global Sync: Traverse ancestor chain and unlock parent height limits
        let currentParent = this.container.parentElement;
        while (currentParent) {
            if (currentParent.classList.contains('expandable-body')) {
                const parentNode = currentParent;
                const ownerContainer = parentNode.closest('.expandable-container');
                // Skip ancestors that are logically collapsed — never unlock their height.
                if (ownerContainer && !ownerContainer.classList.contains('is-expanded')) {
                    currentParent = currentParent.parentElement;
                    continue;
                }
                parentNode.style.maxHeight = `${parentNode.scrollHeight + 2000}px`; // Accommodate delta
                parentNode.classList.add('is-animating');
                log('UI', 'GEOMETRY:BATCH_QUEUE', { id: this.id, parentId: parentNode.id || 'anonymous' });
                
                const onParentEnd = (e) => {
                    if (e.target === parentNode && (e.propertyName === 'max-height' || e.propertyName === 'height')) {
                        parentNode.classList.remove('is-animating');
                        parentNode.style.maxHeight = 'none';
                        parentNode.removeEventListener('transitionend', onParentEnd);
                    }
                };
                parentNode.addEventListener('transitionend', onParentEnd);
                
                setTimeout(() => {
                    if (parentNode.classList.contains('is-animating')) {
                        onParentEnd({ target: parentNode, propertyName: 'max-height' });
                    }
                }, 400);
            }
            currentParent = currentParent.parentElement;
        }

        // The "Big Bang" cleanup phase
        const onTransitionEnd = (e) => {
            if (e.target === this.body && (e.propertyName === 'max-height' || e.propertyName === 'height')) {
                this.body.classList.remove('is-animating');
                if (this.isExpanded) {
                    this.body.style.maxHeight = 'none'; // Dissolve the Container-Prison
                    
                    // SP Mapping: 3. Geometry Finalization
                    if (this.isDominant) {
                        this.body.style.overflowY = 'auto'; // Allow content flow
                    }
                }
                this.body.removeEventListener('transitionend', onTransitionEnd);
                log('LOGIC', 'GEOMETRY:ATOMIC_WRITE', { id: this.id, state: targetState });
            }
        };
        this.body.addEventListener('transitionend', onTransitionEnd);

        setTimeout(() => {
            if (this.body.classList.contains('is-animating')) {
                onTransitionEnd({ target: this.body, propertyName: 'max-height' });
            }
        }, 400);
    }

    destroy() {
        // [V13.S³] Lifecycle Handshake: Ensure abandoned dominance is released upon destruction
        if (this.isDominant) {
            this.isDominant = false;
            window.dispatchEvent(new CustomEvent('UI_DOMINANCE_CHANGE', {
                detail: { id: this.id, source: this.id, isDominant: false }
            }));
            log('UI', 'EXPANDER_DOMINANCE_RELEASE', { id: this.id, reason: 'destroy' });
        }
        if (this.observer) this.observer.disconnect();
        window.removeEventListener('EXPANDER:CLOSE_OTHERS', this.handleCloseOthers);
        window.removeEventListener('EXPANDER', this.handleExpanderAction);
        window.removeEventListener('resize', this.reconcileDominantGeometry);
        document.removeEventListener('click', this.handleOutsideClick);
    }
}
