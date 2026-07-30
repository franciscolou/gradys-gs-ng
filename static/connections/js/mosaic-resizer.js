// Lets the user drag the handle below the Ground station commands section to resize it.
// Mirrors panel-resizer.js's approach but drives a px flex-basis instead of a fr split, since
// the mosaic page is a simple flex column rather than a CSS grid.
(function () {
  const resizer = document.getElementById('commands-row-resizer');
  const section = document.querySelector('.grid-commands-section');
  const page = document.querySelector('.grid-page');
  if (!resizer || !section || !page) return;

  const STORAGE_KEY = 'gs-mosaic-commands-height';
  const MIN_SECTION_HEIGHT = 120;
  const MIN_GRID_HEIGHT = 160;
  let dragging = false;

  function applyHeight(px) {
    page.style.setProperty('--commands-section-height', `${px}px`);
  }

  function restoreHeight() {
    const stored = parseFloat(localStorage.getItem(STORAGE_KEY));
    if (!Number.isNaN(stored) && stored > 0) applyHeight(stored);
  }

  function onPointerDown(event) {
    dragging = true;
    resizer.classList.add('is-dragging');
    resizer.setPointerCapture(event.pointerId);
    document.body.style.userSelect = 'none';
  }

  function onPointerMove(event) {
    if (!dragging) return;

    const sectionRect = section.getBoundingClientRect();
    const pageRect = page.getBoundingClientRect();
    const resizerHeight = resizer.getBoundingClientRect().height;
    const offsetY = event.clientY - sectionRect.top;
    const maxHeight = pageRect.bottom - sectionRect.top - resizerHeight - MIN_GRID_HEIGHT;

    const clamped = Math.min(Math.max(offsetY, MIN_SECTION_HEIGHT), Math.max(maxHeight, MIN_SECTION_HEIGHT));

    applyHeight(clamped);
    localStorage.setItem(STORAGE_KEY, clamped.toFixed(0));
  }

  function onPointerUp(event) {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('is-dragging');
    resizer.releasePointerCapture(event.pointerId);
    document.body.style.userSelect = '';
  }

  restoreHeight();
  resizer.addEventListener('pointerdown', onPointerDown);
  resizer.addEventListener('pointermove', onPointerMove);
  resizer.addEventListener('pointerup', onPointerUp);
})();
