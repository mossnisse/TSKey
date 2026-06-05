// utils.ts
import type { Couplet } from './store.ts';

export function escapeHTML(str: string): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function getStepNumberById(key: readonly Couplet[], targetId: number): string {
    if (targetId === 0) return '0';
    const index = key.findIndex(c => c.id === targetId);
    return index !== -1 ? (index + 1).toString() : 'INVALID ID';
}