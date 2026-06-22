/**
 * @file anchor.js
 * @purpose CONTENT SCRIPT: Intent monitoring and substrate anchoring (Dynamic Registration Mode).
 */

(function() {
    // [IDEMPOTENCY] Registration (document_start) and ensureSubstrate (executeScript) can both
    // land this file in the same frame. Without this guard each run installs its OWN listeners
    // and its OWN sovereignSentinel, so EXECUTE may be handled by an instance that never captured
    // the focus target (-> INJECTION_FAILED_NO_TARGET) while another fights over focus. Allow
    // exactly ONE install per frame so capture and injection always share one consistent state.
    if (window.__alchimist_anchor_installed) return;
    window.__alchimist_anchor_installed = true;

    const SIGIL = 'Δ-ANCHOR';
    console.log(`[${SIGIL}] Substrate Monitoring Active.`);

    // Intent Storage
    window.__alchimist_anchor = { text: '', timestamp: 0 };

    /**
     * Intent Capture Logic
     * Monitors selection changes to anchor causal intent.
     */
    document.addEventListener('selectionchange', () => {
        const selection = window.getSelection().toString().trim();

        window.__alchimist_anchor = {
            text: selection,
            timestamp: Date.now()
        };

        // [V17] Local-only anchor write. The outbound SHADOW_SELECTION broadcast is removed
        // (data minimization); the Scraper reads the live selection on demand via
        // window.__alchimist_anchor, and the background heartbeat reads its existence.
    });

    // [V13.16] Sovereign Sentinel State & Proactive Capture
    let sovereignSentinel = { element: null, range: null, start: 0, end: 0 };
    
    const resolveTrueTarget = (el) => {
        if (!el) return null;
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return el;
        return el.closest ? el.closest('[contenteditable="true"]') : null;
    };

    const captureContext = (e) => {
        const target = resolveTrueTarget(e.target || document.activeElement);
        if (target && target !== sovereignSentinel.element) {
            sovereignSentinel.element = target;
            if (target.isContentEditable) {
                const sel = window.getSelection();
                sovereignSentinel.range = sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
            } else {
                sovereignSentinel.start = target.selectionStart || 0;
                sovereignSentinel.end = target.selectionEnd || 0;
            }
            
            if (chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({ 
                    action: 'NATIVE_LOG', 
                    payload: { type: 'l', aspect: 'SENTINEL_CAPTURE', args: [{ tag: target.tagName, isEditable: target.isContentEditable }] } 
                }).catch(() => {});
            }
        }
    };
    
    document.addEventListener('mousedown', captureContext, true);
    document.addEventListener('keyup', captureContext, true);
    document.addEventListener('focusin', captureContext, true);
    document.addEventListener('selectionchange', () => {
        if (document.activeElement) captureContext({ target: document.activeElement });
    });

    // [V13.16] Causal Injection Listener
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'EXECUTE_CLIPBOARD_INJECTION') {
            const target = sovereignSentinel.element;
            if (!target || target.tagName === 'BODY') {
                if (chrome.runtime && chrome.runtime.sendMessage) {
                    chrome.runtime.sendMessage({ 
                        action: 'NATIVE_LOG', 
                        payload: { type: 'e', aspect: 'INJECTION_FAILED_NO_TARGET', args: [] } 
                    }).catch(() => {});
                }
                return;
            }

            if (chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({ 
                    action: 'NATIVE_LOG', 
                    payload: { type: 'l', aspect: 'HANDSHAKE_INITIATED', args: [] } 
                }).catch(() => {});
            }

            // Phase 1: Focus Handshake (Wakes up SPAs like Gemini from Side Panel blur)
            try {
                const opts = { bubbles: true, cancelable: true, view: window };
                target.dispatchEvent(new MouseEvent('mousedown', opts));
                target.dispatchEvent(new MouseEvent('mouseup', opts));
            } catch (e) {}
            target.focus();

            if (target.isContentEditable && sovereignSentinel.range) {
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(sovereignSentinel.range);
            } else if (sovereignSentinel.start !== undefined && target.setSelectionRange) {
                target.setSelectionRange(sovereignSentinel.start, sovereignSentinel.end);
            }

            // [V17] Phase 2-A: Native form-control path for <input>/<textarea> (React/LinkedIn,
            // Gemini textarea). Uses the ISOLATED-world native value setter to bypass framework
            // state locks. Rich-text contenteditable editors (ProseMirror/Lexical on ChatGPT/Claude)
            // fall through to the Composition Bridge below, where execCommand stays the most reliable path.
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                try {
                    const proto = target.tagName === 'TEXTAREA'
                        ? window.HTMLTextAreaElement.prototype
                        : window.HTMLInputElement.prototype;
                    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                    if (nativeSetter) {
                        nativeSetter.call(target, request.payload);
                        if (target._valueTracker) target._valueTracker.setValue('');
                    } else {
                        target.value = request.payload;
                    }
                    target.dispatchEvent(new Event('input', { bubbles: true }));
                    target.dispatchEvent(new Event('change', { bubbles: true }));
                } catch (e) {
                    target.value = request.payload;
                    target.dispatchEvent(new Event('input', { bubbles: true }));
                }
                if (chrome.runtime && chrome.runtime.sendMessage) {
                    chrome.runtime.sendMessage({
                        action: 'NATIVE_LOG',
                        payload: { type: 'l', aspect: 'anchor_injection_branch', args: ['input_native'] }
                    }).catch(() => {});
                }
                return;
            }

            // Phase 2: Shrouded Injection (Composition Bridge)
            target.dispatchEvent(new CompositionEvent('compositionstart', { data: '', bubbles: true }));
            
            // Primary attempt: Native Splicing (Linked to the 'isTrusted' window created by pointers)
            document.execCommand('insertText', false, request.payload);
            
            // Secondary attempt: Framework-Specific InputEvent
            target.dispatchEvent(new InputEvent('beforeinput', { 
                inputType: 'insertCompositionText', 
                data: request.payload, 
                bubbles: true 
            }));
            
            // Phase 3: State Seal
            target.dispatchEvent(new CompositionEvent('compositionend', { data: request.payload, bubbles: true }));
            
            // Force Framework Reconciliation
            target.dispatchEvent(new Event('input', { bubbles: true }));

            // Phase 4: Verification & Brute-Force Fallback
            setTimeout(() => {
                const content = target.value !== undefined ? target.value : (target.innerText || target.textContent || '');
                if (!content.includes(request.payload.substring(0, 10))) {
                    if (chrome.runtime && chrome.runtime.sendMessage) {
                        chrome.runtime.sendMessage({ 
                            action: 'NATIVE_LOG', 
                            payload: { type: 'e', aspect: 'RECONCILIATION_WIPE_DETECTED', args: [] } 
                        }).catch(() => {});
                    }
                } else {
                    if (chrome.runtime && chrome.runtime.sendMessage) {
                        chrome.runtime.sendMessage({ 
                            action: 'NATIVE_LOG', 
                            payload: { type: 'l', aspect: 'INJECTION_SYNC_COMPLETE', args: [] } 
                        }).catch(() => {});
                    }
                }
            }, 100);
        }
    });
})();