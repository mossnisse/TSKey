import { DEFAULT_PARSE_OPTIONS, parseLeadMarker } from '../plainTextImporter.ts';

export interface TextQuality {
    usable: boolean;
    nonWhitespace: number;
    printableRatio: number;
    alphanumericRatio: number;
    hasLeadMarker: boolean;
}

/** Conservative embedded-text check. Borderline pages can always be force-OCRed. */
export function assessTextQuality(text: string): TextQuality {
    const chars = [...text];
    const nonWhitespaceChars = chars.filter(char => !/\s/u.test(char));
    const nonWhitespace = nonWhitespaceChars.length;
    const printable = nonWhitespaceChars.filter(char => !/[\u0000-\u001f\u007f-\u009f�]/u.test(char)).length;
    const alphanumeric = nonWhitespaceChars.filter(char => /[\p{L}\p{N}]/u.test(char)).length;
    const printableRatio = nonWhitespace ? printable / nonWhitespace : 0;
    const alphanumericRatio = nonWhitespace ? alphanumeric / nonWhitespace : 0;
    const hasLeadMarker = text.split(/\r?\n/).some(line => parseLeadMarker(line, DEFAULT_PARSE_OPTIONS) !== null);
    const usable = hasLeadMarker
        || (nonWhitespace >= 24 && printableRatio >= 0.9 && alphanumericRatio >= 0.5);
    return { usable, nonWhitespace, printableRatio, alphanumericRatio, hasLeadMarker };
}
