# Third-party notices

TSKey's PDF import feature distributes the following browser-side components so that PDF extraction and OCR do not require a CDN request. Package versions are pinned in `package-lock.json`.

## PDF.js

- Package: `pdfjs-dist` 6.1.200
- Source: <https://github.com/mozilla/pdf.js>
- License: Apache License 2.0
- Distributed assets: character maps, standard fonts, ICC profiles, and WASM helpers under `public/vendor/pdfjs/`; the PDF worker is emitted by Vite from the pinned package.
- License copy: `public/vendor/pdfjs/LICENSE`

## Tesseract.js

- Package: `tesseract.js` 7.0.0
- Source: <https://github.com/naptha/tesseract.js>
- License: Apache License 2.0
- Distributed asset: browser worker under `public/vendor/tesseract/`.
- Bundler notices: `public/vendor/tesseract/worker.min.js.LICENSE.txt`

## Tesseract.js Core

- Package: `tesseract.js-core` 7.0.0 (a dependency of Tesseract.js)
- Source: <https://github.com/naptha/tesseract.js-core>
- License: Apache License 2.0
- Distributed assets: baseline, SIMD, and relaxed-SIMD browser core variants, with LSTM and compatibility variants, under `public/vendor/tesseract/core/`.
- License copy: `public/vendor/tesseract/core/LICENSE`

## English OCR language data

- Package: `@tesseract.js-data/eng` 1.0.0
- Source: <https://github.com/naptha/tessdata>
- Package license: MIT
- Distributed asset: `4.0.0_best_int/eng.traineddata.gz`, copied to `public/vendor/tesseract/lang/eng.traineddata.gz`.

The notices above do not replace the full license texts shipped with their respective packages and assets.
