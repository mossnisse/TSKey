// ui/richTextField.ts
// Mount/lifecycle adapter that lets a live RichTextEditor stand in for the plain
// textareas the card reconcilers used to render. Each editor instance is stashed on
// its host element (`_rte`) so the refresh pass can push new values (setValue), the
// reconciler can tear it down on card removal (destroy), and the format toolbar /
// figure-reference tool can find the editor a selection sits in.

import { RichTextEditor, defaultMarks, figureTokenRule } from '../editor/richText/index.ts';
import type { EditorSchema } from '../editor/richText/index.ts';
import { buildFigureLookups } from '../figureTokens.ts';
import type { FigureLookups } from '../figureTokens.ts';
import type { KeyStore, Figure } from '../store';

interface RteHost extends HTMLElement { _rte?: RichTextEditor; }

export interface RichTextFieldOptions {
    schema: EditorSchema;
    value: string;
    placeholder?: string;
    onChange: (value: string) => void;
}

/** Mounts a RichTextEditor on `host`, stashing the instance for later sync/teardown.
 *  Figure-aware fields are flagged (`data-rte-figures`) so the toolbar knows to offer
 *  the insert-figure button and the figure-reference tool can target them. */
export function mountRichTextField(host: HTMLElement, opts: RichTextFieldOptions): RichTextEditor {
    const editor = new RichTextEditor(host, {
        schema: opts.schema,
        value: opts.value,
        placeholder: opts.placeholder,
        onChange: opts.onChange,
    });
    (host as RteHost)._rte = editor;
    if (opts.schema.tokens.length > 0) host.dataset.rteFigures = 'true';
    return editor;
}

/** The editor mounted on a host, if any. */
export function getFieldEditor(host: HTMLElement | null): RichTextEditor | undefined {
    return host ? (host as RteHost)._rte : undefined;
}

/** Pushes a fresh value into a mounted field without clobbering an in-progress edit
 *  (RichTextEditor.setValue skips the focused-echo case, like syncField). */
export function syncRichTextField(host: HTMLElement, value: string): void {
    (host as RteHost)._rte?.setValue(value);
}

/** Destroys every editor mounted within (and on) `root`, releasing its DOM listeners.
 *  Called from the reconciler's onRemove and before any manual container teardown, so
 *  editors never leak on card delete / reorder / project switch. */
export function destroyRichTextFieldsIn(root: HTMLElement): void {
    const hosts: HTMLElement[] = [...root.querySelectorAll<HTMLElement>('.rte-host')];
    if (root.matches?.('.rte-host')) hosts.push(root);
    for (const h of hosts) {
        const rte = (h as RteHost)._rte;
        if (rte) {
            rte.destroy();
            delete (h as RteHost)._rte;
        }
    }
}

// Reference-keyed cache for the figure lookups, shared by every mounted editor. The
// token rule's getter runs once per chip per re-render (i.e. every keystroke), and each
// build is O(figures); without this it would rebuild all four maps every time. Every
// store mutation replaces `state.figures` with a new array (see KeyStore add/update/
// reorder/delete/undo/load), so an unchanged array reference means unchanged lookups —
// we rebuild only on a real figure change, not per chip.
let cachedFigures: readonly Figure[] | null = null;
let cachedLookups: FigureLookups | null = null;
function liveFigureLookups(store: KeyStore): FigureLookups {
    const figures = store.getFigures();
    if (figures !== cachedFigures) {
        cachedFigures = figures;
        cachedLookups = buildFigureLookups(figures);
    }
    return cachedLookups!;
}

/** Schema for a figure-aware field (couplet alt1/alt2, taxa description): all four
 *  marks plus a figure-token rule reading *live* lookups, so chips renumber as figures
 *  are added/reordered without re-mounting the editor. */
export function figureFieldSchema(store: KeyStore): EditorSchema {
    return { marks: defaultMarks, tokens: [figureTokenRule(() => liveFigureLookups(store))] };
}

/** Schema for a mark-only field (figure caption): text styling, no figure tokens. */
export function markOnlyFieldSchema(): EditorSchema {
    return { marks: defaultMarks, tokens: [] };
}
