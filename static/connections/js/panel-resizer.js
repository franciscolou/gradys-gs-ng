// Lets the user drag the handle between the map and log panels to resize them.
// Self-contained: does not read or write any state main.js/gmap.js depend on.
(function () {
  const resizer = document.getElementById('row-resizer');
  const pageContainer = document.querySelector('.page-container');
  if (!resizer || !pageContainer) return;

  const STORAGE_KEY = 'gs-map-log-split';
  const MIN_ROW_PX = 120;
  let dragging = false;

  function applySplit(mapRatio) {
    pageContainer.style.setProperty('--row-map', `${mapRatio}fr`);
    pageContainer.style.setProperty('--row-log', `${1 - mapRatio}fr`);
  }

  function restoreSplit() {
    const stored = parseFloat(localStorage.getItem(STORAGE_KEY));
    if (!Number.isNaN(stored) && stored > 0 && stored < 1) {
      applySplit(stored);
    }
  }

  function onPointerDown(event) {
    dragging = true;
    resizer.classList.add('is-dragging');
    resizer.setPointerCapture(event.pointerId);
    document.body.style.userSelect = 'none';
  }

  function onPointerMove(event) {
    if (!dragging) return;

    const containerRect = pageContainer.getBoundingClientRect();
    const resizerHeight = resizer.getBoundingClientRect().height;
    const usableHeight = containerRect.height - resizerHeight;
    const offsetY = event.clientY - containerRect.top;

    const clampedOffset = Math.min(Math.max(offsetY, MIN_ROW_PX), usableHeight - MIN_ROW_PX);
    const mapRatio = clampedOffset / usableHeight;

    applySplit(mapRatio);
    localStorage.setItem(STORAGE_KEY, mapRatio.toFixed(4));
  }

  function onPointerUp(event) {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('is-dragging');
    resizer.releasePointerCapture(event.pointerId);
    document.body.style.userSelect = '';
  }

  restoreSplit();
  resizer.addEventListener('pointerdown', onPointerDown);
  resizer.addEventListener('pointermove', onPointerMove);
  resizer.addEventListener('pointerup', onPointerUp);
})();
