// latexExporter.ts
import type { KeyStore } from '../store.ts';
import { triggerFileDownload, resolveDestination, buildIdToIndexMap, buildFigureIdToDisplayNumMap, sanitizeFilename, buildCoupletLeads, buildBackReferenceMap, buildTaxaContext } from '../utils.ts';
import type { LeadFormat, NameDisplayMode } from '../utils.ts';
import { figIdTokenRegex } from '../figureTokens.ts';
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

/**
 * Compiles the current KeyStore state into a valid standalone LaTeX structure
 * using classic inline notation and dot leaders to prevent layout overlap.
 */
export function exportKeyToLaTeX(store: KeyStore, leadFormat: LeadFormat, showBackReference: boolean, nameMode: NameDisplayMode): void {

    try {
        const key = store.getKey();
        const figures = store.getFigures();
        const title = store.getTitle();
        const idToIndexMap = buildIdToIndexMap(key);
        const figureIdToDisplayNum = buildFigureIdToDisplayNumMap(figures);
        const backRefMap = showBackReference ? buildBackReferenceMap(key) : null;
        const taxaCtx = buildTaxaContext(store.getTaxa(), nameMode);
        // The back-reference widens the lead ("2 (1)"), so give the fixed box and
        // matching hang-indent extra room to avoid overprinting the diagnosis text.
        const leadWidth = showBackReference ? '4.5em' : '2.5em';

        // Converts stored [figID: N] tokens in already-escaped text into inline (Fig.~N)
        // citations. Escaping leaves the digit-only tokens intact for this pass.
        const figIdRegex = figIdTokenRegex();
        const resolveFigCitations = (escapedText: string): string =>
            escapedText.replace(figIdRegex, (match, idStr) => {
                const id = parseInt(idStr, 10);
                const displayNum = figureIdToDisplayNum.get(id);
                return displayNum !== undefined ? ` (Fig.~${displayNum})` : match;
            });

        let mainContent = '';

        if (key.length === 0) {
            mainContent = `
\\begin{center}
  \\vspace*{2cm}
  \\textit{\\small [The identification key is currently empty. Please add key steps in the editor to populate this document.]}
\\end{center}`;
        } else {
            let bodyContent = '';

            // --- KEY COUPLETS LOOP ---
            key.forEach((c, index) => {
                const currentDisplayNum = index + 1;

                // Render a destination: italic-bold taxon name, bold step number,
                // or \dots when the branch is empty/broken.
                const renderEnd = (dest: ReturnType<typeof resolveDestination>): string => {
                    // A linked taxon and a not-yet-created draft both render as the name.
                    if (dest.printClass === 'print-dest-taxon' || dest.printClass === 'print-dest-taxon-unlinked') {
                        return `\\mbox{\\textbf{\\textit{${escapeLaTeX(dest.printText)}}}}`;
                    }
                    if (dest.printClass === 'print-dest-strong') {
                        return `\\mbox{\\textbf{${dest.printText}}}`;
                    }
                    return `\\dots`;
                };

                const end1 = renderEnd(resolveDestination(c.branch1, idToIndexMap, taxaCtx));
                const end2 = renderEnd(resolveDestination(c.branch2, idToIndexMap, taxaCtx));

                // Escape text first, then convert [figID: N] tokens into inline (Fig.~N) citations.
                const alt1Text = resolveFigCitations(escapeLaTeX(c.alt1));
                const alt2Text = resolveFigCitations(escapeLaTeX(c.alt2));

                const { lead1, lead2 } = buildCoupletLeads(leadFormat, currentDisplayNum, backRefMap?.get(c.id));

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
                const escapedCaption = escapeLaTeX(fig.caption || `Figure ${displayNum}`);

                figuresAppendix += `\\begin{figure}[htbp]\n`;
                figuresAppendix += `  \\centering\n`;

                const filename = fig.filename.trim();
                if (filename) {
                    // \detokenize keeps the literal filename (so the link still resolves) while
                    // neutralizing catcode-active characters such as underscores.
                    figuresAppendix += `  \\includegraphics[width=0.7\\linewidth]{\\detokenize{figures/${filename}}}\n`;

                    // \detokenize cannot rescue spaces or multiple dots — flag those for the user.
                    if (/\s/.test(filename) || (filename.match(/\./g)?.length ?? 0) > 1) {
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
${figuresAppendix}
\\end{document}`;

        triggerFileDownload(latexDocument, sanitizeFilename(title, '.tex'), 'application/x-latex;charset=utf-8;');

        if (problematicFilenames.length > 0) {
            showToast(
                `⚠️ ${problematicFilenames.length} image filename(s) contain spaces or multiple dots and may fail to compile in LaTeX. Consider renaming: ${problematicFilenames.join(', ')}`,
                'error'
            );
        }

    } catch (error) {
        console.error('LaTeX Export system failure:', error);
        showToast('❌ An unexpected error disrupted the LaTeX document generation pipeline.', 'error');
    }
}