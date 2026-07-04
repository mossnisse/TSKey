import { defineConfig } from 'vite';

export default defineConfig(({ command, isPreview }) => ({
  // Production build (and `vite preview` of it) keeps the GitHub Pages sub-path; only
  // the dev server is served at the root so the Claude preview (and a plain browser)
  // opens straight to the app. `vite preview` also runs with command === 'serve', so
  // it must be excluded via isPreview or it would serve /TSKey/-built assets at '/'.
  base: command === 'serve' && !isPreview ? '/' : '/TSKey/', // deployed at https://mossnisse.github.io/TSKey/
  // Single entry point: Vite defaults to the root index.html (the main app).
  server: {
    port: 5173,
    // Fail loudly if 5173 is taken instead of silently drifting to 5174/5175 — a
    // drifted port no longer matches .claude/launch.json, which breaks the preview.
    strictPort: true,
  },
}));
