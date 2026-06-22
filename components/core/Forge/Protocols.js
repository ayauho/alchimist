/**
 * @file components/core/Forge/Protocols.js
 * @purpose UI: Protocols orchestrator utilizing hierarchical expanders.
 */
import { Expander } from '../../reusable/Expander.js';
import { Switcher } from '../../reusable/Switcher.js';
import { dom } from '../../../utils/dom.js';
import { Language } from '../../../services/Language.js';
import { Storage } from '../../../services/Storage.js';
import { State } from '../../../services/State.js';
import { License } from '../../../services/License.js';
import { log } from '../../../utils/logger.js';

export const PROTOCOL_CONFIG = {
    'void_source_auditor': { abbrev: 'VSA', color: 'var(--color-vsa)' },
    'resonance_buffer':    { abbrev: 'RB',  color: 'var(--color-rb)' },
    'causal_anchor':       { abbrev: 'CA',  color: 'var(--color-ca)' },
    'entropy_shield':      { abbrev: 'ES',  color: 'var(--color-es)' },
    'nexus_sync':          { abbrev: 'NS',  color: 'var(--color-ns)' },
    'image_prompt_addon':  { abbrev: 'IP',  color: 'var(--color-ip)' },
    'signature':           { abbrev: 'SIG', color: 'var(--color-sig, #f97316)' },
    'detailed_suggestions': { abbrev: 'DS',  color: 'var(--color-ds)' },
    'cognitive_origin_auditor': { abbrev: 'COA', color: 'var(--color-coa)' },
    'twitter_short':            { abbrev: 'TS',  color: 'var(--color-ts, #1DA1F2)' },
    'engagement_kinetics':      { abbrev: 'EK',  color: 'var(--color-ek)' },
    'social_alchemy':           { abbrev: 'SA',  color: 'var(--color-sa)' },
    'thematic_tagging':         { abbrev: 'TT',  color: 'var(--color-tt)' },
    'emoji_enhancement':        { abbrev: 'EM',  color: 'var(--color-em)' },
    'kaomoji_enhancement':      { abbrev: 'KM',  color: 'var(--color-km)' },
    'boldify_enhancement':      { abbrev: 'BE',  color: 'var(--color-be)' }
};

// [PREMIUM] Protocols gated behind ⚗ Unseal. `signature` is force-ON branding for the free tier.
export const PREMIUM_PROTOCOLS = new Set([
    'cognitive_origin_auditor', 'twitter_short', 'thematic_tagging',
    'boldify_enhancement', 'detailed_suggestions', 'signature'
]);

export class Protocols {
   constructor(container) {
       this.container = container;
       this.childExpanders = [];
        this._switcherMap = {};
        this.handleProtocolsRestrict = (e) => {
            const allowed = e.detail && e.detail.allowed;
            this.applyRestriction(allowed);
        };
        window.addEventListener('FORGE_PROTOCOLS_RESTRICT', this.handleProtocolsRestrict);
   }

    /**
     * Helper to create a protocol row with a switcher.
     */
    _createProtocolItem(titleKey, descKey, stateKey) {
        const config = PROTOCOL_CONFIG[stateKey] || { abbrev: '?', color: 'var(--text-secondary)' };
        const item = dom.create('div', 'protocol-row');
        item.style.setProperty('--protocol-color', config.color);
        const infoWrapper = dom.create('div', 'protocol-row__info');
        const titleNode = dom.create('div', 'protocol-row__title', { innerText: Language.text(titleKey) || titleKey });
        titleNode.setAttribute('data-protocol', stateKey);
        infoWrapper.appendChild(titleNode);
        if (descKey) {
            infoWrapper.appendChild(dom.create('div', 'protocol-row__desc', { innerText: Language.text(descKey) || descKey }));
        }
        item.appendChild(infoWrapper);

        let isCurrentlyActive = State.get(stateKey) || false;
        // [PREMIUM] Free tier: signature is force-ON branding (cannot be disabled).
        if (stateKey === 'signature' && !License.isPremium() && !isCurrentlyActive) {
            isCurrentlyActive = true;
            State.set('signature', true);
            Storage.set({ signature: true });
        }
        titleNode.style.color = isCurrentlyActive ? config.color : '';

        // Boot-Sync: Hydrate mirror from storage to ensure snapshots work on cold start
        Storage.get(stateKey).then(val => {
            if (val !== undefined && val !== null) {
                State.set(stateKey, val);
                if (val !== isCurrentlyActive) {
                    item.classList.toggle('protocol-row--active', val);
                    const input = item.querySelector('input');
                    if (input) input.checked = val;
                    this.refreshAllHeaders();
                }
            }
        });

        if (isCurrentlyActive) {
            item.classList.add('protocol-row--active');
        }
        
        const switcher = new Switcher({
            id: `switch-${stateKey.replace(/_/g, '-')}`,
            initialState: isCurrentlyActive,
            containerTarget: item,
            onChange: (newState) => {
                // [REQ-9] Free tier: signature is force-ON branding and cannot be disabled.
                // The disabled/covered switcher (or a spurious init fire) emits onChange(false)
                // right after the force-ON; left unchecked it writes State/Storage false and the
                // SIG indicator vanishes from both the Protocols and Addon headers. Coerce any
                // free-tier disable attempt back to ON so the forced state — and the badge — hold.
                if (stateKey === 'signature' && !License.isPremium()) newState = true;
                item.classList.toggle('protocol-row--active', newState);
                State.set(stateKey, newState);
                Storage.set({ [stateKey]: newState }); // Async fire-and-forget
                log('LOGIC', 'PROTOCOLS', { id: stateKey, state: newState });
               
                window.dispatchEvent(new CustomEvent('STATE_UPDATE', { 
                    detail: { key: stateKey, value: newState } 
                }));
                this.refreshAllHeaders();
            }
        });

        item.appendChild(switcher.render());
         this._switcherMap[stateKey] = switcher;

        // [PREMIUM] Gate premium protocols for the free tier — disable the switcher and overlay a
        // ⚗ Unseal cover that intercepts interaction (devtools-proof: clicks land on the cover).
        if (PREMIUM_PROTOCOLS.has(stateKey) && !License.isPremium()) {
            if (typeof switcher.setDisabled === 'function') switcher.setDisabled(true);
            item.classList.add('protocol-row--premium');
            item.style.position = 'relative';
            const _premCover = dom.create('div', 'protocol-row__premium-cover', {
                style: 'position:absolute;inset:0;display:flex;align-items:center;justify-content:flex-end;padding-right:8px;cursor:pointer;z-index:6;',
                onclick: (e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('PREMIUM_GATE_OPEN', { detail: { actionId: `protocol:${stateKey}` } })); log('UI', 'PREMIUM_ACTION_BLOCKED', { actionId: `protocol:${stateKey}` }); }
            });
            _premCover.appendChild(dom.create('span', 'protocol-row__premium-pill', {
                innerHTML: (Language.text('BTN_PREMIUM') || '⚗ Unseal'),
                style: 'padding:2px 8px;font-size:10px;font-weight:700;color:#0a0a0a;background:linear-gradient(90deg,#d4af37,#f0c75e);border-radius:9999px;'
            }));
            item.appendChild(_premCover);
        }
        
        // [V13.S³] Deep Reactivity: Sync Switcher UI with external State changes (e.g. Presets)
        const unsubscribe = State.subscribe(stateKey, (newVal) => {
            item.classList.toggle('protocol-row--active', !!newVal);
            titleNode.style.color = newVal ? config.color : '';
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox && checkbox.checked !== !!newVal) {
                checkbox.checked = !!newVal;
            }
            if (switcher) switcher.isOn = !!newVal;
        });

        // Track for cleanup
        if (!this._unsubs) this._unsubs = [];
        this._unsubs.push(unsubscribe);
        
        let nodeToReturn = item;

        // [V13.20] Signature Protocol: Conditional Textarea
        if (stateKey === 'signature') {
            const wrapper = dom.create('div', 'flex flex-col w-full gap-2');
            wrapper.appendChild(item);

            const textKey = 'protocol_signature_text';
            // [PREMIUM] Free tier: seed the default watermark text so the UI reflects the forced signature.
            if (!License.isPremium() && !State.get(textKey)) {
                const _def = Language.text('SIGNATURE_DEFAULT') || 'Transmuted via ΔLCHIMIST 🧪';
                State.set(textKey, _def);
                Storage.set({ [textKey]: _def });
            }
            const sigArea = dom.create('textarea', 'w-full bg-[#1a1a1d] text-white p-2 text-xs outline-none resize-none border border-[#27272a] rounded custom-scrollbar', {
                placeholder: Language.text('PLACEHOLDER_SIGNATURE') || 'Enter signature...',
                value: State.get(textKey) || ''
            });
            if (!License.isPremium()) sigArea.readOnly = true;

            Storage.get(textKey).then(val => {
                if (val !== undefined && val !== null) {
                    State.set(textKey, val);
                    sigArea.value = val;
                    setTimeout(() => this.adjustTextAreaHeight(sigArea), 0);
                }
            });

            const updateVisibility = (isOn) => {
                sigArea.style.display = isOn ? 'block' : 'none';
                if (isOn) setTimeout(() => this.adjustTextAreaHeight(sigArea), 0);
            };

            updateVisibility(isCurrentlyActive);

            sigArea.addEventListener('input', () => {
                State.set(textKey, sigArea.value);
                Storage.set({ [textKey]: sigArea.value });
                this.adjustTextAreaHeight(sigArea);
            });

            const unsubText = State.subscribe(stateKey, (val) => {
                updateVisibility(val);
                requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
            });
            
            this._unsubs.push(unsubText);

            wrapper.appendChild(sigArea);
            nodeToReturn = wrapper;
        }

        return nodeToReturn;
    }

    adjustTextAreaHeight(el) {
        el.style.overflow = 'hidden';
        el.style.height = '1px';
        el.style.height = (el.scrollHeight + 2) + 'px';
        
        const container = el.closest('.expandable-container');
        if (container && container.classList.contains('is-expanded')) {
            const body = container.querySelector('.expandable-body');
            if (body && body.style.maxHeight && body.style.maxHeight !== 'none') {
                body.style.maxHeight = body.scrollHeight + 'px';
            }
        }
    }

    render() {
        this.expander = new Expander({
            title: Language.text('TITLE_PROTOCOLS'),
            id: 'exp-protocols',
            groupId: 'forge-inputs',
            isDominantConfig: true,
            onToggle: (isExpanded) => {
                if (!isExpanded) {
                    // Recursion Guard: Automatically collapse nested categories
                    this.childExpanders.forEach(e => {
                        if (e.instance.isExpanded) e.instance.collapse();
                    });
                }
            }
        });

        const contentWrapper = dom.create('div', 'flex flex-col gap-2');

        // --- SECTION: Audit ---
        const auditExpander = new Expander({
            title: Language.text('CAT_AUDIT'),
            id: 'exp-protocol-audit',
            groupId: 'protocols-inner',
            isDominantConfig: false,
            isExpanded: false
        });

        this.childExpanders.push({ instance: auditExpander, keys: ['void_source_auditor', 'cognitive_origin_auditor', 'twitter_short'] });

        const auditContent = dom.create('div', 'flex flex-col gap-1 pl-2');
        auditContent.appendChild(this._createProtocolItem('LABEL_VOID_SOURCE', 'DESC_VOID_AUDITOR', 'void_source_auditor'));
        auditContent.appendChild(this._createProtocolItem('LABEL_COGNITIVE_AUDIT', 'DESC_COGNITIVE_AUDITOR', 'cognitive_origin_auditor'));
        auditContent.appendChild(this._createProtocolItem('LABEL_TWITTER_SHORT', 'DESC_TWITTER_SHORT', 'twitter_short'));

        const auditNode = auditExpander.render(auditContent);
        auditNode.classList.add('expandable-container--nested');
        
        contentWrapper.appendChild(auditNode);

        // --- SECTION: Engagement ---
        const engagementExpander = new Expander({
            title: Language.text('CAT_ENGAGEMENT') || 'Engagement',
            id: 'exp-protocol-engagement',
            groupId: 'protocols-inner',
            isDominantConfig: false
        });
        this.childExpanders.push({ instance: engagementExpander, keys: ['engagement_kinetics', 'social_alchemy', 'thematic_tagging'] });

        const engagementContent = dom.create('div', 'flex flex-col gap-1 pl-2');
        engagementContent.appendChild(this._createProtocolItem('LABEL_KINETICS', 'DESC_KINETICS', 'engagement_kinetics'));
        engagementContent.appendChild(this._createProtocolItem('LABEL_SOCIAL_ALCHEMY', 'DESC_SOCIAL_ALCHEMY', 'social_alchemy'));
        engagementContent.appendChild(this._createProtocolItem('LABEL_THEMATIC_TAGGING', 'DESC_THEMATIC_TAGGING', 'thematic_tagging'));

        const engagementNode = engagementExpander.render(engagementContent);
        engagementNode.classList.add('expandable-container--nested');
        contentWrapper.appendChild(engagementNode);

        // --- SECTION: Enhancement ---
        const enhancementExpander = new Expander({
            title: Language.text('CAT_ENHANCEMENT') || 'Enhancement',
            id: 'exp-protocol-enhancement',
            groupId: 'protocols-inner',
            isDominantConfig: false
        });
        this.childExpanders.push({ instance: enhancementExpander, keys: ['emoji_enhancement', 'kaomoji_enhancement', 'boldify_enhancement'] });

        const enhancementContent = dom.create('div', 'flex flex-col gap-1 pl-2');
        enhancementContent.appendChild(this._createProtocolItem('LABEL_EMOJI_ENHANCEMENT', 'DESC_EMOJI_ENHANCEMENT', 'emoji_enhancement'));
        enhancementContent.appendChild(this._createProtocolItem('LABEL_KAOMOJI_ENHANCEMENT', 'DESC_KAOMOJI_ENHANCEMENT', 'kaomoji_enhancement'));
        enhancementContent.appendChild(this._createProtocolItem('LABEL_BOLDIFY_ENHANCEMENT', 'DESC_BOLDIFY_ENHANCEMENT', 'boldify_enhancement'));

        const enhancementNode = enhancementExpander.render(enhancementContent);
        enhancementNode.classList.add('expandable-container--nested');
        contentWrapper.appendChild(enhancementNode);

        // --- SECTION: Addon ---
        const addonExpander = new Expander({
            title: Language.text('CAT_ADDON') || 'Addon',
            id: 'exp-protocol-addon',
            groupId: 'protocols-inner',
            isDominantConfig: false
        });
        this.childExpanders.push({ instance: addonExpander, keys: ['image_prompt_addon', 'signature', 'detailed_suggestions'] });

        const addonContent = dom.create('div', 'flex flex-col gap-1 pl-2');
        addonContent.appendChild(this._createProtocolItem('LABEL_IMAGE_PROMPT', 'DESC_IMAGE_PROMPT', 'image_prompt_addon'));
        addonContent.appendChild(this._createProtocolItem('LABEL_SIGNATURE', 'DESC_SIGNATURE', 'signature'));
        addonContent.appendChild(this._createProtocolItem('LABEL_DETAILED_SUGGESTIONS', 'DESC_DETAILED_SUGGESTIONS', 'detailed_suggestions'));

        const addonNode = addonExpander.render(addonContent);
        addonNode.classList.add('expandable-container--nested');
        contentWrapper.appendChild(addonNode);

        const mainNode = this.expander.render(contentWrapper);
        this.container.appendChild(mainNode);
       
        this.refreshAllHeaders();

        this.handlePresetApplied = () => {
            this.refreshAllHeaders();
        };
        window.addEventListener('PRESET_APPLIED', this.handlePresetApplied);

         // [ARTICLE] Self-heal: if Strategy hydrated as 'article' BEFORE Protocols.render() ran,
         // _switcherMap was empty when FORGE_PROTOCOLS_RESTRICT fired. Re-apply now using current State.
         const _hydratedStrategy = State.get('interactionType');
         if (_hydratedStrategy === 'article') {
             const ARTICLE_ALLOWED = ['void_source_auditor', 'engagement_kinetics', 'thematic_tagging',
                                       'emoji_enhancement', 'kaomoji_enhancement', 'boldify_enhancement',
                                       'image_prompt_addon', 'signature', 'detailed_suggestions'];
             this.applyRestriction(ARTICLE_ALLOWED);
             log('LOGIC', 'PROTOCOLS_RESTRICT_SELF_HEAL', { count: Object.keys(this._switcherMap).length });
         } else if (_hydratedStrategy === 'promo') {
             // [V14.5] Promo restriction = all keys except cognitive_origin_auditor and social_alchemy.
             const PROMO_FORBIDDEN = ['cognitive_origin_auditor', 'social_alchemy'];
             const PROMO_ALLOWED   = Object.keys(PROTOCOL_CONFIG).filter(k => !PROMO_FORBIDDEN.includes(k));
             this.applyRestriction(PROMO_ALLOWED);
             log('LOGIC', 'PROTOCOLS_RESTRICT_SELF_HEAL', { count: Object.keys(this._switcherMap).length, strategy: 'promo' });
         }

        log('UI', 'PROTOCOLS', 'Protocols manifold mounted successfully.');
    }

    refreshAllHeaders() {
        const updateExpander = (exp, keys) => {
            if (!exp) return;
            const active = keys
                .filter(k => State.get(k))
                .map(k => PROTOCOL_CONFIG[k])
                .filter(Boolean);
            if (typeof exp.updateIndicators === 'function') {
                exp.updateIndicators(active);
            }
        };

        // Main Protocols Header
        updateExpander(this.expander, Object.keys(PROTOCOL_CONFIG));
        
        // Aspect Headers
        this.childExpanders.forEach(child => {
            updateExpander(child.instance, child.keys);
        });
    }

    destroy() {
        window.removeEventListener('PRESET_APPLIED', this.handlePresetApplied);
         window.removeEventListener('FORGE_PROTOCOLS_RESTRICT', this.handleProtocolsRestrict);
        if (this._unsubs) this._unsubs.forEach(u => u());
        if (this.expander && typeof this.expander.destroy === 'function') {
            this.expander.destroy();
        }
        this.childExpanders.forEach(e => {
            if (typeof e.instance.destroy === 'function') e.instance.destroy();
        });
    }

     applyRestriction(allowedList) {
         const keys = Object.keys(this._switcherMap || {});
         for (const key of keys) {
             const switcher = this._switcherMap[key];
             if (!switcher || typeof switcher.setDisabled !== 'function') continue;
             const shouldDisable = (allowedList != null) && !allowedList.includes(key);
             switcher.setDisabled(shouldDisable);
         }
         log('LOGIC', 'ARTICLE_PROTOCOL_RESTRICTION_APPLIED', { allowed: allowedList || 'all' });
         this.refreshAllHeaders();
     }
 }