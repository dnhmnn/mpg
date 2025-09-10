// netlify/functions/presign.js
// Node 18+ empfohlen (Netlify hat fetch/FormData/Blob global).
// POST JSON: { file_b64, filename?, mime_type?, expires_in? }
// Antwort: { ok:true, url, id, expires_in } oder { ok:false, error:... }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const json = (status, body) => ({
  statusCode: status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
    if (event.httpMethod !== 'POST') return json(405, { ok:false, error:'Method Not Allowed' });

    // --- Eingabe ---
    const {
      file_b64,
      filename = `patient-doc-${Date.now()}.pdf`,
      mime_type = 'application/pdf',
      expires_in = 86400 // 24h
    } = JSON.parse(event.body || '{}');

    if (!file_b64) return json(400, { ok:false, error:'file_b64 missing' });

    // --- ENV & Normalisierung ---
    const STORAGE_BASE = (process.env.NHOST_STORAGE_URL || '').replace(/\/v1\/?$/,'').replace(/\/$/,'');
    const AUTH_BASE    = (process.env.NHOST_AUTH_URL || '').replace(/\/v1\/?$/,'').replace(/\/$/,'');
    const SVC_EMAIL    = process.env.NHOST_SERVICE_EMAIL || '';
    const SVC_PASS     = process.env.NHOST_SERVICE_PASSWORD || '';
    const BUCKET       = process.env.PATIENT_DOCS_BUCKET || 'default';

    if (!/\.storage\./.test(STORAGE_BASE) || !/\.auth\./.test(AUTH_BASE) || !SVC_EMAIL || !SVC_PASS) {
      return json(500, {
        ok:false,
        error:'Missing NHOST_AUTH_URL / NHOST_STORAGE_URL / NHOST_SERVICE_EMAIL / NHOST_SERVICE_PASSWORD'
      });
    }

    // --- Service-Login ---
    const signinUrl = `${AUTH_BASE}/v1/signin/email-password`;
    const loginRes  = await fetch(signinUrl, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ email: SVC_EMAIL, password: SVC_PASS })
    });
    const loginTxt = await loginRes.text();
    if (!loginRes.ok) return json(502, { ok:false, error:`service login failed: ${loginRes.status} ${loginTxt}` });

    let token = null;
    try {
      const lj = JSON.parse(loginTxt);
      token = lj?.session?.accessToken || lj?.accessToken || null;
    } catch {}
    if (!token) return json(502, { ok:false, error:`service login ok but no accessToken in: ${loginTxt}` });

    // --- Datei vorbereiten ---
    const safeName = String(filename).replace(/[^\w.\-]+/g,'_').slice(0,120) || `file-${Date.now()}.pdf`;
    const buffer   = Buffer.from(file_b64, 'base64');
    const fileBlob = new Blob([buffer], { type: mime_type });

    const form = new FormData();
    form.append('file', fileBlob, safeName);
    form.append('bucketId', BUCKET);

    // --- Upload ---
    const uploadUrl = `${STORAGE_BASE}/v1/files`;
    const upRes  = await fetch(uploadUrl, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    const upText = await upRes.text();
    if (!upRes.ok) return json(502, { ok:false, error:`upload failed @ ${uploadUrl}: ${upRes.status} ${upText}` });

    // --- ID extrahieren (versch. Formate) ---
    let uploadedId = null;
    try {
      const j = JSON.parse(upText);
      if (Array.isArray(j) && j[0]?.id) uploadedId = j[0].id;
      else if (j?.id) uploadedId = j.id;
      else if (j?.fileMetadata?.[0]?.id) uploadedId = j.fileMetadata[0].id;
      else if (j?.processedFiles?.[0]?.id) uploadedId = j.processedFiles[0].id;
    } catch {}
    if (!uploadedId) return json(502, { ok:false, error:`
