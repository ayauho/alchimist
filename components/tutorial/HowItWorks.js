import { dom } from '../../utils/dom.js';
import { log } from '../../utils/logger.js';
import { Language } from '../../services/Language.js';
import { Expander } from '../reusable/Expander.js';

const DEFAULT_CODEX_DATA = [
    {
        id: 'core_engine',
        title: "1. Core Engine & Context Synthesis",
        aspects: [
            { icon: '🎯', label: 'Contextual Resonance & Attention Targeting', description: 'Allows the Alchimist to capture the active page state. By highlighting specific text blocks, you can project surgical attention focus points; otherwise, the full semantic context of the active tab is parsed into structured data blocks and AI decides where to focus on.' },
            { icon: '🌌', label: 'Dimensional Generation Modes', description: 'Choose how your generations manifest: a Single Stream response for rapid action, Tri-Variant Moods to generate three contrasting directional styles, or a Sequential Saga to chain three independent or weakly-dependent, continuous narrative segments.' },
            { icon: '⚔️', label: 'Tactical Execution Blueprints', description: 'Select your content strategy. Rewrite existing information, Comment on active discussions, Repost (quoting original authors with added cognitive framing), publish a Promotional Resonance piece, or assemble an authoritative Article based on compiled assets.' },
            { icon: '⚡', label: 'Operative Directives', description: 'Provides a dynamic text input channel to feed immediate, high-priority context-level modifications into the active transmutation cycle, allowing immediate course corrections.' }
        ]
    },
    {
        id: 'persona_alchemy',
        title: "2. Persona Alchemy & Cognitive Shaping",
        aspects: [
            { icon: '🎭', label: 'Cognitive Personas', description: 'Defines the core cognitive, stylistic, and vocabulary filters of the engine. Selecting an active persona changes the fundamental thinking patterns, tone, and rhetorical structure of the output, creating infinite expressive variation.' },
            { icon: '🧬', label: 'Persona Synthesis & Crossbreeding', description: 'Enables high-order persona generation. You can Synthesize a persona from pure description, Mutate an existing persona\'s parameters through context, or Crossbreed two separate psychological structures to create a hybrid cognitive profile.' },
            { icon: '🧠', label: 'Dynamic Memory Forging', description: 'Personas accrue experience from every interaction. With each transmutation, relevant knowledge domains are forged directly into their memory ledger, allowing your custom personas to evolve over time.' },
            { icon: '👁️', label: 'Sovereign Identity Profiles', description: 'Constructs an updatable, structured profile containing your personal background, goals, and communication parameters. Injecting this profile aligns generated responses to your authentic identity.' },
            { icon: '⚖️', label: 'Archetypal Projections & Judges', description: 'Evaluates personal or target profiles through the lens of legendary chars or domain-specific advisors, calculating advanced social compatibility and ideological scores.' }
        ]
    },
    {
        id: 'intent_engineering',
        title: "3. Intent Engineering & Peer Interactive Targeting",
        aspects: [
            { icon: '🎯', label: 'Target Profiling & Intent Mapping', description: 'Analyze peer profiles by building interactive dossiers. By reviewing a peer\'s public communication style and declaring an intent strategy, you can tailor the engine\'s outputs for relevant, resonant communication.' },
            { icon: '🔒', label: 'Subconscious Imperatives', description: 'Embeds unyielding instructions deep within the transmutation prompt structure, enforcing strict logical, formatting, or stylistic guardrails that the LLM cannot bypass.' },
            { icon: '⚙️', label: 'Aesthetic & Linguistic Protocols', description: 'Toggle custom systemic behaviors on demand: emulate a natural human style, humanize AI-assisted text, append trailing questions, incorporate emoji layers, highlight key structural phrases, or automate image-prompt generation.' }
        ]
    },
    {
        id: 'artifact_extraction',
        title: "4. Artifact Extraction & Staged Knowledge",
        aspects: [
            { icon: '🧳', label: 'Knowledge Baggage (Attachments)', description: 'Upload external assets (PDF, DOCX, HTML, TXT, MD) to the engine. They are instantly parsed, converted into clean Markdown streams, and bound to the active context layer as accessible knowledge bases.' },
            { icon: '📚', label: 'Staged Article Forging', description: 'Structures professional writing workflows into two sequential stages: (1) Amass and Refine, collecting materials during usual transmutations while taking dynamic suggestions, and (2) Fusing materials into structured professional article.' }
        ]
    },
    {
        id: 'post_transmutation',
        title: "5. Post-Transmutation Refinement & Iteration",
        aspects: [
            { icon: '🔧', label: 'Precision Refinement & Recalibration', description: 'Allows direct, real-time modification of completed transmutations. Tweak length constraints, apply iterative suggestions, or adjust numerical metric ranges to automatically guide the regeneration cycle.' },
            { icon: '📊', label: 'Output Estimation Metrics', description: 'Score and guide generations using customizable metrics. Apply alchemical actions—Synthesizing novel quality targets, Mutating thresholds, or Crossbreeding evaluation schemas—to guide automated self-correction loops.' },
            { icon: '👁️‍🗨️', label: 'Iterative Visual Alchemy', description: 'Analyzes the generated output text to extract core visual metaphors, formulating and iteratively refining descriptive image prompts derived directly from your transmutations.' }
        ]
    },
    {
        id: 'sovereign_architecture',
        title: "6. Sovereign Architecture & Configuration Ledger",
        aspects: [
            { icon: '💾', label: 'Operational Presets & Memory', description: 'Memorize complete configurations. Save combinations of personas, strategies, protocols, and active configs as presets to easily switch between daily routines and specialized content scenarios.' },
            { icon: '🔄', label: 'Automated API Key Rotation', description: 'Enables continuous operation by mapping multiple AI Studio keys. If a rate limit boundary is met, the system automatically rotates to the next key or shifts to a lighter model profile.' },
            { icon: '📦', label: 'Sovereign Ledger Backup & Restore', description: 'Export your entire operational environment—including custom personas, harvested profiles, metrics, and presets—into a single encrypted JSON file to restore your workspace on any device or rollback changes.' },
            { icon: '🔑', label: 'Sovereign Key Provisioning', description: 'Acquire high-performance, cost-free developer credentials. Navigate to Google AI Studio, construct a new api key, and input it into your Config settings.' }
        ]
    }
];

export class HowItWorks {
    constructor() {
        this.container = dom.create('div', 'flex flex-col flex-1 min-h-0 w-full relative', { id: 'how-it-works-container' });
        this.searchQuery = "";
        this.categories = DEFAULT_CODEX_DATA;
        this.expanders = {};
        this.aspectCards = [];
        this.searchTimeout = null;
    }

    init(codexData) {
        if (codexData && codexData.length > 0) this.categories = codexData;
    }

    render() {
        this.container.innerHTML = '';

        const scrollWrapper = dom.create('div', 'flex-1 overflow-y-auto p-4 space-y-4 min-h-0 w-full');
        this.container.appendChild(scrollWrapper);
        this.scrollWrapper = scrollWrapper;

        const headerEl = dom.create("div", "codex-header pb-4 border-b border-white/10");
        headerEl.innerHTML = `
            <h2 class="text-lg font-bold text-amber-500">${Language.text('CODEX_TITLE')}</h2>
            <p class="text-sm text-gray-400 mt-1">${Language.text('CODEX_SUBTITLE')}</p>
        `;
        scrollWrapper.appendChild(headerEl);

        const searchWrapper = dom.create("div", "search-wrapper my-4 relative");
        const searchInput = dom.create("input", "alchimist-input pl-8 w-full text-sm rounded transition-colors", {
            type: "text",
            placeholder: Language.text('CODEX_SEARCH_PLACEHOLDER'),
            "aria-label": Language.text('CODEX_SEARCH_PLACEHOLDER')
        });
        
        searchInput.addEventListener("input", (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => this.onSearchTriggered(e.target.value), 250);
        });
        
        searchWrapper.appendChild(searchInput);
        scrollWrapper.appendChild(searchWrapper);

        this.accordionContainer = dom.create("div", "accordion-list flex flex-col gap-3 mt-4");
        scrollWrapper.appendChild(this.accordionContainer);

        this.initializeExpanders();
        
        log('UI', 'CODEX', 'How It Works viewport rendered active.');
        return this.container;
    }

    initializeExpanders() {
        this.accordionContainer.innerHTML = '';
        this.expanders = {};
        this.aspectCards = [];

        for (const category of this.categories) {
            const exp = new Expander({
                id: `codex-exp-${category.id}`,
                title: category.title,
                isExpanded: false,
                groupId: 'codex-group',
                stretchTitle: true,
                onToggle: (isExpanded) => {
                    if (!isExpanded) return;
                    // [REQ-5] After the expand/collapse reflow settles, align this expander's
                    // header top border with the scroll container's top border (mirrors the
                    // settle-then-scroll discipline of Sanctuary.engageFocus).
                    setTimeout(() => {
                        const el = this.expanders[category.id] && this.expanders[category.id].element;
                        const sw = this.scrollWrapper;
                        if (!el || !sw) return;
                        const delta = el.getBoundingClientRect().top - sw.getBoundingClientRect().top;
                        sw.scrollTo({ top: sw.scrollTop + delta, behavior: 'smooth' });
                    }, 350);
                }
            });

            // Separate, styled content node passed into Expander's render parameters
            // This prevents closed padding leaks from appearing on the parent .expandable-body
            const contentNode = dom.create('div', 'p-3 flex flex-col gap-2 bg-black/20 border-t border-white/5');

            for (const aspect of category.aspects) {
                const card = dom.create("div", "aspect-item p-3 border-l-2 border-amber-500/50 bg-white/5 rounded-r hover:bg-white/10 transition-colors duration-200");
                card.innerHTML = `
                    <h4 class='text-xs font-bold text-amber-400 mb-1 flex items-center gap-2'>
                        <span>${aspect.icon || '✦'}</span> ${aspect.label}
                    </h4>
                    <p class='text-xs text-gray-400 leading-relaxed'>${aspect.description}</p>
                `;
                contentNode.appendChild(card);
                this.aspectCards.push({ cardEl: card, aspect, categoryId: category.id });
            }

            const expEl = exp.render(contentNode);
            this.expanders[category.id] = { instance: exp, element: expEl };
            this.accordionContainer.appendChild(expEl);
        }
    }

    onSearchTriggered(query) {
        this.searchQuery = query.toLowerCase().trim();
        
        const visibleCategories = new Set();

        for (const item of this.aspectCards) {
            const matches = this.searchQuery === "" || 
                            item.aspect.label.toLowerCase().includes(this.searchQuery) || 
                            item.aspect.description.toLowerCase().includes(this.searchQuery);
            
            if (matches) {
                item.cardEl.classList.remove('u-hidden');
                visibleCategories.add(item.categoryId);
            } else {
                item.cardEl.classList.add('u-hidden');
            }
        }

        let firstExpanded = false;

        for (const category of this.categories) {
            const catId = category.id;
            const expData = this.expanders[catId];
            if (!expData) continue;

            if (!visibleCategories.has(catId) && this.searchQuery !== "") {
                expData.element.classList.add('u-hidden');
            } else {
                expData.element.classList.remove('u-hidden');
                if (this.searchQuery !== "") {
                    if (!firstExpanded) {
                        if (!expData.instance.isExpanded) {
                            window.dispatchEvent(new CustomEvent('EXPANDER', { detail: { id: expData.instance.id, action: 'expand' } }));
                        }
                        firstExpanded = true;
                    } else {
                        if (expData.instance.isExpanded) {
                            window.dispatchEvent(new CustomEvent('EXPANDER', { detail: { id: expData.instance.id, action: 'collapse' } }));
                        }
                    }
                } else {
                    if (expData.instance.isExpanded) {
                        window.dispatchEvent(new CustomEvent('EXPANDER', { detail: { id: expData.instance.id, action: 'collapse' } }));
                    }
                }
            }
        }
        
        log('LOGIC', 'CODEX', `Search filtered: "${this.searchQuery}"`);
    }

    destroy() {
        for (const key in this.expanders) {
            if (this.expanders[key].instance && typeof this.expanders[key].instance.destroy === 'function') {
                this.expanders[key].instance.destroy();
            }
        }
    }
}