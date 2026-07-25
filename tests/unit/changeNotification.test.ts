// Covers the store change notification that replaced hand-threaded `refreshAll`
// calls: what each kind of mutation announces, and that 'typing' stays distinct so
// a subscriber can skip re-rendering mid-keystroke.
import { describe, expect, it, vi } from 'vitest';
import { KeyStore } from '../../src/store/keyStore.ts';
import { UIStateStore } from '../../src/uiState.ts';
import { couplet } from '../helpers/factories.ts';

function subscribedStore() {
    const store = new KeyStore([couplet(1), couplet(2)], [], 'Test key');
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    return { store, listener, unsubscribe };
}

describe('store change notification', () => {
    it('announces structural document mutations', () => {
        const { store, listener } = subscribedStore();

        store.addCouplet();
        expect(listener).toHaveBeenCalledWith('structural');

        listener.mockClear();
        store.addTaxon('Bufo bufo');
        store.addFigure('toad.jpg', 'A toad');
        store.reorderCouplets(1, 2, 'below');
        expect(listener).toHaveBeenCalledTimes(3);
        expect(listener.mock.calls.every(([kind]) => kind === 'structural')).toBe(true);
    });

    it('announces a field edit as typing, so subscribers can skip it while the user types', () => {
        const { store, listener } = subscribedStore();
        const taxonId = store.addTaxon('Bufo');
        listener.mockClear();

        store.updateCouplet(1, { alt1: 'Skin dry and warty' });
        store.updateTaxon(taxonId, { vernacularName: 'Common toad' });
        expect(listener.mock.calls).toEqual([['typing'], ['typing']]);
    });

    it('announces selection and undo/redo, which change what is on screen but not the document', () => {
        const { store, listener } = subscribedStore();

        store.toggleSelection(1, false);
        expect(listener).toHaveBeenLastCalledWith('structural');

        store.addCouplet();
        listener.mockClear();
        expect(store.undo()).toBe(true);
        expect(listener).toHaveBeenLastCalledWith('structural');

        listener.mockClear();
        expect(store.redo()).toBe(true);
        expect(listener).toHaveBeenLastCalledWith('structural');
    });

    it('stops delivering once unsubscribed', () => {
        const { store, listener, unsubscribe } = subscribedStore();

        unsubscribe();
        store.addCouplet();
        expect(listener).not.toHaveBeenCalled();
    });
});

describe('UI state change notification', () => {
    it('announces preference and roster-view changes', () => {
        const uiState = new UIStateStore();
        const listener = vi.fn();
        const unsubscribe = uiState.subscribe(listener);

        uiState.toggleFigures();
        uiState.setLeadFormat('lettered');
        uiState.togglePanelCollapse('taxa');
        // Not persisted, but the roster still has to re-render to apply it.
        uiState.setTaxaFilter('bufo');
        uiState.toggleTaxonExpanded(7);
        expect(listener).toHaveBeenCalledTimes(5);
        expect(listener.mock.calls.every(([kind]) => kind === 'structural')).toBe(true);

        unsubscribe();
        uiState.togglePrint();
        expect(listener).toHaveBeenCalledTimes(5);
    });

    it('ignores a filter set to the value it already has', () => {
        const uiState = new UIStateStore();
        uiState.setTaxaFilter('bufo');
        const listener = vi.fn();
        uiState.subscribe(listener);

        uiState.setTaxaFilter('bufo');
        expect(listener).not.toHaveBeenCalled();
    });
});
