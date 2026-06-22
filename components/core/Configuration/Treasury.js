/**
 * @file components/core/Configuration/Treasury.js
 * @purpose UI: Config → Treasury expander. Save / Upload user-data snapshots.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MIGRATION REMINDER (for future implementation passes):
 *
 * If the app version changes and ANY snapshot field is renamed:
 *   1. Add an entry to TreasuryService._RENAME_MAP mapping (old_key → new_key)
 *      so the alias is silently applied during validate().
 *   2. If a deprecated field has NO new equivalent, the migration step in
 *      _applyRenameMap MUST silently skip it (never throw).
 *   3. The hash check runs POST-migration so a legacy snapshot with applied
 *      renames stays integrity-verified.
 *
 * Contract: EVEN THE OLDEST treasury.json MUST be recoverable.
 * The whole save/upload operation must remain transactional regardless of
 * missing or renamed fields.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { dom } from '../../../utils/dom.js';
import { Expander } from '../../reusable/Expander.js';
import { Switcher } from '../../reusable/Switcher.js';
import { Confirmation } from '../../reusable/Confirmation.js';
import { Language } from '../../../services/Language.js';
import { State } from '../../../services/State.js';
import { License } from '../../../services/License.js';
import { TreasuryService } from '../../../services/TreasuryService.js';
import { log } from '../../../utils/logger.js';

export class Treasury {
    constructor() {
        this.stagedEnvelope = null;
        this.stagedFilename = null;
        this.fullReplace = false;
        this._statusHandler = (rec) => this._paintStatus(rec);
        this.statusUnsub = State.subscribe('_treasury_last_status', this._statusHandler);
        this._onLicenseChange = () => this._reconcilePremiumCover();
        window.addEventListener('LICENSE_STATUS_CHANGED', this._onLicenseChange);
    }

    render() {
        this.expander = new Expander({
            id: 'exp-treasury',
            title: Language.text('CAT_TREASURY'),
            isExpanded: false
        });

        const body = dom.create('div', 'config-section');

        this.statusEl = dom.create('div', 'treasury__status text-xs italic opacity-70 min-h-[1rem]');
        body.appendChild(this.statusEl);

        this.saveBtn = dom.create('button', 'pe-btn pe-btn--secondary w-full', {
            innerText: Language.text('BTN_SNAPSHOT_SAVE'),
            onclick: () => this._onSaveClicked()
        });
        body.appendChild(this.saveBtn);

        this.uploadInput = dom.create('input', 'hidden', { type: 'file', accept: '.json,application/json' });
        this.uploadInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) this._onFileSelected(file);
        });
        body.appendChild(this.uploadInput);

        this.uploadBtn = dom.create('button', 'pe-btn pe-btn--secondary w-full', {
            innerText: Language.text('BTN_SNAPSHOT_UPLOAD'),
            onclick: () => {
                if (!License.isPremium()) { window.dispatchEvent(new CustomEvent('PREMIUM_GATE_OPEN', { detail: { actionId: 'treasury:upload' } })); log('UI', 'PREMIUM_ACTION_BLOCKED', { actionId: 'treasury:upload' }); return; }
                log('UI', 'TREASURY_UPLOAD_CLICKED', {});
                this.uploadInput.click();
            }
        });
        body.appendChild(this.uploadBtn);

        this.stagingContainer = dom.create('div', 'treasury__staging flex flex-col gap-2 hidden');
        body.appendChild(this.stagingContainer);

        // [PREMIUM] Cover the entire Treasury .config-section for the free tier.
        this._body = body;
        body.style.position = 'relative';
        this._premiumCover = dom.create('div', 'config-section__premium-cover', {
            style: 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;cursor:pointer;background:rgba(5,5,7,0.8);z-index:10;',
            onclick: () => { window.dispatchEvent(new CustomEvent('PREMIUM_GATE_OPEN', { detail: { actionId: 'treasury:locked' } })); log('UI', 'PREMIUM_ACTION_BLOCKED', { actionId: 'treasury:locked' }); }
        });
        this._premiumCover.innerHTML = `<span style="padding:3px 12px;font-size:11px;font-weight:800;color:#0a0a0a;background:linear-gradient(90deg,#d4af37,#f0c75e);border-radius:9999px;white-space:nowrap;">${Language.text('BTN_PREMIUM') || '⚗ Unseal'}</span>`;
        body.appendChild(this._premiumCover);
        this._reconcilePremiumCover();

        return this.expander.render(body);
    }

    async _onSaveClicked() {
        if (!License.isPremium()) { window.dispatchEvent(new CustomEvent('PREMIUM_GATE_OPEN', { detail: { actionId: 'treasury:save' } })); log('UI', 'PREMIUM_ACTION_BLOCKED', { actionId: 'treasury:save' }); return; }
        log('UI', 'TREASURY_SAVE_CLICKED', {});
        try { await TreasuryService.exportSnapshot(); }
        catch (err) { log('e', 'TREASURY_EXPORT_FAIL', err.message); }
    }

    async _onFileSelected(file) {
        log('LOGIC', 'TREASURY_FILE_STAGED', { filename: file.name, size: file.size });
        try {
            const text = await file.text();
            this.stagedEnvelope = JSON.parse(text);
            this.stagedFilename = file.name;
            this._renderStaging();
            State.set('_treasury_last_status', { token: 'MSG_TREASURY_STAGED_FILE', status: 'info', params: { filename: file.name } });
        } catch (err) {
            log('e', 'TREASURY_FILE_PARSE_FAIL', err.message);
            this.stagedEnvelope = null;
            this.stagedFilename = null;
            this.stagingContainer.innerHTML = '';
            this.stagingContainer.classList.add('hidden');
            State.set('_treasury_last_status', { token: 'LOG_ERR_SNAPSHOT_CORRUPTED', status: 'error' });
        }
        this.uploadInput.value = '';
    }

    _renderStaging() {
        this.stagingContainer.innerHTML = '';
        this.stagingContainer.classList.remove('hidden');

        const badge = dom.create('div', 'treasury__filename text-xs opacity-80 truncate px-2 py-1 bg-white/5 rounded', {
            innerText: this.stagedFilename || '(unnamed)'
        });
        this.stagingContainer.appendChild(badge);

        const switcherRow = dom.create('div', 'flex items-center justify-between gap-2 py-1');
        const switcherLabel = dom.create('span', 'text-xs', { innerText: Language.text('LABEL_FULL_REPLACE') });
        this.switcher = new Switcher({
            initialState: false,
            onChange: (state) => {
                this.fullReplace = state;
                log('UI', 'TREASURY_FULL_REPLACE_TOGGLED', { state });
                this._refreshApplyLabel();
            }
        });
        switcherRow.appendChild(switcherLabel);
        switcherRow.appendChild(this.switcher.render());
        this.stagingContainer.appendChild(switcherRow);

        this.applyBtn = dom.create('button', 'pe-btn pe-btn--primary w-full', {
            innerText: Language.text('BTN_INTEGRATE'),
            onclick: () => this._onApplyClicked()
        });
        this.stagingContainer.appendChild(this.applyBtn);
    }

    _refreshApplyLabel() {
        if (!this.applyBtn) return;
        this.applyBtn.innerText = this.fullReplace ? Language.text('BTN_OVERWRITE') : Language.text('BTN_INTEGRATE');
    }

    async _onApplyClicked() {
        if (!License.isPremium()) { window.dispatchEvent(new CustomEvent('PREMIUM_GATE_OPEN', { detail: { actionId: 'treasury:apply' } })); log('UI', 'PREMIUM_ACTION_BLOCKED', { actionId: 'treasury:apply' }); return; }
        log('UI', 'TREASURY_APPLY_CLICKED', { fullReplace: this.fullReplace });
        if (!this.stagedEnvelope) return;

        if (this.fullReplace) {
            log('UI', 'TREASURY_OVERWRITE_CONFIRM_SHOWN', {});
            const confirmed = await Confirmation.show(
                Language.text('CONFIRM_TREASURY_OVERWRITE_TITLE'),
                Language.text('CONFIRM_TREASURY_OVERWRITE_MSG'),
                Language.text('BTN_OVERWRITE')
            );
            if (!confirmed) { log('UI', 'TREASURY_OVERWRITE_CANCELLED', {}); return; }
            log('UI', 'TREASURY_OVERWRITE_CONFIRMED', {});
            await TreasuryService.integrate(this.stagedEnvelope, 'overwrite');
        } else {
            await TreasuryService.integrate(this.stagedEnvelope, 'integrate');
        }

        this.stagedEnvelope = null;
        this.stagedFilename = null;
        this.stagingContainer.innerHTML = '';
        this.stagingContainer.classList.add('hidden');
    }

    _paintStatus(rec) {
        if (!rec || !this.statusEl) return;
        let text = Language.text(rec.token) || rec.token;
        if (rec.params) for (const [k, v] of Object.entries(rec.params)) text = text.replace('{' + k + '}', String(v));
        this.statusEl.className = 'treasury__status text-xs log-' + rec.status;
        this.statusEl.innerText = text;
    }

    _reconcilePremiumCover() {
        if (this._premiumCover) {
            this._premiumCover.style.display = License.isPremium() ? 'none' : 'flex';
        }
    }

    destroy() {
        if (this.statusUnsub) this.statusUnsub();
        if (this._onLicenseChange) window.removeEventListener('LICENSE_STATUS_CHANGED', this._onLicenseChange);
        if (this.expander && typeof this.expander.destroy === 'function') this.expander.destroy();
    }
}
