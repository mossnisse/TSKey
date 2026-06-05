// latexExporter.ts
import type { KeyStore } from './store.ts';
import { getStepNumberById } from './uiRenderer.ts';

/**
 * Escapes characters that have active syntactical meaning inside LaTeX compilers.
 */
function escapeLaTeX(str: string): string {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/([&%$#_{}])/g, '\\$1')
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}')
        .replace(/</g, '\\textless{}')
        .replace(/>/g, '\\textgreater{}');
}

/**
 * Compiles KeyStore data into a beautifully aligned academic LaTeX document.
 */
/*
export function exportKeyToLaTeX(store: KeyStore): void {
    const key = store.getKey();
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

        const alt1Text = escapeLaTeX(c.alt1) || '\\underline{\\hspace{2cm}}';
        const alt2Text = escapeLaTeX(c.alt2) || '\\underline{\\hspace{2cm}}';

        bodyContent += `\\noindent\\hangindent=2.5em\\hangafter=1\\makebox[2.5em][l]{\\textbf{${currentDisplayNum}.}}${alt1Text} \\dotfill ${end1}\\par\\nopagebreak\n`;
        bodyContent += `\\noindent\\hangindent=2.5em\\hangafter=1\\makebox[2.5em][l]{\\textemdash}${alt2Text} \\dotfill ${end2}\\par\\vspace{0.6em}\n\n`;
    });

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

${bodyContent}
\\end{document}`;

    // Initialize download pipeline
    const blob = new Blob([latexDocument], { type: 'application/x-latex;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = 'dichotomous_key.tex';
    
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);
}*/

export function exportKeyToLaTeX(store: KeyStore): void {
    const key = store.getKey();
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

        const alt1Text = escapeLaTeX(c.alt1) || '\\underline{\\hspace{2cm}}';
        const alt2Text = escapeLaTeX(c.alt2) || '\\underline{\\hspace{2cm}}';

        bodyContent += `\\noindent\\hangindent=2.5em\\hangafter=1\\makebox[2.5em][l]{\\textbf{${currentDisplayNum}.}}${alt1Text} \\dotfill ${end1}\\par\\nopagebreak\n`;
        
        bodyContent += `\\noindent\\hangindent=2.5em\\hangafter=1\\makebox[2.5em][l]{\\textemdash}${alt2Text} \\dotfill ${end2}\\par\\vspace{0.6em}\n\n`;
    });

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

% Safeguard: Forces the dotfill layout engine to fill the line width entirely.
% If a line wraps right before a destination number, the dots will fill the 
% new line from the left margin, pushing the number flush to the right border.
\\setlength{\\parfillskip}{0pt}

${bodyContent}
\\end{document}`;

    // Initialize download pipeline
    const blob = new Blob([latexDocument], { type: 'application/x-latex;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = 'dichotomous_key.tex';
    
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);
}