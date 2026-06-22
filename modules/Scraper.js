/**
 * @file modules/Scraper.js
 * @purpose EXTERNAL MODULE: Forensic Topology extraction (Sovereign Discovery Model).
 * @version V14.0 - Sovereign Linear Scraper (Acyclic & Self-Aware)
 */
import { log } from '../utils/logger.js';
import { Language } from '../services/Language.js';
import { State } from '../services/State.js';
import { Consent } from '../components/core/Consent.js';

export const Scraper = {
    async extract(opts = {}) {
        // [CWS] Consent gate — no page text is read without explicit text-analysis consent.
        if (!Consent.has('text_analysis')) {
            log('LOGIC', 'consent_gate_resolved', 'blocked: text_analysis not granted');
            Consent.renderModal();
            throw new Error('CONSENT_REQUIRED:text_analysis');
        }
        const inExtension = typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting;
        if (inExtension) {
            // [V13.FIX] Zero-Point Collapse: Clear stale tail before new extraction
            State.resetVolatile();

            log('LOGIC', 'SCRAPER', Language.text('MSG_BRIDGE_HANDSHAKE'));
            try {
                let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab) [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
                if (!tab) throw new Error(Language.text('ERR_TAB_NOT_FOUND'));

                log('LOGIC', 'SCRAPER', `Targeting Tab: ${tab.id} | URL: ${tab.url}`);

                // Attempt 1: Fast Sanitized Pull
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id, allFrames: true },
                    func: () => {
                        // Step 0: Substrate Stasis (Prevent Focus/Selection Theft)
                        window.__ALCHEMIST_STASIS_ACTIVE__ = true;

                        // [V13.S³] Anonymous Atomic Bridge - Logic Bleaching
                        return (() => {
                            try {
                                const NOISE_TAGS = ['SCRIPT', 'STYLE', 'SVG', 'NOSCRIPT', 'PATH', 'IFRAME', 'BR', 'IMG'];
                                const STASIS_ID = 'alchemist-stasis-shield';

                                // [V13.S³] Provocative Scrutiny Pattern: Force layout flush to manifest lazy-loaded mass
                                if (document.body) document.body.getBoundingClientRect();

                                // [V13.S³] Negative Gravity Shield
                                if (window.location.href.match(/captcha|doubleclick|googleads|adnxs\.com|usersync|pixel|analytics|collect\?/i)) {
                                    return { score: -1000000, mass: 0, ctrl_a_text: "", context_structure: "", is_frame: window !== window.top, url: window.location.href };
                                }

                                const isPureNoiseJSON = (text) => {
                                    const trimmed = text.trim();
                                    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
                                    return ['lixTracking', 'entityUrn', 'voyager', 'experimentId', 'treatmentIndex'].some(k => trimmed.includes(k));
                                };

                                // [V14-SLS] Self-Signature Purge
                                const isSelfReflection = (text) => {
                                    return [
                                        '<LINGUISTIC_SHELL>', '<CORE_MANDATE>', 'logger.js:', 
                                        '[LOGIC] GATEWAY', '<CONTEXT_DATA>', '<AUDIT>'
                                    ].some(sig => text.includes(sig));
                                };

                                const isPoisoned = (node) => {
                                    let current = node;
                                    while (current && current !== document.body && current !== document.documentElement) {
                                        if (current.tagName === 'CODE' || 
                                            current.hasAttribute?.('data-chameleon-config') || 
                                            (current.id && current.id.includes('datalet'))) {
                                            return true;
                                        }
                                        current = current.parentElement;
                                    }
                                    return false;
                                };

                                const isVisuallyHidden = (n) => {
                                    if (n.nodeType !== Node.ELEMENT_NODE) return false;
                                    if (n.classList && (n.classList.contains('visually-hidden') || n.classList.contains('visuallyhidden'))) return true;
                                    if (n.getAttribute('aria-hidden') === 'true') return true;
                                    return false;
                                };

                                const getEssenceText = (n) => {
                                    if (isVisuallyHidden(n)) return null;
                                    let txt = "";
                                    const walkEssence = (el) => {
                                        for (let child of el.childNodes) {
                                            if (child.nodeType === Node.TEXT_NODE) {
                                                const content = child.textContent.trim();
                                                if (content && !isSelfReflection(content)) txt += content + " ";
                                            } else if (child.nodeType === Node.ELEMENT_NODE) {
                                                if (!isVisuallyHidden(child) && !['SCRIPT','STYLE','SVG'].includes(child.tagName.toUpperCase())) {
                                                    walkEssence(child);
                                                }
                                            }
                                        }
                                    };
                                    walkEssence(n);
                                    txt = txt.replace(/\s+/g, ' ').trim();
                                    return (txt && txt.length < 150) ? txt : null;
                                };

                                const hasSemanticAnchor = (list, startIndex, currentStr) => {
                                    if (currentStr.trim().length > 0) return true;
                                    let tunnelCount = 0;
                                    for (let j = startIndex + 1; j < list.length; j++) {
                                        const sibling = list[j];
                                        if (sibling.nodeType === Node.TEXT_NODE) {
                                            if (sibling.textContent.trim() && !isPureNoiseJSON(sibling.textContent) && !isSelfReflection(sibling.textContent)) return true;
                                            continue;
                                        }
                                        if (sibling.nodeType === Node.ELEMENT_NODE) {
                                            if (isVisuallyHidden(sibling)) { tunnelCount++; continue; }
                                            if (getEssenceText(sibling)) return true;
                                            tunnelCount++; continue; // TUNNEL: continue searching instead of returning false
                                        }
                                    }
                                    return false;
                                };

                                const virtualCtrlA = (node) => {
                                    let text = "";
                                    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
                                    let current;
                                    while (current = walker.nextNode()) {
                                        if (isPoisoned(current.parentElement)) continue;
                                        const parentTag = current.parentElement?.tagName?.toUpperCase();
                                        if (!NOISE_TAGS.includes(parentTag) && current.parentElement?.id !== STASIS_ID) {
                                            const content = current.textContent.trim();
                                            if (content && !isPureNoiseJSON(content) && !isSelfReflection(content)) text += content + " ";
                                        }
                                    }
                                    return text.replace(/\s+/g, ' ').trim();
                                };

                                const countCandidateNodes = (node) => {
                                    let count = 0;
                                    const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT, null, false);
                                    let current;
                                    while (current = walker.nextNode()) {
                                        if (!isPoisoned(current) && !NOISE_TAGS.includes(current.tagName.toUpperCase()) && current.id !== STASIS_ID) count++;
                                    }
                                    return count;
                                };

                                let anchorNode = null;
                                const activeSel = window.getSelection();
                                if (activeSel.rangeCount > 0) {
                                    anchorNode = activeSel.getRangeAt(0).commonAncestorContainer;
                                    if (anchorNode.nodeType === Node.TEXT_NODE) anchorNode = anchorNode.parentElement;
                                    if (anchorNode && anchorNode.setAttribute) anchorNode.setAttribute('data-alchimist-anchor', 'true');
                                }

                                const walk = (node, depth, forceAnchor = false) => {
                                    if (!node) return "";
                                    if (node.id === STASIS_ID) return "";
                                    if (isPoisoned(node)) return "";
                                    if (node.nodeType === Node.TEXT_NODE) {
                                        const text = node.textContent.trim();
                                        if (!text) return "";
                                        if (isPureNoiseJSON(text)) return "[JSON_PURGE_SUCCESS]";
                                        if (isSelfReflection(text)) return ""; // [V14-SLS] Purge Reflection
                                        return text.replace(/[\r\n]+/g, ' ');
                                    }
                                    if (node.nodeType !== Node.ELEMENT_NODE) return "";
                                    const tag = node.tagName.toUpperCase();
                                    if (NOISE_TAGS.includes(tag)) return "";
                                    
                                    let hasDirectText = false;
                                    let validChildren = [];
                                    for (let child of node.childNodes) {
                                        if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) hasDirectText = true;
                                        if (child.nodeType === Node.ELEMENT_NODE && !NOISE_TAGS.includes(child.tagName.toUpperCase())) {
                                            validChildren.push(child);
                                        }
                                    }
                                    
                                    let isAnchor = forceAnchor || (node === anchorNode);

                                    if (!hasDirectText && validChildren.length === 1 && tag !== 'BODY') {
                                        return walk(validChildren[0], depth + 1, isAnchor);
                                    }
                                    let childrenStr = "";
                                    const childList = Array.from(node.childNodes);
                                    for (let i = 0; i < childList.length; i++) {
                                        const child = childList[i];
                                        
                                        // [V13.S³] Structural Simplification: Essence Discovery & Multi-Lifting
                                        if (child.nodeType === Node.ELEMENT_NODE && !isPoisoned(child)) {
                                            if (isVisuallyHidden(child)) continue; // Drop invisible metadata completely
                                            const essence = getEssenceText(child);
                                            if (essence && !isPureNoiseJSON(essence)) {
                                                if (hasSemanticAnchor(childList, i, childrenStr)) {
                                                    if (child === anchorNode || child.contains(anchorNode)) isAnchor = true;
                                                    const prefix = (childrenStr && !childrenStr.match(/[\s,:]$/)) ? ", " : "";
                                                    childrenStr += prefix + essence;
                                                    
                                                    let suffix = " ";
                                                    let suffixTunnelCount = 0;
                                                    for (let j = i + 1; j < childList.length; j++) {
                                                        const sib = childList[j];
                                                        if (sib.nodeType === Node.TEXT_NODE && sib.textContent.trim()) {
                                                            suffix = ", "; break;
                                                        }
                                                        if (sib.nodeType === Node.ELEMENT_NODE) {
                                                            if (isVisuallyHidden(sib)) { suffixTunnelCount++; continue; }
                                                            if (getEssenceText(sib)) { suffix = ", "; break; }
                                                            suffixTunnelCount++; continue; // TUNNEL
                                                        }
                                                    }
                                                    childrenStr += suffix;
                                                    continue;
                                                }
                                            }
                                        }
                                        
                                        childrenStr += walk(child, depth + 1);
                                    }

                                    if (!childrenStr && !hasDirectText) {
                                        if (depth === 1 && typeof ctrlAText !== 'undefined' && ctrlAText) {
                                            return `<level1>${ctrlAText}</level1>`;
                                        }
                                        return "";
                                    }
                                    const startTag = isAnchor ? `<level${depth} id="selected_text">` : `<level${depth}>`;
                                    return `${startTag}${childrenStr.trim()}</level${depth}>`;
                                };

                                // [V14-SLS] State Heartbeat & Intent Window
                                let alchimistAnchor = window.__alchimist_anchor;
                                if (alchimistAnchor && (Date.now() - alchimistAnchor.timestamp > 10000)) {
                                    alchimistAnchor = null; // Purge stale anchor
                                }
                                let selectionText = activeSel.toString().trim() || alchimistAnchor?.text || "";
                                
                                // [V13.S³] Ghost Check: Ensure selection is connected to active DOM
                                if (selectionText && anchorNode && !anchorNode.isConnected) {
                                    selectionText = "";
                                    anchorNode = null;
                                }

                                let topContainerHtml = null;

                                const ctrlAText = virtualCtrlA(document.body);
                                const rawCount = countCandidateNodes(document.body);
                                let topology = walk(document.body, 1);

                                // [V14-SLS] Linear Topological Simplification (Bottom-Up)
                                let iterations = 1;
                                try {
                                    const parser = new DOMParser();
                                    // Parse strictly as DOM to prevent regex fracturing and ensure tag symmetry
                                    const doc = parser.parseFromString(`<body>${topology}</body>`, 'text/html');
                                    
                                    const levels = Array.from(doc.body.querySelectorAll('*')).filter(el => el.tagName.match(/^LEVEL\d+$/i));
                                    
                                    // Single-pass bottom-up resolution prevents blocking iterations
                                    for (let i = levels.length - 1; i >= 0; i--) {
                                        const el = levels[i];
                                        let hasDirectText = false;
                                        let childElements = [];
                                        for (let node of el.childNodes) {
                                            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
                                                hasDirectText = true;
                                            } else if (node.nodeType === Node.ELEMENT_NODE) {
                                                childElements.push(node);
                                            }
                                        }
                                        
                                        if (!hasDirectText && childElements.length === 1) {
                                            const child = childElements[0];
                                            if (child.tagName.match(/^LEVEL\d+$/i)) {
                                                if (el.hasAttribute('id') && el.getAttribute('id') === 'selected_text') {
                                                    child.setAttribute('id', 'selected_text');
                                                }
                                                el.parentNode.insertBefore(child, el);
                                                el.remove();
                                            }
                                        }
                                    }
                                    
                                    // [V13.S³] Sovereign Acquisition from Simplified Topology
                                    const sovereignNode = doc.querySelector('[id="selected_text"]');
                                    if (sovereignNode) {
                                        // [V14.S³.1] Topological Boundary Lock & Triangulation Engine
                                        let author = 'SYSTEM_UNKNOWN';
                                        let provenance = 'NONE';
                                        let nodePath = 'UNKNOWN';
                                
                                        // 1. BOUNDARY LOCK: Identify Sovereign Container
                                        const boundarySelectors = ['article', '[data-urn]', '.feed-shared-update-v2', '.card'];
                                        let container = sovereignNode.closest(boundarySelectors.join(', '));
                                        if (!container) {
                                            let depth = 0;
                                            let temp = sovereignNode;
                                            // Failsafe: Do not traverse more than 5 levels up if no boundary found
                                            while(temp && depth < 5 && temp !== doc.body) { temp = temp.parentElement; depth++; }
                                            container = temp || doc.body; 
                                        }

                                        // 2. Intra-Container Strict Path Check
                                        let cur = sovereignNode;
                                        while (cur && cur !== container.parentElement && cur !== doc.body) {
                                            if (cur.hasAttribute('author')) { author = cur.getAttribute('author'); provenance = 'ATTRIBUTE_UP'; nodePath = 'attribute'; break; }
                                            if (cur.hasAttribute('data-author')) { author = cur.getAttribute('data-author'); provenance = 'DATA_AUTHOR_UP'; nodePath = 'attribute'; break; }
                                            cur = cur.parentElement;
                                        }
                                        
                                        // 3. Depth-First Semantic Extraction
                                        if (author === 'SYSTEM_UNKNOWN') {
                                             const HARD_NOISE = ['skip to main content', 'follow', 'promoted', 'subscribe', 'like', 'comment', 'repost', 'share', 'reply', 'suggested', 'notification', 'send', 'open emoji keyboard', 'emoji', 'messaging', 'add a comment'];
                                             const isValidName = (str) => str && str.length > 1 && str.length < 40 && !HARD_NOISE.some(n => str.toLowerCase().includes(n));
                                            
                                             // Priority A: CSS Target Triangulation
                                            const nameNodes = container.querySelectorAll('.update-components-actor__name, .comments-post-meta__name-text, .feed-shared-actor__name, [class*="author"], [class*="name"]');
                                            for (let node of nameNodes) {
                                                const txt = node.textContent.replace(/\n/g, ' ').trim().replace(/\s+/g, ' ');
                                                if (isValidName(txt)) { author = txt; provenance = 'CSS_TARGET'; nodePath = node.className.split(' ')[0] || 'class'; break; }
                                            }

                                            // Priority B: Local Sibling Proximity (Confined to Boundary)
                                            if (author === 'SYSTEM_UNKNOWN') {
                                                let curUp = sovereignNode;
                                                while (curUp && curUp !== container && author === 'SYSTEM_UNKNOWN') {
                                                    let sib = curUp.previousElementSibling;
                                                    while (sib) {
                                                        const txt = sib.textContent.replace(/\n/g, ' ').trim().replace(/\s+/g, ' ');
                                                        if (isValidName(txt)) { author = txt; provenance = 'PROXIMITY_SIBLING'; nodePath = 'sibling'; break; }
                                                        sib = sib.previousElementSibling;
                                                    }
                                                    curUp = curUp.parentElement;
                                                }
                                            }
                                        }
                                        
                                        topContainerHtml = sovereignNode.outerHTML;
                                    }
                                    
                                    // Restore string structure flawlessly
                                    topology = doc.body.innerHTML;
                                } catch (e) {
                                    console.error("Atomic Simplification failed:", e);
                                }

                                topology = topology.replace(/[\r\n]+/g, '').replace(/\s+/g, ' ');

                                const finalCount = (topology.match(/<level/g) || []).length;
                                
                                // [V13.S³] Mass Seniority Interlock & Semantic Weighting
                                const mass = document.body ? document.body.innerText.length : 0;
                                const signals = document.body ? document.querySelectorAll('article, [data-urn], .feed-shared-update-v2').length : 0;
                                let score = mass + (signals * 1500);
                                if (mass > 2000) score += 10000;

                                // Constraint: Sovereign Mass Override
                                if (rawCount === 0 || finalCount === 0) {
                                    score = -1000000; // Decimate technical ghost frames
                                } else if (mass > 500) {
                                    score = Math.max(score, mass * 2); // Ignore noise penalty if mass is undeniably high
                                }

                                // Release Stasis Lock
                                window.__ALCHEMIST_STASIS_ACTIVE__ = false;

                                // Returns ONLY safe, serialized primitives
                                return {
                                    profile_name: document.title.split(' | ')[0].split(' - ')[0].trim(),
                                    selected_text: selectionText,
                                    selected_text_container: topContainerHtml,
                                    ctrl_a_text: ctrlAText,
                                    unfiltered_text: document.body ? document.body.innerText : '',
                                    context_structure: `<CONTEXT_STRUCTURE>${topology}</CONTEXT_STRUCTURE>`,
                                    proofs: { 
                                        initial_quantity_of_level_tags: rawCount, 
                                        quantity_of_level_tags_after_simplification: finalCount,
                                        simplification_iterations: iterations
                                    },
                                    status: 'ACCEPTED',
                                    mass: mass,
                                    score: score,
                                    is_frame: window !== window.top,
                                    url: window.location.href
                                };
                            } catch (err) {
                                return { error: String(err.message), status: 'REJECTED' };
                            }
                        })();
                    },
                    world: 'ISOLATED'
                });

                if (!results || results.length === 0) throw new Error("Direct execution returned no result (Serialization Void).");

                // [V13.S³] Sovereign Reality Reconciliation
                const candidates = results.map(r => r.result).filter(Boolean);
                if (candidates.length === 0) throw new Error("All frames rejected execution (Serialization Void).");

                // Sort to find the "Master" frame (usually parent) to act as Anchor of Truth
                const sorted = [...candidates].sort((a, b) => (b.score !== undefined ? b.score : b.mass) - (a.score !== undefined ? a.score : a.mass));
                const primary = sorted[0];
                const masterCtrlA = (primary.ctrl_a_text || '').replace(/\s+/g, ' ').trim();

                // [V13.S³] Master Intersection Test: All selections must exist in the primary frame's text
                candidates.forEach(c => {
                    if (c.selected_text && c.selected_text.trim() !== '') {
                        // Semantic Heuristic: Strip punctuation to ensure robust intersection check
                        const normalize = (str) => str.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
                        const chunk = normalize(c.selected_text).substring(0, 50);
                        
                        if (chunk.length > 0 && !normalize(masterCtrlA).includes(chunk)) {
                            log('LOGIC', 'SCRAPER', `Ghost selection neutralized (Inconsistent with Master Frame).`);
                            c.selected_text = null;
                        }
                    } else if (c.selected_text === undefined) {
                        c.selected_text = null;
                    }
                });

                // Final selection: find the first valid non-neutralized selection, or fallback to primary frame
                let result = candidates.find(c => c.selected_text && c.selected_text.length > 0) || primary;

                if (result.error) throw new Error(result.error);

                log('LOGIC', 'SCRAPER', `${Language.text('MSG_SCRAPE_SUCCESS')} (Frames: ${candidates.length}, Sovereign: ${result.is_frame ? 'IFRAME' : 'PARENT'})`);
                result.is_remote = true;
                
                // [V14-SLS] Safe Telemetry Push (Decoupled from returned payload to prevent Circular JSON crashes)
                State.set('scraper_telemetry', {
                    candidates: candidates.map(c => ({
                        url: c.url,
                        is_frame: c.is_frame,
                        mass: c.mass,
                        score: c.score,
                        iterations: c.proofs?.simplification_iterations
                    }))
                });

                return result;
            } catch (error) {
                log('e', 'SCRAPER_BRIDGE_ERROR', `Sovereign extraction failed (${error.message}).`);
                throw error;
            }
        }
        throw new Error("Extension context unavailable. Sovereign execution requires a valid Chromium substrate.");
    }
};
    
window.Scraper = Scraper;