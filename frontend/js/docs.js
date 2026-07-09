// Anleitung-Button im Header. Öffnet die statische, im Image gebackene
// Doku unter /docs/ in einem neuen Tab — damit ist die Anleitung immer
// auf demselben Stand wie der laufende Container, ohne Drift gegen die
// Pages-Online-Version.

export function init() {
  document.getElementById('docs-btn').addEventListener('click', () => {
    window.open('/docs/', '_blank', 'noopener,noreferrer');
  });
}
