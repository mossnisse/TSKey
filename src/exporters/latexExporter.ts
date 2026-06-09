// latexExporter.ts
import type { KeyStore } from '../store.ts';
import { getStepNumberById, triggerFileDownload, buildIdToIndexMap } from '../utils.ts';
import { showToast } from '../uiRenderer.ts';

/**
 * Escapes characters that have active syntactical meaning inside LaTeX compilers.
 */
function escapeLaTeX(str: string): string {
    if (!str) return '';
    return str
        .replace(/[\r\n]+/g, ' ')
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/([&%$#_{}])/g, '\\$1')
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}')
        .replace(/</g, '\\textless{}')
        .replace(/>/g, '\\textgreater{}');
}

/**
 * Compiles the current KeyStore state into a valid standalone LaTeX structure,
 * handling file serialization with async macro-task resource allocation rules.
 */
export function exportKeyToLaTeX(store: KeyStore): void {

    try {
        const key = store.getKey();
        const idToIndexMap = buildIdToIndexMap(key);
        let mainContent = '';

        if (key.length === 0) {
            mainContent = `
\\begin{center}
  \\vspace*{2cm}
  \\textit{\\small [The identification key is currently empty. Please add couplets in the editor to populate this document.]}
\\end{center}`;
        } else {
            let bodyContent = '';
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

                const alt1Text = escapeLaTeX(c.alt1);
                const alt2Text = escapeLaTeX(c.alt2);

                // Scoped block formatting using your atomic grouping parameters
                bodyContent += `{\\interlinepenalty=10000\n`;
                bodyContent += `\\noindent\\hangindent=2.5em\\hangafter=1\\makebox[2.5em][l]{\\textbf{${currentDisplayNum}.}}${alt1Text} \\dotfill ${end1}\\par\\nopagebreak\n`;
                bodyContent += `\\noindent\\hangindent=2.5em\\hangafter=1\\makebox[2.5em][l]{\\textemdash}${alt2Text} \\dotfill ${end2}\\par}\n`;
                bodyContent += `\\vspace{0.6em}\n\n`;
            });

            mainContent = `
{
\\setlength{\\parfillskip}{0pt}
${bodyContent}
\\par
}`;
        }

        const latexDocument = `\\documentclass[11pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{geometry}
\\geometry{a4paper, margin=1in}
\\usepackage{parskip}

\\title{\\textbf{Dichotomous Key Publication}}
\\date{\\today}
\\author{}

\\begin{document}

\\maketitle

\\section*{Identification Key}
\\label{sec:key}
${mainContent}

\\end{document}`;

        triggerFileDownload(latexDocument, 'dichotomous_key.tex', 'application/x-latex;charset=utf-8;');

    } catch (error) {
        console.error('LaTeX Export system failure:', error);
        showToast('❌ An unexpected error disrupted the LaTeX document generation pipeline.', 'error');
    }
}