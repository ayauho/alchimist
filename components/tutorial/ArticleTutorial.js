import { log } from '../../utils/logger.js';
import { Language } from '../../services/Language.js';

/**
 * @file components/tutorial/ArticleTutorial.js
 * @purpose UI: On-demand "How article creation works" overlay. Opened from the
 *          Articles editor header (the bright "?" beside the title). Mirrors the
 *          WelcomeScreen aesthetic: black canvas, mono eyebrows, float-schema
 *          mini-window schematics, animated flow-lines, white-glow CTA.
 *
 *          Two parts:
 *            01 · Preparation — each Transmute implicitly gathers article materials.
 *            02 · Generation  — Strategy -> Long-form Article forges the piece.
 *          A single "Understood" button dismisses the overlay.
 *
 *          Unlike WelcomeScreen this is not a one-time, Storage-gated tutorial;
 *          it can be reopened any time, so forceShow() simply renders.
 */
export const ArticleTutorial = {
    forceShow() {
        this.render();
    },

    render() {
        const existing = document.getElementById('article-tutorial-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'article-tutorial-overlay';
        overlay.className = 'fixed inset-0 z-[99999] bg-black text-white flex flex-col px-5 py-6 transition-all duration-500 overflow-x-hidden overflow-y-auto select-none';

        overlay.innerHTML = `
          <style>
            @keyframes draw-flow { 0% { stroke-dashoffset: 24; } 100% { stroke-dashoffset: 0; } }
            .flow-line { stroke-dasharray: 6; animation: draw-flow 1.5s infinite linear; }
            @keyframes subtle-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
            .float-schema { animation: subtle-float 6s infinite ease-in-out; }

            @keyframes at-spark-travel {
              0%   { left: 6%;  opacity: 0; transform: scale(0.5); }
              12%  { opacity: 1; transform: scale(1); }
              88%  { opacity: 1; transform: scale(1); }
              100% { left: 92%; opacity: 0; transform: scale(0.5); }
            }
            .at-spark {
              position: absolute; top: 50%; width: 6px; height: 6px; margin-top: -3px;
              border-radius: 9999px; background: #fff;
              box-shadow: 0 0 8px 2px rgba(255,255,255,0.7);
              animation: at-spark-travel 2.4s linear infinite;
            }
            .at-spark--b { animation-delay: 1.2s; opacity: 0; top: 42%; }

            @keyframes at-glyph-fire {
              0%, 70%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(255,255,255,0)); }
              80% { transform: scale(1.18); filter: drop-shadow(0 0 6px rgba(255,255,255,0.55)); }
            }
            .at-glyph-fire { animation: at-glyph-fire 2.4s ease-in-out infinite; transform-origin: 50% 50%; }
            @keyframes at-spin-slow { 100% { transform: rotate(360deg); } }
            .at-glyph-rotate { animation: at-spin-slow 9s linear infinite; transform-origin: 50% 50%; transform-box: fill-box; }

            @keyframes at-material-drop {
              0%   { opacity: 0; transform: translateY(-7px) scaleX(0.55); }
              60%  { opacity: 1; }
              100% { opacity: 1; transform: translateY(0) scaleX(1); }
            }
            .at-material-bar { height: 4px; border-radius: 2px; background: #fff; transform-origin: left center; animation: at-material-drop 0.5s cubic-bezier(0.4,0,0.2,1) both; }

            @keyframes at-count-tick { 0% { transform: scale(1); } 40% { transform: scale(1.28); } 100% { transform: scale(1); } }
            .at-count-tick { animation: at-count-tick 0.45s ease-out; }
            @keyframes at-delta-pop { 0% { opacity: 0; transform: translateY(2px); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(-6px); } }
            .at-delta-pop { animation: at-delta-pop 1.4s ease-out forwards; }

            @keyframes at-line-grow { 0% { transform: scaleX(0); opacity: 0.2; } 100% { transform: scaleX(1); opacity: 1; } }
            .at-gen-line { transform-origin: left center; }
            .at-gen-line.is-on { animation: at-line-grow 0.45s cubic-bezier(0.4,0,0.2,1) both; }

            .at-strat-row { transition: opacity .3s ease; }
            .at-strat-row__radio { transition: background .3s ease, box-shadow .3s ease, border-color .3s ease; }
            .at-strat-row.is-selected .at-strat-row__radio { background: #fff; border-color: #fff; box-shadow: 0 0 8px rgba(255,255,255,0.6); }
            .at-strat-row.is-selected .at-strat-row__bar { background: #fff; opacity: 1; }
            .at-strat-row.is-dim { opacity: 0.32; }

            @media (prefers-reduced-motion: reduce) {
              .flow-line, .float-schema, .at-spark, .at-glyph-fire, .at-glyph-rotate { animation: none !important; }
            }
          </style>

          <div class="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full relative">

            <!-- screen heading -->
            <div class="flex items-center justify-between border-b border-[var(--border)] pb-2 mb-4">
              <span class="text-xs font-mono tracking-widest text-[var(--text-secondary)] uppercase">${Language.text('ART_TUT_TITLE')}</span>
              <span class="w-1.5 h-1.5 rounded-full bg-white anim-pulse"></span>
            </div>

            <div class="space-y-4">

              <!-- PART 1 — STAGE 01 · PREPARATION -->
              <section class="space-y-3">
                <div class="flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <span class="text-xs font-mono tracking-widest text-[var(--text-secondary)] uppercase">${Language.text('ART_TUT_STAGE1_EYEBROW')}</span>
                  <span class="text-[9px] font-mono tracking-widest text-[var(--text-secondary)] uppercase border border-[var(--border)] rounded px-1.5 py-0.5">${Language.text('ART_TUT_BG_TAG')}</span>
                </div>

                <div class="h-32 border border-[var(--border)] bg-[#060608] rounded-lg p-2 flex items-center justify-between relative overflow-hidden float-schema">
                  <!-- LEFT: the page thread being transmuted -->
                  <div class="w-[40%] h-full border border-[var(--border)] rounded flex flex-col bg-black overflow-hidden relative">
                    <div class="h-4 bg-[var(--bg-main)] border-b border-[var(--border)] flex items-center px-1.5 gap-1">
                      <div class="w-1 h-1 rounded-full bg-[var(--border)]"></div>
                      <div class="w-10 h-1.5 bg-[var(--bg-card)] rounded"></div>
                    </div>
                    <div class="p-2 flex-1 flex flex-col justify-center gap-1.5">
                      <div class="p-1.5 border border-white rounded bg-black space-y-1" style="box-shadow:0 0 10px rgba(255,255,255,0.15)">
                        <div class="flex items-center gap-1">
                          <div class="w-2 h-2 rounded-full bg-white"></div>
                          <div class="w-8 h-0.5 bg-white"></div>
                        </div>
                        <div class="w-full h-0.5 bg-white rounded-sm"></div>
                        <div class="w-2/3 h-0.5 bg-white rounded-sm"></div>
                      </div>
                      <div class="pl-2 space-y-1 opacity-30">
                        <div class="flex gap-1 items-center"><div class="w-1 h-1 rounded-full bg-white"></div><div class="w-8 h-px bg-white"></div></div>
                        <div class="flex gap-1 items-center"><div class="w-1 h-1 rounded-full bg-white"></div><div class="w-6 h-px bg-white"></div></div>
                      </div>
                    </div>
                    <div class="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-[var(--text-secondary)] uppercase tracking-wide">${Language.text('ART_TUT_LBL_THREAD')}</div>
                  </div>

                  <!-- CENTER: transmute glyph + implicit flow -->
                  <div class="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <svg class="w-full h-16" viewBox="0 0 200 64" fill="none">
                      <path d="M82 34C108 34 104 32 122 32" stroke="white" stroke-width="1.1" class="flow-line" />
                      <path d="M82 22C110 14 108 28 122 30" stroke="white" stroke-width="0.5" stroke-dasharray="2 4" class="opacity-40" />
                      <polygon points="123,32 118,29 118,35" fill="white" />
                    </svg>
                    <div class="absolute left-1/2 -translate-x-1/2 -top-0.5 at-glyph-fire">
                      <svg class="w-6 h-6 text-white" viewBox="0 0 64 64" fill="none" stroke="currentColor">
                        <circle cx="32" cy="32" r="26" stroke-width="2" class="at-glyph-rotate" stroke-dasharray="6 6" stroke-opacity="0.5" />
                        <polygon points="32,18 46,42 18,42" stroke-width="2.5" stroke-linejoin="round" />
                        <circle cx="32" cy="35" r="4" fill="currentColor" fill-opacity="0.15" stroke-width="1" />
                      </svg>
                    </div>
                    <span class="absolute left-1/2 -translate-x-1/2 top-9 text-[8px] font-mono uppercase tracking-widest text-[var(--text-secondary)]">${Language.text('ART_TUT_LBL_TRANSMUTE')}</span>
                  </div>
                  <span class="at-spark" style="z-index:5"></span>
                  <span class="at-spark at-spark--b" style="z-index:5"></span>

                  <!-- RIGHT: active article accumulating materials -->
                  <div class="w-[40%] h-full border border-[var(--border)] rounded flex flex-col bg-black overflow-hidden relative">
                    <div class="h-4 bg-[var(--bg-main)] border-b border-[var(--border)] flex items-center px-1.5 justify-between">
                      <div class="flex items-center gap-1">
                        <div class="w-1.5 h-1.5 border border-white rounded-sm"></div>
                        <div class="w-6 h-1.5 bg-[var(--bg-card)] rounded"></div>
                      </div>
                    </div>
                    <div class="px-2 pt-1.5 pb-1 flex-1 flex flex-col">
                      <div class="flex items-baseline justify-between">
                        <span class="text-[8px] font-mono text-[var(--text-secondary)] uppercase tracking-widest">${Language.text('ART_TUT_LBL_MATERIALS')}</span>
                        <span class="flex items-baseline gap-1">
                          <span id="at-mat-count" class="text-[11px] font-mono font-bold text-white leading-none">3</span>
                          <span id="at-mat-delta" class="text-[9px] font-mono font-bold" style="color:rgba(52,211,153,0.95)"></span>
                        </span>
                      </div>
                      <div id="at-mat-stack" class="mt-1.5 flex flex-col gap-1 justify-end flex-1 pb-3"></div>
                    </div>
                    <div class="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-[var(--text-secondary)] uppercase tracking-wide">${Language.text('ART_TUT_LBL_ARTICLE')}</div>
                  </div>
                </div>

                <div class="space-y-1">
                  <h3 class="text-xs font-mono font-bold uppercase tracking-wider text-white">${Language.text('ART_TUT_H1')}</h3>
                  <p class="text-[11px] text-[var(--text-primary)] leading-relaxed font-light">${Language.text('ART_TUT_D1')}</p>
                </div>
              </section>

              <!-- PART 2 — STAGE 02 · GENERATION -->
              <section class="space-y-3 pt-4 border-t border-[var(--border)]">
                <div class="flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <span class="text-xs font-mono tracking-widest text-[var(--text-secondary)] uppercase">${Language.text('ART_TUT_STAGE2_EYEBROW')}</span>
                  <span class="w-1.5 h-1.5 rounded-full bg-white anim-pulse"></span>
                </div>

                <div class="h-32 border border-[var(--border)] bg-[#060608] rounded-lg p-2 flex items-center justify-between relative overflow-hidden float-schema">
                  <!-- LEFT: Strategy selector, Long-form Article chosen -->
                  <div class="w-[40%] h-full border border-[var(--border)] rounded flex flex-col bg-black overflow-hidden relative">
                    <div class="h-4 bg-[var(--bg-main)] border-b border-[var(--border)] flex items-center px-1.5 gap-1">
                      <div class="w-1.5 h-1.5 border border-[var(--text-secondary)] rounded-sm"></div>
                      <div class="w-8 h-1.5 bg-[var(--bg-card)] rounded"></div>
                    </div>
                    <div class="p-2 flex-1 flex flex-col justify-center gap-1.5">
                      <div class="at-strat-row is-dim flex items-center gap-1.5">
                        <span class="at-strat-row__radio w-1.5 h-1.5 rounded-full border border-[var(--text-secondary)]"></span>
                        <span class="at-strat-row__bar w-9 h-0.5 bg-[var(--text-secondary)] rounded-sm opacity-60"></span>
                      </div>
                      <div id="at-strat-target" class="at-strat-row flex items-center gap-1.5">
                        <span class="at-strat-row__radio w-1.5 h-1.5 rounded-full border border-white"></span>
                        <span class="at-strat-row__bar w-12 h-0.5 bg-white rounded-sm opacity-80"></span>
                      </div>
                      <div class="at-strat-row is-dim flex items-center gap-1.5">
                        <span class="at-strat-row__radio w-1.5 h-1.5 rounded-full border border-[var(--text-secondary)]"></span>
                        <span class="at-strat-row__bar w-7 h-0.5 bg-[var(--text-secondary)] rounded-sm opacity-60"></span>
                      </div>
                      <div class="at-strat-row is-dim flex items-center gap-1.5">
                        <span class="at-strat-row__radio w-1.5 h-1.5 rounded-full border border-[var(--text-secondary)]"></span>
                        <span class="at-strat-row__bar w-10 h-0.5 bg-[var(--text-secondary)] rounded-sm opacity-60"></span>
                      </div>
                    </div>
                    <div class="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-[var(--text-secondary)] uppercase tracking-wide">${Language.text('ART_TUT_LBL_STRATEGY')}</div>
                  </div>

                  <!-- CENTER: materials stream feeding generation -->
                  <div class="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <svg class="w-full h-16" viewBox="0 0 200 64" fill="none">
                      <path d="M82 32C104 32 104 32 122 32" stroke="white" stroke-width="1.1" class="flow-line" />
                      <polygon points="123,32 118,29 118,35" fill="white" />
                    </svg>
                    <span class="absolute left-1/2 -translate-x-1/2 top-2 text-[8px] font-mono uppercase tracking-widest text-[var(--text-secondary)]">${Language.text('ART_TUT_LBL_FROM_MATERIALS')}</span>
                  </div>
                  <div id="at-gen-stream" class="absolute inset-0 pointer-events-none" style="z-index:5"></div>

                  <!-- RIGHT: forged long-form article -->
                  <div class="w-[40%] h-full border border-[var(--border)] rounded flex flex-col bg-black overflow-hidden relative">
                    <div class="h-4 bg-[var(--bg-main)] border-b border-[var(--border)] flex items-center px-1.5 justify-between">
                      <div class="flex items-center gap-1">
                        <div class="w-1.5 h-1.5 border border-white rounded-sm"></div>
                        <div class="w-6 h-1.5 bg-[var(--bg-card)] rounded"></div>
                      </div>
                    </div>
                    <div class="p-2 flex-1 flex flex-col justify-center gap-1.5" id="at-gen-doc">
                      <div class="at-gen-line w-3/4 h-1 bg-white rounded-sm"></div>
                      <div class="at-gen-line w-full h-0.5 bg-white rounded-sm opacity-80"></div>
                      <div class="at-gen-line w-full h-0.5 bg-white rounded-sm opacity-80"></div>
                      <div class="at-gen-line w-5/6 h-0.5 bg-white rounded-sm opacity-80"></div>
                      <div class="at-gen-line w-full h-0.5 bg-white rounded-sm opacity-80"></div>
                      <div class="at-gen-line w-2/3 h-0.5 bg-white rounded-sm opacity-80"></div>
                    </div>
                    <div class="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-[var(--text-secondary)] uppercase tracking-wide">${Language.text('ART_TUT_LBL_ARTICLE')}</div>
                  </div>
                </div>

                <div class="space-y-1">
                  <h3 class="text-xs font-mono font-bold uppercase tracking-wider text-white">${Language.text('ART_TUT_H2')}</h3>
                  <p class="text-[11px] text-[var(--text-primary)] leading-relaxed font-light">${Language.text('ART_TUT_D2')}</p>
                </div>
              </section>
            </div>

            <!-- ACTION ZONE -->
            <div class="pt-8 w-full">
              <button id="article-tutorial-understood" class="flex items-center justify-center w-full h-[48px] bg-white text-black hover:bg-zinc-200 font-mono font-bold uppercase tracking-widest text-sm rounded-lg transition-all duration-300 active:scale-[0.98] shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                ${Language.text('ART_TUT_BTN_UNDERSTOOD')}
              </button>
            </div>

          </div>
        `;

        document.body.appendChild(overlay);
        this._wire(overlay);
        log('UI', 'ARTICLE_TUTORIAL_RENDERED', {});
    },

    _wire(overlay) {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const timers = [];
        const intervals = [];
        const T = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
        const I = (fn, ms) => { const id = setInterval(fn, ms); intervals.push(id); return id; };

        // ---------- STAGE 1: implicit material gathering ----------
        const matCountEl = overlay.querySelector('#at-mat-count');
        const matDeltaEl = overlay.querySelector('#at-mat-delta');
        const matStack   = overlay.querySelector('#at-mat-stack');
        const MAT_WIDTHS = ['80%', '95%', '65%', '100%', '72%', '88%'];
        let matCount = 3;

        const addBar = (animate) => {
            const bar = document.createElement('div');
            bar.className = 'at-material-bar';
            bar.style.width = MAT_WIDTHS[Math.floor(Math.random() * MAT_WIDTHS.length)];
            if (!animate) bar.style.animation = 'none';
            matStack.appendChild(bar);
            const bars = matStack.querySelectorAll('.at-material-bar');
            if (bars.length > 4) {
                const oldest = bars[0];
                oldest.style.transition = 'opacity .4s ease, transform .4s ease';
                oldest.style.opacity = '0';
                oldest.style.transform = 'translateY(-6px)';
                T(() => oldest.remove(), 400);
            }
        };
        const gatherTick = () => {
            matCount += 1;
            matCountEl.textContent = matCount;
            matCountEl.classList.remove('at-count-tick'); void matCountEl.offsetWidth; matCountEl.classList.add('at-count-tick');
            matDeltaEl.textContent = '+1';
            matDeltaEl.classList.remove('at-delta-pop'); void matDeltaEl.offsetWidth; matDeltaEl.classList.add('at-delta-pop');
            addBar(true);
        };

        for (let i = 0; i < 3; i++) addBar(false);
        if (reduceMotion) {
            matCount = 7; matCountEl.textContent = matCount; addBar(false);
        } else {
            T(gatherTick, 1100);
            I(gatherTick, 2400);
        }

        // ---------- STAGE 2: choose Long-form -> generate ----------
        const stratTarget = overlay.querySelector('#at-strat-target');
        const genLines    = Array.from(overlay.querySelectorAll('#at-gen-doc .at-gen-line'));
        const streamHost  = overlay.querySelector('#at-gen-stream');

        const emitMaterial = (delay) => {
            T(() => {
                if (reduceMotion) return;
                const dot = document.createElement('span');
                dot.className = 'at-spark';
                dot.style.animation = 'at-spark-travel 1.1s linear forwards';
                streamHost.appendChild(dot);
                T(() => dot.remove(), 1150);
            }, delay);
        };
        const runGenerationCycle = () => {
            stratTarget.classList.remove('is-selected');
            genLines.forEach(l => { l.classList.remove('is-on'); l.style.visibility = 'hidden'; });
            if (reduceMotion) {
                stratTarget.classList.add('is-selected');
                genLines.forEach(l => { l.style.visibility = 'visible'; });
                return;
            }
            T(() => stratTarget.classList.add('is-selected'), 500);
            [1100, 1450, 1800, 2150].forEach(emitMaterial);
            genLines.forEach((line, i) => {
                T(() => { line.style.visibility = 'visible'; line.classList.add('is-on'); }, 1300 + i * 360);
            });
        };

        runGenerationCycle();
        if (!reduceMotion) I(runGenerationCycle, 6200);

        // ---------- dismiss ----------
        const dismiss = () => {
            intervals.forEach(clearInterval);
            timers.forEach(clearTimeout);
            overlay.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
            log('UI', 'ARTICLE_TUTORIAL', 'Dismissed by user');
            setTimeout(() => overlay.remove(), 500);
        };
        overlay.querySelector('#article-tutorial-understood').addEventListener('click', dismiss);
    }
};
