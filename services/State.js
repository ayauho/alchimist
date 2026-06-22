/**
 * @file services/State.js
 * @purpose Volatile State Registry (Sovereign) for transient UI postures.
 */
import { Storage } from './Storage.js';

export const State = {
    _data: {
        last_alchemy_result: null,
        is_managing_personas: false,
        active_tab: 'Forge',
        is_integrations_open: false,
        is_managing_chars: false,
        is_managing_archetypes: false,
        is_managing_schemes: false,
        pre_management_expander_state: null,
        persona_id: null,
        active_persona_id: null,
        personas_active_id: null,
        interactionType: 'rewrite',
        mode: 'single',
        imperatives: [],
        attachments: [],
        persona_active_tab: 'all',
        favorite_personas: [],
        ui_focus_target: null,
        personas: [],
        emoji_enhancement: false,
        kaomoji_enhancement: false,
        boldify_enhancement: false,
        detailed_suggestions: false,
        void_source_auditor: false,
        resonance_buffer: false,
        causal_anchor: false,
        entropy_shield: false,
        nexus_sync: false,
        image_prompt_addon: false,
        cognitive_origin_auditor: false,
        engagement_kinetics: false,
        social_alchemy: false,
        // [CWS] Compliance scaffolding (WP-1). Behavioral rename lands in WP-2/WP-3.
        // naturalness_pass falls back to legacy void_source_auditor until rewired.
        naturalness_pass: null,
        text_analysis_consent: false,
        granted_origins: [],
        // [V14] Metric Alchemy isolation — split from legacy single `last_alchemy_result`.
        // Legacy key retained above for backward-compat; NEW code MUST read/write the
        // kind-scoped key (last_persona_alchemy_result or last_metric_alchemy_result).
        last_persona_alchemy_result: null,
        last_metric_alchemy_result: null,
        // [V14] Forge Metrics — UI dominance + editor mutex + persisted list
        is_managing_metrics: false,
        is_metric_editor_active: false,
        metrics: [],
        // [V14] Metric Alchemy waiting overlay flags
        is_synthesizing_metric: false,
        is_mutating_metric: false,
        is_crossbreeding_metric: false,
        // [V15] Persona Categories — volatile assigning-mode registers + category registry mirror.
        // assigning_* are intentionally EXCLUDED from _configKeys (must never survive reload).
        // persona_categories mirror is committed explicitly by Categories.js (single writer).
        assigning_persona_category_mode: false,
        assigning_persona_category_id: null,
        persona_categories: []
    },
    _listeners: {},
    
    // [V13.S³] Configuration Keys that require persistent mirroring
    _configKeys: [
        'persona_id', 'active_persona_id', 'personas_active_id', 'personas', 'interactionType', 'mode', 'imperatives', 'attachments',
        'detailed_suggestions', 'void_source_auditor', 'resonance_buffer', 'causal_anchor',
        'entropy_shield', 'nexus_sync', 'image_prompt_addon', 'cognitive_origin_auditor',
        'engagement_kinetics', 'social_alchemy',
        // [CWS] WP-1 persistent consent + naturalness scaffolding
        'naturalness_pass', 'text_analysis_consent', 'granted_origins',
        'active_article_id',
        // [V14] Auto-persist custom metrics to Storage on every State.set('metrics', ...)
        'metrics'
    ],

    set(key, value) {
        // [V13.S³] Deep Equality Guard: Stop Log Storms at the gate
        const current = JSON.stringify(this._data[key]);
        const incoming = JSON.stringify(value);
        
        if (current === incoming) return;

        //console.trace(`Storage.set: key=${key} value=${value}`)

        this._data[key] = value;
        this.notify(key, value);

        // [V13.S³] Reactive Persistence: Config keys sync to Storage automatically
        if (this._configKeys.includes(key)) {
            this._persist(key, value);
        }
    },

    _persist(key, value) {
        if (this._persistTimer) clearTimeout(this._persistTimer);
        this._persistTimer = setTimeout(() => {
            Storage.set({ [key]: value });
        }, 150);
    },
    get(key) {
        return this._data[key];
    },
    // [CWS] WP-1 dual-read shim: new code reads naturalness_pass; legacy records
    // fall back to void_source_auditor so pre-flag persisted state survives hydration.
    resolveNaturalnessPass() {
        return this._data.naturalness_pass ?? this._data.void_source_auditor ?? false;
    },
    update(obj) {
        const changedKeys = [];
        // First pass: Write all data to ensure atomic availability for all listeners
        Object.keys(obj).forEach(key => { 
            if (this._data[key] !== obj[key]) {
                this._data[key] = obj[key]; 
                changedKeys.push(key);
            }
        });
        // Second pass: Notify listeners who may now read consistent multi-key updates
        changedKeys.forEach(key => this.notify(key, this._data[key]));
    },
    lock(id) {
        this.set('_ui_lock', id);
    },
    unlock() {
        this.set('_ui_lock', null);
    },
    resetVolatile() {
        this.update({
            selected_text: null,
            context_structure: null
        });
    },

    /**
     * Returns an atomic configuration snapshot for Presets or Prompt Compiling.
     */
    getSnapshot() {
        const truncate = (str, len = 35) => str ? str.substring(0, len) : '';
        
        const activePersonaId = this.get('personas_active_id') || this.get('active_persona_id') || this.get('persona_id');
        const personas = this.get('personas') || [];
        const activePersona = personas.find(p => p.id === activePersonaId);

        return {
            persona_id: activePersonaId,
            persona: activePersona ? { id: activePersona.id, short: truncate(activePersona.name) } : null,
            strategy: this.get('interactionType') || 'rewrite',
            mode: this.get('mode') || 'single',
            imperatives: (this.get('imperatives') || [])
                .filter(i => i.active || i.used)
                .map(i => ({ id: i.id, short: truncate(i.text || i.name) })),
            attachments: (this.get('attachments') || [])
                .filter(a => a.used)
                .map(a => ({ id: a.id, short: truncate(a.name) })),
            protocols: this._configKeys
                .filter(k => k.includes('_') && this.get(k) === true)
                .map(k => ({ id: k, short: k.replace(/_/g, ' ').substring(0, 10) }))
        };
    },

    subscribe(key, callback) {
        if (!this._listeners[key]) this._listeners[key] = [];
        this._listeners[key].push(callback);
        return () => {
            this._listeners[key] = this._listeners[key].filter(cb => cb !== callback);
        };
    },
    notify(key, value) {
        if (this._listeners[key]) {
            this._listeners[key].forEach(cb => cb(value));
        }
    }
};