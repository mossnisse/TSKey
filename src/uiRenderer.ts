// uiRenderer.ts
// Barrel for the UI render modules in ui/. Kept so existing import sites
// (main.ts, the event modules, exporters) stay stable while the rendering code is
// split by concern: shell, menu, project hub, editor cards, figures, print view, toast.
export { initializeShell, applyPanelVisibility } from './ui/shell.ts';
export { renderMenu } from './ui/menu.ts';
export { renderProjectHubList } from './ui/projectHub.ts';
export { renderEditorCards } from './ui/editorCards.ts';
export { renderFigures } from './ui/figures.ts';
export { renderPrintView } from './ui/printView.ts';
export { showToast } from './ui/toast.ts';