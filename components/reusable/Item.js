/**
 * @file components/reusable/Item.js
 * @purpose UI: Constructor for complex Selector items (emojis, categories, desc).
 */
import { dom } from '../../utils/dom.js';
import { ICONS } from '../../utils/assets.js';
import { Language } from '../../services/Language.js';

export class Item {
    static render(entity, isActive, onClick, actions = null, options = {}) {
        const wrapper = dom.create('div', `selector-item relative ${isActive ? 'selector-item--active' : ''} ${actions ? 'group' : ''}`, {
            onclick: onClick,
            id: `persona-${entity.id}`,
            'data-id': entity.id
        });

        // Favorite Heart logic
        if (options.onFavoriteToggle) {
            const isFavorite = options.isFavorite;
            const heart = dom.create('div', `selector-item__favorite ${isFavorite ? 'selector-item__favorite--active' : ''}`, {
                innerHTML: isFavorite ? ICONS.HEART_FULL : ICONS.HEART_HOLLOW,
                onclick: (e) => {
                    e.stopPropagation();
                    options.onFavoriteToggle(entity.id);
                }
            });
            wrapper.appendChild(heart);
        }

        const info = dom.create('div', 'selector-item__info');
        
        const nameRow = dom.create('span', 'selector-item__name');
        if (entity.emoji) {
            const knowledges = entity.persona_knowledge || entity.knowledge || [];
            const kCount = Array.isArray(knowledges) ? knowledges.length : 0;
            nameRow.appendChild(dom.create('span', 'persona-item__emoji', { 
                innerText: entity.emoji,
                title: `Knowledge: ${kCount}`
            }));
        }
        
        nameRow.appendChild(document.createTextNode(entity.name));
        
        const tags = entity.tags || (entity.category ? [entity.category] : null);
        if (tags && tags.length > 0) {
            const primaryTag = tags[0];
            const tagText = tags.length > 1 ? `${primaryTag} + ${tags.length - 1}` : primaryTag;
            nameRow.appendChild(dom.create('span', 'persona-item__category', { innerText: tagText }));
        }

        info.appendChild(nameRow);

        if (entity.desc) {
            info.appendChild(dom.create('span', 'selector-item__desc u-truncate-rows', { 
                innerText: entity.desc,
                title: entity.desc 
            }));
        }

        wrapper.appendChild(info);

        if (actions) {
            const actionGroup = dom.create('div', 'selector-item__actions opacity-0 group-hover:opacity-100 transition-opacity duration-200');
            if (actions.onEdit) {
                const editBtn = dom.create('button', 'menu__item', {
                    innerHTML: ICONS.EDIT,
                    onclick: (e) => { e.stopPropagation(); actions.onEdit(entity); }
                });
                actionGroup.appendChild(editBtn);
            }
            if (actions.onDelete) {
                const delBtn = dom.create('button', 'menu__item hover:!text-red-500 hover:!bg-red-500/10', {
                    innerHTML: ICONS.TRASH,
                    onclick: (e) => { e.stopPropagation(); actions.onDelete(entity); }
                });
                actionGroup.appendChild(delBtn);
            }
            wrapper.appendChild(actionGroup);
        }

        // Trailing Checkmark for Active State
        if (isActive && !actions) {
            const check = dom.create('div', 'selector-item__icon', {
                innerHTML: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
            });
            wrapper.appendChild(check);
        }

        // [V15] Persona category bottom-right slot (mutually exclusive; absolute on the relative wrapper).
        if (options.onUnassignCategory) {
            const un = dom.create('button', 'selector-item__unassign-category', {
                innerHTML: ICONS.UNASSIGN_CATEGORY || '&#8592;',
                title: Language.text('TOOLTIP_UNASSIGN_CATEGORY'),
                dataset: { action: 'category:unassign' },
                onclick: (e) => { e.stopPropagation(); options.onUnassignCategory(entity.id); }
            });
            wrapper.appendChild(un);
        } else if (options.categoryName && options.onCategoryChip) {
            const chip = dom.create('div', 'selector-item__category-chip', {
                innerText: options.categoryName,
                title: options.categoryName,
                dataset: { action: 'category:navigate' },
                onclick: (e) => { e.stopPropagation(); options.onCategoryChip(entity.id); }
            });
            wrapper.appendChild(chip);
        } else if (options.onAssignCategory) {
            const asg = dom.create('button', 'selector-item__assign-category', {
                innerHTML: ICONS.ASSIGN_CATEGORY || '&#8594;',
                title: Language.text('TOOLTIP_ASSIGN_CATEGORY'),
                dataset: { action: 'category:assign' },
                onclick: (e) => { e.stopPropagation(); options.onAssignCategory(entity.id); }
            });
            wrapper.appendChild(asg);
        }

        return wrapper;
    }
}
