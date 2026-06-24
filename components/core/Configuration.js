import { dom } from '../../utils/dom.js';
import { Expander } from '../reusable/Expander.js';
import { Storage } from '../../services/Storage.js';
import { Language } from '../../services/Language.js';
import { MODEL_HIERARCHY, INITIAL_SLOT_STATE } from '../../utils/constants.js';
import { Tester } from '../../services/Tester.js';
import Dropdown from '../reusable/Dropdown.js';
import { log } from '../../utils/logger.js';
import { MemoryService } from '../../services/MemoryService.js';
import { State } from '../../services/State.js';
import { License } from '../../services/License.js';
import { Treasury } from './Configuration/Treasury.js';

export class Configuration {
    constructor() {
        this.container = dom.create('div', 'flex flex-col flex-1 min-h-0 w-full overflow-y-auto relative p-2 gap-2');
        this.currentSlotIndex = 0;
        this.apiSlots = [];
        this.refreshSlotUI = this.refreshSlotUI.bind(this);
        this.syncState = this.syncState.bind(this);
        window.addEventListener('alchimist:api-rotation', this.syncState);
    }

    render() {
        this.container.innerHTML = '';

        this.apiExpander = new Expander({
            title: Language.text('CAT_API_SETTINGS'),
            id: 'exp-api-settings',
            isExpanded: true
        });

        const apiContent = dom.create('div', 'config-section');

        const slotNav = dom.create('div', 'api-slot-manager mb-4');
        const prevBtn = dom.create('button', 'slot-nav__btn', { innerHTML: '◀', onclick: () => this.navigateSlot(-1) });
        this.slotDisplay = dom.create('div', 'slot-nav__display');
        const nextBtn = dom.create('button', 'slot-nav__btn', { innerHTML: '▶', onclick: () => this.navigateSlot(1) });

        slotNav.appendChild(prevBtn);
        slotNav.appendChild(this.slotDisplay);
        slotNav.appendChild(nextBtn);
        apiContent.appendChild(slotNav);

        // [PREMIUM] Single host wrapping key + model so one cover gates both on locked slots.
        this.apiFieldsWrap = dom.create('div', 'api-slot-fields relative');
        apiContent.appendChild(this.apiFieldsWrap);

        const keyGroup = dom.create('div', 'input-group');
        this.keyLabel = dom.create('label', 'input-label', { innerText: Language.text('LABEL_API_KEY') });
        this.keyInput = dom.create('input', 'alchimist-input api-slot__key-input', {
            type: 'password',
            placeholder: Language.text('PLACEHOLDER_API_KEY')
        });
        
        this.keyInput.addEventListener('change', async (e) => {
            if (!License.isPremium() && this.currentSlotIndex > 0) return;
            if(this.apiSlots[this.currentSlotIndex]) {
                this.apiSlots.forEach(s => s.isActive = false);
                this.apiSlots[this.currentSlotIndex].isActive = true;
                this.apiSlots[this.currentSlotIndex].apiKey = e.target.value.trim();
                this.apiSlots[this.currentSlotIndex].lastExpired = null;
                if (this.apiSlots[this.currentSlotIndex].modelExhaustion) {
                    delete this.apiSlots[this.currentSlotIndex].modelExhaustion[this.apiSlots[this.currentSlotIndex].currentModel];
                }
                await Storage.set({ api_slots: this.apiSlots, active_slot_index: this.currentSlotIndex });
                this.refreshSlotUI();
            }
        });

        keyGroup.appendChild(this.keyLabel);
        keyGroup.appendChild(this.keyInput);
        this.apiFieldsWrap.appendChild(keyGroup);

        const modelGroup = dom.create('div', 'input-group');
        const modelLabel = dom.create('label', 'input-label', { innerText: Language.text('LABEL_PREFERRED_MODEL') });
        
        const dropdownTarget = dom.create('div', 'flex-1 min-w-[200px]');
        dropdownTarget.id = 'alchimist-model-dropdown-wrap';
        
        this.modelDropdown = new Dropdown(dropdownTarget, {
            items: MODEL_HIERARCHY.map(m => ({ id: m, label: m })),
             current: MODEL_HIERARCHY[0],
            className: 'conf__model-dropdown',
            portal: true,
             onSelect: async (payload) => {
                 if (!License.isPremium() && this.currentSlotIndex > 0) return;
                 // Dropdown.onSelect emits the full event payload object ({ id, label, item, parentId, option }),
                 // not a bare string. Extract the canonical model id; coercing the object into the endpoint
                 // produced "models/[object Object]" and a 400 INVALID_ARGUMENT from the API.
                 const id = (payload && typeof payload === 'object') ? (payload.id || payload.option) : payload;
                 if (typeof id !== 'string' || !id) {
                     log('w', 'CONFIG_UPDATE', { rejected: 'non-string model id', received: payload });
                     return;
                 }
                Tester.Sovereignty.claim('model-dropdown'); // Use sovereignty for the dropdown interaction
                if(this.apiSlots[this.currentSlotIndex]) {
                    this.apiSlots.forEach(s => s.isActive = false);
                    this.apiSlots[this.currentSlotIndex].isActive = true;
                    this.apiSlots[this.currentSlotIndex].preferredModel = id;
                    this.apiSlots[this.currentSlotIndex].currentModel = id;
                    this.apiSlots[this.currentSlotIndex].lastExpired = null;
                    if (this.apiSlots[this.currentSlotIndex].modelExhaustion) {
                        delete this.apiSlots[this.currentSlotIndex].modelExhaustion[id];
                    }
                    await Storage.set({ api_slots: this.apiSlots, active_slot_index: this.currentSlotIndex });
                    log('LOGIC','CONFIG_UPDATE', { aiModel: id, slot: this.currentSlotIndex });
                    this.refreshSlotUI();
                }
                Tester.Sovereignty.release('model-dropdown');
            }
        });

        const dropdownStyle = dom.create('style', '', {
            textContent: `
                #alchimist-model-dropdown-wrap .dropdown,
                .dropdown__menu {
                    --dd-bg: #0a0a0a !important;
                    --dd-color: #d4af37 !important;
                    --dd-border: rgba(212, 175, 55, 0.3) !important;
                    --dd-hover-bg: rgba(212, 175, 55, 0.2) !important;
                }
                #alchimist-model-dropdown-wrap .dropdown {
                    width: 100%;
                }
                #alchimist-model-dropdown-wrap .dropdown__trigger {
                    width: 100%;
                    font-family: 'JetBrains Mono', monospace;
                    padding: 0.5rem 0.75rem;
                }
                .dropdown__item {
                    color: #d4af37 !important;
                }
                .dropdown__item:hover {
                    background: rgba(212, 175, 55, 0.2) !important;
                    color: #ffffff !important;
                }
            `
        });
        dropdownTarget.appendChild(dropdownStyle);

        modelGroup.appendChild(modelLabel);
        modelGroup.appendChild(dropdownTarget);
        this.apiFieldsWrap.appendChild(modelGroup);

        // [PREMIUM] Cover for locked API slots (free tier = slot 1 only). Covers BOTH fields.
        this.apiPremiumCover = dom.create('div', 'api-slot-fields__premium-cover', {
            style: 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;cursor:pointer;background:rgba(5,5,7,0.78);z-index:10;',
            onclick: () => { window.dispatchEvent(new CustomEvent('PREMIUM_GATE_OPEN', { detail: { actionId: 'apislot:locked' } })); log('UI', 'PREMIUM_ACTION_BLOCKED', { actionId: 'apislot:locked' }); }
        });
        this.apiPremiumCover.innerHTML = `<span style="padding:3px 12px;font-size:11px;font-weight:800;color:#0a0a0a;background:linear-gradient(90deg,#d4af37,#f0c75e);border-radius:9999px;white-space:nowrap;">${Language.text('BTN_PREMIUM') || '⚗ Unseal'}</span>`;
        this.apiFieldsWrap.appendChild(this.apiPremiumCover);

        this.container.appendChild(this.apiExpander.render(apiContent));

        this.limitExpander = new Expander({
            title: Language.text('TITLE_LIMITS'),
            id: 'exp-storage-limits',
            isExpanded: false
        });

        const limitContent = dom.create('div', 'config-section px-0');
         const limitRow = dom.create('div', 'flex items-center justify-between gap-3 mb-2 w-full');
         const limitLabel = dom.create('label', 'input-label m-0', { innerText: Language.text('LABEL_MAX_OUTPUTS') });
         this.limitInput = dom.create('input', 'alchimist-input ml-auto w-24 text-right', {
             type: 'number',
             min: '1'
         });

        this.limitInput.addEventListener('change', async (e) => {
            const val = parseInt(e.target.value, 10) || 20;
            const currentConfig = await Storage.get('config') || {};
            await Storage.set({ config: { ...currentConfig, maxSavedOutputs: val } });
           
            // Instantly enforce the new limit on existing outputs
            const currentOutputs = await Storage.get('currentOutputs') || [];
            if (currentOutputs.length > val) {
                await Storage.set({ currentOutputs }); // Interceptor automatically applies FIFO slice
                window.dispatchEvent(new CustomEvent('alchimist:outputs-updated'));
            }
        });

         limitRow.appendChild(limitLabel);
         limitRow.appendChild(this.limitInput);
         limitContent.appendChild(limitRow);

         // [ARTICLE] Max saved articles (Library FIFO cap)
          const articlesLimitRow = dom.create('div', 'flex items-center justify-between gap-3 mb-2 w-full');
          const articlesLimitLabel = dom.create('label', 'input-label m-0', { innerText: Language.text('LABEL_MAX_SAVED_ARTICLES') });
          this.articlesLimitInput = dom.create('input', 'alchimist-input ml-auto w-24 text-right', {
              type: 'number',
              min: '1'
          });
         this.articlesLimitInput.addEventListener('change', async (e) => {
             const val = parseInt(e.target.value, 10) || 10;
             const currentConfig = await Storage.get('config') || {};
             await Storage.set({ config: { ...currentConfig, maxSavedArticles: val } });
             const arts = await Storage.get('libraryArticles') || [];
             if (arts.length > val) {
                 await Storage.set({ libraryArticles: arts });
                 window.dispatchEvent(new CustomEvent('library:articles-updated'));
             }
         });
          articlesLimitRow.appendChild(articlesLimitLabel);
          articlesLimitRow.appendChild(this.articlesLimitInput);
          limitContent.appendChild(articlesLimitRow);

          // [PERSONA] Persona knowledge threshold — drives PERSONA_KNOWLEDGE_UPDATE_PROTOCOL priority rules
          const personaThresholdRow = dom.create('div', 'flex items-center justify-between gap-3 mb-2 w-full');
          const personaThresholdLabel = dom.create('label', 'input-label m-0', { innerText: Language.text('LABEL_PERSONA_KNOWLEDGE_THRESHOLD') });
          this.personaThresholdInput = dom.create('input', 'alchimist-input ml-auto w-24 text-right', {
              type: 'number',
              min: '1'
          });
          this.personaThresholdInput.addEventListener('change', async (e) => {
              const val = parseInt(e.target.value, 10) || 40;
              const currentConfig = await Storage.get('config') || {};
              await Storage.set({ config: { ...currentConfig, personaKnowledgeThreshold: val } });
          });
          personaThresholdRow.appendChild(personaThresholdLabel);
          personaThresholdRow.appendChild(this.personaThresholdInput);
          limitContent.appendChild(personaThresholdRow);

        this.container.appendChild(this.limitExpander.render(limitContent));

        this.treasuryComponent = new Treasury();
        this.container.appendChild(this.treasuryComponent.render());

        // [PREMIUM] License activation panel — bottom of Settings.
        this.licenseExpander = new Expander({
            title: Language.text('LABEL_LICENSE') || 'License',
            id: 'exp-license',
            isExpanded: false
        });
        this.container.appendChild(this.licenseExpander.render(this._renderLicensePanel()));

        this.container.style.opacity = '0';
        this.loadState();
        return this.container;
    }

    async loadState() {
        let slots = await Storage.get('api_slots');
        if (!Array.isArray(slots) || slots.length !== 5) {
            slots = [1, 2, 3, 4, 5].map(i => INITIAL_SLOT_STATE(i));
            const legacyKey = await Storage.get('geminiApiKey');
            if (legacyKey) {
                slots[0].apiKey = legacyKey;
            }
            await Storage.set({ api_slots: slots });
        }
        this.apiSlots = slots;

        this.currentSlotIndex = (await Storage.get('active_slot_index')) || 0;

        const config = await Storage.get('config') || {};
        this.limitInput.value = config.maxSavedOutputs || 20;
         if (this.articlesLimitInput) this.articlesLimitInput.value = (config.maxSavedArticles == null) ? 10 : config.maxSavedArticles;
          if (this.personaThresholdInput) this.personaThresholdInput.value = (config.personaKnowledgeThreshold == null) ? 40 : config.personaKnowledgeThreshold;

        this.refreshSlotUI();
        
        requestAnimationFrame(() => {
            this.container.style.opacity = '1';
            console.info('[DATA][STATE]', `API slots hydrated. Length: ${this.apiSlots.length}`);
            window.dispatchEvent(new CustomEvent('alchimist:config-hydrated'));
        });
    }

    async syncState() {
        this.apiSlots = await Storage.get('api_slots') || [];
        this.currentSlotIndex = await Storage.get('active_slot_index') || 0;
        this.refreshSlotUI();
        log('UI', 'API_ROTATION_SYNC', 'UI aligned with Engine state.');
    }

    async navigateSlot(dir) {
        this.currentSlotIndex = (this.currentSlotIndex + dir + 5) % 5;
        this.apiSlots.forEach(s => s.isActive = false);
        this.apiSlots[this.currentSlotIndex].isActive = true;
        await Storage.set({ api_slots: this.apiSlots, active_slot_index: this.currentSlotIndex });
        this.refreshSlotUI();
    }

    /**
     * Refreshes the Slot UI values.
     * Note: We use specific value updates rather than innerHTML to preserve native dropdown state.
     */
    refreshSlotUI() {
        if (!this.apiSlots || this.apiSlots.length === 0) return;
        const slot = this.apiSlots[this.currentSlotIndex];
        if (!slot) return;
        if (this.apiPremiumCover) {
            this.apiPremiumCover.style.display = (!License.isPremium() && this.currentSlotIndex > 0) ? 'flex' : 'none';
        }
        const liveBadge = slot.isActive ? `<span class="text-green-500 text-[9px] font-black tracking-widest px-1 bg-green-500/10 rounded">${Language.text('LABEL_LIVE_BADGE')}</span>` : '';
        this.slotDisplay.innerHTML = `${Language.text('LABEL_SLOT')} ${slot.id} ${liveBadge}`;
        
        this.keyInput.value = slot.apiKey || '';
        
        // SOVEREIGNTY GUARD: Do not refresh dropdown value if user is currently interacting (claimed sovereignty)
        const targetModel = slot.currentModel || slot.preferredModel || MODEL_HIERARCHY[0];
        if (!Tester.Sovereignty.isActive()) {
             // Drive the dropdown through its VERIFIED public API. selectById(id, true) updates
             // selectedIds + trigger text silently (no onSelect → no Storage.set / no rotation event),
             // converging the UI to the hydrated active-slot model after async restoration.
             if (this.modelDropdown && typeof this.modelDropdown.selectById === 'function') {
                 this.modelDropdown.selectById(targetModel, true);
                 log('UI', 'CONFIG_DROPDOWN_SYNC', { model: targetModel, slot: this.currentSlotIndex });
             }
        }
        
        const isDowngraded = slot.currentModel && slot.preferredModel && (slot.currentModel !== slot.preferredModel);
        if (isDowngraded) {
            this.keyLabel.innerHTML = `${Language.text('LABEL_API_KEY')} <span class="text-orange-500 ml-1">(${Language.text('LABEL_DOWNGRADED')})</span>`;
        } else if (slot.lastExpired) {
            this.keyLabel.innerHTML = `${Language.text('LABEL_API_KEY')} <span class="text-red-500 ml-1">[${Language.text('LABEL_QUOTA_EXPIRED')}]</span>`;
        } else {
            this.keyLabel.innerText = Language.text('LABEL_API_KEY');
        }
    }

    _renderLicensePanel() {
        this._licensePanelBody = dom.create('div', 'config-section flex flex-col gap-2');
        this._paintLicensePanel();
        if (!this._onLicenseChange) {
            this._onLicenseChange = () => { this._paintLicensePanel(); this.refreshSlotUI(); };
            window.addEventListener('LICENSE_STATUS_CHANGED', this._onLicenseChange);
        }
        return this._licensePanelBody;
    }

    async _paintLicensePanel() {
        const wrap = this._licensePanelBody;
        if (!wrap) return;
        wrap.innerHTML = '';
        if (License.isPremium()) {
            const info = await License.getInfo();
            wrap.appendChild(dom.create('div', 'text-xs text-emerald-400 font-bold', { innerText: (Language.text('MSG_LICENSE_PREMIUM_ACTIVE') || 'Premium active') + (info.email ? ` — ${info.email}` : '') }));
            if (info.activatedAt) {
                wrap.appendChild(dom.create('div', 'text-[10px] text-text-secondary', { innerText: `${Language.text('MSG_LICENSE_ACTIVATED_AT') || 'Activated'} ${new Date(info.activatedAt).toLocaleDateString()}` }));
            }
            const deBtn = dom.create('button', 'alchimist-input mt-2 cursor-pointer', { innerText: Language.text('BTN_DEACTIVATE_LICENSE') || 'Deactivate' });
            deBtn.onclick = async () => { await License.revoke(); };
            wrap.appendChild(deBtn);
            return;
        }
        wrap.appendChild(dom.create('div', 'text-[10px] text-text-secondary', { innerText: Language.text('MSG_LICENSE_FREE_TIER') || 'Free tier active' }));
        const emailGroup = dom.create('div', 'input-group');
        emailGroup.appendChild(dom.create('label', 'input-label', { innerText: Language.text('LABEL_LICENSE_EMAIL') || 'Email used at purchase' }));
        const emailInput = dom.create('input', 'alchimist-input', { type: 'email' });
        emailGroup.appendChild(emailInput);
        const keyGroup = dom.create('div', 'input-group');
        keyGroup.appendChild(dom.create('label', 'input-label', { innerText: Language.text('LABEL_LICENSE_KEY') || 'License key' }));
        const keyInput = dom.create('input', 'alchimist-input', { type: 'text', placeholder: Language.text('PLACEHOLDER_LICENSE_KEY') || 'ALCH-…' });
        keyGroup.appendChild(keyInput);
        // [PROMO] Promo tokens are email-free; hide the email field when one is detected.
        keyInput.addEventListener('input', () => {
            emailGroup.hidden = keyInput.value.trim().toUpperCase().startsWith('HN-');
        });
        const msg = dom.create('div', 'text-[10px] mt-1');
        const actBtn = dom.create('button', 'alchimist-input mt-2 cursor-pointer', { innerText: Language.text('BTN_ACTIVATE_LICENSE') || 'Activate License' });
        actBtn.onclick = async () => {
            const email = emailInput.value.trim();
            const key = keyInput.value.trim();
            if (!key) { msg.innerText = Language.text('ERR_LICENSE_EMPTY_KEY') || 'Enter your license key.'; msg.style.color = '#f87171'; return; }
            const res = await License.activate(email, key);
            if (res && res.valid) {
                msg.innerText = Language.text('MSG_LICENSE_SUCCESS') || 'Premium features unlocked.';
                msg.style.color = '#34d399';
            } else {
                msg.innerText = (res && res.reason && Language.text(res.reason)) || 'Activation failed.';
                msg.style.color = '#f87171';
            }
        };
        wrap.append(emailGroup, keyGroup, actBtn, msg);
    }

    destroy() {
        window.removeEventListener('alchimist:api-rotation', this.syncState);
        if (this._onLicenseChange) window.removeEventListener('LICENSE_STATUS_CHANGED', this._onLicenseChange);
        if (this.apiExpander && typeof this.apiExpander.destroy === 'function') {
            this.apiExpander.destroy();
        }
        if (this.licenseExpander && typeof this.licenseExpander.destroy === 'function') {
            this.licenseExpander.destroy();
        }
        if (this.limitExpander && typeof this.limitExpander.destroy === 'function') {
            this.limitExpander.destroy();
        }
        if (this.treasuryComponent && typeof this.treasuryComponent.destroy === 'function') {
            this.treasuryComponent.destroy();
        }
    }
}