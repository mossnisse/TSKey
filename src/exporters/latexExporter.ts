// latexExporter.ts
import type { KeyStore } from '../store';
import { triggerFileDownload, sanitizeFilename } from '../utils.ts';
import type { DestinationResolution, LeadFormat, NameDisplayMode } from '../utils.ts';
import { buildKeyDocumentModel, renderAltSegments, renderRichText, buildTaxonExportNames } from '../keyDocumentModel.ts';
import type { AltSegmentRenderer, TaxonNameLine } from '../keyDocumentModel.ts';
import { showToast } from '../uiRenderer.ts';

/**
 * Escapes characters that have active syntactical meaning inside LaTeX compilers.
 * Uses a token system to prevent double-escaping structural formatting macros.
 */
function escapeLaTeX(str: string): string {
    if (!str) return '';
    return str
        .replace(/[\r\n]+/g, ' ')
        // 1. Convert literal backslashes to a temporary safe placeholder string
        .replace(/\\/g, '___TSKEY_LATEX_BACKSLASH___')
        // 2. Escape standard active layout characters safely
        .replace(/([&%$#_{}])/g, '\\$1')
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}')
        .replace(/</g, '\\textless{}')
        .replace(/>/g, '\\textgreater{}')
        // 3. Swap the placeholder out for the true native backslash macro block
        .replace(/___TSKEY_LATEX_BACKSLASH___/g, '\\textbackslash{}');
}

/**
 * Renders a couplet lead marker (e.g. "1.", "1a", "—") as a bold, fixed-width
 * box. The em dash is emitted as \textemdash{} so it compiles without relying on
 * inputenc handling of the literal character.
 */
function latexLeadBox(lead: string, width: string): string {
    const body = escapeLaTeX(lead).replace(/—/g, '\\textemdash{}');
    return `\\makebox[${width}][l]{\\textbf{${body}}}`;
}

// Resolves figure tokens the same way as the plain-text and HTML exporters: every
// resolvable token (stored [figID: N] or raw [fig: value]) becomes an inline
// (Fig.~N) citation, and an unresolvable one stays visible as [Broken Fig: …].
// Mark name → LaTeX wrapping macro.
const LATEX_MARK: Record<string, (inner: string) => string> = {
    bold: s => `\\textbf{${s}}`,
    italic: s => `\\textit{${s}}`,
    subscript: s => `\\textsubscript{${s}}`,
    superscript: s => `\\textsuperscript{${s}}`,
};

const LATEX_ALT: AltSegmentRenderer = {
    text: escapeLaTeX,
    fig: seg => ` (Fig.~${seg.displayNum})`,
    brokenFig: seg => `[Broken Fig: ${escapeLaTeX(seg.label)}]`,
    mark: (name, inner) => (LATEX_MARK[name] ?? ((s: string) => s))(inner),
};

/**
 * Compiles the current KeyStore state into a valid standalone LaTeX structure
 * using classic inline notation and dot leaders to prevent layout overlap.
 */
export function exportKeyToLaTeX(store: KeyStore, leadFormat: LeadFormat, showBackReference: boolean, nameMode: NameDisplayMode): void {

    try {
        const model = buildKeyDocumentModel(store, { leadFormat, showBackReference, nameMode });
        const { title, taxa, figures } = model;
        // The back-reference widens the lead ("2 (1)"), so give the fixed box and
        // matching hang-indent extra room to avoid overprinting the diagnosis text.
        const leadWidth = showBackReference ? '4.5em' : '2.5em';

        let mainContent = '';

        if (model.isEmpty) {
            mainContent = `
\\begin{center}
  \\vspace*{2cm}
  \\textit{\\small [The identification key is currently empty. Please add key steps in the editor to populate this document.]}
\\end{center}`;
        } else {
            let bodyContent = '';

            // Render a destination: italic-bold taxon name (linked record or draft
            // alike), bold step number, or \dots when the branch is empty/broken.
            const renderEnd = (dest: DestinationResolution): string => {
                switch (dest.kind) {
                    case 'taxon': return `\\mbox{\\textbf{\\textit{${escapeLaTeX(dest.printText)}}}}`;
                    case 'step': return `\\mbox{\\textbf{${escapeLaTeX(dest.printText)}}}`;
                    default: return `\\dots`;
                }
            };

            // --- KEY COUPLETS LOOP ---
            model.couplets.forEach(c => {
                const end1 = renderEnd(c.dest1);
                const end2 = renderEnd(c.dest2);

                const alt1Text = renderAltSegments(c.alt1, LATEX_ALT);
                const alt2Text = renderAltSegments(c.alt2, LATEX_ALT);

                const { lead1, lead2 } = c;

                // Structural formatting utilizing flexible dot-fill constraints to auto-align right boundaries
                bodyContent += `{\\interlinepenalty=10000\n`;
                bodyContent += `\\noindent\\hangindent=${leadWidth}\\hangafter=1${latexLeadBox(lead1, leadWidth)}${alt1Text}\\nobreak\\dotfill\\allowbreak\\hspace*{0pt}\\dotfill ${end1}\\par\\nopagebreak\n`;
                bodyContent += `\\noindent\\hangindent=${leadWidth}\\hangafter=1${latexLeadBox(lead2, leadWidth)}${alt2Text}\\nobreak\\dotfill\\allowbreak\\hspace*{0pt}\\dotfill ${end2}\\par}\n`;
                bodyContent += `\\vspace{0.6em}\n\n`;
            });

            mainContent = `
{
\\setlength{\\parfillskip}{0pt}
${bodyContent}
\\par
}`;
        }

        // --- FIGURES APPENDIX GENERATION ---
        // Filenames \detokenize can't rescue (spaces / multiple dots) are collected for a warning.
        const problematicFilenames: string[] = [];
        let figuresAppendix = '';
        if (figures.length > 0) {
            figuresAppendix += `\\newpage\n\\section*{Figures Appendix}\n`;
            figuresAppendix += `\\textit{Instructions: Create a folder named \\texttt{figures} in the same directory as this \\texttt{.tex} file, and place the corresponding image files inside it before compiling.}\n\\vspace{1.5em}\n\n`;

            figures.forEach((fig, index) => {
                const displayNum = index + 1;
                const escapedCaption = fig.caption
                    ? renderRichText(fig.caption, LATEX_ALT)
                    : escapeLaTeX(`Figure ${displayNum}`);

                figuresAppendix += `\\begin{figure}[htbp]\n`;
                figuresAppendix += `  \\centering\n`;

                const filename = fig.filename.trim();
                if (filename) {
                    // \detokenize keeps the literal filename (so the link still resolves) while
                    // neutralizing catcode-active characters such as underscores.
                    figuresAppendix += `  \\includegraphics[width=0.7\\linewidth]{\\detokenize{figures/${filename}}}\n`;

                    // The filename must match the real image file, so we can't rewrite it —
                    // instead flag anything that won't compile so the user can rename the file.
                    // \detokenize neutralizes catcodes INSIDE its argument, but characters the
                    // TeX tokenizer acts on first — braces, %, #, backslash — still break the
                    // \detokenize{...} group; spaces and multiple dots confuse graphicx's
                    // extension handling.
                    if (/\s/.test(filename) || (filename.match(/\./g)?.length ?? 0) > 1 || /[{}\\%#]/.test(filename)) {
                        problematicFilenames.push(filename);
                    }
                } else {
                    figuresAppendix += `  \\framebox[0.7\\linewidth]{\\vbox{\\vspace{1.5cm}\\centering\\textbf{[Image Placeholder]}\\par\\vspace{0.5em}\\small No filename provided in data store\\vspace{1.5cm}}}\n`;
                }

                figuresAppendix += `  \\caption{${escapedCaption}}\n`;
                figuresAppendix += `  \\label{fig:${displayNum}}\n`;
                figuresAppendix += `\\end{figure}\n\n`;
            });
        }

        // --- TAXA CHAPTERS ---
        // One entry per taxon record, in panel order; empty fields are omitted.
        // escapeLaTeX collapses newlines to spaces, so each value stays single-line.
        let taxaSection = '';
        if (taxa.length > 0) {
            let taxaBody = '';
            const field = (label: string, value: string): string =>
                `\\noindent\\textbf{${label}:} ${escapeLaTeX(value)}\\par\n`;

            // A name line: the scientific name is italicised with its auctor in a
            // smaller size after it; the vernacular name renders upright.
            const renderName = (line: TaxonNameLine): string => {
                const name = line.isScientific ? `\\textit{${escapeLaTeX(line.name)}}` : escapeLaTeX(line.name);
                const auctor = line.auctor ? ` {\\small ${escapeLaTeX(line.auctor)}}` : '';
                return name + auctor;
            };

            taxa.forEach(taxon => {
                const names = buildTaxonExportNames(taxon, nameMode);
                taxaBody += `\\subsection*{${renderName(names.heading)}}\n`;

                // The other name (scientific + auctor in vernacular mode, else the
                // vernacular name) on its own line; omitted when absent.
                if (names.secondary) {
                    taxaBody += `\\noindent ${renderName(names.secondary)}\\par\n`;
                }

                if (taxon.synonyms.length > 0) taxaBody += field('Synonyms', taxon.synonyms.join('; '));
                if (taxon.description) taxaBody += `\\noindent\\textbf{Description:} ${renderRichText(taxon.description, LATEX_ALT, figures)}\\par\n`;
                if (taxon.biology) taxaBody += field('Biology', taxon.biology);
                if (taxon.distribution) taxaBody += field('Distribution', taxon.distribution);
                if (taxon.confusables.length > 0) {
                    taxaBody += `\\noindent\\textbf{Confusable species:}\\par\n`;
                    taxaBody += `\\begin{itemize}\n`;
                    taxon.confusables.forEach(c => {
                        const dist = c.distinction ? ` --- ${escapeLaTeX(c.distinction)}` : '';
                        taxaBody += `  \\item ${escapeLaTeX(c.name)}${dist}\n`;
                    });
                    taxaBody += `\\end{itemize}\n`;
                }

                taxaBody += `\\vspace{0.8em}\n\n`;
            });

            taxaSection = `\\newpage\n\\section*{Taxa}\n${taxaBody}`;
        }

        // --- DOCUMENT LAYOUT BUILD ---
        const latexDocument = `% =========================================================================
% LaTeX Dichotomous Key Export
% Companion Directory Configuration Notice:
% Create a directory called "figures/" alongside this file and ensure 
% your referenced image filenames match exactly to build the final document.
% =========================================================================

\\documentclass[11pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{geometry}
\\geometry{a4paper, margin=1in}
\\usepackage{parskip}
\\usepackage{graphicx} % Package to handle external image file parsing natively

\\title{\\textbf{${escapeLaTeX(title)}}}
\\date{\\today}
\\author{}

\\begin{document}

\\maketitle

\\section*{Identification Key}
\\label{sec:key}
${mainContent}
${taxaSection}
${figuresAppendix}
\\end{document}`;

        triggerFileDownload(latexDocument, sanitizeFilename(title, '.tex'), 'application/x-latex;charset=utf-8;');

        if (problematicFilenames.length > 0) {
            showToast(
                `⚠️ ${problematicFilenames.length} image filename(s) contain spaces, multiple dots, or LaTeX-special characters ({ } % # \\) and may fail to compile. Rename the image file(s) to match: ${problematicFilenames.join(', ')}`,
                'error'
            );
        }

    } catch (error) {
        console.error('LaTeX Export system failure:', error);
        showToast('❌ An unexpected error disrupted the LaTeX document generation pipeline.', 'error');
    }
}