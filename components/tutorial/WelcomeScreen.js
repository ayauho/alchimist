import { Storage } from '../../services/Storage.js';
import { log } from '../../utils/logger.js';
import { Language } from '../../services/Language.js';

export const WelcomeScreen = {
    async init() {
        const shown = await Storage.get('welcome_screen_shown');
        if (shown) return;

        this.render();
    },

    render() {
        const existing = document.getElementById('welcome-screen-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'welcome-screen-overlay';
        // Enforce overlay on top with solid black background and white typography
        overlay.className = 'fixed inset-0 z-[9999] bg-black text-white flex flex-col px-5 py-6 transition-all duration-500 overflow-x-hidden overflow-y-auto select-none';

        overlay.innerHTML = `
          <style>
            @keyframes draw-flow {
              0% { stroke-dashoffset: 24; }
              100% { stroke-dashoffset: 0; }
            }
            .flow-line {
              stroke-dasharray: 6;
              animation: draw-flow 1.5s infinite linear;
            }
            @keyframes subtle-float {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-4px); }
            }
            .float-schema {
              animation: subtle-float 6s infinite ease-in-out;
            }
          </style>

          <div class="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full relative">
            
            <!-- UNIFIED CONTENT ZONE -->
            <div class="relative w-full h-[520px]">
              
              <!-- STEP 1 CONTENT -->
              <div id="ws-step-1" class="absolute inset-0 w-full flex flex-col justify-start transition-all duration-500 space-y-4">
                <!-- PART 1: TOP SECTION -->
                <div class="space-y-3">
                  <div class="flex items-center justify-between border-b border-[var(--border)] pb-2">
                    <span class="text-xs font-mono tracking-widest text-[var(--text-secondary)] uppercase">${Language.text('TUTORIAL_SYS_INTEL')}</span>
                    <span class="w-1.5 h-1.5 rounded-full bg-white anim-pulse"></span>
                  </div>

                  <div class="h-24 border border-[var(--border)] bg-[#060608] rounded-lg p-2 flex items-center justify-between relative overflow-hidden float-schema">
                    <!-- Schematic: Left (Tab) -->
                    <div class="w-[45%] h-full border border-[var(--border)] rounded flex flex-col bg-black overflow-hidden relative">
                      <div class="h-4 bg-[var(--bg-main)] border-b border-[var(--border)] flex items-center px-1.5 gap-1">
                        <div class="w-1 h-1 rounded-full bg-[var(--border)]"></div>
                        <div class="w-10 h-1.5 bg-[var(--bg-card)] rounded"></div>
                      </div>
                      <div class="p-2 flex-1 flex flex-col justify-center gap-1.5">
                        <div class="p-1.5 border border-white rounded bg-black space-y-1" style="box-shadow: 0 0 10px rgba(255,255,255,0.15)">
                          <div class="flex items-center gap-1">
                            <div class="w-2 h-2 rounded-full bg-white"></div>
                            <div class="w-8 h-0.5 bg-white"></div>
                          </div>
                          <div class="w-full h-0.5 bg-white rounded-sm"></div>
                          <div class="w-2/3 h-0.5 bg-white rounded-sm"></div>
                        </div>
                        <div class="pl-2 space-y-1 opacity-30">
                          <div class="flex gap-1 items-center">
                            <div class="w-1 h-1 rounded-full bg-white"></div>
                            <div class="w-8 h-px bg-white"></div>
                          </div>
                        </div>
                      </div>
                      <div class="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-[var(--text-secondary)] uppercase tracking-wide">TAB</div>
                    </div>

                    <!-- Flow Connection -->
                    <div class="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <svg class="w-full h-12" viewBox="0 0 200 48" fill="none">
                        <path d="M78 24C110 24 100 24 134 24" stroke="white" stroke-width="1" class="flow-line" />
                        <polygon points="135,24 130,21 130,27" fill="white" />
                      </svg>
                    </div>

                    <!-- Schematic: Right (Panel) -->
                    <div class="w-[45%] h-full border border-[var(--border)] rounded flex flex-col bg-black overflow-hidden relative">
                      <div class="h-4 bg-[var(--bg-main)] border-b border-[var(--border)] flex items-center px-1.5 justify-between">
                        <div class="flex items-center gap-1">
                          <div class="w-1.5 h-1.5 border border-white rounded-sm"></div>
                          <div class="w-6 h-1.5 bg-[var(--bg-card)] rounded"></div>
                        </div>
                      </div>
                      <div class="p-2 flex-1 flex flex-col justify-center space-y-1">
                        <span class="text-[9px] font-mono text-[var(--text-secondary)] block tracking-widest uppercase">FORGE</span>
                        <div class="p-1 border border-dashed border-[var(--text-secondary)] rounded space-y-1">
                          <div class="w-full h-0.5 bg-white rounded-sm"></div>
                          <div class="w-5/6 h-0.5 bg-white rounded-sm"></div>
                        </div>
                      </div>
                      <div class="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-[var(--text-secondary)] uppercase tracking-wide">PANEL</div>
                    </div>
                  </div>

                  <div class="space-y-1">
                    <h3 class="text-xs font-mono font-bold uppercase tracking-wider text-white">${Language.text('TUTORIAL_H1')}</h3>
                    <p class="text-[11px] text-[var(--text-primary)] leading-relaxed font-light">
                      ${Language.text('TUTORIAL_D1')}
                    </p>
                  </div>
                </div>

                <!-- PART 2: MIDDLE SECTION -->
                <div class="space-y-3 pt-4 border-t border-[var(--border)]">
                  <div class="flex items-center justify-between border-b border-[var(--border)] pb-2">
                    <span class="text-xs font-mono tracking-widest text-[var(--text-secondary)] uppercase">${Language.text('TUTORIAL_CTX_RET')}</span>
                    <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
                  </div>

                  <div class="h-24 border border-[var(--border)] bg-[#060608] rounded-lg p-2 flex items-center justify-between relative overflow-hidden float-schema">
                    <!-- Schematic: Left (Tab with selection) -->
                    <div class="w-[45%] h-full border border-[var(--border)] rounded flex flex-col bg-black overflow-hidden relative">
                      <div class="h-4 bg-[var(--bg-main)] border-b border-[var(--border)] flex items-center px-1.5 gap-1">
                        <div class="w-1 h-1 rounded-full bg-[var(--border)]"></div>
                        <div class="w-10 h-1.5 bg-[var(--bg-card)] rounded"></div>
                      </div>
                      <div class="p-2 flex-1 flex flex-col justify-center gap-1.5">
                        <div class="p-1 border border-[var(--border)] rounded bg-black space-y-0.5 opacity-20">
                          <div class="w-full h-0.5 bg-white rounded-sm"></div>
                          <div class="w-2/3 h-0.5 bg-white rounded-sm"></div>
                        </div>
                        <div class="pl-2 space-y-1">
                          <div class="p-1 border border-white rounded bg-black relative" style="box-shadow: 0 0 10px rgba(255,255,255,0.15)">
                            <div class="absolute -top-0.5 -left-0.5 w-1 h-1 bg-white rounded-full"></div>
                            <div class="absolute -bottom-0.5 -right-0.5 w-1 h-1 bg-white rounded-full"></div>
                            <div class="flex gap-1 items-center mb-0.5">
                              <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
                              <div class="w-8 h-0.5 bg-white"></div>
                            </div>
                            <div class="w-full h-0.5 bg-white"></div>
                          </div>
                        </div>
                      </div>
                      <div class="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-[var(--text-secondary)] uppercase tracking-wide">TAB</div>
                    </div>

                    <!-- Flow Connection Dual Weight -->
                    <div class="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <svg class="w-full h-12" viewBox="0 0 200 48" fill="none">
                        <path d="M78 32C105 32 105 24 134 24" stroke="white" stroke-width="1.2" class="flow-line" />
                        <path d="M78 12C110 5 110 20 134 22" stroke="white" stroke-width="0.5" stroke-dasharray="2 4" class="opacity-45" />
                        <polygon points="135,24 130,21 130,27" fill="white" />
                      </svg>
                    </div>

                    <!-- Schematic: Right (Panel locked focus) -->
                    <div class="w-[45%] h-full border border-[var(--border)] rounded flex flex-col bg-black overflow-hidden relative">
                      <div class="h-4 bg-[var(--bg-main)] border-b border-[var(--border)] flex items-center px-1.5 justify-between">
                        <div class="flex items-center gap-1">
                          <div class="w-1.5 h-1.5 border border-white rounded-sm"></div>
                          <div class="w-6 h-1.5 bg-[var(--bg-card)] rounded"></div>
                        </div>
                      </div>
                      <div class="p-2 flex-1 flex flex-col justify-center space-y-1">
                        <span class="text-[9px] font-mono text-[var(--text-secondary)] block tracking-widest uppercase">LOCK</span>
                        <div class="p-1 border border-white rounded space-y-1" style="box-shadow: 0 0 10px rgba(255,255,255,0.15)">
                          <div class="w-full h-0.5 bg-white rounded-sm"></div>
                          <div class="w-4/5 h-0.5 bg-white rounded-sm"></div>
                        </div>
                        <div class="flex gap-1 justify-center mt-1">
                          <span class="w-1 h-1 bg-[var(--border)] rounded-full"></span>
                          <span class="w-1 h-1 bg-[var(--border)] rounded-full"></span>
                          <span class="w-1 h-1 bg-[var(--border)] rounded-full"></span>
                        </div>
                      </div>
                      <div class="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-[var(--text-secondary)] uppercase tracking-wide">PANEL</div>
                    </div>
                  </div>

                  <div class="space-y-1">
                    <h3 class="text-xs font-mono font-bold uppercase tracking-wider text-white">${Language.text('TUTORIAL_H2')}</h3>
                    <p class="text-[11px] text-[var(--text-primary)] leading-relaxed font-light">
                      ${Language.text('TUTORIAL_D2')}
                    </p>
                  </div>
                </div>
              </div>

              <!-- STEP 2 CONTENT -->
              <div id="ws-step-2" class="absolute inset-0 flex flex-col justify-center opacity-0 pointer-events-none transition-all duration-500 translate-x-10">
                <div class="flex items-center justify-between border-b border-[var(--border)] pb-2 mb-4">
                  <span class="text-xs font-mono tracking-widest text-[var(--text-secondary)] uppercase">${Language.text('TUTORIAL_API_TITLE')}</span>
                  <span class="w-1.5 h-1.5 rounded-full bg-white anim-pulse"></span>
                </div>

                <div class="flex flex-col items-center gap-5 py-4 w-full px-2">
                    <a href="${Language.text('TUTORIAL_API_LINK')}" target="_blank" class="w-full group">
                        <div class="p-4 border border-[var(--border)] rounded-lg bg-[#060608] hover:border-white transition-colors flex flex-col items-center gap-2 relative overflow-hidden">
                            <div class="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <span class="text-white font-mono text-[11px] sm:text-xs tracking-wider group-hover:underline break-all">${Language.text('TUTORIAL_API_LINK')}</span>
                        </div>
                    </a>

                    <svg class="w-5 h-5 text-[var(--text-secondary)] anim-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>

                    <div class="w-full p-4 border border-[var(--border)] rounded-lg bg-[#060608] flex flex-col items-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="7.5" cy="15.5" r="5.5"></circle>
                          <path d="m21 2-9.6 9.6"></path>
                          <path d="m15.5 7.5 3 3L22 7l-3-3"></path>
                        </svg>
                        <span class="font-mono text-sm text-white uppercase tracking-wider">${Language.text('TUTORIAL_API_STEP1')}</span>
                    </div>

                    <svg class="w-5 h-5 text-[var(--text-secondary)] anim-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>

                    <div class="w-full p-4 border border-[var(--border)] rounded-lg bg-[#060608] flex flex-col items-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" />
                        </svg>
                        <span class="font-mono text-sm text-white uppercase tracking-wider">${Language.text('TUTORIAL_API_STEP2')}</span>
                        <span class="text-[10px] text-[var(--text-secondary)] font-mono text-center">${Language.text('TUTORIAL_API_NOTE')}</span>
                    </div>
                </div>
              </div>

            </div>

            <!-- UNIFIED ACTION ZONE -->
            <div class="pt-8 w-full relative h-[80px] mt-4">
                <button id="welcome-next-btn" class="absolute top-0 left-0 flex items-center justify-center w-full h-[48px] bg-white text-black hover:bg-zinc-200 font-mono font-bold uppercase tracking-widest text-sm rounded-lg transition-all duration-500 active:scale-[0.98] shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                    ${Language.text('TUTORIAL_BTN_NEXT')}
                </button>
                <button id="welcome-init-btn" class="absolute top-0 left-0 flex items-center justify-center w-full h-[48px] bg-white text-black hover:bg-zinc-200 font-mono font-bold uppercase tracking-widest text-sm rounded-lg transition-all duration-500 active:scale-[0.98] shadow-[0_0_20px_rgba(255,255,255,0.2)] opacity-0 pointer-events-none">
                    ${Language.text('TUTORIAL_BTN_INIT')}
                </button>
                <button id="welcome-skip-btn" class="absolute bottom-0 left-1/2 -translate-x-1/2 text-[var(--text-secondary)] hover:text-white underline text-[10px] font-mono uppercase tracking-wider transition-all duration-300">
                    ${Language.text('TUTORIAL_BTN_SKIP')}
                </button>
            </div>

          </div>
        `;

        document.body.appendChild(overlay);

        const dismiss = async () => {
            overlay.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
            await Storage.set({ welcome_screen_shown: true });
            log('UI', 'WELCOME_SCREEN', 'Dismissed by user');
            setTimeout(() => overlay.remove(), 500);
        };

        overlay.querySelector('#welcome-next-btn').addEventListener('click', () => {
            const step1 = overlay.querySelector('#ws-step-1');
            const step2 = overlay.querySelector('#ws-step-2');
            const nextBtn = overlay.querySelector('#welcome-next-btn');
            const initBtn = overlay.querySelector('#welcome-init-btn');
            const skipBtn = overlay.querySelector('#welcome-skip-btn');
            
            step1.classList.add('opacity-0', '-translate-x-10', 'pointer-events-none');
            step2.classList.remove('opacity-0', 'translate-x-10', 'pointer-events-none');
            
            nextBtn.classList.add('opacity-0', 'pointer-events-none');
            initBtn.classList.remove('opacity-0', 'pointer-events-none');
            skipBtn.classList.add('opacity-0', 'pointer-events-none');
        });

        overlay.querySelector('#welcome-skip-btn').addEventListener('click', dismiss);
        overlay.querySelector('#welcome-init-btn').addEventListener('click', dismiss);
    },

    forceShow() {
        this.render();
    }
};