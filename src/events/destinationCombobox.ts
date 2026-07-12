// events/destinationCombobox.ts
// Autocomplete dropdown for the key-card destination inputs (dest1/dest2). Focusing
// a destination shows the taxa from the Taxa panel; typing filters them by scientific
// OR vernacular name. Free typing is untouched — a step number (existing or not) or a
// brand-new taxon name commits exactly as before; the dropdown is only a shortcut.
// Selecting a suggestion sets the input's value and re-dispatches 'input', so the
// normal destination pipeline (parseDestinationInput → live taxon link → debounced
// validation, in setupCoupletInput) handles the store update.

import type { KeyStore, Taxon } from '../store';
import type { UIStateStore } from '../uiState.ts';
import { displayTaxonName, escapeHTML } from '../utils.ts';

interface Suggestion {
    taxon: Taxon;
    primary: string;   // name shown first and inserted on select (current display mode)
    secondary: string; // the taxon's other name, shown muted ('' when absent/identical)
}

export function setupDestinationCombobox(
    keyContainer: HTMLElement,
    store: KeyStore,
    uiState: UIStateStore,
    signal: AbortSignal,
) {
    let listEl: HTMLElement | null = null;
    let anchor: HTMLInputElement | null = null;
    let suggestions: Suggestion[] = [];
    let activeIndex = -1; // -1 = nothing highlighted, so plain Enter never steals a free-typed value

    const isDestInput = (el: EventTarget | null): el is HTMLInputElement =>
        el instanceof HTMLInputElement && el.classList.contains('input-destination');

    function buildSuggestions(query: string): Suggestion[] {
        const q = query.trim().toLowerCase();
        // A pure number is a step reference — taxon suggestions would only be noise.
        if (/^\d+$/.test(q)) return [];

        const mode = uiState.nameDisplayMode;
        const out: Suggestion[] = [];
        for (const taxon of store.getTaxa()) {
            const sci = taxon.scientificName.trim();
            const ver = taxon.vernacularName.trim();
            if (!sci && !ver) continue;
            if (q && !sci.toLowerCase().includes(q) && !ver.toLowerCase().includes(q)) continue;
            const primary = displayTaxonName(taxon, mode);
            const other = primary === sci ? ver : sci;
            out.push({ taxon, primary, secondary: other === primary ? '' : other });
        }
        // Names starting with the query rank above mere substring matches.
        const rank = (s: Suggestion) =>
            !q || s.primary.toLowerCase().startsWith(q) || s.secondary.toLowerCase().startsWith(q) ? 0 : 1;
        out.sort((a, b) => rank(a) - rank(b) || a.primary.localeCompare(b.primary));
        return out;
    }

    function render() {
        if (!listEl) return;
        listEl.innerHTML = suggestions.map((s, i) => `
            <div class="dest-option${i === activeIndex ? ' is-active' : ''}" role="option"
                 id="dest-option-${i}" aria-selected="${i === activeIndex}" data-index="${i}">
                <span class="dest-option-primary">${escapeHTML(s.primary)}</span>
                ${s.secondary ? `<span class="dest-option-secondary">${escapeHTML(s.secondary)}</span>` : ''}
            </div>`).join('');
        if (activeIndex >= 0) {
            anchor?.setAttribute('aria-activedescendant', `dest-option-${activeIndex}`);
            listEl.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
        } else {
            anchor?.removeAttribute('aria-activedescendant');
        }
    }

    /** Anchors the (already populated) list under the input, clamped to the viewport;
     *  flips above the input when there is no room below. */
    function position() {
        if (!listEl || !anchor) return;
        const rect = anchor.getBoundingClientRect();
        const margin = 8;
        listEl.style.minWidth = `${Math.max(rect.width, 180)}px`;
        const listRect = listEl.getBoundingClientRect();
        const left = Math.max(margin, Math.min(rect.left, window.innerWidth - listRect.width - margin));
        const below = rect.bottom + 4;
        const top = below + listRect.height > window.innerHeight - margin
            ? Math.max(margin, rect.top - listRect.height - 4)
            : below;
        listEl.style.left = `${left}px`;
        listEl.style.top = `${top}px`;
    }

    function close() {
        listEl?.remove();
        listEl = null;
        anchor?.setAttribute('aria-expanded', 'false');
        anchor?.removeAttribute('aria-activedescendant');
        anchor?.removeAttribute('aria-controls');
        anchor = null;
        suggestions = [];
        activeIndex = -1;
    }

    /** Inserts the chosen taxon name and pushes it through the normal input pipeline. */
    function select(index: number) {
        const chosen = suggestions[index];
        const input = anchor;
        close();
        if (!chosen || !input) return;
        input.value = chosen.primary;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        // Re-dispatching 'input' would immediately reopen the list — close it again on
        // the microtask after the pipeline ran, keeping focus for further edits.
        queueMicrotask(close);
    }

    /** Opens (or refilters) the dropdown for `input`; closes it when nothing matches. */
    function openFor(input: HTMLInputElement, query: string) {
        const next = buildSuggestions(query);
        if (next.length === 0) {
            if (anchor === input) close();
            return;
        }
        // close() clears `suggestions`, so build first, tear down any stale list, then
        // assign — otherwise the fresh matches would be wiped before render().
        if (!listEl || anchor !== input) {
            close();
            anchor = input;
            listEl = document.createElement('div');
            listEl.className = 'dest-combobox';
            listEl.id = 'dest-combobox-listbox';
            listEl.setAttribute('role', 'listbox');
            // mousedown (not click) so we can keep focus in the input: no focusout, no
            // typing-session end, no refresh churn mid-selection.
            listEl.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const option = (e.target as HTMLElement).closest('[data-index]');
                if (option) select(Number(option.getAttribute('data-index')));
            });
            document.body.appendChild(listEl);
            input.setAttribute('aria-expanded', 'true');
            input.setAttribute('aria-autocomplete', 'list');
            input.setAttribute('aria-controls', 'dest-combobox-listbox');
        }
        suggestions = next;
        activeIndex = -1;
        render();
        position();
    }

    // Focusing a destination shows the full taxa list (the text is auto-selected by
    // setupCoupletFocus, so the first keystroke replaces it and filters).
    keyContainer.addEventListener('focusin', (e) => {
        if (isDestInput(e.target)) openFor(e.target, '');
    }, { signal });

    keyContainer.addEventListener('input', (e) => {
        if (isDestInput(e.target)) openFor(e.target, e.target.value);
    }, { signal });

    keyContainer.addEventListener('focusout', (e) => {
        if (isDestInput(e.target)) close();
    }, { signal });

    keyContainer.addEventListener('keydown', (e) => {
        if (!listEl || !isDestInput(e.target) || e.target !== anchor) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const delta = e.key === 'ArrowDown' ? 1 : -1;
            activeIndex = activeIndex === -1
                ? (delta === 1 ? 0 : suggestions.length - 1)
                : (activeIndex + delta + suggestions.length) % suggestions.length;
            render();
        } else if (e.key === 'Enter') {
            // Only a highlighted suggestion is taken; otherwise the typed text stands
            // (a new taxon name or a step number) and the list just closes.
            if (activeIndex >= 0) {
                e.preventDefault();
                select(activeIndex);
            } else {
                close();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            close();
        } else if (e.key === 'Tab') {
            close();
        }
    }, { signal });

    // Outside interactions dismiss the list (scrolling inside the list itself doesn't).
    document.addEventListener('mousedown', (e) => {
        if (listEl && !listEl.contains(e.target as Node) && e.target !== anchor) close();
    }, { signal });
    window.addEventListener('scroll', (e) => {
        if (listEl && e.target instanceof Node && listEl.contains(e.target)) return;
        close();
    }, { signal, capture: true });
    window.addEventListener('resize', close, { signal });
    signal.addEventListener('abort', close);
}
