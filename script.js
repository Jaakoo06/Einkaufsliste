(() => {
  const stateKey = 'besorgungen-checklist-v1';
  const customItemsKey = 'besorgungen-custom-items-v1';
  const checklistFor = group => document.querySelector(`[data-group="${group}"] .checklist`);

  function readStorage(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function saveState() {
    try {
      const state = {};
      document.querySelectorAll('input[type="checkbox"][data-id]').forEach(box => {
        state[box.dataset.id] = box.checked;
      });
      localStorage.setItem(stateKey, JSON.stringify(state));
    } catch {
      // Die Liste bleibt auch ohne verfügbaren Speicher bedienbar.
    }
  }

  function saveCustomItems(items) {
    try {
      localStorage.setItem(customItemsKey, JSON.stringify(items));
    } catch {
      // Die Liste bleibt auch ohne verfügbaren Speicher bedienbar.
    }
  }

  function makeCustomItem(item) {
    const li = document.createElement('li');
    li.className = 'custom-list-item';
    li.dataset.customId = item.id;

    const row = document.createElement('div');
    row.className = 'item-row';
    const label = document.createElement('label');
    label.className = 'item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.id = item.id;
    checkbox.checked = Boolean(item.checked);
    checkbox.addEventListener('change', () => {
      const savedItem = customItems.find(entry => entry.id === item.id);
      if (savedItem) savedItem.checked = checkbox.checked;
      saveCustomItems(customItems);
      saveState();
      updateProgress();
    });

    const check = document.createElement('span');
    check.className = 'custom-check';
    const name = document.createElement('span');
    name.className = 'item-name';
    name.textContent = item.title;
    label.append(checkbox, check, name);
    row.append(label);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-item';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `„${item.title}“ entfernen`);
    remove.addEventListener('click', () => {
      customItems = customItems.filter(entry => entry.id !== item.id);
      saveCustomItems(customItems);
      li.remove();
      saveState();
      updateProgress();
    });
    row.append(remove);
    li.append(row);

    if (item.subtitle) {
      const note = document.createElement('span');
      note.className = 'item-note';
      note.textContent = item.subtitle;
      li.append(note);
    }
    return li;
  }

  let customItems = readStorage(customItemsKey, []);
  if (!Array.isArray(customItems)) customItems = [];
  customItems.forEach(item => {
    const list = checklistFor(item.group);
    if (list) list.append(makeCustomItem(item));
  });

  const savedState = readStorage(stateKey, {});
  document.querySelectorAll('input[type="checkbox"][data-id]').forEach(box => {
    if (!box.closest('.custom-list-item')) box.checked = Boolean(savedState[box.dataset.id]);
    box.addEventListener('change', () => {
      saveState();
      updateProgress();
    });
  });

  document.querySelectorAll('[data-add-form]').forEach(form => {
    form.addEventListener('submit', event => {
      event.preventDefault();
      const title = form.elements.title.value.trim();
      const subtitle = form.elements.subtitle.value.trim();
      if (!title) return;

      const group = form.dataset.addForm;
      const id = globalThis.crypto?.randomUUID?.() || `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const item = { id, group, title, subtitle, checked: false };
      customItems = readStorage(customItemsKey, []);
      if (!Array.isArray(customItems)) customItems = [];
      customItems.push(item);
      saveCustomItems(customItems);
      const list = checklistFor(group);
      if (list) list.append(makeCustomItem(item));
      form.reset();
      form.elements.title.focus();
      saveState();
      updateProgress();
    });
  });

  document.getElementById('reset-button').addEventListener('click', () => {
    document.querySelectorAll('input[type="checkbox"][data-id]').forEach(box => { box.checked = false; });
    customItems = customItems.map(item => ({ ...item, checked: false }));
    saveCustomItems(customItems);
    saveState();
    updateProgress();
  });

  function updateProgress() {
    const boxes = [...document.querySelectorAll('input[type="checkbox"][data-id]')];
    const checked = boxes.filter(box => box.checked).length;
    const total = boxes.length;
    const percent = total ? Math.round((checked / total) * 100) : 0;
    document.getElementById('progress-count').textContent = `${checked} von ${total} erledigt`;
    document.getElementById('progress-percent').textContent = `${percent}%`;
    document.getElementById('progress-fill').style.width = `${percent}%`;
    document.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', String(percent));

    document.querySelectorAll('[data-count-for]').forEach(count => {
      const groupBoxes = boxes.filter(box => box.closest('[data-group]')?.dataset.group === count.dataset.countFor);
      count.textContent = `${groupBoxes.filter(box => box.checked).length} / ${groupBoxes.length}`;
    });
  }

  updateProgress();
})();
