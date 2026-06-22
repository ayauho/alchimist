/**
 * @file components/reusable/Confirmation.js
 * @purpose Reusable Promise-based confirmation modal.
 */
import { dom } from '../../utils/dom.js';
import { Language } from '../../services/Language.js';

export class Confirmation {
    static show(title, message, confirmText = Language.text('BTN_DELETE'), options = {}) {
        return new Promise((resolve) => {
            const overlay = dom.create('div', 'c-modal');
            const card = dom.create('div', 'c-modal__card u-fade-in');
            
            const header = dom.create('h3', 'c-modal__header', { innerText: title });
            const body = dom.create('p', 'c-modal__body', { innerText: message });
            const footer = dom.create('div', 'c-modal__footer');
            
            const cancelBtn = dom.create('button', 'c-modal__btn--secondary', { innerText: Language.text('BTN_CANCEL') });
            const confirmVariant = options.variant === 'primary' ? 'c-modal__btn--primary' : 'c-modal__btn--danger';
            const confirmBtn = dom.create('button', confirmVariant, { innerText: confirmText });
            
            const cleanup = () => overlay.remove();
            
            cancelBtn.onclick = () => { cleanup(); resolve(false); };
            confirmBtn.onclick = () => { cleanup(); resolve(true); };
            overlay.onclick = (e) => { if(e.target === overlay) { cleanup(); resolve(false); } };
            
            footer.appendChild(cancelBtn);
            footer.appendChild(confirmBtn);
            card.appendChild(header);
            card.appendChild(body);
            card.appendChild(footer);
            overlay.appendChild(card);
            
            document.body.appendChild(overlay);
        });
    }
}
