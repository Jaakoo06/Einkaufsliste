import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import {
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc
} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDCXZ9nwqlJy5vNKC3HzPyiakheqCWu6Is',
  authDomain: 'einkaufsliste-aea0a.firebaseapp.com',
  projectId: 'einkaufsliste-aea0a',
  storageBucket: 'einkaufsliste-aea0a.firebasestorage.app',
  messagingSenderId: '997825929248',
  appId: '1:997825929248:web:5310e5de05ed01b9775c45',
  measurementId: 'G-V61604LR8M'
};

const stateKey = 'besorgungen-checklist-v1';
const customItemsKey = 'besorgungen-custom-items-v1';
const allowedGroups = new Set(['dm', 'spar', 'action', 'extra']);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const authForm = document.getElementById('auth-form');
const syncStatus = document.getElementById('sync-status');
const signedInPanel = document.getElementById('signed-in-panel');
const signedInEmail = document.getElementById('signed-in-email');

let currentUser = null;
let currentListRef = null;
let unsubscribeList = null;
let cloudReady = false;
let applyingCloudData = false;
let customItems = readStorage(customItemsKey, []);
if (!Array.isArray(customItems)) customItems = [];

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Cloud sync remains available if browser storage is disabled.
  }
}

function checklistFor(group) {
  if (!allowedGroups.has(group)) return null;
  return document.querySelector(`[data-group="${group}"] .checklist`);
}

function getCurrentListData() {
  const checked = {};
  document.querySelectorAll('input[type="checkbox"][data-id]').forEach(box => {
    checked[box.dataset.id] = box.checked;
  });
  return { checked, customItems };
}

function saveLocalData(data = getCurrentListData()) {
  writeStorage(stateKey, data.checked);
  writeStorage(customItemsKey, data.customItems);
}

function setStatus(message, isError = false) {
  syncStatus.textContent = message;
  syncStatus.classList.toggle('sync-error', isError);
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
    saveList();
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
    li.remove();
    saveList();
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

function renderCustomItems() {
  document.querySelectorAll('.custom-list-item').forEach(item => item.remove());
  customItems.forEach(item => checklistFor(item.group)?.append(makeCustomItem(item)));
}

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

function saveList() {
  updateProgress();
  if (applyingCloudData) return;

  const data = getCurrentListData();
  saveLocalData(data);
  if (!currentUser || !currentListRef || !cloudReady) return;

  setDoc(currentListRef, {
    checked: data.checked,
    customItems: data.customItems,
    updatedAt: serverTimestamp()
  }, { merge: true }).then(() => {
    setStatus('Synchronisiert. Deine Liste ist auf diesem Gerät und in der Cloud gespeichert.');
  }).catch(error => {
    console.error('Cloud-Speichern fehlgeschlagen:', error);
    setStatus('Cloud-Speichern fehlgeschlagen. Prüfe die Firestore-Regeln und deine Verbindung.', true);
  });
}

function applyCloudData(data) {
  applyingCloudData = true;
  const checked = data.checked && typeof data.checked === 'object' ? data.checked : {};
  customItems = Array.isArray(data.customItems)
    ? data.customItems.filter(item => item && typeof item.id === 'string' && typeof item.title === 'string' && allowedGroups.has(item.group))
    : [];

  renderCustomItems();
  document.querySelectorAll('input[type="checkbox"][data-id]').forEach(box => {
    box.checked = Boolean(checked[box.dataset.id]);
  });
  const localData = getCurrentListData();
  saveLocalData(localData);
  updateProgress();
  applyingCloudData = false;
}

function subscribeToUserList(user) {
  if (unsubscribeList) unsubscribeList();
  cloudReady = false;
  currentListRef = doc(db, 'users', user.uid, 'shoppingList', 'main');
  let firstSnapshotHandled = false;

  unsubscribeList = onSnapshot(currentListRef, async snapshot => {
    if (snapshot.exists()) {
      firstSnapshotHandled = true;
      applyCloudData(snapshot.data());
      cloudReady = true;
      setStatus('Synchronisiert. Änderungen erscheinen auch auf deinen anderen Geräten.');
      return;
    }

    if (firstSnapshotHandled) return;
    firstSnapshotHandled = true;
    const localData = {
      checked: readStorage(stateKey, {}),
      customItems: readStorage(customItemsKey, [])
    };
    const safeLocalData = {
      checked: localData.checked && typeof localData.checked === 'object' ? localData.checked : {},
      customItems: Array.isArray(localData.customItems) ? localData.customItems : []
    };
    try {
      await setDoc(currentListRef, {
        ...safeLocalData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Cloud-Initialisierung fehlgeschlagen:', error);
      cloudReady = false;
      setStatus('Konnte die Liste nicht in der Cloud anlegen. Prüfe die Firestore-Regeln.', true);
    }
  }, error => {
    console.error('Cloud-Synchronisierung fehlgeschlagen:', error);
    cloudReady = false;
    setStatus('Synchronisierung fehlgeschlagen. Prüfe die Firestore-Regeln und deine Verbindung.', true);
  });
}

document.querySelectorAll('input[type="checkbox"][data-id]').forEach(box => {
  box.checked = Boolean(readStorage(stateKey, {})[box.dataset.id]);
  box.addEventListener('change', saveList);
});
renderCustomItems();
document.querySelectorAll('[data-add-form]').forEach(form => {
  form.addEventListener('submit', event => {
    event.preventDefault();
    const title = form.elements.title.value.trim();
    const subtitle = form.elements.subtitle.value.trim();
    if (!title) return;

    const id = globalThis.crypto?.randomUUID?.() || `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const item = { id, group: form.dataset.addForm, title, subtitle, checked: false };
    customItems.push(item);
    checklistFor(item.group)?.append(makeCustomItem(item));
    form.reset();
    form.elements.title.focus();
    saveList();
  });
});

document.getElementById('reset-button').addEventListener('click', () => {
  document.querySelectorAll('input[type="checkbox"][data-id]').forEach(box => { box.checked = false; });
  customItems = customItems.map(item => ({ ...item, checked: false }));
  saveList();
});

authForm.addEventListener('submit', async event => {
  event.preventDefault();
  const email = authForm.elements.email.value.trim();
  const password = authForm.elements.password.value;
  const action = event.submitter?.value || 'signin';
  const buttons = [...authForm.querySelectorAll('button')];
  buttons.forEach(button => { button.disabled = true; });
  setStatus(action === 'signup' ? 'Konto wird erstellt …' : 'Anmeldung läuft …');

  try {
    if (action === 'signup') {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    authForm.reset();
  } catch (error) {
    console.error('Anmeldung fehlgeschlagen:', error);
    const messages = {
      'auth/email-already-in-use': 'Für diese E-Mail gibt es bereits ein Konto. Melde dich an.',
      'auth/invalid-credential': 'E-Mail oder Passwort stimmt nicht.',
      'auth/invalid-email': 'Bitte gib eine gültige E-Mail-Adresse ein.',
      'auth/weak-password': 'Das Passwort muss mindestens 6 Zeichen lang sein.',
      'auth/operation-not-allowed': 'Aktiviere E-Mail/Passwort in den Firebase-Anmeldemethoden.'
    };
    setStatus(messages[error.code] || `Anmeldung fehlgeschlagen: ${error.message}`, true);
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
});

document.getElementById('signout-button').addEventListener('click', async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Abmelden fehlgeschlagen:', error);
    setStatus('Abmelden fehlgeschlagen. Bitte versuche es erneut.', true);
  }
});

onAuthStateChanged(auth, user => {
  currentUser = user;
  authForm.hidden = Boolean(user);
  signedInPanel.hidden = !user;

  if (unsubscribeList) {
    unsubscribeList();
    unsubscribeList = null;
  }
  currentListRef = null;
  cloudReady = false;

  if (user) {
    signedInEmail.textContent = user.email || 'Angemeldet';
    setStatus('Verbinde deine Liste mit der Cloud …');
    subscribeToUserList(user);
  } else {
    signedInEmail.textContent = '';
    setStatus('Melde dich an oder erstelle ein Konto, um deine Liste auf mehreren Geräten zu nutzen.');
  }
});

updateProgress();
