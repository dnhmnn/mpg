// ========================================
// PATIENTENDOKUMENTATION-DATEIEN.JS
// Komplettes JavaScript für die Dokumentenverwaltung
// ========================================

// ========================================
// SECTION: POCKETBASE INITIALIZATION & AUTH
// ========================================
const pb = new PocketBase(‘https://api.responda.systems’);

// Check if user is logged in
if (!pb.authStore.isValid) {
location.href = “/mpg-login.html”;
}

const currentUser = pb.authStore.model;
if (!currentUser || !currentUser.organization_id) {
location.href = “/mpg-login.html”;
}

// Load organization data
let currentOrganization = { name: ‘Feuerwehr’ }; // Default fallback

async function loadOrganization() {
try {
if (!currentUser.organization_id) {
console.warn(‘⚠️ User has no organization_id’);
return;
}
currentOrganization = await pb.collection(‘organizations’).getOne(currentUser.organization_id);
console.log(‘✅ Organization loaded:’, currentOrganization);
} catch(e) {
console.warn(‘⚠️ Could not load organization, using fallback:’, e.message);
}
}

// Start loading (non-blocking)
loadOrganization();

// ========================================
// SECTION: LOGOUT HANDLER
// ========================================
document.getElementById(“logout”).onclick = async (e) => {
e.preventDefault();
pb.authStore.clear();
localStorage.clear();
location.href = “/mpg-login.html”;
};

// ========================================
// SECTION: TAB SWITCHING
// ========================================
document.querySelectorAll(’.tab’).forEach(tab => {
tab.onclick = () => {
const targetTab = tab.dataset.tab;
document.querySelectorAll(’.tab’).forEach(t => t.classList.remove(‘active’));
tab.classList.add(‘active’);
document.querySelectorAll(’.tab-content’).forEach(tc => tc.style.display = ‘none’);
document.getElementById(‘tab-’ + targetTab).style.display = ‘block’;
document.getElementById(‘msg’).textContent = ‘’;
};
});

// ========================================
// SECTION: UTILITY FUNCTIONS
// ========================================
function showMsg(text, type = ‘success’) {
const msgDiv = document.getElementById(‘msg’);
msgDiv.textContent = text;
msgDiv.className = ’msg ’ + type;
setTimeout(() => {
msgDiv.textContent = ‘’;
msgDiv.className = ‘msg’;
}, 5000);
}

function calculateGCS(p) {
const e = parseInt(p.gcs_e || 0);
const v = parseInt(p.gcs_v || 0);
const m = parseInt(p.gcs_m || 0);
const sum = e + v + m;
return sum > 0 ? sum : ‘—’;
}

function calculateQSOFA(p) {
const gcs = parseInt(p.gcs_e || 0) + parseInt(p.gcs_v || 0) + parseInt(p.gcs_m || 0);
const af = parseInt(p.af || 0);
const rrSys = parseInt(p.rr_sys || 0);
let score = 0;
if (gcs > 0 && gcs < 15) score++;
if (af >= 22) score++;
if (rrSys > 0 && rrSys <= 100) score++;
return (gcs > 0 || af > 0 || rrSys > 0) ? score : ‘—’;
}

// ========================================
// SECTION: LOAD DATA FROM DATABASE
// ========================================
async function loadData() {
try {
// Load open patient documents
const patData = await pb.collection(‘patients’).getFullList({
filter: `status = "offen" && organization_id = "${currentUser.organization_id}"`,
sort: ‘-created’,
});

```
const patRows = document.getElementById('pat-rows');
patRows.innerHTML = patData.map(doc => {
  const payload = doc.payload || {};
  const patName = `${payload.vorname || ''} ${payload.name || ''}`.trim() || 'Unbekannt';
  return `
  <div class="doc-card" onclick="editPatDoc('${doc.id}')">
    <div class="doc-header">
      <span class="pill offen">Offen</span>
      <span class="doc-title">${doc.title || patName}</span>
    </div>
    <div class="doc-meta">
      ${payload.einsatz_nr ? 'Einsatz-Nr: ' + payload.einsatz_nr + ' · ' : ''}
      ${new Date(doc.created).toLocaleString('de-DE')}
    </div>
  </div>
`;
}).join('') || '<p style="padding:20px;color:#fff;opacity:0.7">Keine offenen Patientendokus</p>';

// Load open Nacherfassungen
const nachData = await pb.collection('patient_docs_nacherfassung').getFullList({
  filter: `status = "offen" && organization_id = "${currentUser.organization_id}"`,
  sort: '-created',
});

const nachRows = document.getElementById('nach-rows');
nachRows.innerHTML = nachData.map(doc => `
  <div class="doc-card">
    <div class="doc-header">
      <span class="pill offen">Offen</span>
      <span class="doc-title">${doc.stichwort || 'Ohne Stichwort'}</span>
    </div>
    <div class="doc-meta">
      von ${doc.nacherfasst_von_name || '?'} · 
      ${new Date(doc.created).toLocaleString('de-DE')}
    </div>
    <div class="doc-actions">
      <button class="doc-btn" onclick="event.stopPropagation(); viewNach('${doc.id}')">
        <i class="fa-solid fa-eye"></i> Details
      </button>
      <button class="doc-btn" onclick="event.stopPropagation(); archiveNach('${doc.id}')">
        <i class="fa-solid fa-box-archive"></i> Archivieren
      </button>
    </div>
  </div>
`).join('') || '<p style="padding:20px;color:#fff;opacity:0.7">Keine offenen Nacherfassungen</p>';

// Load archived patient documents
const archivPat = await pb.collection('patients').getFullList({
  filter: `status = "archiviert" && organization_id = "${currentUser.organization_id}"`,
  sort: '-updated',
});

// Load archived Nacherfassungen
const archivNach = await pb.collection('patient_docs_nacherfassung').getFullList({
  filter: `status = "archiviert" && organization_id = "${currentUser.organization_id}"`,
  sort: '-updated',
});

const archivRows = document.getElementById('archiv-rows');
let archivHTML = '';

archivPat.forEach(doc => {
  const payload = doc.payload || {};
  const patName = `${payload.vorname || ''} ${payload.name || ''}`.trim() || doc.title || 'Ohne Titel';
  archivHTML += `
    <div class="doc-card" onclick="viewPatArchiv('${doc.id}')">
      <div class="doc-header">
        <span class="pill archiviert">Patientendoku</span>
        <span class="doc-title">${patName}</span>
      </div>
      <div class="doc-meta">
        ${payload.einsatz_nr ? 'Einsatz-Nr: ' + payload.einsatz_nr + ' · ' : ''}
        MPG-Verantwortlicher: ${doc.admin_name || '?'} · 
        ${doc.admin_datum ? new Date(doc.admin_datum).toLocaleString('de-DE') : ''}
      </div>
    </div>
  `;
});

archivNach.forEach(doc => {
  archivHTML += `
    <div class="doc-card" onclick="viewNachArchiv('${doc.id}')">
      <div class="doc-header">
        <span class="pill archiviert">Nacherfassung</span>
        <span class="doc-title">${doc.stichwort || 'Ohne Titel'}</span>
      </div>
      <div class="doc-meta">von ${doc.nacherfasst_von_name || '?'}</div>
    </div>
  `;
});

archivRows.innerHTML = archivHTML || '<p style="padding:20px;color:#fff;opacity:0.7">Kein Archiv vorhanden</p>';
```

} catch(e) {
showMsg(’Fehler beim Laden: ’ + e.message, ‘error’);
}
}

// ========================================
// SECTION: EDIT PATIENT DOCUMENT
// ========================================
let currentEditDoc = null;
let currentEditPayload = null;
let medRowCounter = 0;

window.editPatDoc = async (id) => {
try {
currentEditDoc = await pb.collection(‘patients’).getOne(id);
currentEditPayload = currentEditDoc.payload || {};

```
const formHTML = buildEditForm(currentEditPayload);
document.getElementById('editFormContainer').innerHTML = formHTML;
document.querySelectorAll('#editFormContainer details').forEach(d => d.open = true);

const meds = currentEditPayload.medications || [];
medRowCounter = meds.length;

document.getElementById('editModal').classList.add('show');
```

} catch(e) {
showMsg(’Fehler: ’ + e.message, ‘error’);
}
};

// ========================================
// SECTION: BUILD EDIT FORM HTML
// ========================================
function buildEditForm(payload) {
const v = (key, fallback = ‘’) =>
payload[key] !== undefined && payload[key] !== null ? payload[key] : fallback;

const checked = (key) => payload[key] ? ‘checked’ : ‘’;

const radioChecked = (key, value) => payload[key] === value ? ‘checked’ : ‘’;

// Build medication rows
const medications = payload.medications || [];
let medRowsHTML = ‘’;
medications.forEach((med, idx) => {
const i = idx + 1;
medRowsHTML += `<tr> <td>${i}</td> <td><input type="text" name="med_name_${i}" value="${med.name || ''}"  style="width:100%;padding:.3rem;font-size:14px"></td> <td><input type="number" name="med_dose_${i}" value="${med.dose || ''}" step="0.1"  style="width:80px;padding:.3rem;font-size:14px"></td> <td><input type="text" name="med_unit_${i}" value="${med.unit || ''}" placeholder="mg"  style="width:60px;padding:.3rem;font-size:14px"></td> <td> <select name="med_route_${i}" style="padding:.3rem;font-size:14px"> <option value="">-</option> <option value="i.v." ${med.route === 'i.v.' ? 'selected' : ''}>i.v.</option> <option value="i.m." ${med.route === 'i.m.' ? 'selected' : ''}>i.m.</option> <option value="s.c." ${med.route === 's.c.' ? 'selected' : ''}>s.c.</option> <option value="p.o." ${med.route === 'p.o.' ? 'selected' : ''}>p.o.</option> <option value="inhal." ${med.route === 'inhal.' ? 'selected' : ''}>inhal.</option> </select> </td> <td><input type="time" name="med_time_${i}" value="${med.time || ''}"  style="width:90px;padding:.3rem;font-size:14px"></td> <td><input type="text" name="med_note_${i}" value="${med.note || ''}"  style="width:100%;padding:.3rem;font-size:14px"></td> <td><button class="subbtn" type="button" onclick="this.closest('tr').remove()">×</button></td> </tr>`;
});

// Build photos display
const photos = payload.photos || [];
let photosHTML = ‘’;
if (photos.length > 0) {
photosHTML = ‘<div class="thumbs">’;
photos.forEach((photo, idx) => {
photosHTML += `<div class="thumb"> <img src="${photo}" alt="Foto ${idx+1}"> </div>`;
});
photosHTML += ‘</div>’;
}

// Return complete form HTML (gekürzt - die komplette Version ist sehr lang!)
return `

<details open>
  <summary><i class="fa-solid fa-truck-medical"></i> Einsatzdaten</summary>
  <div class="sec-body">
    <div class="grid">
      <label>Einsatz-Nr.<input name="einsatz_nr" type="text" value="${v('einsatz_nr')}"></label>
      <label>Pat./Auftrags-Nr.<input name="auftrags_nr" type="text" value="${v('auftrags_nr')}"></label>
      <label>Rufname<input name="rufname" type="text" value="${v('rufname')}"></label>
      <label>Fahrzeug<input name="fahrzeug" type="text" value="${v('fahrzeug')}"></label>
      <label>Datum/Uhrzeit<input name="zeit_einsatz" type="datetime-local" value="${v('zeit_einsatz')}"></label>
    </div>
    <label>Einsatz-Art<input name="einsatz_art" type="text" value="${v('einsatz_art')}"></label>
  </div>
</details>

<details open>
  <summary><i class="fa-solid fa-id-card-clip"></i> Pat-Stammdaten</summary>
  <div class="sec-body">
    <div class="grid">
      <label>Name<input name="name" type="text" value="${v('name')}"></label>
      <label>Vorname<input name="vorname" type="text" value="${v('vorname')}"></label>
      <label>Geb.-Datum<input name="gebdatum" type="date" value="${v('gebdatum')}"></label>
      <label>Alter<input name="alter" type="number" value="${v('alter')}"></label>
      <label>Telefon<input name="telefon" type="text" value="${v('telefon')}"></label>
      <label>Mobil<input name="mobil" type="text" value="${v('mobil')}"></label>
      <label>Straße<input name="strasse" type="text" value="${v('strasse')}"></label>
      <label>PLZ, Ort<input name="plz_ort" type="text" value="${v('plz_ort')}"></label>
      <label>Kasse / Nr.<input name="kasse" type="text" value="${v('kasse')}"></label>
      <label>Vers.-Nr.<input name="versnr" type="text" value="${v('versnr')}"></label>
      <label>Hausarzt / Tel.<input name="hausarzt" type="text" value="${v('hausarzt')}"></label>
      <label>Angehöriger / Tel.<input name="angehoeriger" type="text" value="${v('angehoeriger')}"></label>
    </div>
    <label>Informationen / Aspekte<textarea name="infos">${v('infos')}</textarea></label>
  </div>
</details>

<details open>
  <summary><i class="fa-solid fa-notes-medical"></i> Notfallgeschehen / Anamnese</summary>
  <div class="sec-body">
    <textarea name="notfallgeschehen">${v('notfallgeschehen')}</textarea>
    ${photosHTML ? '<div style="margin-top:.75rem"><strong>Fotos:</strong>' + photosHTML + '</div>' : ''}
  </div>
</details>

<details open>
  <summary><i class="fa-solid fa-stethoscope"></i> Messwerte / Atmung</summary>
  <div class="sec-body">
    <div class="grid">
      <label>RR syst. (mmHg)<input name="rr_sys" type="number" value="${v('rr_sys')}"></label>
      <label>RR diast. (mmHg)<input name="rr_dia" type="number" value="${v('rr_dia')}"></label>
      <label>HF (/min)<input name="hf" type="number" value="${v('hf')}"></label>
      <label>AF (/min)<input name="af" type="number" value="${v('af')}"></label>
      <label>SpO₂ (%)<input name="spo2" type="number" value="${v('spo2')}"></label>
      <label>etCO₂ (mmHg)<input name="etco2" type="number" value="${v('etco2')}"></label>
      <label>Temp (°C)<input name="temp" type="number" step="0.1" value="${v('temp')}"></label>
      <label>BZ (mg/dl)<input name="bz_mg" type="number" value="${v('bz_mg')}"></label>
      <label>BZ (mmol/l)<input name="bz_mmol" type="number" step="0.1" value="${v('bz_mmol')}"></label>
      <label>Schmerz (0–10)<input name="schmerz" type="number" min="0" max="10" value="${v('schmerz')}"></label>
    </div>
    <fieldset style="margin-top:.8rem">
      <legend>qSOFA (auto)</legend>
      <div class="badge">qSOFA-Score: ${calculateQSOFA(payload)}</div>
    </fieldset>
  </div>
</details>

<details open>
  <summary><i class="fa-solid fa-syringe"></i> Maßnahmen – Zugang & Medikation</summary>
  <div class="sec-body">
    <fieldset>
      <legend>Medikamente</legend>
      <button type="button" class="subbtn" onclick="addMedRowEdit()" style="margin-bottom:.5rem">
        <i class="fa-solid fa-plus"></i> Zeile hinzufügen
      </button>
      <div style="overflow:auto">
        <table id="medTableEdit">
          <thead>
            <tr>
              <th>#</th>
              <th>Medikament</th>
              <th>Dosis</th>
              <th>Einheit</th>
              <th>Route</th>
              <th>Uhrzeit</th>
              <th>Bemerkung</th>
              <th>×</th>
            </tr>
          </thead>
          <tbody>${medRowsHTML}</tbody>
        </table>
      </div>
    </fieldset>
  </div>
</details>

<details open>
  <summary><i class="fa-solid fa-signature"></i> Ausfüller & Unterschrift</summary>
  <div class="sec-body">
    <div class="grid">
      <label>Name<input name="ausfueller_name" type="text" value="${v('ausfueller_name')}"></label>
      <label>Zeitpunkt<input name="ausfueller_zeit" type="datetime-local" value="${v('ausfueller_zeit')}"></label>
    </div>
    ${payload.signature ? `<div style="margin-top:.75rem"><strong>Unterschrift:</strong><br><img src="${payload.signature}" class="signature-img"></div>` : ''}
  </div>
</details>`;
}

// ========================================
// SECTION: ADD MEDICATION ROW TO TABLE
// ========================================
window.addMedRowEdit = function() {
medRowCounter++;
const tbody = document.querySelector(’#medTableEdit tbody’);
const tr = document.createElement(‘tr’);
tr.innerHTML = `<td>${medRowCounter}</td> <td><input type="text" name="med_name_${medRowCounter}"  style="width:100%;padding:.3rem;font-size:14px"></td> <td><input type="number" name="med_dose_${medRowCounter}" step="0.1"  style="width:80px;padding:.3rem;font-size:14px"></td> <td><input type="text" name="med_unit_${medRowCounter}" placeholder="mg"  style="width:60px;padding:.3rem;font-size:14px"></td> <td> <select name="med_route_${medRowCounter}" style="padding:.3rem;font-size:14px"> <option value="">-</option> <option value="i.v.">i.v.</option> <option value="i.m.">i.m.</option> <option value="s.c.">s.c.</option> <option value="p.o.">p.o.</option> <option value="inhal.">inhal.</option> </select> </td> <td><input type="time" name="med_time_${medRowCounter}"  style="width:90px;padding:.3rem;font-size:14px"></td> <td><input type="text" name="med_note_${medRowCounter}"  style="width:100%;padding:.3rem;font-size:14px"></td> <td><button class="subbtn" type="button" onclick="this.closest('tr').remove()">×</button></td>`;
tbody.appendChild(tr);
};

// ========================================
// SECTION: CLOSE EDIT MODAL
// ========================================
window.closeEditModal = () => {
document.getElementById(‘editModal’).classList.remove(‘show’);
if (!document.getElementById(‘signModal’).classList.contains(‘show’)) {
currentEditDoc = null;
currentEditPayload = null;
}
};

// ========================================
// SECTION: SAVE AND SIGN PATIENT DOCUMENT
// ========================================
window.saveAndSignPatDoc = async () => {
try {
showMsg(‘Daten werden gespeichert…’, ‘success’);
const btn = document.querySelector(’#editModal .btn:not(.btn-secondary)’);
btn.disabled = true;

```
const form = document.getElementById('editFormContainer');
const formData = new FormData();
const inputs = form.querySelectorAll('input, textarea, select');

inputs.forEach(input => {
  if (input.type === 'checkbox') {
    formData.append(input.name, input.checked);
  } else if (input.type === 'radio') {
    if (input.checked) formData.append(input.name, input.value);
  } else {
    formData.append(input.name, input.value);
  }
});

const payload = {};
for (let [key, value] of formData.entries()) {
  if (payload[key] !== undefined) continue;
  payload[key] = value === 'true' ? true : value === 'false' ? false : value;
}

// Collect medications
const medications = [];
for (let i = 1; i <= medRowCounter; i++) {
  const name = form.querySelector(`[name="med_name_${i}"]`)?.value;
  if (name) {
    medications.push({
      name,
      dose: form.querySelector(`[name="med_dose_${i}"]`)?.value || '',
      unit: form.querySelector(`[name="med_unit_${i}"]`)?.value || '',
      route: form.querySelector(`[name="med_route_${i}"]`)?.value || '',
      time: form.querySelector(`[name="med_time_${i}"]`)?.value || '',
      note: form.querySelector(`[name="med_note_${i}"]`)?.value || ''
    });
  }
}
payload.medications = medications;

// Preserve photos and signature
if (currentEditPayload.photos) {
  payload.photos = currentEditPayload.photos;
}
if (currentEditPayload.signature) {
  payload.signature = currentEditPayload.signature;
}

await pb.collection('patients').update(currentEditDoc.id, {
  payload: payload
});

document.getElementById('editModal').classList.remove('show');
document.getElementById('signModal').classList.add('show');
initAdminSigCanvas();
```

} catch(e) {
showMsg(‘Fehler beim Speichern: ’ + e.message, ‘error’);
const btn = document.querySelector(’#editModal .btn:not(.btn-secondary)’);
btn.disabled = false;
}
};

// ========================================
// SECTION: ADMIN SIGNATURE CANVAS
// ========================================
let adminSigCanvas, adminSigCtx, adminIsDrawing = false;

function initAdminSigCanvas() {
adminSigCanvas = document.getElementById(‘adminSigCanvas’);
adminSigCtx = adminSigCanvas.getContext(‘2d’);
const rect = adminSigCanvas.getBoundingClientRect();
adminSigCanvas.width = rect.width;
adminSigCanvas.height = rect.height;
adminSigCtx.lineWidth = 2;
adminSigCtx.strokeStyle = ‘#000’;
adminSigCtx.lineCap = ‘round’;

// Mouse events
adminSigCanvas.addEventListener(‘mousedown’, startAdminDraw);
adminSigCanvas.addEventListener(‘mousemove’, adminDraw);
adminSigCanvas.addEventListener(‘mouseup’, stopAdminDraw);
adminSigCanvas.addEventListener(‘mouseleave’, stopAdminDraw);

// Touch events
adminSigCanvas.addEventListener(‘touchstart’, (e) => {
e.preventDefault();
const touch = e.touches[0];
const mouseEvent = new MouseEvent(‘mousedown’, {
clientX: touch.clientX,
clientY: touch.clientY
});
adminSigCanvas.dispatchEvent(mouseEvent);
});

adminSigCanvas.addEventListener(‘touchmove’, (e) => {
e.preventDefault();
const touch = e.touches[0];
const mouseEvent = new MouseEvent(‘mousemove’, {
clientX: touch.clientX,
clientY: touch.clientY
});
adminSigCanvas.dispatchEvent(mouseEvent);
});

adminSigCanvas.addEventListener(‘touchend’, (e) => {
e.preventDefault();
const mouseEvent = new MouseEvent(‘mouseup’, {});
adminSigCanvas.dispatchEvent(mouseEvent);
});
}

function startAdminDraw(e) {
adminIsDrawing = true;
const rect = adminSigCanvas.getBoundingClientRect();
adminSigCtx.beginPath();
adminSigCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}

function adminDraw(e) {
if (!adminIsDrawing) return;
const rect = adminSigCanvas.getBoundingClientRect();
adminSigCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
adminSigCtx.stroke();
}

function stopAdminDraw() {
adminIsDrawing = false;
}

window.clearAdminSig = () => {
adminSigCtx.clearRect(0, 0, adminSigCanvas.width, adminSigCanvas.height);
};

window.closeSignModal = () => {
document.getElementById(‘signModal’).classList.remove(‘show’);
};

// ========================================
// SECTION: ARCHIVE WITH SIGNATURE
// ========================================
window.archiveWithSignature = async () => {
try {
const adminName = document.getElementById(‘adminName’).value.trim();
if (!adminName) {
showMsg(‘Bitte Namen eingeben’, ‘error’);
return;
}

```
const signatureData = adminSigCanvas.toDataURL('image/png');

await pb.collection('patients').update(currentEditDoc.id, {
  status: 'archiviert',
  admin_name: adminName,
  admin_datum: new Date().toISOString(),
  admin_unterschrift: signatureData
});

closeSignModal();
showMsg('✅ Dokument archiviert!', 'success');
await loadData();

currentEditDoc = null;
currentEditPayload = null;
```

} catch(e) {
showMsg(’Fehler beim Archivieren: ’ + e.message, ‘error’);
}
};

// ========================================
// SECTION: NACHERFASSUNG MODAL & SIGNATURE
// ========================================
document.getElementById(‘addBtn’).onclick = () => {
document.getElementById(‘nachForm’).reset();
document.getElementById(‘nachModal’).classList.add(‘show’);
initNachSigCanvas();
};

window.closeNachModal = () => {
document.getElementById(‘nachModal’).classList.remove(‘show’);
};

let nachSigCanvas, nachSigCtx, nachIsDrawing = false;

function initNachSigCanvas() {
nachSigCanvas = document.getElementById(‘nachSigCanvas’);
nachSigCtx = nachSigCanvas.getContext(‘2d’);
const rect = nachSigCanvas.getBoundingClientRect();
nachSigCanvas.width = rect.width;
nachSigCanvas.height = rect.height;
nachSigCtx.lineWidth = 2;
nachSigCtx.strokeStyle = ‘#000’;
nachSigCtx.lineCap = ‘round’;

// Mouse events
nachSigCanvas.addEventListener(‘mousedown’, startNachDraw);
nachSigCanvas.addEventListener(‘mousemove’, nachDraw);
nachSigCanvas.addEventListener(‘mouseup’, stopNachDraw);
nachSigCanvas.addEventListener(‘mouseleave’, stopNachDraw);

// Touch events
nachSigCanvas.addEventListener(‘touchstart’, (e) => {
e.preventDefault();
const touch = e.touches[0];
const mouseEvent = new MouseEvent(‘mousedown’, {
clientX: touch.clientX,
clientY: touch.clientY
});
nachSigCanvas.dispatchEvent(mouseEvent);
});

nachSigCanvas.addEventListener(‘touchmove’, (e) => {
e.preventDefault();
const touch = e.touches[0];
const mouseEvent = new MouseEvent(‘mousemove’, {
clientX: touch.clientX,
clientY: touch.clientY
});
nachSigCanvas.dispatchEvent(mouseEvent);
});

nachSigCanvas.addEventListener(‘touchend’, (e) => {
e.preventDefault();
const mouseEvent = new MouseEvent(‘mouseup’, {});
nachSigCanvas.dispatchEvent(mouseEvent);
});
}

function startNachDraw(e) {
nachIsDrawing = true;
const rect = nachSigCanvas.getBoundingClientRect();
nachSigCtx.beginPath();
nachSigCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}

function nachDraw(e) {
if (!nachIsDrawing) return;
const rect = nachSigCanvas.getBoundingClientRect();
nachSigCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
nachSigCtx.stroke();
}

function stopNachDraw() {
nachIsDrawing = false;
}

window.clearNachSig = () => {
nachSigCtx.clearRect(0, 0, nachSigCanvas.width, nachSigCanvas.height);
};

// ========================================
// SECTION: SAVE NACHERFASSUNG
// ========================================
window.saveNacherfassung = async () => {
try {
const form = document.getElementById(‘nachForm’);
const formData = new FormData(form);

```
const nacherfassungData = {
  datum_alarmzeit: formData.get('datum_alarmzeit') || null,
  datum_einsatzende: formData.get('datum_einsatzende') || null,
  stichwort: formData.get('stichwort') || '',
  kategorie: formData.get('kategorie') || '',
  einsatznummer_ils: formData.get('einsatznummer_ils') || '',
  meldebild: formData.get('meldebild') || '',
  adresse: formData.get('adresse') || '',
  disponierte_em_fw: formData.get('disponierte_em_fw') || '',
  disponierte_em_rd: formData.get('disponierte_em_rd') || '',
  patienten_daten_erhoben: formData.get('patienten_daten_erhoben') === 'ja',
  patient_name: formData.get('patient_name') || '',
  patient_alter_geburtsdatum: formData.get('patient_alter_geburtsdatum') || '',
  patient_nummer_ils: formData.get('patient_nummer_ils') || '',
  sachverhalt: formData.get('sachverhalt') || '',
  protokollpflichtig: formData.get('protokollpflichtig') === 'ja',
  protokollpflichtig_begruendung: formData.get('protokollpflichtig_begruendung') || '',
  verantwortlicher_unterwiesen: formData.get('verantwortlicher_unterwiesen') === 'ja',
  verantwortlicher_name: formData.get('verantwortlicher_name') || '',
  verantwortlicher_qualifikation: formData.get('verantwortlicher_qualifikation') || '',
  nacherfasst_von_name: formData.get('nacherfasst_von_name') || '',
  nacherfasst_von_qualifikation: formData.get('nacherfasst_von_qualifikation') || '',
  nacherfasst_datum: new Date().toISOString(),
  nacherfasst_unterschrift: nachSigCanvas.toDataURL('image/png'),
  status: 'offen',
  organization_id: currentUser.organization_id
};

await pb.collection('patient_docs_nacherfassung').create(nacherfassungData);

closeNachModal();
showMsg('✅ Nacherfassung gespeichert!', 'success');
await loadData();
```

} catch(e) {
showMsg(’Fehler: ’ + e.message, ‘error’);
}
};

// ========================================
// SECTION: ARCHIVE NACHERFASSUNG
// ========================================
window.archiveNach = async (id) => {
if (!confirm(‘Nacherfassung ins Archiv verschieben?’)) return;
try {
await pb.collection(‘patient_docs_nacherfassung’).update(id, {
status: ‘archiviert’
});

```
showMsg('✅ Nacherfassung archiviert!', 'success');
await loadData();
```

} catch(e) {
showMsg(’Fehler: ’ + e.message, ‘error’);
}
};

// ========================================
// SECTION: VIEW NACHERFASSUNG DETAILS
// ========================================
window.viewNach = async (id) => {
try {
const doc = await pb.collection(‘patient_docs_nacherfassung’).getOne(id);

```
window.currentViewedNachData = doc;
window.currentViewedDocType = 'nacherfassung';

document.getElementById('detailsTitle').textContent = 'Nacherfassung: ' + (doc.stichwort || '?');

let html = buildNachDetailsHTML(doc);

document.getElementById('detailsBody').innerHTML = html;
document.getElementById('detailsModal').classList.add('show');
```

} catch(e) {
showMsg(’Fehler: ’ + e.message, ‘error’);
}
};

// ========================================
// SECTION: BUILD NACHERFASSUNG DETAILS HTML
// ========================================
function buildNachDetailsHTML(doc) {
let html = ‘<div style="display:grid;grid-template-columns:200px 1fr;gap:12px 24px;padding:12px 0">’;
html += `<div style="font-weight:700;color:#667eea">Alarmzeit:</div><div>${doc.datum_alarmzeit ? new Date(doc.datum_alarmzeit).toLocaleString('de-DE') : '-'}</div>`;
html += `<div style="font-weight:700;color:#667eea">Einsatzende:</div><div>${doc.datum_einsatzende ? new Date(doc.datum_einsatzende).toLocaleString('de-DE') : '-'}</div>`;
html += `<div style="font-weight:700;color:#667eea">Stichwort:</div><div>${doc.stichwort || '-'}</div>`;
html += `<div style="font-weight:700;color:#667eea">Kategorie:</div><div>${doc.kategorie || '-'}</div>`;
html += `<div style="font-weight:700;color:#667eea">Einsatznummer ILS:</div><div>${doc.einsatznummer_ils || '-'}</div>`;
html += `<div style="font-weight:700;color:#667eea">Meldebild:</div><div>${doc.meldebild || '-'}</div>`;
html += `<div style="font-weight:700;color:#667eea">Adresse:</div><div>${doc.adresse || '-'}</div>`;
html += `<div style="font-weight:700;color:#667eea">Disponierte EM (FW):</div><div>${doc.disponierte_em_fw || '-'}</div>`;
html += `<div style="font-weight:700;color:#667eea">Disponierte EM (RD):</div><div>${doc.disponierte_em_rd || '-'}</div>`;
html += `<div style="font-weight:700;color:#667eea">Patienten-Daten erhoben:</div><div>${doc.patienten_daten_erhoben ? 'Ja' : 'Nein'}</div>`;

if (doc.patienten_daten_erhoben) {
html += `<div style="font-weight:700;color:#667eea">Patient Name:</div><div>${doc.patient_name || '-'}</div>`;
html += `<div style="font-weight:700;color:#667eea">Alter/Geburtsdatum:</div><div>${doc.patient_alter_geburtsdatum || '-'}</div>`;
html += `<div style="font-weight:700;color:#667eea">Pat.-Nummer ILS:</div><div>${doc.patient_nummer_ils || '-'}</div>`;
}

html += `<div style="font-weight:700;color:#667eea">Sachverhalt:</div><div>${doc.sachverhalt || '-'}</div>`;
html += `<div style="font-weight:700;color:#667eea">Protokollpflichtig:</div><div>${doc.protokollpflichtig ? 'Ja' : 'Nein'}</div>`;

if (doc.protokollpflichtig) {
html += `<div style="font-weight:700;color:#667eea">Begründung:</div><div>${doc.protokollpflichtig_begruendung || '-'}</div>`;
}

html += `<div style="font-weight:700;color:#667eea">Verantwortlicher unterwiesen:</div><div>${doc.verantwortlicher_unterwiesen ? 'Ja' : 'Nein'}</div>`;
html += `<div style="font-weight:700;color:#667eea">Verantwortlicher Name:</div><div>${doc.verantwortlicher_name || '-'}</div>`;
html += `<div style="font-weight:700;color:#667eea">Verantwortlicher Qualifikation:</div><div>${doc.verantwortlicher_qualifikation || '-'}</div>`;
html += `<div style="font-weight:700;color:#667eea">Nacherfasst von:</div><div>${doc.nacherfasst_von_name || '-'} (${doc.nacherfasst_von_qualifikation || '-'})</div>`;
html += `<div style="font-weight:700;color:#667eea">Nacherfasst am:</div><div>${doc.nacherfasst_datum ? new Date(doc.nacherfasst_datum).toLocaleString('de-DE') : '-'}</div>`;

if (doc.nacherfasst_unterschrift) {
html += `<div style="font-weight:700;color:#667eea">Unterschrift:</div><div><img src="${doc.nacherfasst_unterschrift}" class="signature-img"></div>`;
}

html += ‘</div>’;
return html;
}

// ========================================
// SECTION: VIEW ARCHIVED PATIENT DOCUMENT
// ========================================
window.viewPatArchiv = async (id) => {
try {
const doc = await pb.collection(‘patients’).getOne(id);
const p = doc.payload || {};

```
window.currentViewedPayload = p;
window.currentViewedAdmin = {
  name: doc.admin_name,
  datum: doc.admin_datum,
  unterschrift: doc.admin_unterschrift
};
window.currentViewedOrgName = currentOrganization?.name || 'Feuerwehr';
window.currentViewedDocType = 'patient';

const displayName = `${p.vorname || ''} ${p.name || ''}`.trim() || 'Unbekannt';
document.getElementById('detailsTitle').textContent = 'Patientendokumentation: ' + displayName;

let html = buildPatArchiveHTML(p, doc);

document.getElementById('detailsBody').innerHTML = html;

// Öffne alle details-Elemente
document.querySelectorAll('#detailsBody details').forEach(d => d.open = true);

document.getElementById('detailsModal').classList.add('show');
```

} catch(e) {
showMsg(’Fehler: ’ + e.message, ‘error’);
}
};

// Diese Funktion ist sehr lang - ich erstelle sie in der nächsten Nachricht
function buildPatArchiveHTML(p, doc) {
// Platzhalter - wird in Teil 4 vervollständigt
return ‘<p>Patientendaten werden geladen…</p>’;
}

// ========================================
// SECTION: VIEW ARCHIVED NACHERFASSUNG
// ========================================
window.viewNachArchiv = async (id) => {
await viewNach(id);
};

// ========================================
// SECTION: CLOSE DETAILS MODAL
// ========================================
window.closeDetailsModal = () => {
document.getElementById(‘detailsModal’).classList.remove(‘show’);
};

// ========================================
// SECTION: GENERATE PDF FROM MODAL
// ========================================
window.generatePDFFromModal = async () => {
const docType = window.currentViewedDocType;

if (docType === ‘nacherfassung’) {
await generateNacherfassungPDF(window.currentViewedNachData || {});
} else {
await generatePatientPDF();
}
};

// ========================================
// SECTION: INITIAL DATA LOAD
// ========================================
loadData();

// ========================================
// SECTION: FADE IN ANIMATION
// ========================================
setTimeout(() => {
document.body.classList.add(‘loaded’);
}, 100);

// ========================================
// SECTION: BUILD PATIENT ARCHIVE HTML (VOLLSTÄNDIG!)
// ========================================
function buildPatArchiveHTML(p, doc) {
const v = (key, fallback = ‘’) =>
p[key] !== undefined && p[key] !== null ? p[key] : fallback;

const checked = (key) => p[key] ? ‘✓’ : ‘’;

const radioValue = (key) => p[key] || ‘-’;

// Build medication rows (read-only)
const medications = p.medications || [];
let medRowsHTML = ‘’;
if (medications.length > 0) {
medications.forEach((med, idx) => {
medRowsHTML += `<tr> <td>${idx + 1}</td> <td>${med.name || '-'}</td> <td>${med.dose || '-'}</td> <td>${med.unit || '-'}</td> <td>${med.route || '-'}</td> <td>${med.time || '-'}</td> <td>${med.note || '-'}</td> </tr>`;
});
} else {
medRowsHTML = ‘<tr><td colspan="7" style="text-align:center;color:#999">Keine Medikamente dokumentiert</td></tr>’;
}

// Build photos display
const photos = p.photos || [];
let photosHTML = ‘’;
if (photos.length > 0) {
photosHTML = ‘<div class="photo-grid">’;
photos.forEach((photo, idx) => {
photosHTML += `<img src="${photo}" alt="Foto ${idx+1}">`;
});
photosHTML += ‘</div>’;
}

// Return complete READONLY form HTML
return `

<details open>
  <summary><i class="fa-solid fa-truck-medical"></i> Einsatzdaten</summary>
  <div class="sec-body">
    <div class="grid">
      <div><strong>Einsatz-Nr:</strong><br>${v('einsatz_nr')}</div>
      <div><strong>Pat./Auftrags-Nr:</strong><br>${v('auftrags_nr')}</div>
      <div><strong>Rufname:</strong><br>${v('rufname')}</div>
      <div><strong>Fahrzeug:</strong><br>${v('fahrzeug')}</div>
      <div><strong>Datum/Uhrzeit:</strong><br>${v('zeit_einsatz') ? new Date(v('zeit_einsatz')).toLocaleString('de-DE') : '-'}</div>
    </div>
    <div style="margin-top:12px"><strong>Einsatz-Art:</strong><br>${v('einsatz_art')}</div>
  </div>
</details>

<details open>
  <summary><i class="fa-solid fa-id-card-clip"></i> Pat-Stammdaten</summary>
  <div class="sec-body">
    <div class="grid">
      <div><strong>Name:</strong><br>${v('name')}</div>
      <div><strong>Vorname:</strong><br>${v('vorname')}</div>
      <div><strong>Geb.-Datum:</strong><br>${v('gebdatum') ? new Date(v('gebdatum')).toLocaleDateString('de-DE') : '-'}</div>
      <div><strong>Alter:</strong><br>${v('alter')}</div>
      <div><strong>Telefon:</strong><br>${v('telefon')}</div>
      <div><strong>Mobil:</strong><br>${v('mobil')}</div>
      <div><strong>Straße:</strong><br>${v('strasse')}</div>
      <div><strong>PLZ, Ort:</strong><br>${v('plz_ort')}</div>
      <div><strong>Kasse:</strong><br>${v('kasse')}</div>
      <div><strong>Vers.-Nr:</strong><br>${v('versnr')}</div>
      <div><strong>Hausarzt:</strong><br>${v('hausarzt')}</div>
      <div><strong>Angehöriger:</strong><br>${v('angehoeriger')}</div>
    </div>
    <div style="margin-top:12px"><strong>Informationen / Aspekte:</strong><br>${v('infos') || '-'}</div>
  </div>
</details>

<details open>
  <summary><i class="fa-solid fa-notes-medical"></i> Notfallgeschehen / Anamnese</summary>
  <div class="sec-body">
    <div>${v('notfallgeschehen') || '-'}</div>
    ${photosHTML ? '<div style="margin-top:12px"><strong>Fotos:</strong>' + photosHTML + '</div>' : ''}
  </div>
</details>

<details open>
  <summary><i class="fa-solid fa-stethoscope"></i> Messwerte / Atmung</summary>
  <div class="sec-body">
    <div class="grid">
      <div><strong>RR syst.:</strong><br>${v('rr_sys')} mmHg</div>
      <div><strong>RR diast.:</strong><br>${v('rr_dia')} mmHg</div>
      <div><strong>HF:</strong><br>${v('hf')} /min</div>
      <div><strong>AF:</strong><br>${v('af')} /min</div>
      <div><strong>SpO₂:</strong><br>${v('spo2')} %</div>
      <div><strong>etCO₂:</strong><br>${v('etco2')} mmHg</div>
      <div><strong>Temp:</strong><br>${v('temp')} °C</div>
      <div><strong>BZ (mg/dl):</strong><br>${v('bz_mg')}</div>
      <div><strong>BZ (mmol/l):</strong><br>${v('bz_mmol')}</div>
      <div><strong>Schmerz:</strong><br>${v('schmerz')} / 10</div>
    </div>
    <fieldset style="margin-top:12px">
      <legend>qSOFA Score</legend>
      <div class="badge">qSOFA: ${calculateQSOFA(p)}</div>
    </fieldset>
  </div>
</details>

<details open>
  <summary><i class="fa-solid fa-syringe"></i> Maßnahmen – Zugang & Medikation</summary>
  <div class="sec-body">
    <fieldset>
      <legend>Medikamente</legend>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Medikament</th>
            <th>Dosis</th>
            <th>Einheit</th>
            <th>Route</th>
            <th>Uhrzeit</th>
            <th>Bemerkung</th>
          </tr>
        </thead>
        <tbody>${medRowsHTML}</tbody>
      </table>
    </fieldset>
  </div>
</details>

<details open>
  <summary><i class="fa-solid fa-signature"></i> Ausfüller & Unterschrift</summary>
  <div class="sec-body">
    <div class="grid">
      <div><strong>Name:</strong><br>${v('ausfueller_name')}</div>
      <div><strong>Zeitpunkt:</strong><br>${v('ausfueller_zeit') ? new Date(v('ausfueller_zeit')).toLocaleString('de-DE') : '-'}</div>
    </div>
    ${p.signature ? '<div style="margin-top:12px"><strong>Unterschrift:</strong><br><img src="' + p.signature + '" class="signature-img"></div>' : ''}
  </div>
</details>

<details open>
  <summary><i class="fa-solid fa-user-shield"></i> MPG-Beauftragter</summary>
  <div class="sec-body">
    <div class="grid">
      <div><strong>Name:</strong><br>${doc.admin_name || '-'}</div>
      <div><strong>Zeitpunkt:</strong><br>${doc.admin_datum ? new Date(doc.admin_datum).toLocaleString('de-DE') : '-'}</div>
    </div>
    ${doc.admin_unterschrift ? '<div style="margin-top:12px"><strong>Unterschrift:</strong><br><img src="' + doc.admin_unterschrift + '" class="signature-img"></div>' : ''}
  </div>
</details>`;
}

// ========================================
// SECTION: GENERATE PATIENT PDF - KOMPLETT!
// ========================================
async function generatePatientPDF() {
try {
showMsg(‘📄 PDF wird erstellt…’, ‘success’);

```
const { jsPDF } = window.jspdf;
const pdf = new jsPDF('p', 'mm', 'a4');

const p = window.currentViewedPayload || {};
const adminData = window.currentViewedAdmin || {};
const orgName = currentOrganization?.name || 'Feuerwehr';

const pageWidth = 210;
const pageHeight = 297;
const margin = 15;
const fullWidth = pageWidth - 2 * margin;

let currentY = 0;
let pageNum = 1;

// ========================================
// PDF HEADER FUNCTION
// ========================================
function addHeader(isFirstPage = false) {
  pdf.setFillColor(102, 126, 234);
  pdf.rect(0, 0, pageWidth, isFirstPage ? 35 : 25, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(isFirstPage ? 20 : 14);
  pdf.setFont(undefined, 'bold');
  
  if (isFirstPage) {
    pdf.text(orgName, margin, 12);
    pdf.setFontSize(16);
    pdf.text('NOTFALLPROTOKOLL', margin, 24);
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text('Erstellt: ' + new Date().toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }), pageWidth - margin - 65, 24);
  } else {
    pdf.text(`NOTFALLPROTOKOLL - Seite ${pageNum}`, margin, 16);
  }
  
  pdf.setTextColor(0, 0, 0);
}

// ========================================
// HELPER: CHECK PAGE BREAK
// ========================================
function checkPageBreak(neededHeight) {
  if (currentY + neededHeight > pageHeight - 20) {
    pdf.addPage();
    pageNum++;
    addHeader(false);
    currentY = 30;
    return true;
  }
  return false;
}

// ========================================
// HELPER: DRAW SECTION BOX
// ========================================
function drawSection(title, height) {
  pdf.setFillColor(245, 247, 250);
  pdf.rect(margin, currentY, fullWidth, height, 'F');
  
  pdf.setFillColor(102, 126, 234);
  pdf.rect(margin, currentY, fullWidth, 7, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(11);
  pdf.setFont(undefined, 'bold');
  pdf.text(title, margin + 2, currentY + 5);
  
  pdf.setTextColor(0, 0, 0);
  pdf.setFont(undefined, 'normal');
  
  return currentY + 9;
}

// ========================================
// HELPER: ADD FIELD
// ========================================
function addField(x, y, label, value) {
  pdf.setFontSize(9);
  pdf.setFont(undefined, 'bold');
  pdf.text(label, x, y);
  
  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(10);
  pdf.text(String(value || '-'), x, y + 4);
  
  return y + 9;
}

// ========================================
// PAGE 1 START
// ========================================
addHeader(true);
currentY = 40;

// SECTION 1: EINSATZDATEN
checkPageBreak(38);
let boxY = drawSection('1. EINSATZDATEN', 38);

const col3W = (fullWidth - 6) / 3;
addField(margin + 2, boxY, 'Einsatz-Nr:', p.einsatz_nr);
addField(margin + 2 + col3W + 3, boxY, 'Datum/Uhrzeit:', 
  p.zeit_einsatz ? new Date(p.zeit_einsatz).toLocaleString('de-DE') : '-');
addField(margin + 2 + 2*col3W + 6, boxY, 'Pat./Auftrags-Nr:', p.auftrags_nr);

addField(margin + 2, boxY + 12, 'Fahrzeug:', p.fahrzeug);
addField(margin + 2 + col3W + 3, boxY + 12, 'Rufname:', p.rufname);
addField(margin + 2 + 2*col3W + 6, boxY + 12, 'Einsatz-Art:', p.einsatz_art);

currentY += 40;

// SECTION 2: PATIENT
checkPageBreak(38);
boxY = drawSection('2. PATIENT', 38);

const patName = `${p.vorname || ''} ${p.name || ''}`.trim();
addField(margin + 2, boxY, 'Name:', patName);
addField(margin + 2 + col3W + 3, boxY, 'Straße:', p.strasse);
addField(margin + 2 + 2*col3W + 6, boxY, 'Kasse:', p.kasse);

addField(margin + 2, boxY + 12, 'Geburtsdatum:', 
  p.gebdatum ? new Date(p.gebdatum).toLocaleDateString('de-DE') : '-');
addField(margin + 2 + col3W + 3, boxY + 12, 'PLZ, Ort:', p.plz_ort);
addField(margin + 2 + 2*col3W + 6, boxY + 12, 'Vers.-Nr.:', p.versnr);

addField(margin + 2, boxY + 24, 'Alter:', p.alter);
addField(margin + 2 + col3W + 3, boxY + 24, 'Telefon:', p.telefon || p.mobil);
addField(margin + 2 + 2*col3W + 6, boxY + 24, 'Hausarzt:', p.hausarzt);

currentY += 40;

// SECTION 3: ANAMNESE
checkPageBreak(50);
boxY = drawSection('3. ANAMNESE / NOTFALLGESCHEHEN', 50);

pdf.setFontSize(9.5);
const anamLines = pdf.splitTextToSize(p.notfallgeschehen || '-', fullWidth - 4);
pdf.text(anamLines.slice(0, 18), margin + 2, boxY);

currentY += 52;

// SECTION 4: VITALPARAMETER
checkPageBreak(33);
boxY = drawSection('4. VITALPARAMETER', 33);

const col4W = (fullWidth - 9) / 4;
addField(margin + 2, boxY, 'RR:', `${p.rr_sys || '-'} / ${p.rr_dia || '-'} mmHg`);
addField(margin + 2 + col4W + 3, boxY, 'AF:', `${p.af || '-'} /min`);
addField(margin + 2 + 2*col4W + 6, boxY, 'Temp:', `${p.temp || '-'} °C`);
addField(margin + 2 + 3*col4W + 9, boxY, 'etCO₂:', `${p.etco2 || '-'} mmHg`);

addField(margin + 2, boxY + 10, 'HF:', `${p.hf || '-'} /min`);
addField(margin + 2 + col4W + 3, boxY + 10, 'SpO₂:', `${p.spo2 || '-'} %`);
addField(margin + 2 + 2*col4W + 6, boxY + 10, 'BZ:', `${p.bz_mg || '-'} mg/dl`);
addField(margin + 2 + 3*col4W + 9, boxY + 10, 'Schmerz:', `${p.schmerz || '-'} / 10`);

addField(margin + 2, boxY + 20, 'qSOFA:', calculateQSOFA(p));

currentY += 35;

// SECTION 5: MEDIKAMENTE
checkPageBreak(55);
boxY = drawSection('5. MEDIKAMENTE', 55);

const meds = p.medications || [];
if (meds.length > 0) {
  pdf.setFontSize(8);
  pdf.setFont(undefined, 'bold');
  
  const medX = margin + 2;
  let medY = boxY;
  
  // Table header
  pdf.setFillColor(245, 245, 245);
  pdf.rect(medX, medY, fullWidth - 4, 5, 'F');
  
  pdf.text('#', medX + 1, medY + 3.5);
  pdf.text('Medikament', medX + 8, medY + 3.5);
  pdf.text('Dosis', medX + 60, medY + 3.5);
  pdf.text('Einh.', medX + 80, medY + 3.5);
  pdf.text('Route', medX + 100, medY + 3.5);
  pdf.text('Uhrzeit', medX + 120, medY + 3.5);
  pdf.text('Bemerkung', medX + 145, medY + 3.5);
  
  medY += 6;
  pdf.setFont(undefined, 'normal');
  
  // Table rows
  meds.slice(0, 6).forEach((med, idx) => {
    pdf.text(`${idx + 1}`, medX + 1, medY);
    pdf.text(med.name || '-', medX + 8, medY);
    pdf.text(med.dose || '-', medX + 60, medY);
    pdf.text(med.unit || '-', medX + 80, medY);
    pdf.text(med.route || '-', medX + 100, medY);
    pdf.text(med.time || '-', medX + 120, medY);
    const noteLines = pdf.splitTextToSize(med.note || '-', 30);
    pdf.text(noteLines[0] || '-', medX + 145, medY);
    medY += 5;
  });
} else {
  pdf.setFontSize(9);
  pdf.text('Keine Medikamentengabe dokumentiert', margin + 2, boxY + 5);
}

currentY += 57;

// SECTION 6: UNTERSCHRIFTEN
checkPageBreak(40);
boxY = drawSection('6. UNTERSCHRIFTEN', 40);

const col2W = (fullWidth - 3) / 2;

addField(margin + 2, boxY, 'Ausfüller:', p.ausfueller_name);
pdf.setFontSize(9);
pdf.text(p.ausfueller_zeit ? new Date(p.ausfueller_zeit).toLocaleString('de-DE') : '', 
  margin + 2, boxY + 8);

if (p.signature) {
  try {
    pdf.addImage(p.signature, 'PNG', margin + 2, boxY + 12, 50, 20);
  } catch(e) {
    pdf.setFontSize(8);
    pdf.text('(Unterschrift vorhanden)', margin + 2, boxY + 20);
  }
}

addField(margin + col2W + 5, boxY, 'MPG-Beauftragter:', adminData.name);
pdf.setFontSize(9);
pdf.text(adminData.datum ? new Date(adminData.datum).toLocaleString('de-DE') : '', 
  margin + col2W + 5, boxY + 8);

if (adminData.unterschrift) {
  try {
    pdf.addImage(adminData.unterschrift, 'PNG', margin + col2W + 5, boxY + 12, 50, 20);
  } catch(e) {
    pdf.setFontSize(8);
    pdf.text('(Unterschrift vorhanden)', margin + col2W + 5, boxY + 20);
  }
}

currentY += 42;

// ========================================
// FOOTER ON ALL PAGES
// ========================================
const totalPages = pdf.internal.pages.length - 1;
for (let i = 1; i <= totalPages; i++) {
  pdf.setPage(i);
  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  
  const einsatzNr = p.einsatz_nr || '?';
  const footerText = `Einsatz-Nr: ${einsatzNr} | ${orgName} | Seite ${i} von ${totalPages}`;
  
  pdf.text(footerText, pageWidth / 2, pageHeight - 5, { align: 'center' });
}

// ========================================
// SAVE PDF
// ========================================
const pdfPatName = `${p.vorname || ''}_${p.name || ''}`.trim() || 'Patient';
const einsatzNr = p.einsatz_nr || 'ohne_nr';
const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

pdf.save(`Notfallprotokoll_${einsatzNr}_${timestamp}.pdf`);

showMsg('✅ PDF erfolgreich erstellt!', 'success');
```

} catch(e) {
console.error(‘PDF Error:’, e);
showMsg(’❌ Fehler beim PDF-Export: ’ + e.message, ‘error’);
}
}

// ========================================
// SECTION: GENERATE NACHERFASSUNG PDF
// ========================================
async function generateNacherfassungPDF(doc) {
try {
showMsg(‘📄 PDF wird erstellt…’, ‘success’);

```
const { jsPDF } = window.jspdf;
const pdf = new jsPDF('p', 'mm', 'a4');

const orgName = currentOrganization?.name || 'Feuerwehr';
const pageWidth = 210;
const pageHeight = 297;
const margin = 10;
const fullWidth = pageWidth - 2 * margin;

let currentY = 0;

// PDF Header
pdf.setFillColor(102, 126, 234);
pdf.rect(0, 0, pageWidth, 30, 'F');

pdf.setTextColor(255, 255, 255);
pdf.setFontSize(22);
pdf.setFont(undefined, 'bold');
pdf.text(orgName, margin, 12);

pdf.setFontSize(18);
pdf.text('EINSATZNACHERFASSUNG', margin, 22);

pdf.setFontSize(10);
pdf.setFont(undefined, 'normal');
pdf.text(`Erstellt: ${new Date().toLocaleString('de-DE')}`, pageWidth - margin - 60, 22);

currentY = 35;

// Helper function: Draw box
function drawBox(x, y, width, height, title) {
  pdf.setFillColor(245, 247, 250);
  pdf.rect(x, y, width, height, 'F');
  
  pdf.setFillColor(102, 126, 234);
  pdf.rect(x, y, width, 8, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(11);
  pdf.setFont(undefined, 'bold');
  pdf.text(title, x + 3, y + 5.5);
  
  pdf.setTextColor(0, 0, 0);
  pdf.setFont(undefined, 'normal');
  
  return y + 11;
}

// Helper function: Add field
function addField(x, y, label, value, width) {
  pdf.setFontSize(10);
  pdf.setFont(undefined, 'bold');
  pdf.setTextColor(102, 126, 234);
  pdf.text(label, x, y);
  
  pdf.setFont(undefined, 'normal');
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(10);
  
  const lines = pdf.splitTextToSize(value || '-', width - 6);
  pdf.text(lines, x, y + 5);
  
  return y + 5 + (lines.length * 5) + 2;
}

// SECTION 1: EINSATZDATEN
let boxY = drawBox(margin, currentY, fullWidth, 55, '1. EINSATZDATEN');

const col2Width = (fullWidth - 3) / 2;
let tempY = boxY;

tempY = addField(margin + 3, tempY, 'Datum/Alarmzeit:', 
  doc.datum_alarmzeit ? new Date(doc.datum_alarmzeit).toLocaleString('de-DE') : '-', col2Width);
tempY = addField(margin + 3, tempY, 'Stichwort:', doc.stichwort, col2Width);
tempY = addField(margin + 3, tempY, 'Einsatznummer ILS:', doc.einsatznummer_ils, col2Width);

tempY = boxY;
tempY = addField(margin + 3 + col2Width + 3, tempY, 'Datum/Einsatzende:', 
  doc.datum_einsatzende ? new Date(doc.datum_einsatzende).toLocaleString('de-DE') : '-', col2Width);
tempY = addField(margin + 3 + col2Width + 3, tempY, 'Kategorie:', doc.kategorie, col2Width);
tempY = addField(margin + 3 + col2Width + 3, tempY, 'Meldebild:', doc.meldebild, col2Width);

currentY += 57;

// SECTION 2: EINSATZORT
boxY = drawBox(margin, currentY, fullWidth, 35, '2. EINSATZORT');
pdf.setFontSize(10);
const adresseLines = pdf.splitTextToSize(doc.adresse || '-', fullWidth - 6);
pdf.text(adresseLines, margin + 3, boxY);
currentY += 37;

// SECTION 3: EINSATZMITTEL
boxY = drawBox(margin, currentY, fullWidth, 35, '3. EINSATZMITTEL');
tempY = boxY;
tempY = addField(margin + 3, tempY, 'Disponierte EM (FW):', doc.disponierte_em_fw, col2Width);
tempY = boxY;
tempY = addField(margin + 3 + col2Width + 3, tempY, 'Disponierte EM (RD):', doc.disponierte_em_rd, col2Width);
currentY += 37;

// SECTION 4: PATIENTEN-DATEN
boxY = drawBox(margin, currentY, fullWidth, 55, '4. PATIENTEN-DATEN');
tempY = boxY;
tempY = addField(margin + 3, tempY, 'Erhoben:', doc.patienten_daten_erhoben ? 'Ja' : 'Nein', fullWidth);

if (doc.patienten_daten_erhoben) {
  tempY = addField(margin + 3, tempY, 'Name:', doc.patient_name, col2Width);
  tempY = addField(margin + 3, tempY, 'Alter/Geburtsdatum:', doc.patient_alter_geburtsdatum, col2Width);
  
  tempY = boxY + 20;
  tempY = addField(margin + 3 + col2Width + 3, tempY, 'Pat.-Nummer ILS:', doc.patient_nummer_ils, col2Width);
}

currentY += 57;

// SECTION 5: SACHVERHALT
boxY = drawBox(margin, currentY, fullWidth, 60, '5. SACHVERHALT VOR ORT');
pdf.setFontSize(10);
const sachverhaltLines = pdf.splitTextToSize(doc.sachverhalt || '-', fullWidth - 6);
pdf.text(sachverhaltLines, margin + 3, boxY);
currentY += 62;

// SECTION 6: PROTOKOLLPFLICHT
boxY = drawBox(margin, currentY, fullWidth, 50, '6. PROTOKOLLPFLICHT (§630f BGB)');
tempY = boxY;
tempY = addField(margin + 3, tempY, 'War dieser Einsatz protokollpflichtig?', 
  doc.protokollpflichtig ? 'Ja' : 'Nein', fullWidth);

if (doc.protokollpflichtig_begruendung) {
  pdf.setFontSize(9.5);
  pdf.setFont(undefined, 'bold');
  pdf.text('Begründung:', margin + 3, tempY);
  pdf.setFont(undefined, 'normal');
  const begruendungLines = pdf.splitTextToSize(doc.protokollpflichtig_begruendung, fullWidth - 6);
  pdf.text(begruendungLines, margin + 3, tempY + 5);
}

currentY += 52;

// SECTION 7: VERANTWORTLICHER
boxY = drawBox(margin, currentY, fullWidth, 45, '7. VERANTWORTLICHER');
tempY = boxY;
tempY = addField(margin + 3, tempY, 'Name:', doc.verantwortlicher_name, col2Width);
tempY = addField(margin + 3, tempY, 'Qualifikation:', doc.verantwortlicher_qualifikation, col2Width);

tempY = boxY;
tempY = addField(margin + 3 + col2Width + 3, tempY, 'War die verantwortliche Person mit der', '', col2Width);
pdf.setFontSize(9);
pdf.text('Thematik der Einsatz-/Patientendokumentation', margin + 3 + col2Width + 3, tempY);
tempY += 5;
pdf.text('(gem. §630f BGB) unterwiesen?', margin + 3 + col2Width + 3, tempY);
tempY += 5;
pdf.setFontSize(10);
pdf.setFont(undefined, 'bold');
pdf.text(doc.verantwortlicher_unterwiesen ? 'Ja' : 'Nein', margin + 3 + col2Width + 3, tempY);
pdf.setFont(undefined, 'normal');

currentY += 47;

// SECTION 8: NACHERFASSUNG
boxY = drawBox(margin, currentY, fullWidth, 45, '8. NACHERFASSUNG');
tempY = boxY;
tempY = addField(margin + 3, tempY, 'Nacherfasst von:', doc.nacherfasst_von_name, col2Width);
tempY = addField(margin + 3, tempY, 'Qualifikation:', doc.nacherfasst_von_qualifikation, col2Width);

tempY = boxY;
tempY = addField(margin + 3 + col2Width + 3, tempY, 'Datum:', 
  doc.nacherfasst_datum ? new Date(doc.nacherfasst_datum).toLocaleString('de-DE') : '-', col2Width);

currentY += 47;

// SECTION 9: UNTERSCHRIFT
boxY = drawBox(margin, currentY, fullWidth, 40, '9. UNTERSCHRIFT');

if (doc.nacherfasst_unterschrift) {
  try {
    pdf.addImage(doc.nacherfasst_unterschrift, 'PNG', margin + 3, boxY, 60, 25);
  } catch(e) {
    pdf.text('(Unterschrift vorhanden)', margin + 3, boxY + 5);
  }
} else {
  pdf.text('Keine Unterschrift vorhanden', margin + 3, boxY + 5);
}

currentY += 42;

// SECTION 10: HINWEISE
boxY = drawBox(margin, currentY, fullWidth, 30, '10. RECHTLICHE HINWEISE');
pdf.setFontSize(8);
pdf.setTextColor(80, 80, 80);
pdf.text('Dieses Dokument wurde gemäß §630f BGB (Dokumentationspflicht) erstellt.', margin + 3, boxY);
pdf.text('Die Angaben wurden nach bestem Wissen und Gewissen erfasst.', margin + 3, boxY + 5);
pdf.text('Fehlerhafte oder unvollständige Angaben können zu rechtlichen Konsequenzen führen.', 
  margin + 3, boxY + 10);

currentY += 32;

// FOOTER
pdf.setFontSize(8);
pdf.setTextColor(100, 100, 100);
pdf.text(`${orgName} - Einsatznacherfassung`, margin, pageHeight - 5);
pdf.text(`Seite 1 von 1`, pageWidth - margin - 25, pageHeight - 5);
pdf.text(`Erstellt: ${new Date().toLocaleString('de-DE')}`, pageWidth / 2 - 30, pageHeight - 5);

// Save PDF
const stichwort = doc.stichwort ? doc.stichwort.replace(/[^a-zA-Z0-9]/g, '_') : 'Nacherfassung';
const timestamp = new Date().toISOString().slice(0, 10);
pdf.save(`Nacherfassung_${stichwort}_${timestamp}.pdf`);

showMsg('✅ PDF erfolgreich erstellt!', 'success');
```

} catch(e) {
console.error(‘PDF Error:’, e);
showMsg(’❌ Fehler beim PDF-Export: ’ + e.message, ‘error’);
}
}

console.log(‘✅ patientendokumentation-dateien.js erfolgreich geladen!’);
