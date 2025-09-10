// netlify/functions/presign.js
// POST JSON: { file_b64, filename?, mime_type?, expires_in? }
// -> lädt Base64-PDF in Nhost-Storage (Bucket) und gibt eine befristete Download-URL zurück.
// Keine Benutzer-Anmeldung im Frontend nötig.

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

    // ENV normalisieren
    const STORAGE_BASE = (process.env.NHOST_STORAGE_URL || '').replace(/\/v1\/?$/,'').replace(/\/$/,'');
    const AUTH_BASE    = (process.env.NHOST_AUTH_URL || '').replace(/\/v1\/?$/,'').replace(/\/$/,'');
    const SVC_EMAIL    = process.env.NHOST_SERVICE_EMAIL || '';
    const SVC_PASS     = process.env.NHOST_SERVICE_PASSWORD || '';
    const BUCKET       = process.env.PATIENT_DOCS_BUCKET || 'default';

    if (!/\.storage\./.test(STORAGE_BASE)) {
      return { statusCode: 500, body: JSON.stringify({ ok:false, error:'NHOST_STORAGE_URL must be storage domain (…storage…nhost.run)' }) };
    }
    if (!AUTH_BASE || !SVC_EMAIL || !SVC_PASS) {
      return { statusCode: 500, body: JSON.stringify({ ok:false, error:'Missing NHOST_AUTH_URL / NHOST_SERVICE_EMAIL / NHOST_SERVICE_PASSWORD' }) };
    }

    // 1) Service-Login (serverseitig)
    const signinUrl = `${AUTH_BASE}/v1/signin/email-password`;
    const loginRes  = await fetch(signinUrl, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ email: SVC_EMAIL, password: SVC_PASS })
    });
    const loginTxt = await loginRes.text();
    if (!loginRes.ok) {
      return { statusCode: 502, body: JSON.stringify({ ok:false, error:`service login failed: ${loginRes.status} ${loginTxt}` }) };
    }
    let token = null;
    try {
      const lj = JSON.parse(loginTxt);
      token = lj?.session?.accessToken || lj?.accessToken || null;
    } catch {}
    if (!token) {
      return { statusCode: 502, body: JSON.stringify({ ok:false, error:`service login ok but no accessToken in: ${loginTxt}` }) };
    }

    // 2) Datei vorbereiten
    const safeName = String(filename).replace(/[^\w.\-]+/g, '_').slice(0,120) || `file-${Date.now()}.pdf`;
    const buffer   = Buffer.from(file_b64, 'base64');
    const fileBlob = new Blob([buffer], { type: mime_type });

    const form = new FormData();
    form.append('file', fileBlob, safeName);
    form.append('bucketId', BUCKET);

    // 3) Upload
    const uploadUrl = `${STORAGE_BASE}/v1/files`;
    const upRes  = await fetch(uploadUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });
    const upText = await upRes.text();
    if (!upRes.ok) {
      return { statusCode: 502, body: JSON.stringify({ ok:false, error:`upload failed @ ${uploadUrl}: ${upRes.status} ${upText}` }) };
    }

    // 4) Datei-ID extrahieren (verschiedene Antwort-Formate berücksichtigen)
    let uploadedId = null;
    try {
      const j = JSON.parse(upText);
      if (Array.isArray(j) && j[0]?.id) uploadedId = j[0].id;
      else if (j?.id) uploadedId = j.id;
      else if (j?.fileMetadata?.[0]?.id) uploadedId = j.fileMetadata[0].id;
      else if (j?.processedFiles?.[0]?.id) uploadedId = j.processedFiles[0].id;
    } catch {}
    if (!uploadedId) {
      return { statusCode: 502, body: JSON.stringify({ ok:false, error:`upload ok but no id found: ${upText}` }) };
    }

    // 5) Presigned URL erzeugen (zeitlich befristet)
    const exp = Math.max(60, Math.min(parseInt(expires_in,10) || 86400, 7*86400)); // 1min–7 Tage
    const presignUrl = `${STORAGE_BASE}/v1/files/${uploadedId}/presignedurl?expiresIn=${exp}`;
    const preRes  = await fetch(presignUrl, { headers: { Authorization: `Bearer ${token}` } });
    const preText = await preRes.text();
    if (!preRes.ok) {
      return { statusCode: 502, body: JSON.stringify({ ok:false, error:`presign failed: ${preRes.status} ${preText}` }) };
    }

    let url = null;
    try { const pj = JSON.parse(preText); url = pj.url || pj.presignedUrl || pj.signedUrl || null; } catch {}
    if (!url && /^https?:\/\//i.test(preText.trim())) url = preText.trim();
    if (!url) {
      return { statusCode: 502, body: JSON.stringify({ ok:false, error:`presign ok but no url found: ${preText}` }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ ok:true, url, id: uploadedId, expires_in: exp })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:String(err?.message || err) }) };
  }
};
