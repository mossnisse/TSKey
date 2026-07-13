TSKey: A Dichotomous Key Editor  https://mossnisse.github.io/TSKey/

TSKey is an interactive editor designed to build and manage classical taxonomic keys for identifying biological species based on morphological characters. It provides the standard productivity tools expected of a desktop application, including copy-paste and a undo-redo system.

The application dynamically tracks and updates all step numbers and text references. It can systematically reorder steps and figure references for you, completely eliminating the need to manually renumber everything that follows whenever a new couplet or figure is inserted in the middle of a key. TSKey can export your work into standalone LaTeX and HTML files.

## Testing

Run the local test suite with `npm test`. Use `npm run test:watch` while developing,
`npm run test:typecheck` to type-check production and test sources, and
`npm run test:coverage` to generate the HTML coverage report in `coverage/`.
