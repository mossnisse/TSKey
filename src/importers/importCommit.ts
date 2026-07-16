import type { KeyStore } from '../store';
import { APP_NAME, APP_VERSION, workspaceStorage } from '../store';
import type { UIStateStore } from '../uiState.ts';
import { showToast } from '../uiRenderer.ts';
import type { PlainTextParseResult } from './plainTextImporter.ts';

export type ImportCommitOutcome = 'cancelled' | 'saved' | 'imported-unsaved' | 'failed';

export interface CommitParsedKeyOptions {
    store: KeyStore;
    uiState: UIStateStore;
    refreshAll: () => void;
    result: PlainTextParseResult;
    title: string;
    sourceLabel: string;
}

/** Commits a parsed key as a project without coupling persistence to a dialog. */
export async function commitParsedKey(options: CommitParsedKeyOptions): Promise<ImportCommitOutcome> {
    const { store, uiState, refreshAll, result, sourceLabel } = options;
    if (!result.couplets.length || result.errors.length) {
        showToast('⚠️ There is nothing valid to import yet.', 'error');
        return 'failed';
    }

    const title = options.title.trim() || 'Imported Key';
    if (store.hasUnsavedChanges()
        && !confirm('You have unsaved changes in the current key. Importing will discard them. Continue?')) {
        return 'cancelled';
    }

    let imported = false;
    try {
        const projects = await workspaceStorage.getProjectList();
        const exists = projects.some(project => project.name.toLowerCase() === title.toLowerCase());
        if (exists && !confirm(`A local project named "${title}" already exists. Overwrite it with this import?`)) {
            return 'cancelled';
        }

        const importResult = store.importJsonData({
            type: APP_NAME,
            version: APP_VERSION,
            title,
            data: { title, key: result.couplets, figures: result.figures },
        });
        if (!importResult.success) {
            alert(`Failed to import parsed key:\n• ${importResult.errors.join('\n• ')}`);
            return 'failed';
        }
        imported = true;
        store.setTitle(title);
        uiState.setActiveProjectTitle(title);
        await store.saveToStorage();
        showToast(`📥 Imported "${title}" from ${sourceLabel} (${result.stepCount} step(s)).`, 'success');
        refreshAll();
        return 'saved';
    } catch (error) {
        console.error(`${sourceLabel} import failed:`, error);
        if (imported) {
            showToast('⚠️ The key was imported but could not be saved to browser storage. Use File → Save to retry.', 'error');
            refreshAll();
            return 'imported-unsaved';
        }
        showToast(`⚠️ The ${sourceLabel} import could not be completed.`, 'error');
        return 'failed';
    }
}
