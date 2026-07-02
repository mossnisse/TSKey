// editor/richText/index.ts
// Public surface of the standalone hybrid rich-text editor.

export { RichTextEditor } from './RichTextEditor.ts';
export type { RichTextEditorOptions } from './RichTextEditor.ts';
export { defaultMarks, figureTokenRule } from './schema.ts';
export type { EditorSchema, InlineMark, InlineToken, TokenRender } from './schema.ts';
export type { Atom, TextAtom, MarkAtom, TokenAtom } from './tokenize.ts';

// Lower-level pure helpers, exported for testing / advanced reuse.
export { tokenize } from './tokenize.ts';
export { renderAtoms } from './render.ts';
export { serialize } from './caret.ts';
export { toggleMark, insertToken } from './commands.ts';
export type { Selection, CommandResult } from './commands.ts';
