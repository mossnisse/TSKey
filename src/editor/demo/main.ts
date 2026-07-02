// editor/demo/main.ts
// Standalone harness for developing/verifying the rich-text editor in isolation
// (served at /editor-demo.html). It mounts a RichTextEditor with the default marks and
// a figure-token rule backed by a FAKE figure list, adds a toolbar + shortcuts, and
// shows the live source string so the round-trip is visible.

import '../../style.css';
import '../richText/richText.css';
import './demo.css';
import { RichTextEditor, defaultMarks, figureTokenRule } from '../richText/index.ts';
import { buildFigureLookups } from '../../figureTokens.ts';

// Pretend the project has three figures, so tokens can resolve to display numbers —
// through the exact same lookups + resolution the real app and exporters use.
const figureLookups = buildFigureLookups([
    { id: 10, filename: 'habitus.jpg', caption: '' },
    { id: 20, filename: 'antenna.png', caption: '' },
    { id: 30, filename: 'genitalia.jpg', caption: '' },
]);

const root = document.getElementById('demo-root')!;
root.innerHTML = `
  <div class="demo-shell">
    <h1>Rich-Text Editor</h1>
    <p class="demo-hint">
      Type <code>**bold**</code>, <code>*italic*</code>, <code>~sub~</code>,
      <code>^sup^</code>, or a figure reference like <code>[fig: 1]</code>.
      Shortcuts: Ctrl/Cmd+B, Ctrl/Cmd+I.
    </p>
    <div class="demo-toolbar" id="toolbar">
      <button type="button" data-mark="bold" title="Bold (Ctrl/Cmd+B)"><b>B</b></button>
      <button type="button" data-mark="italic" title="Italic (Ctrl/Cmd+I)"><i>I</i></button>
      <button type="button" data-mark="subscript" title="Subscript">x<sub>2</sub></button>
      <button type="button" data-mark="superscript" title="Superscript">x<sup>2</sup></button>
      <span class="demo-sep"></span>
      <button type="button" id="insert-fig" title="Insert figure reference">＋ Fig ref</button>
    </div>
    <div id="editor"></div>
    <h2>Source string (<code>getValue()</code>)</h2>
    <pre id="source" class="demo-source"></pre>
  </div>
`;

const editorHost = document.getElementById('editor') as HTMLElement;
const sourceOut = document.getElementById('source') as HTMLElement;

const editor = new RichTextEditor(editorHost, {
    schema: { marks: defaultMarks, tokens: [figureTokenRule(figureLookups)] },
    placeholder: 'Enter a diagnostic trait…  e.g. **pronotum** with [fig: 1]',
    value: 'Elytra **strongly punctate**, antenna with 11 segments (see [fig: 2]); H~2~O droplet, area = r^2^.',
    onChange: (v) => { sourceOut.textContent = v; },
});
sourceOut.textContent = editor.getValue();

document.getElementById('toolbar')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button');
    if (!btn) return;
    const mark = btn.getAttribute('data-mark');
    if (mark) { editor.toggleMark(mark); return; }
    if (btn.id === 'insert-fig') editor.insertToken('[fig: 1]');
});

// Expose for preview_eval-based verification.
(window as unknown as { demoEditor: RichTextEditor }).demoEditor = editor;
