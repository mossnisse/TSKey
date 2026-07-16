import type { Branch } from '../store';
import { diagnoseKey } from '../store';
import { escapeHTML } from '../utils.ts';
import type { PlainTextParseResult } from './plainTextImporter.ts';

/** Builds the shared live-preview markup used by text and PDF imports. */
export function renderImportPreview(result: PlainTextParseResult): string {
    let html = '';

    if (result.errors.length > 0) {
        html += '<div class="import-messages">';
        result.errors.forEach(err => {
            html += `<div class="import-msg import-msg-error">⛔ ${escapeHTML(err)}</div>`;
        });
        return `${html}</div>`;
    }

    if (result.warnings.length > 0) {
        html += '<div class="import-messages">';
        result.warnings.forEach(warn => {
            html += `<div class="import-msg import-msg-warning">⚠️ ${escapeHTML(warn)}</div>`;
        });
        html += '</div>';
    }

    const diagnostics = diagnoseKey(result.couplets, result.figures);
    let errorCount = 0;
    let warningCount = 0;
    diagnostics.forEach(issues => issues.forEach(issue => {
        if (issue.severity === 'error') errorCount++; else warningCount++;
    }));

    if (errorCount > 0 || warningCount > 0) {
        const parts: string[] = [];
        if (errorCount) parts.push(`${errorCount} error${errorCount === 1 ? '' : 's'}`);
        if (warningCount) parts.push(`${warningCount} warning${warningCount === 1 ? '' : 's'}`);
        html += `<div class="import-diagnostics-summary">Key check: ${parts.join(', ')}. Fixable after import in the editor.</div>`;
    }

    const idToStep = new Map<number, number>();
    result.couplets.forEach((couplet, index) => idToStep.set(couplet.id, index + 1));

    const destLabel = (branch: Branch): string => {
        switch (branch.kind) {
            case 'linked': {
                const step = idToStep.get(branch.targetId);
                return step === undefined ? '→ ?' : `→ ${step}`;
            }
            case 'unresolved': return `→ ${branch.couplet}`;
            case 'taxonDraft': return escapeHTML(branch.name);
            case 'taxon': return '→ taxon';
            case 'empty': return '<span class="import-preview-muted">(empty)</span>';
        }
    };

    const diagnosticsHtml = (id: number): string => {
        const issues = diagnostics.get(id);
        if (!issues?.length) return '';
        const rows = issues.map(issue => {
            const cls = issue.severity === 'error' ? 'error-text' : 'warning-text';
            const icon = issue.severity === 'error' ? '⛔' : '⚠️';
            return `<div class="${cls}">${icon} ${escapeHTML(issue.message)}</div>`;
        }).join('');
        return `<div class="import-preview-diagnostics warning-block">${rows}</div>`;
    };

    html += '<ol class="import-preview-list">';
    result.couplets.forEach((couplet, index) => {
        const hasIssues = diagnostics.has(couplet.id);
        html += `
            <li class="import-preview-step${hasIssues ? ' has-issues' : ''}">
                <div class="import-preview-rows">
                    <div class="import-preview-row">
                        <span class="import-preview-lead">${index + 1}.</span>
                        <span class="import-preview-text">${escapeHTML(couplet.alt1) || '<span class="import-preview-muted">(blank)</span>'}</span>
                        <span class="import-preview-dest">${destLabel(couplet.branch1)}</span>
                    </div>
                    <div class="import-preview-row">
                        <span class="import-preview-lead">—</span>
                        <span class="import-preview-text">${escapeHTML(couplet.alt2) || '<span class="import-preview-muted">(blank)</span>'}</span>
                        <span class="import-preview-dest">${destLabel(couplet.branch2)}</span>
                    </div>
                    ${diagnosticsHtml(couplet.id)}
                </div>
            </li>`;
    });
    return `${html}</ol>`;
}
