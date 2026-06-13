// latexExporter.ts
import type { KeyStore } from '../store.ts';
import { triggerFileDownload, getStepNumberById, buildIdToIndexMap, buildFigureIdToDisplayNumMap } from '../utils.ts';
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
 * Compiles the current KeyStore state into a valid standalone LaTeX structure
 * using the Companion Directory Approach for figures, creating a dedicated
 * column on the right for figure references.
 */
export function exportKeyToLaTeX(store: KeyStore): void {

    try {
        const key = store.getKey();
        const figures = store.getFigures();
        const idToIndexMap = buildIdToIndexMap(key);
        const figureIdToDisplayNum = buildFigureIdToDisplayNumMap(figures);

        let mainContent = '';

        if (key.length === 0) {
            mainContent = `
\\begin{center}
  \\vspace*{2cm}
  \\textit{\\small [The identification key is currently empty. Please add couplets in the editor to populate this document.]}
\\end{center}`;
        } else {
            let bodyContent = '';

            // --- COLUMN HEADERS ---
            bodyContent += `\\noindent\\makebox[2.5em][l]{\\textbf{No.}}\\textbf{Description} \\hfill \\makebox[8em][l]{\\textbf{Figures}} \\makebox[12em][r]{\\textbf{Destination}}\\par\n`;
            bodyContent += `\\rule{\\linewidth}{0.5pt}\\vspace{0.6em}\\par\n\n`;

            // --- KEY COUPLETS LOOP ---
            key.forEach((c, index) => {
                const currentDisplayNum = index + 1;
                const step1Dest = getStepNumberById(idToIndexMap, c.link1);
                const step2Dest = getStepNumberById(idToIndexMap, c.link2);

                // Guard against structural 'INVALID ID' fragments slipping into text fields
                const end1 = c.taxa1
                    ? `\\textbf{\\textit{${escapeLaTeX(c.taxa1)}}}`
                    : (c.link1 && step1Dest !== 'INVALID ID' ? `\\textbf{${step1Dest}}` : `\\dots`);

                const end2 = c.taxa2
                    ? `\\textbf{\\textit{${escapeLaTeX(c.taxa2)}}}`
                    : (c.link2 && step2Dest !== 'INVALID ID' ? `\\textbf{${step2Dest}}` : `\\dots`);

                // Escape text strings first to keep figure macros intact for regex token processing
                let alt1Text = escapeLaTeX(c.alt1);
                let alt2Text = escapeLaTeX(c.alt2);

                const figLabels1: string[] = [];
                const figLabels2: string[] = [];

                // Resolve inline figure reference macros for alternative choice 1
                alt1Text = alt1Text.replace(/\[figID:\s*(\d+)\s*\]/gi, (match, idStr) => {
                    const id = parseInt(idStr, 10);
                    const displayNum = figureIdToDisplayNum.get(id);
                    if (displayNum !== undefined) {
                        figLabels1.push(`Fig.~${displayNum}`);
                        return `(Fig.~${displayNum})`;
                    }
                    return match;
                });

                // Resolve inline figure reference macros for alternative choice 2
                alt2Text = alt2Text.replace(/\[figID:\s*(\d+)\s*\]/gi, (match, idStr) => {
                    const id = parseInt(idStr, 10);
                    const displayNum = figureIdToDisplayNum.get(id);
                    if (displayNum !== undefined) {
                        figLabels2.push(`Fig.~${displayNum}`);
                        return `(Fig.~${displayNum})`;
                    }
                    return match;
                });

                const figText1 = figLabels1.length > 0 ? figLabels1.join(', ') : '';
                const figText2 = figLabels2.length > 0 ? figLabels2.join(', ') : '';

                // Scoped block formatting using structural column macro configurations
                bodyContent += `{\\interlinepenalty=10000\n`;
                bodyContent += `\\noindent\\hangindent=2.5em\\hangafter=1\\makebox[2.5em][l]{\\textbf{${currentDisplayNum}.}}${alt1Text} \\dotfill \\makebox[8em][l]{${figText1}} \\makebox[12em][r]{${end1}}\\par\\nopagebreak\n`;
                bodyContent += `\\noindent\\hangindent=2.5em\\hangafter=1\\makebox[2.5em][l]{\\textemdash}${alt2Text} \\dotfill \\makebox[8em][l]{${figText2}} \\makebox[12em][r]{${end2}}\\par}\n`;
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
        let figuresAppendix = '';
        if (figures.length > 0) {
            figuresAppendix += `\\newpage\n\\section*{Figures Appendix}\n`;
            figuresAppendix += `\\textit{Instructions: Create a folder named \\texttt{figures} in the same directory as this \\texttt{.tex} file, and place the corresponding image files inside it before compiling.}\n\\vspace{1.5em}\n\n`;

            figures.forEach((fig, index) => {
                const displayNum = index + 1;
                const escapedCaption = escapeLaTeX(fig.caption || `Figure ${displayNum}`);

                figuresAppendix += `\\begin{figure}[htbp]\n`;
                figuresAppendix += `  \\centering\n`;

                // Check if a filename actually exists to choose between graphic insertion or textual fallback
                if (fig.filename && fig.filename.trim()) {
                    figuresAppendix += `  \\includegraphics[width=0.7\\linewidth]{figures/${fig.filename.trim()}}\n`;
                } else {
                    // Generates a structured layout box placeholder directly avoiding compilation file-missing breaks
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

\\title{\\textbf{Dichotomous Key Publication}}
\\date{\\today}
\\author{}

\\begin{document}

\\maketitle

\\section*{Identification Key}
\\label{sec:key}
${mainContent}
${figuresAppendix}
\\end{document}`;

        triggerFileDownload(latexDocument, 'dichotomous_key.tex', 'application/x-latex;charset=utf-8;');

    } catch (error) {
        console.error('LaTeX Export system failure:', error);
        showToast('❌ An unexpected error disrupted the LaTeX document generation pipeline.', 'error');
    }
}