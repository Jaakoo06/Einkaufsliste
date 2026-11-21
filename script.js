(() => {
  const storageKey = 'besorgungen-checklist-v1';
  const boxes = [...document.querySelectorAll('input[type="checkbox"][data-id]')];
  const countEl = document.getElementById('progress-count');
  const percentEl = document.getElementById('progress-percent');
  const fillEl = document.getElementById('progress-fill');
  const progressBar = document.querySelector('[role="progressbar"]');

  function readSaved() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function save() {
    try {
      const state = Object.fromEntries(boxes.map(box => [box.dataset.id, box.checked]));
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // The checklist remains usable if local storage is unavailable.
    }
  }

  function updateProgress() {
    const checked = boxes.filter(box => box.checked).length;
    const total = boxes.length;
    const percent = total ? Math.round((checked / total) * 100) : 0;
    countEl.textContent = `${checked} von ${total} erledigt`;
    percentEl.textContent = `${percent}%`;
    fillEl.style.width = `${percent}%`;
    progressBar.setAttribute('aria-valuenow', String(percent));

    document.querySelectorAll('[data-count-for]').forEach(count => {
      const group = count.dataset.countFor;
      const groupBoxes = boxes.filter(box => box.closest('[data-group]')?.dataset.group === group);
      const groupChecked = groupBoxes.filter(box => box.checked).length;
      count.textContent = `${groupChecked} / ${groupBoxes.length}`;
    });
  }

  const saved = readSaved();
  boxes.forEach(box => {
    box.checked = Boolean(saved[box.dataset.id]);
    box.addEventListener('change', () => {
      save();
      updateProgress();
    });
  });

  document.getElementById('reset-button').addEventListener('click', () => {
    boxes.forEach(box => { box.checked = false; });
    save();
    updateProgress();
  });

  updateProgress();
})();
