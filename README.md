# ΔLCHIMIST — AI Content Workstation

ΔLCHIMIST is an advanced, fully client-side browser extension that transforms web page layouts into structured intelligence. Designed for professional creators, ghostwriters, researchers, and knowledge operators, ΔLCHIMIST serves as a comprehensive authoring environment. It reads, parses, and grounds its generation loops inside the active browsing context, avoiding generic blank-box prompting.

By bringing your own API keys (BYOK), the workspace operates completely within your browser's execution boundaries, maintaining zero-server isolation and high data integrity.

---

## ⚗️ Core Architecture & Features

### 1. Context-Grounded Transmutation
* **Sensory Scraper Core:** Recursively parses active document bodies, automatically penetrating Shadow Roots, iframes, and deep semantic structures.
* **Ghost Selection Neutralization:** Intersects active clipboard or UI highlight states with the absolute frame coordinates to resolve and neutralize hallucinated elements.
* **Whitespace & Comma Lifting:** Flattens jagged metadata runs and tabular elements into compact, high-density structured fragments before prompt packaging.

### 2. Cognitive Persona System & Persona Alchemy
* **Persistent Profiles:** Personas act as persistent cognitive matrices governing voice, reasoning syntax, structural patterns, and restricted vocabularies.
* **Contextual Learning:** With every generation cycle, the active persona extracts fresh insights, synthesizes related concepts, and prunes redundancies to evolve its internal knowledge framework.
* **Persona Alchemy Manifold:** * **Synthesize:** Extract an completely new cognitive profile from any provided source text.
  * **Mutate:** Transform a persona's core profile by injecting a distinct stylistic or conceptual influence.
  * **Crossbreed:** Combine two discrete personas into a hybrid child matrix that inherits linguistic traits from both parent vectors.

### 3. Multi-Stage Content Strategies
* **Comment:** Formulate highly targeted, contextually strategic interactions geared towards specific page arguments.
* **Repost:** Pull the core text of a post or article, apply quotes, and append a multi-layered analytical perspective.
* **Rewrite:** Process existing materials through your selected persona's exact stylistic signature.
* **Promotional Post:** Synthesize your own structured profile intelligence with domain themes to draft author-validated posts.
* **Long-Form Article (Two-Stage Pipeline):** * *Stage 1 (Material Preparation):* Gather resource fragments across multiple sessions while an embedded research companion advises on logical gaps.
  * *Stage 2 (Generation):* Compile gathered materials into a cohesive long-form essay with consistent argumentative transitions and a structured schema layout.

### 4. Output Modes & Controls
* **Single Output:** Focuses the generation layout on a single highly-optimized output.
* **Matrix Mode:** Spits out three independent stylistic or emotional variants (mood registers) of the same context simultaneously, complete with interactive refinement chips.
* **Nexus Threads:** Creates a coherent sequence of three independent, multi-part serial blocks for long-form publishing.

### 5. Advanced Refinement & Protocols Suit
* **Dynamic Metrics Recalibration:** Assign specialized axes (Clarity, Specificity, Authority, Emotional Weight) to your output. Adjust sliders up or down to dynamically trigger real-time, vector-shifted regenerations. Supports *Metrics Alchemy* to synthesize entirely unique evaluation criteria.
* **Linguistic & Formatting Protocols:**
  * *Void Source Auditor:* Minimizes standard AI generation markers to maximize text naturalness.
  * *Cognitive Origin Auditor:* Scans language variance across seven forensic dimensions to display real-time stability scores.
  * *Twitter Short:* Forces strict character constraints for platform compliance.
  * *Thematic Tagging & Structural Enhancements:* Generates platform-optimized hashtag arrays and applies bold emphasis highlights.
  * *Custom Signatures:* Injects personalized watermark strings seamlessly at the generation boundary.

### 6. Relational Intelligence & Social Scaling
* **Peer Targeting Matrix:** Harvest structured public data profiles from target individuals and attach custom interaction goals. Generation outputs adapt symmetrically to who you are addressing and your objective.
* **Characters & Archetypes:** Overlay specialized domain perspectives (historical figures, faceless experts) onto your active persona stack to add dimensionality to reasoning loops.
* **Professional Bundles:** Instantly swap between prepared operational frameworks carrying optimized matrices of personas, characters, and intentions.

### 7. Document Ingestion Engine
* **Multipurpose Ingestion:** Upload files directly into the generation layer (`.pdf`, `.docx`, `.html`, `.txt`, `.md`, `.json`).
* **Decomposed Memory Layout:** Structural blocks are extracted via font-weight and Y-coordinate deltas, normalized into fenced markdown fragments, and archived via a memory mirror buffer to prevent pipeline bloat.

---

## 🛠️ Infrastructure & Data Architecture

* **BYOK Key & Model Rotation:** Supports up to 5 concurrent API keys with automatic, real-time fallback routing. If a primary slot trips a `429 Quota Exhausted` limit, the model engine seamlessly rotates to the next available slot or safely downgrades across tiers without disrupting current execution states.
* **Sharded Storage Architecture:** Moves away from heavy monolithic storage blocks. Personas, metrics, and profiles are written as atomic uncompressed shards linked by a monotonic master index, cutting LZMA latency out of daily mutation loops.
* **Universal Archival Gate:** Automatic real-time LZMA compression triggers on keys exceeding 1.5KB, maintaining browser runtime storage optimization.
* **Workspace Treasury Snapshots:** Fully transactional backup utility. Allows users to export their entire operational environment (presets, articles, keys, personas) into an encrypted snapshot, with robust safety rules to merge or roll back states without clobbering existing structures.

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
5. Tap the ΔLCHIMIST action badge in your toolbar, click **Settings -> API & Model**, and paste your AI Studio key.

---

## 🔒 Privacy & Security Blueprint
* **Absolute Client-Side Execution:** ΔLCHIMIST has no middleman servers. All profiles, files, presets, and keys live within Chrome's isolated local storage sandbox.
* **Sovereign Network Bridges:** Network queries route exclusively between your browser thread and the direct API endpoints of your selected model provider using your self-provisioned credential.