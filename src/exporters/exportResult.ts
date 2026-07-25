// exporters/exportResult.ts
// What an exporter hands back. Exporters are formatters: they turn the document model
// into a file and say what was imperfect about it — they do not decide how (or
// whether) the user is told. A fatal problem throws; the caller that triggered the
// export owns the console log and the notification.

/** Non-fatal problems worth surfacing; empty when the export was clean. */
export type ExportWarnings = string[];
