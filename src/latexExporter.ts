// latexExporter.ts
import type { KeyStore } from './store.ts';
import { getStepNumberById } from './utils.ts';

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

export function exportKeyToLaTeX(store: KeyStore): void {
    const key = store.getKey();
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
            const step1Dest = getStepNumberById(key, c.link1);
            const step2Dest = getStepNumberById(key, c.link2);

            const end1 = c.taxa1
                ? `\\textbf{\\textit{${escapeLaTeX(c.taxa1)}}}`
                : (c.link1 ? `\\textbf{${step1Dest}}` : `\\dots`);

            const end2 = c.taxa2
                ? `\\textbf{\\textit{${escapeLaTeX(c.taxa2)}}}`
                : (c.link2 ? `\\textbf{${step2Dest}}` : `\\dots`);

            const alt1Text = escapeLaTeX(c.alt1);
            const alt2Text = escapeLaTeX(c.alt2);

            // 💡 FIX: Wrap the entire couplet in a scoped block with \interlinepenalty=10000
            // This prevents breaks INSIDE multi-line alternatives, while \nopagebreak prevents breaks BETWEEN them.
            bodyContent += `{\\interlinepenalty=10000\n`;
            bodyContent += `\\noindent\\hangindent=2.5em\\hangafter=1\\makebox[2.5em][l]{\\textbf{${currentDisplayNum}.}}${alt1Text} \\dotfill ${end1}\\par\\nopagebreak\n`;
            bodyContent += `\\noindent\\hangindent=2.5em\\hangafter=1\\makebox[2.5em][l]{\\textemdash}${alt2Text} \\dotfill ${end2}\\par}\n`;
            
            // The spacing remains OUTSIDE the atomic block, allowing natural page-breaks BETWEEN different couplets.
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

    // Normalize and trigger pipeline
    const normalizedLines = latexDocument.replace(/\r\n/g, '\n');
    const blob = new Blob([normalizedLines], { type: 'application/x-latex;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = 'dichotomous_key.tex';

    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();

    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);
}