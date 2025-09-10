// netlify/functions/presign.js
// POST { file_b64, filename, mime_type, expires_in }
// -> lädt Datei in Nhost Storage (Bucket) und gibt befristete Download-URL zurück.

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const {
      file_b64,
      filename = `patient-doc-${Date.now()}.pdf`,
      mime_type = 'application/pdf',
      expires_in = 86400 // 24h
    } = JSON.parse(event.body || '{}');

    if (!file_b64) {
      return { statusCode: 400, body: JSON.stringify({ ok:false, error:'file_b64 missing' }) };
    }

    // --- ENV & Normalisierung ---
    const RAW  = process.env.NHOST_STORAGE_URL || '';
    const BASE = RAW.replace(/\/v1\/?$/,'').replace(/\/$/,''); // entfernt evtl. /v1 & trailing /
    const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET || '';
    const BUCKET = process.env.PATIENT_DOCS_BUCKET || 'default';

    console.log('STORAGE_BASE=', BASE);
    console.log('ADMIN_SECRET_LEN=', ADMIN_SECRET.length);
    console.log('BUCKET=', BUCKET);

    if (!BASE || !ADMIN_SECRET) {
      return { statusCode: 500, body: JSON.stringify({ ok:false, error:'Missing env NHOST_STORAGE_URL or NHOST_ADMIN_SECRET' }) };
    }
    if (!/\.storage\./.test(BASE)) {
      return { statusCode: 500, body: JSON.stringify({ ok:false, error:'NHOST_STORAGE_URL must be storage domain (…storage…nhost.run)', got: BASE }) };
    }

    // --- Datei vorbereiten ---
    const safeName = String(filename).replace(/[^\w.\-]+/g,'_').slice(0,120) || `file-${Date.now()}.pdf`;
    const buffer   = Buffer.from(file_b64, 'base64');
    const fileBlob = new Blob([buffer], { type: mime_type });

    // Upload-Form
    const form = new FormData();
    form.append('file', fileBlob, safeName);
    form.append('bucketId', BUCKET);

    const uploadUrl = `${BASE}/v1/files`;

    // Wir testen zwei Header-Varianten (manche Storage-Setups erwarten Bearer)
    const headerVariants = [
      { name: 'admin-secret', headers: { 'x-hasura-admin-secret': ADMIN_SECRET, 'x-hasura-role': 'admin' } },
      { name: 'bearer',       headers: { 'Authorization': `Bearer ${ADMIN_SECRET}`, 'x-hasura-role': 'admin' } }
    ];

    let uploadedId = null;
    let upErrors = [];

    for (const hv of headerVariants) {
      console.log('Try upload with header variant:', hv.name);
      try {
        const upRes  = await fetch(uploadUrl, { method: 'POST', headers: hv.headers, body: form });
        const upText = await upRes.text();
        if (!upRes.ok) {
          upErrors.push(`${hv.name}: ${upRes.status} ${upText.slice(0,200)}`);
          continue;
        }
        // ID aus Antwort extrahieren (versch
