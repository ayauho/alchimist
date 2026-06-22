/**
 * @file components/core/Features/Profile.js
 * @purpose UI: Profile Intelligence Harvesting.
 */
import { dom } from '../../../utils/dom.js';
import { Expander } from '../../reusable/Expander.js';
import { Language } from '../../../services/Language.js';
import { Storage } from '../../../services/Storage.js';
import { State } from '../../../services/State.js';
import { log } from '../../../utils/logger.js';
import { LLM } from '../../../services/LLM.js';
import { PromptTemplates } from '../../../utils/promptTemplates.js';
import { PrimeManifold } from '../../../modules/JsonPrime.js';
import { Scraper } from '../../../modules/Scraper.js';
import { PermissionBroker } from '../../../services/PermissionBroker.js';
import Dropdown from '../../reusable/Dropdown.js';

export class Profile {
    constructor() {
        this.id = 'exp-features-profile'; // Synchronize with expander ID
        
        this.expander = new Expander({
            title: Language.text('TITLE_PROFILE') || 'Profile',
            id: this.id,
            isExpanded: false,
            groupId: 'features',
            onToggle: async (isExpanded) => {
                if (isExpanded) {
                    await this.mountAndRefreshDropdown();
                }
            }
        });

        this.handleHarvest = async () => await this.executeSiege('PROFILE_GENERATE');
        this.handleUpdate = async () => await this.executeSiege('PROFILE_UPDATE', await Storage.get('profile_intelligence'));
        this.handleClear = async () => { 
            await Storage.set({ profile_intelligence: null, profile_intelligence_backup: null }); 
            State.set('profile_intelligence', null);
            await this.syncSubtitle(); await this.hydrateAndRenderBody(); log('DATA', 'PROFILE_CLEARED'); 
        };
        this.handleUndo = async () => { 
            const backup = await Storage.get('profile_intelligence_backup'); 
            if (backup) { 
                await Storage.set({ profile_intelligence: backup, profile_intelligence_backup: null }); 
                State.set('profile_intelligence', backup);
                log('DATA', 'PROFILE_REVERTED'); await this.syncSubtitle(); await this.hydrateAndRenderBody(); 
            } 
        };
        
        this.hydrateAndRenderBody = this.hydrateAndRenderBody.bind(this);
        this.syncSubtitle = this.syncSubtitle.bind(this);

        this.unsubscribers = [];
        const syncDropdown = () => { if (this.integrationsDropdown) this.refreshIntegrationsDropdown(); };
        
        // Multi-point reactive subscriptions across all possible active events and arrays
        this.unsubscribers.push(State.subscribe('chars_active_count', syncDropdown));
        this.unsubscribers.push(State.subscribe('archetypes_active_count', syncDropdown));
        this.unsubscribers.push(State.subscribe('active_scheme_id', syncDropdown));
        // [V16] Authoritative refresh when a bundle apply/revoke mutates substrate while mounted.
        this._bundleSync = () => { if (this.integrationsDropdown) this.refreshIntegrationsDropdown(); };
        window.addEventListener('INTEGRATIONS_DATA_CHANGED', this._bundleSync);        
        ['chars', 'archetypes', 'schemes', 'char', 'archetype', 'scheme', 'characters'].forEach(k => {
            this.unsubscribers.push(State.subscribe(k, syncDropdown));
            this.unsubscribers.push(State.subscribe(`integrations_${k}`, syncDropdown));
            this.unsubscribers.push(State.subscribe(`feature_${k}`, syncDropdown));
        });
    }

    render() {
        if (!this.node) {
            this.wrapper = dom.create('div', 'features__profile flex flex-col w-full min-h-[40px]');
            
            // Immortal Static Container (synchronously appended so MutationObserver doesn't kill instances)
            this.integrationsContainer = dom.create('div', 'profile-integrations-wrapper mb-4');
            this.wrapper.appendChild(this.integrationsContainer);

            // Volatile Dynamic Content Container (cleared during state hydration)
            this.dynamicWrapper = dom.create('div', 'profile-dynamic-content flex flex-col w-full gap-3');
            this.wrapper.appendChild(this.dynamicWrapper);

            this.node = this.expander.render(this.wrapper);
        }
        
        // Ensure subtitle and body are hydrated
        this.syncSubtitle();
        this.hydrateAndRenderBody();
        return this.node;
    }

    async mountAndRefreshDropdown() {
        if (!this.integrationsContainer) return;
        
        // Dropdown internal MutationObserver expects the parent to be in the document body.
        // We wait for DOM settlement if it's currently rendering.
        if (!document.body.contains(this.integrationsContainer)) {
            await new Promise(r => setTimeout(r, 50));
            if (!document.body.contains(this.integrationsContainer)) return;
        }

        if (!this.integrationsDropdown) {
            // Inject theme-compliant BEM CSS overrides exclusively for the profile dropdown scope
            if (!document.getElementById('profile-dropdown-overrides')) {
                const style = dom.create('style', '', { id: 'profile-dropdown-overrides' });
                style.innerHTML = `
                    .profile-integrations-wrapper .dropdown__trigger { background-color: #18181b !important; color: #e4e4e7 !important; border-color: rgba(255,255,255,0.1) !important; }
                    .profile-integrations-wrapper .dropdown__caret { opacity: 0.6; }
                    
                    .profile-integrations-menu { background-color: #1f1f22 !important; border-color: rgba(255,255,255,0.1) !important; box-shadow: 0 4px 15px rgba(0,0,0,0.5) !important; }
                    .profile-integrations-menu .dropdown__item { color: #e4e4e7 !important; position: relative; padding-right: 28px; }
                    .profile-integrations-menu .dropdown__item:hover { background-color: rgba(255,255,255,0.05) !important; }
                    .profile-integrations-menu .dropdown__group-label { color: #a1a1aa !important; font-size: 11px !important; text-transform: uppercase; letter-spacing: 0.05em; }
                    .profile-integrations-menu .is-selected { background-color: rgba(99,102,241,0.25) !important; color: #a5b4fc !important; font-weight: 500; }
                    .profile-integrations-menu .is-selected:not(:has(.dropdown__checkbox))::after { content: '✓'; position: absolute; right: 12px; font-weight: 900; color: #a5b4fc; }
                    .profile-integrations-menu [data-id="action_clear_selections"] { border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 4px; padding-bottom: 8px; color: #a1a1aa !important; justify-content: center; }
                    .profile-integrations-menu [data-id="action_clear_selections"]:hover { color: #f87171 !important; background-color: rgba(248,113,113,0.1) !important; }
                `;
                document.head.appendChild(style);
            }

            this.integrationsDropdown = new Dropdown(this.integrationsContainer, {
                defaultTriggerText: Language.text('INTEGRATIONS_DROPDOWN_PLACEHOLDER') || "Select integrations",
                portal: true 
            });

            this.integrationsDropdown.onSelect = (event) => {
                // Intercept the utility action first
                if (event.id === 'action_clear_selections') {
                    this.integrationsDropdown.clearAllSelections();
                    this.integrationsDropdown.closeMenu();
                    return;
                }

                if (event.parentId === 'schemes') {
                    // Downward Trigger Selection
                    const schemeId = event.id;
                    const scheme = (this.lastFetchedSchemes || []).find(s => s.id === schemeId);
                    
                    if (this.integrationsDropdown.options['chars']) this.integrationsDropdown.options['chars'].clearSelection(true);
                    if (this.integrationsDropdown.options['archetypes']) this.integrationsDropdown.options['archetypes'].clearSelection(true);
                    
                    if (scheme) {
                        const elements = scheme.elements || scheme.snapshot || {};
                        const sChars = elements.chars || elements.char || elements.characters || [];
                        const sArchs = elements.archetypes || elements.archetype || [];
                        
                        // Silently select all blueprint entities
                        sChars.forEach(id => this.integrationsDropdown.selectById(id, true));
                        sArchs.forEach(id => this.integrationsDropdown.selectById(id, true));
                        
                        log('LOGIC', 'PROFILE_SCHEME_TRIGGER_APPLIED', { scheme: scheme.name, chars: sChars.length, archetypes: sArchs.length });
                    }
                    
                    if (typeof this.integrationsDropdown.updateDOMSelectionState === 'function') {
                        this.integrationsDropdown.updateDOMSelectionState();
                    }
                    
                    // Manual onChange invocation to flush visuals & Storage
                    if (typeof this.integrationsDropdown.onChange === 'function') this.integrationsDropdown.onChange();
                    
                } else if (event.parentId === 'chars' || event.parentId === 'archetypes') {
                    // Upward Consistency Check
                    const selected = this.integrationsDropdown.getSelectedOptions();
                    const selectedCharIds = selected.filter(node => node.parentId === 'chars').map(node => node.id);
                    const selectedArchIds = selected.filter(node => node.parentId === 'archetypes').map(node => node.id);
                    
                    let matchedScheme = null;
                    for (const scheme of (this.lastFetchedSchemes || [])) {
                        const elements = scheme.elements || scheme.snapshot || {};
                        const sChars = (elements.chars || elements.char || elements.characters || []).map(id => String(id));
                        const sArchs = (elements.archetypes || elements.archetype || []).map(id => String(id));
                        
                        if (sChars.length === selectedCharIds.length && sArchs.length === selectedArchIds.length) {
                            const allCharsMatch = sChars.every(id => selectedCharIds.includes(id));
                            const allArchsMatch = sArchs.every(id => selectedArchIds.includes(id));
                            if (allCharsMatch && allArchsMatch) {
                                matchedScheme = scheme;
                                break;
                            }
                        }
                    }

                    if (this.integrationsDropdown.options['schemes']) this.integrationsDropdown.options['schemes'].clearSelection(true);
                    
                    if (matchedScheme) {
                        this.integrationsDropdown.selectById(matchedScheme.id, true);
                        log('LOGIC', 'PROFILE_SCHEME_CONSISTENCY_LOCKED', { scheme: matchedScheme.name });
                    } else {
                        log('LOGIC', 'PROFILE_SCHEME_CONSISTENCY_BROKEN', {});
                    }
                    
                    if (typeof this.integrationsDropdown.updateDOMSelectionState === 'function') {
                        this.integrationsDropdown.updateDOMSelectionState();
                    }
                    
                    if (typeof this.integrationsDropdown.onChange === 'function') this.integrationsDropdown.onChange();
                }
            };

            this.integrationsDropdown.onChange = () => {
                let parts = [];
                if (typeof this.integrationsDropdown.levelEntities === 'function') {
                    this.integrationsDropdown.levelEntities(1).forEach(entity => {
                        // Ensure the clear action node and schemes don't contribute to counts
                        if (entity.id !== 'action_clear_selections' && entity.id !== 'schemes' && typeof entity.selectionCount === 'function') {
                            const count = entity.selectionCount();
                            if (count > 0) parts.push(`${entity.option}:(${count})`);
                        }
                    });
                }
                
                const activeCharsCount = (this.lastFetchedChars || []).filter(c => c.isActive || c.active || c.enabled).length;
                const activeArchsCount = (this.lastFetchedArchs || []).filter(a => a.isActive || a.active || a.enabled).length;
                const hasActiveIndividuals = activeCharsCount > 0 || activeArchsCount > 0;

                if (parts.length > 0) {
                    this.integrationsDropdown.setTriggerText(parts.join(', '));
                } else if (!hasActiveIndividuals) {
                    this.integrationsDropdown.setTriggerText(Language.text('INTEGRATIONS_NO_ACTIVE_INTEGRATIONS') || "<i>no active integrations</i>");
                } else {
                    this.integrationsDropdown.setTriggerText(this.integrationsDropdown.defaultTriggerText || Language.text('INTEGRATIONS_DROPDOWN_PLACEHOLDER') || "Select integrations");
                }

                // Filter out the utility action before writing to persistent state
                const currentSelections = this.integrationsDropdown.getSelectedOptions()
                    .map(opt => opt.id)
                    .filter(id => id !== 'action_clear_selections');

                // Dynamically show/hide the Clear Selections list item
                const clearOpt = this.integrationsDropdown.menu?.querySelector('[data-id="action_clear_selections"]');
                if (clearOpt) {
                    clearOpt.style.display = currentSelections.length > 0 ? 'flex' : 'none';
                }

                // Passive Write-Back (Persists current state and finalizes purges)
                Storage.set({ profile_selected_integrations: currentSelections });
                log('DATA', 'PROFILE_INTEGRATIONS_STATE_SAVED', currentSelections);
            };
        }

        await this.refreshIntegrationsDropdown();
    }
    
    async syncSubtitle() {
        const data = await Storage.get('profile_intelligence');

        if (data && data.profile_name) {
            this.expander.updateSubtitle(data.profile_name);
        } else {
            this.expander.updateSubtitle('');
        }
    }

    async hydrateAndRenderBody() {
        if (!this.dynamicWrapper) return;
        
        const data = await Storage.get('profile_intelligence');
        const backup = await Storage.get('profile_intelligence_backup');
        
        // ONLY wipe the volatile dynamic wrapper, guaranteeing the dropdown shell immortality
        this.dynamicWrapper.innerHTML = '';
        
        // Sync Dropdown immediately if the panel is open
        if (this.expander && this.expander.isExpanded) {
            await this.mountAndRefreshDropdown();
        }

        if (data && data.profile_name) {
            this.expander.updateSubtitle(data.profile_name);
        } else {
            this.expander.updateSubtitle('');
        }
        
        if (!data || Object.keys(data).length === 0) {
            const harvestBtn = dom.create('button', 'profile-actions__harvest w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow text-sm font-medium transition-colors', {
                innerText: Language.text('BTN_HARVEST') || 'Harvest Profile',
                id: 'btn-profile-harvest',
                onclick: this.handleHarvest
            });
            this.dynamicWrapper.appendChild(harvestBtn);
        } else {
            const jsonContainer = dom.create('div', 'w-full bg-gray-900 rounded border border-gray-700 p-2 json-prime-container');
            
            // Clean up legacy PrimeManifold instance to prevent memory leaks
            if (this.primeManifold && typeof this.primeManifold.destroy === 'function') {
                this.primeManifold.destroy();
            }

            this.primeManifold = new PrimeManifold(jsonContainer, (newState) => {
                Storage.set({ profile_intelligence: newState });
                State.set('profile_intelligence', newState);
            }, { initialData: data, copyLabel: 'COPY JSON' });
            
            this.dynamicWrapper.appendChild(jsonContainer);

            const actionGroup = dom.create('div', 'profile-actions flex gap-2 mt-2');
            
            if (backup) {
                const undoBtn = dom.create('button', 'flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded shadow text-sm font-medium transition-colors', {
                    innerText: Language.text('BTN_UNDO') || 'Undo',
                    onclick: this.handleUndo
                });
                actionGroup.appendChild(undoBtn);
            }

            const updateBtn = dom.create('button', 'flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow text-sm font-medium transition-colors', {
                innerText: Language.text('BTN_UPDATE') || 'Update Profile',
                onclick: this.handleUpdate
            });
            const clearBtn = dom.create('button', 'flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded shadow text-sm font-medium transition-colors', {
                innerText: Language.text('BTN_CLEAR') || 'Clear Profile',
                onclick: this.handleClear
            });
            
            actionGroup.appendChild(updateBtn);
            actionGroup.appendChild(clearBtn);
            this.dynamicWrapper.appendChild(actionGroup);
        }
    }

    async executeSiege(templateId, existingData = null) {
        const permitted = await PermissionBroker.ensurePermission();
        if (!permitted) {
            log('UI', 'HARVEST_ABORTED_NO_PERMISSION');
            return;
        }
        try {
            State.set('is_harvesting_profile', true);
            State.set('is_transmuting', true);
            
            const context_data = await Scraper.extract().catch(() => ({ ctrl_a_text: 'Fallback context.', context_structure: '' }));
            const context_block = PromptTemplates.get('CONTEXT_DATA', context_data).content;
            const template = PromptTemplates.get(templateId, { context: context_block, existing: existingData });
            
            // Get selected options directly from the component state API
            const activeNodes = (this.integrationsDropdown && typeof this.integrationsDropdown.getSelectedOptions === 'function') 
                ? this.integrationsDropdown.getSelectedOptions() 
                : (this.integrationsDropdown ? this.integrationsDropdown.state.selectedNodes : []);

            if (activeNodes && activeNodes.length > 0) {
                const { chars, archetypes } = await this.flattenSelectedIntegrations(activeNodes);
                const isUpdate = templateId === 'PROFILE_UPDATE';
                if (chars.length > 0) {
                    template.content += "\n\n" + PromptTemplates.get('PROFILE_INTEGRATION_CHAR', { chars: chars, isUpdate }).content;
                }
                if (archetypes.length > 0) {
                    template.content += "\n\n" + PromptTemplates.get('PROFILE_INTEGRATION_ARCH', { archetypes: archetypes, isUpdate }).content;
                }
                log('AI', 'INTEGRATIONS_PROMPT_COMPILE_COMPLETE', { prompt_length: template.content.length });
            }

            log('DATA', 'PROMPT_RAW', template.content);
            
            const raw_json = await LLM.transmute(template.content);
            
            let clean_json = existingData || {};
            try {
                const match = raw_json.match(/\[[\s\S]*\]/);
                const parsed = match ? JSON.parse(match[0]) : JSON.parse(raw_json);
                clean_json = Array.isArray(parsed) ? (parsed[0] || {}) : parsed;
            } catch(e) {
                log('DATA', 'JSON_PARSE_ERROR', e);
            }

            if (existingData && templateId === 'PROFILE_UPDATE') {
                await Storage.set({ profile_intelligence_backup: existingData });
                clean_json = this.mergeProfileData(existingData, clean_json);
            } else if (Array.isArray(clean_json)) {
                clean_json = clean_json[0] || {};
            }

            await Storage.set({ profile_intelligence: clean_json });
            State.set('profile_intelligence', clean_json);
            log('DATA', 'STATE_HYDRATED', { key: 'profile_intelligence', length: JSON.stringify(clean_json).length });
            await this.syncSubtitle();
            await this.hydrateAndRenderBody();
        } catch (e) {
            log('AI', `PROFILE_${templateId}_ERROR`, e);
        } finally {
            State.set('is_harvesting_profile', false);
            State.set('is_transmuting', false);
        }
    }

    // Resilient, multi-source payload retriever helper
    async fetchIntegrationList(key) {
        const isValidNonEmpty = (d) => d && ((Array.isArray(d) && d.length > 0) || (!Array.isArray(d) && typeof d === 'object' && Object.keys(d).length > 0));
        const singular = key.endsWith('s') ? key.slice(0, -1) : key;
        
        const keysToTry = [
            `feature_${key}`, `feature_${singular}`,
            `integrations_${key}`, key,
            `integrations_${singular}`, singular
        ];
        if (key === 'chars') keysToTry.push('feature_characters', 'characters', 'integrations_characters');

        for (const k of keysToTry) {
            let data = State.get(k);
            if (isValidNonEmpty(data)) {
                log('DATA', 'PROFILE_DROPDOWN_FETCH_STATE_SUCCESS', { key: k, source: 'State', type: Array.isArray(data) ? 'Array' : 'Object' });
                return data;
            }
        }

        for (const k of keysToTry) {
            let data = await Storage.get(k);
            if (isValidNonEmpty(data)) {
                log('DATA', 'PROFILE_DROPDOWN_FETCH_STORAGE_SUCCESS', { key: k, source: 'Storage', type: Array.isArray(data) ? 'Array' : 'Object' });
                return data;
            }
        }
        return [];
    }

    // Dynamic schema sanitizer to seamlessly map flat arrays and key-value dictionary maps
    sanitizeToArray(data) {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (typeof data === 'object') {
            return Object.entries(data).map(([key, val]) => {
                if (val && typeof val === 'object') {
                    return { id: val.id || key, ...val };
                }
                return { id: key, name: val };
            });
        }
        return [];
    }

    async refreshIntegrationsDropdown() {
        try {
            // Retrieve arrays through the resilient dual-source getter
            const rawChars = await this.fetchIntegrationList('chars');
            const rawArchs = await this.fetchIntegrationList('archetypes');
            const rawSchemes = await this.fetchIntegrationList('schemes');

            const chars = this.sanitizeToArray(rawChars);
            const archs = this.sanitizeToArray(rawArchs);
            const schemes = this.sanitizeToArray(rawSchemes);

            // Store references on instance for rapid reactive checks inside the change handler
            this.lastFetchedChars = chars;
            this.lastFetchedArchs = archs;
            this.lastFetchedSchemes = schemes;

            const activeCharsCount = chars.filter(c => c.isActive || c.active || c.enabled).length;
            const activeArchsCount = archs.filter(a => a.isActive || a.active || a.enabled).length;

            log('LOGIC', 'PROFILE_DROPDOWN_REFRESH_EVALUATION', { 
                activeCharsCount, 
                activeArchsCount, 
                rawCharsCount: chars.length,
                rawArchsCount: archs.length,
                allSchemesCount: schemes.length,
                rawCharsPayload: chars,
                rawArchsPayload: archs,
                rawSchemesPayload: schemes
            });

            if (this.integrationsDropdown) {
                // [V16] List ALL characters/archetypes (not only active). The isActive flag governs
                // Scheme/indicator behavior elsewhere; the integrations dropdown exposes the full
                // roster so any defined entity can be selected here.
                const chars_opts = chars.length > 0 ? chars.map(c => ({ option: c.name, id: c.id })) : [{ option: Language.text('INTEGRATIONS_EMPTY_GROUP') || "None available", id: "empty-chars", disabled: true }];
                const archs_opts = archs.length > 0 ? archs.map(a => ({ option: a.name, id: a.id })) : [{ option: Language.text('INTEGRATIONS_EMPTY_GROUP') || "None available", id: "empty-archs", disabled: true }];
                const schemes_opts = schemes.length > 0 ? schemes.map(s => ({ option: s.name, id: s.id })) : [{ option: Language.text('INTEGRATIONS_EMPTY_GROUP') || "None available", id: "empty-schemes", disabled: true }];

                const hasIndividuals = chars.length > 0 || archs.length > 0;
                const totalEntities = chars.length + archs.length + schemes.length;

                if (!hasIndividuals) {
                    if (typeof this.integrationsDropdown.setTriggerText === 'function') {
                        this.integrationsDropdown.setTriggerText(Language.text('INTEGRATIONS_NO_ACTIVE_INTEGRATIONS') || "<i>no active integrations</i>");
                    }
                }
                
                // Only fully disable if NOTHING exists
                if (totalEntities === 0) {
                    if (typeof this.integrationsDropdown.setDisabled === 'function') this.integrationsDropdown.setDisabled(true);
                } else {
                    if (typeof this.integrationsDropdown.setDisabled === 'function') this.integrationsDropdown.setDisabled(false);
                }

                // Prepare structure for Dropdown.js. Empty arrays represent standard non-populated blocks.
                const structure = [
                    {
                        option: "clear selections",
                        html: "<i>clear selections</i>",
                        id: "action_clear_selections"
                    },
                    {
                        option: Language.text('INTEGRATIONS_CHARS_LABEL') || "Characters",
                        id: "chars",
                        selection: "multiple",
                        options: chars_opts
                    },
                    {
                        option: Language.text('INTEGRATIONS_ARCHETYPES_LABEL') || "Archetypes",
                        id: "archetypes",
                        selection: "multiple",
                        options: archs_opts
                    },
                    {
                        option: Language.text('INTEGRATIONS_SCHEMES_LABEL') || "Schemes",
                        id: "schemes",
                        selection: "single",
                        options: schemes_opts
                    }
                ];

                this.integrationsDropdown.refreshStructure(structure);
                
                if (this.integrationsDropdown.menu) {
                    this.integrationsDropdown.menu.classList.add('profile-integrations-menu');
                }
                
                // State Recovery & Purging
                const savedSelections = await Storage.get('profile_selected_integrations') || [];
                const tempOnChange = this.integrationsDropdown.onChange;
                this.integrationsDropdown.onChange = null;
                this.integrationsDropdown.clearAllSelections();
                savedSelections.forEach(id => {
                    this.integrationsDropdown.selectById(id, true); // true = silent, avoids dispatch storm
                });
                this.integrationsDropdown.onChange = tempOnChange;

                if (typeof this.integrationsDropdown.onChange === 'function') {
                    this.integrationsDropdown.onChange();
                }
            }
        } catch (e) {
            log('DATA', 'INTEGRATIONS_DESERIALIZATION_FALLBACK', e.message || 'Storage Deserialization Failed');
        }
    }

    async flattenSelectedIntegrations(selectedNodes) {
        const rawChars = await this.fetchIntegrationList('chars');
        const rawArchs = await this.fetchIntegrationList('archetypes');
        
        const charsArray = this.sanitizeToArray(rawChars);
        const archsArray = this.sanitizeToArray(rawArchs);
        
        let charIds = new Set();
        let archIds = new Set();

        selectedNodes.forEach(node => {
            if (node.parentId === 'chars') {
                charIds.add(node.id);
            } else if (node.parentId === 'archetypes') {
                archIds.add(node.id);
            }
        });

        const resolvedChars = charsArray.filter(c => charIds.has(c.id));
        const resolvedArchs = archsArray.filter(a => archIds.has(a.id));
        
        log('DATA', 'INTEGRATIONS_FLATTENED_FOR_PROMPT', { char_names: resolvedChars.map(c=>c.name), archetype_names: resolvedArchs.map(a=>a.name) });

        return { chars: resolvedChars, archetypes: resolvedArchs };
    }

    mergeProfileData(P, U) {
        if (!P) return U;
        if (!U) return P;
        if (Array.isArray(U)) {
            if (U.length === 0) return P;
            U = U[0];
        }
        if (typeof U !== 'object' || U === null) return U;
        const result = JSON.parse(JSON.stringify(P));
        for (const [key, uVal] of Object.entries(U)) {
            if (!(key in result)) {
                result[key] = uVal;
                continue;
            }
            const pVal = result[key];
            if (Array.isArray(pVal) && Array.isArray(uVal)) {
                let mergedArr = [...pVal];
                for (const item of uVal) {
                    if (typeof item === 'object' && item !== null) {
                        const identifier = 'name' in item ? 'name' : ('id' in item ? 'id' : null);
                        if (identifier) {
                            const existingIdx = mergedArr.findIndex(x => x[identifier] === item[identifier]);
                            if (existingIdx !== -1) mergedArr[existingIdx] = this.mergeProfileData(mergedArr[existingIdx], item);
                            else mergedArr.push(item);
                        } else {
                            const exists = mergedArr.some(x => JSON.stringify(x) === JSON.stringify(item));
                            if (!exists) mergedArr.push(item);
                        }
                    } else if (!mergedArr.includes(item)) mergedArr.push(item);
                }
                result[key] = mergedArr;
            } else if (Array.isArray(pVal) && typeof uVal === 'object' && uVal !== null && Object.keys(uVal).length > 0 && Object.keys(uVal).every(k => !isNaN(parseInt(k, 10)))) {
                let mergedArr = [...pVal];
                for (const [idxStr, item] of Object.entries(uVal)) {
                    const idx = parseInt(idxStr, 10);
                    if (idx >= 0 && idx < mergedArr.length) mergedArr[idx] = this.mergeProfileData(mergedArr[idx], item);
                    else mergedArr.push(item);
                }
                result[key] = mergedArr;
            } else if (typeof pVal === 'object' && pVal !== null && typeof uVal === 'object' && uVal !== null) result[key] = this.mergeProfileData(pVal, uVal);
            else result[key] = uVal;
        }
        return result;
    }

    destroy() {
        this.expander.destroy();
        if (this._bundleSync) window.removeEventListener('INTEGRATIONS_DATA_CHANGED', this._bundleSync);
        this.unsubscribers.forEach(unsub => { if (typeof unsub === 'function') unsub(); });
        if (this.integrationsDropdown) this.integrationsDropdown.destroy();
        if (this.primeManifold && typeof this.primeManifold.destroy === 'function') {
            this.primeManifold.destroy();
        }
    }
}