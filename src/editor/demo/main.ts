// editor/demo/main.ts
// Standalone harness for developing/verifying the rich-text editor in isolation
// (served at /src/editor/index.html, built as its own page). It mounts a
// RichTextEditor with the default marks and a figure-token rule backed by a FAKE
// figure list — resolved through the exact same lookups + resolution the real app
// and exporters use — and shows the live source string so the round-trip is visible.

import '../../style.css';
import '../richText/richText.css';
import './demo.css';
import { RichTextEditor, defaultMarks, figureTokenRule } from '../richText/index.ts';
import { buildFigureLookups } from '../../figureTokens.ts';
import { escapeHTML } from '../../utils.ts';

const fakeFigures = [
    { id: 10, filename: 'habitus.jpg', caption: 'Habitus, dorsal view' },
    { id: 20, filename: 'antenna.png', caption: 'Antenna, segments 1–11' },
    { id: 30, filename: 'genitalia.jpg', caption: 'Male genitalia, lateral' },
];
// Resolve figure tokens through the exact lookups the real app + exporters use, so
// the demo's chips can never drift from published output.
const figureLookups = buildFigureLookups(fakeFigures);

const root = document.getElementById('app')!;
root.innerHTML = `
  <div class="demo-shell">
    <header class="demo-head">
      <h1>Rich-Text Editor</h1>
      <p class="demo-hint">
        A hybrid editor: markdown markers render as styling and hide, figure
        references render as chips. The stored value stays a plain string.
      </p>
    </header>

    <div class="demo-toolbar" id="toolbar" role="toolbar" aria-label="Formatting">
      <button type="button" data-mark="bold" title="Bold (Ctrl/Cmd+B)"><b>B</b></button>
      <button type="button" data-mark="italic" title="Italic (Ctrl/Cmd+I)"><i>I</i></button>
      <button type="button" data-mark="subscript" title="Subscript">x<sub>2</sub></button>
      <button type="button" data-mark="superscript" title="Superscript">x<sup>2</sup></button>
      <span class="demo-sep"></span>
      <span class="demo-syntax-legend">
        <code>**bold**</code> <code>*italic*</code> <code>~sub~</code> <code>^sup^</code>
      </span>
    </div>

    <div id="editor"></div>

    <section class="demo-figures">
      <h2>Figures <span class="demo-muted">— click to insert a reference</span></h2>
      <ul id="figure-list" class="demo-figure-list">
        ${fakeFigures.map((f, i) => `
          <li>
            <button type="button" class="demo-figure-btn" data-fig="${i + 1}">
              <span class="tsk-chip">(Fig. ${i + 1})</span>
              <span class="demo-figure-meta">
                <span class="demo-figure-file">${escapeHTML(f.filename)}</span>
                <span class="demo-figure-caption">${escapeHTML(f.caption)}</span>
              </span>
            </button>
          </li>`).join('')}
      </ul>
    </section>

    <section class="demo-out">
      <h2>Stored source string <span class="demo-muted">— <code>getValue()</code></span></h2>
      <pre id="source" class="demo-source"></pre>
    </section>
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

// Toolbar: mark buttons keep focus in the editor so the selection survives the click.
document.getElementById('toolbar')!.addEventListener('mousedown', (e) => {
    const btn = (e.target as HTMLElement).closest('button');
    if (!btn) return;
    e.preventDefault(); // don't blur the editor
    const mark = btn.getAttribute('data-mark');
    if (mark) editor.toggleMark(mark);
});

// Figure legend: insert a display-number reference at the caret.
document.getElementById('figure-list')!.addEventListener('mousedown', (e) => {
    const btn = (e.target as HTMLElement).closest('.demo-figure-btn') as HTMLElement | null;
    if (!btn) return;
    e.preventDefault(); // keep the editor selection
    editor.insertToken(`[fig: ${btn.dataset.fig}]`);
});

// Expose for preview_eval-based verification.
(window as unknown as { demoEditor: RichTextEditor }).demoEditor = editor;
