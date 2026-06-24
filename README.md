# ΔLCHIMIST — AI Content Workstation

ΔLCHIMIST is an advanced, fully client-side browser extension that turns any active web page into a grounded authoring context — reading, parsing, and reflecting its content back through your chosen persona to generate purposeful output. Designed for professional creators, ghostwriters, researchers, and data operators, ΔLCHIMIST serves as a comprehensive authoring environment that avoids generic blank-box prompting by anchoring every generation cycle to real, live page content.

By bringing your own API keys (BYOK), the workspace operates completely within your browser's execution boundaries — no intermediary servers, no external data routing, no exposure beyond your own API endpoint.

---

## ⚗️ Core Architecture & Features

### 1. Context-Grounded Transmutation
* **Sovereign Scraper Core:** Recursively traverses the active document's DOM tree, automatically descending into Shadow Roots and iframes across all frames, to extract clean, structured text from the live page. Noise elements (scripts, styles, ads, analytics payloads) are filtered before the content is packaged into the generation prompt.
* **Ghost Selection Neutralization:** When text is selected across multiple frames, the scraper cross-checks each frame's selection against the master frame's full text. Any selection that cannot be verified against the master frame is neutralized before prompt assembly, preventing phantom or cross-origin context bleed.
* **Topological Simplification:** The raw DOM tree is linearized and bottom-up simplified into a compact, structured representation — collapsing redundant single-child nesting and purging invisible or zero-mass nodes — so the AI receives a clean, high-density content structure rather than raw HTML noise.

### 2. Cognitive Persona System & Persona Alchemy
* **Persistent Profiles:** Personas act as persistent cognitive matrices governing voice, reasoning syntax, structural patterns, and restricted vocabularies.
* **Contextual Learning:** With every generation cycle, the active persona extracts fresh insights, synthesizes related concepts, and prunes redundancies to evolve its internal knowledge framework.
* **Persona Alchemy Manifold:**
  * **Synthesize:** Extract a completely new cognitive profile from any provided source text.
  * **Mutate:** Transform a persona's core profile by injecting a distinct stylistic or conceptual influence.
  * **Crossbreed:** Combine two discrete personas into a hybrid child matrix that inherits linguistic traits from both parent vectors.

### 3. Multi-Stage Content Strategies
* **Comment:** Formulate highly targeted, contextually strategic interactions geared towards specific page arguments.
* **Repost:** Pull the core text of a post or article, apply quotes, and append a multi-layered analytical perspective.
* **Rewrite:** Process existing materials through your selected persona's exact stylistic signature.
* **Promotional Post:** Synthesize your own structured profile intelligence with domain themes to draft author-validated posts.
* **Long-Form Article (Two-Stage Pipeline):**
  * *Stage 1 (Material Preparation):* Gather resource fragments across multiple sessions while an embedded research companion advises on the next step.
  * *Stage 2 (Generation):* Compile gathered materials into a cohesive long-form essay structured around a chosen narrative model.

### 4. Output Modes & Controls
* **Single Output:** Focuses the generation on a single highly-optimized result.
* **Matrix Mode:** Generates three independent stylistic variants of the output simultaneously, each accompanied by three targeted refinement suggestions for further iteration.
* **Nexus Threads:** Creates a coherent sequence of three independent (or semi-dependent), multi-part serial blocks for long-form publishing.

### 5. Advanced Refinement & Protocols Suite
* **Dynamic Metrics Recalibration:** Each generation is scored across automatically assigned evaluation axes (e.g. Clarity, Specificity, Authority, Emotional Weight). Use the **up/down** controls on each metric to trigger targeted regenerations shifted along that axis. Supports *Metrics Alchemy* to synthesize, mutate, or crossbreed entirely custom evaluation criteria from page context.
* **Imperatives & Directives:**
  * *Imperatives:* Persistent, mandatory editorial constraints injected into every generation at high priority — useful for non-negotiable tone rules, forbidden topics, or format requirements that must always be respected regardless of strategy or persona.
  * *Directive Citadel:* A per-generation freeform instruction field with history. Unlike imperatives, directives are one-shot requests that shape a single generation without overriding persona intent unless explicitly asked.
* **Linguistic & Formatting Protocols:**
  * *Void Source Auditor:* Minimizes standard AI generation markers to maximize text naturalness.
  * *Cognitive Origin Auditor:* Scans language variance across seven forensic dimensions to estimate the probability that the input context is AI-generated.
  * *Twitter Short:* Forces character constraint for platform compliance.
  * *Thematic Tagging & Structural Enhancements:* Generates platform-optimized hashtag arrays and applies bold emphasis highlights.
  * *Custom Signatures:* Injects static personalized watermark strings seamlessly at the generation boundary.

### 6. Relational Intelligence & Social Scaling
* **Peer Targeting Matrix:** Harvest structured public data profiles from target individuals and attach custom interaction goals. Generation outputs adapt to who you are addressing and your stated objective.
* **Characters & Archetypes:** Inject specialized domain perspectives (historical figures, faceless experts) directly into your own profile or a target peer's profile to add focused reasoning depth to the generation context.
* **Professional Bundles:** Instantly swap between prepared operational frameworks carrying optimized matrices of personas, characters, and intentions.

### 7. Document Ingestion Engine
* **Multipurpose Ingestion:** Upload files directly into the generation layer (`.pdf`, `.docx`, `.html`, `.txt`, `.md`, `.json`). Uploaded documents are available as supplementary context that the AI mines alongside page content during generation.

---

## 🛠️ Infrastructure & Data Architecture

* **BYOK Key & Model Rotation:** Supports up to 5 concurrent API keys with automatic, real-time fallback routing. If a primary slot trips a `429 Quota Exhausted` limit, the model engine seamlessly rotates to the next available slot or safely downgrades across tiers without disrupting current execution states.
* **Workspace Treasury Snapshots:** Fully transactional backup utility. Allows users to export their entire operational environment (presets, articles, keys, personas, imperatives, attachments, custom metrics, peers, intents, characters, archetypes, and schemes) into an encrypted snapshot, with robust safety rules to merge or roll back states without clobbering existing structures.

---

## 🚀 Getting Started

### Prerequisites
ΔLCHIMIST runs directly on standard API keys provided by **Google AI Studio**.
1. Navigate to [Google AI Studio](https://aistudio.google.com).
2. Select **Get API Key** followed by **Create New Key**.

### Setup
1. Clone or extract this repository into your local path.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Toggle **Developer mode** on at the top right.
4. Click **Load unpacked** at the top left and select the folder path containing this extension.
5. Tap the ΔLCHIMIST action badge in your toolbar, click **Settings → API & Model**, and paste your AI Studio key.

### Chrome Web Store
ΔLCHIMIST is also available directly from the Chrome Web Store:
[Install ΔLCHIMIST](https://chromewebstore.google.com/detail/ikahiglhmlnbdfmpckfpnidokecdganl)

---

## 🔒 Privacy & Security Blueprint
* **Absolute Client-Side Execution:** ΔLCHIMIST has no middleman servers. All data live within Chrome's isolated local storage sandbox.
* **Sovereign Network Bridges:** Network queries route exclusively between your browser thread and the direct Gemini API endpoint using your self-provisioned credential.
