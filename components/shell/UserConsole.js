/**
 * @file components/shell/UserConsole.js
 * @purpose UI: Sovereign component for Status Bar + Telemetry Log Overlay with
 *          expandable artifact records (added/synthesized persona knowledge + article materials).
 */
import { dom } from '../../utils/dom.js';
import { Language } from '../../services/Language.js';
import { Logger } from '../../utils/logger.js';
import { log } from '../../utils/logger.js';

export class UserConsole {
    constructor() {
        this.isOpen = false;
        this.isSilenced = false;
        this._silenceTimer = null;

        // [ARTIFACTS] Pending artifacts captured from Footer.handleTransmute; correlated to the next emitted log by timestamp.
        this._pendingArtifacts = null;
        this._artifactsByTimestamp = new Map();

         // [V13] One-shot ticket consumed by renderHistory() on the next pass: when set to a record's
         // timestamp, that record's artifact body renders pre-expanded. toggleConsole() captures the
         // head record's timestamp at open time so the status bar's currently-displayed log migrates
         // into the panel already expanded — the user does not have to click twice.
         this._autoExpandTs = null;

        this.container = dom.create('div', 'user-console-wrapper w-full flex flex-col relative');
        this.panel = dom.create('div', 'user-console-panel hidden flex flex-col justify-end');
        this.statusBar = dom.create('div', 'status-bar-interactive flex items-center h-8 px-3 text-xs border-t border-zinc-800 bg-zinc-950/80 transition-colors', { style: 'height: 32px' });
        this.statusText = dom.create('span', 'status-text truncate w-full');

        this.statusBar.appendChild(this.statusText);
        this.container.appendChild(this.panel);
        this.container.appendChild(this.statusBar);

        this.statusBar.onclick = () => this.toggleConsole();

        this._handleLogEmitted = (e) => this.onLogEmitted(e.detail);
        this._handleArtifacts  = (e) => { this._pendingArtifacts = (e.detail && e.detail.payload) || null; };
        window.addEventListener('USER_LOG_EMITTED', this._handleLogEmitted);
        window.addEventListener('TRANSMUTATION_ARTIFACTS', this._handleArtifacts);
    }

    mount(slot) {
        slot.appendChild(this.container);
    }

    toggleConsole() {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
             // [V13] Status-Bar Migration: the currently displayed head record (e.g. "Transmutation success!")
             // must move into the panel — pre-expanded if it carries artifacts — and the status bar must
             // immediately show the Silence placeholder so the head is not duplicated. enterSilenceState()
             // flips isSilenced=true (which makes renderHistory() include history[0] instead of slicing it
             // out), paints "Silence 💤" on the bar, and renders the panel. The _autoExpandTs ticket is
             // consumed on that single renderHistory pass so later re-renders (new logs while the panel is
             // open) do not keep re-expanding this record against the user's will.
             const history = Logger.getUserHistory();
             const head = history && history[0];
             const headArtifacts = head && this._artifactsByTimestamp.get(head.timestamp);
             this._autoExpandTs = this._hasArtifacts(headArtifacts) ? head.timestamp : null;

             if (this._silenceTimer) { clearTimeout(this._silenceTimer); this._silenceTimer = null; }
             this.panel.classList.remove('hidden');
             this.enterSilenceState();

             this._autoExpandTs = null;
        } else {
            this.panel.classList.add('hidden');
        }
    }

    _hasArtifacts(payload) {
        if (!payload) return false;
        const p = payload.persona, a = payload.article, t = payload.treasury;
        return !!(
            (p && ((p.added && p.added.length) || (p.synthesized && p.synthesized.length))) ||
            (a && ((a.added && a.added.length) || (a.synthesized && a.synthesized.length))) ||
            (t && ((t.added && t.added.length) || (t.failed && t.failed.length)))
        );
    }

    _buildArtifactGroup(titleText, items, valueKey) {
        if (!items || items.length === 0) return null;
        const group = dom.create('div', 'artifact-group flex flex-col gap-1 pl-2');
        group.appendChild(dom.create('div', 'artifact-group__title text-[10px] font-bold uppercase tracking-wider opacity-70', { innerText: titleText }));
        items.forEach(it => {
            const valueRaw = (it && typeof it === 'object') ? (it[valueKey] || it.element || it.content || '') : String(it || '');
            const li = dom.create('div', 'artifact-group__item text-[10px] pl-2 opacity-90 break-words', { innerText: '• ' + String(valueRaw) });
            group.appendChild(li);
        });
        return group;
    }

    _renderArtifacts(payload) {
        const wrap = dom.create('div', 'user-console-record__artifacts flex flex-col gap-2 mt-2');
        if (payload && payload.persona) {
            const g1 = this._buildArtifactGroup(Language.text('LABEL_ARTIFACTS_PERSONA_ADDED'),       payload.persona.added,       'element');
            const g2 = this._buildArtifactGroup(Language.text('LABEL_ARTIFACTS_PERSONA_SYNTHESIZED'), payload.persona.synthesized, 'element');
            if (g1) wrap.appendChild(g1);
            if (g2) wrap.appendChild(g2);
        }
        if (payload && payload.article) {
            const g3 = this._buildArtifactGroup(Language.text('LABEL_ARTIFACTS_ARTICLE_ADDED'),       payload.article.added,       'content');
            const g4 = this._buildArtifactGroup(Language.text('LABEL_ARTIFACTS_ARTICLE_SYNTHESIZED'), payload.article.synthesized, 'content');
            if (g3) wrap.appendChild(g3);
            if (g4) wrap.appendChild(g4);
        }
        if (payload && payload.treasury) {
            const g5 = this._buildArtifactGroup(Language.text('LABEL_ARTIFACTS_TREASURY_ADDED'),  payload.treasury.added,  'label');
            const g6 = this._buildArtifactGroup(Language.text('LABEL_ARTIFACTS_TREASURY_FAILED'), payload.treasury.failed, 'label');
            if (g5) wrap.appendChild(g5);
            if (g6) wrap.appendChild(g6);
        }
        return wrap;
    }

    renderHistory() {
        this.panel.innerHTML = '';
        const history = Logger.getUserHistory();
        const pastHistory = this.isSilenced ? history : history.slice(1);

        if (pastHistory.length === 0) {
            const row = dom.create('div', 'user-console-record text-zinc-600 italic');
            row.textContent = 'No telemetry recorded yet.';
            this.panel.appendChild(row);
        }

        const orderedHistory = [...pastHistory].reverse();
        orderedHistory.forEach(record => {
            const text = Language.text(record.token_id) || record.token_id;
            const colorClass = `log-${record.status}`;
            const artifacts = this._artifactsByTimestamp.get(record.timestamp);
            const hasArt = this._hasArtifacts(artifacts);

            if (hasArt) {
                const row = dom.create('div', `user-console-record user-console-record--expandable ${colorClass}`);
                const header = dom.create('div', 'user-console-record__header cursor-pointer flex items-center justify-between gap-2');
                const labelEl = dom.create('span', 'flex-1', { innerText: `[${record.timestamp}] ${text}` });
                 const shouldAutoExpand = !!this._autoExpandTs && record.timestamp === this._autoExpandTs;
                 const chevEl  = dom.create('span', 'user-console-record__chevron shrink-0', { innerText: shouldAutoExpand ? '⯅' : '⯆' });
                header.appendChild(labelEl);
                header.appendChild(chevEl);
                 const body = dom.create('div', `user-console-record__body${shouldAutoExpand ? '' : ' hidden'}`);
                body.appendChild(this._renderArtifacts(artifacts));
                header.onclick = () => {
                    body.classList.toggle('hidden');
                    const isOpen = !body.classList.contains('hidden');
                    chevEl.innerText = isOpen ? '⯅' : '⯆';
                    log('UI', 'USER_CONSOLE_ARTIFACTS_TOGGLED', { ts: record.timestamp, open: isOpen });
                };
                row.appendChild(header);
                row.appendChild(body);
                this.panel.appendChild(row);
            } else {
                const row = dom.create('div', `user-console-record ${colorClass}`);
                row.textContent = `[${record.timestamp}] ${text}`;
                this.panel.appendChild(row);
            }
        });

        setTimeout(() => this.panel.scrollTop = this.panel.scrollHeight, 10);
    }

    onLogEmitted(record) {
        const text = Language.text(record.token_id) || record.token_id;

        // [ARTIFACTS] If artifacts were dispatched just before this log, correlate by timestamp.
        if (this._pendingArtifacts && this._hasArtifacts(this._pendingArtifacts)) {
            this._artifactsByTimestamp.set(record.timestamp, this._pendingArtifacts);
        }
        const recordArtifacts = this._artifactsByTimestamp.get(record.timestamp);
        const hasArt = this._hasArtifacts(recordArtifacts);
        this._pendingArtifacts = null;

         // [V13] While the console panel is open: new telemetry lands directly in the panel and the
         // status bar stays Silenced (it was set by toggleConsole). Suppress the bar paint and the
         // 60-second silence countdown entirely — Silence is enforced for as long as the panel is open.
         if (this.isOpen) {
             this.renderHistory();
             return;
         }

        if (this._silenceTimer) clearTimeout(this._silenceTimer);
        this.isSilenced = false;

        this.statusText.className = 'status-text truncate w-full';
        void this.statusText.offsetWidth;

        this.statusText.className = `status-text truncate w-full log-${record.status} transition-opacity duration-300`;
        this.statusText.style.opacity = '1';
        this.statusText.textContent = hasArt ? `${text} ⯆` : text;

        if (record.effect) this.statusText.classList.add(record.effect);

        this._silenceTimer = setTimeout(() => this.enterSilenceState(), 60000);
    }

    enterSilenceState() {
        this.isSilenced = true;
        this.statusText.className = 'status-text truncate w-full text-zinc-500 italic transition-opacity duration-300';
        this.statusText.style.opacity = '1';
        this.statusText.textContent = Language.text('LOG_SILENCE') || 'Silence 💤';
        if (this.isOpen) this.renderHistory();
    }

    destroy() {
        if (this._silenceTimer) clearTimeout(this._silenceTimer);
        window.removeEventListener('USER_LOG_EMITTED', this._handleLogEmitted);
        window.removeEventListener('TRANSMUTATION_ARTIFACTS', this._handleArtifacts);
        this.container.remove();
    }
}