// netlify/functions/presign.js
// POST JSON: { file_b64, filename?, mime_type?, expires_in? }
// Lädt Base64-Datei in Nhost Storage (Bucket) und gibt eine befristete Download-URL zurück.

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

    // --- ENV lesen & normalisieren ---
    const RAW_STORAGE = process.env.NHOST_STORAGE_URL || '';
    const STORAGE_BASE = RAW_STORAGE.replace(/\/v1\/?$/,'').replace(/\/$/,''); // evtl. /v1 & trailing / entfernen
    const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET || '';
    const BUCKET       = process.env.PATIENT_DOCS_BUCKET || 'default';

    const RAW_AUTH   = process.env.NHOST_AUTH_URL || ''; // für Fallback-Login
    const AUTH_BASE  = RAW_AUTH.replace(/\/v1\/?$/,'').replace(/\/$/,'');
    const SERVICE_EMAIL    = process.env.NHOST_SERVICE_EMAIL || '';
    const SERVICE_PASSWORD = process.env.NHOST_SERVICE_PASSWORD || '';

    console.log('STORAGE_BASE=', STORAGE_BASE);
    console.log('AUTH_BASE   =', AUTH_BASE);
    console.log('ADMIN_SECRET_LEN=', ADMIN_SECRET.length);
    console.log('BUCKET=', BUCKET);

    if (!STORAGE_BASE) {
      return { statusCode: 500, body: JSON.stringify({ ok:false, error:'NHOST_STORAGE_URL missing' }) };
    }
    if (!/\.storage\./.test(STORAGE_BASE)) {
      return { statusCode: 500, body: JSON.stringify({ ok:false, error:'NHOST_STORAGE_URL must be a storage domain (…storage…nhost.run)', got: STORAGE_BASE }) };
    }

    // --- Datei vorbereiten ---
    const safeName = String(filename).replace(/[^\w.\-]+/g,'_').slice(0,120) || `file-${Date.now()}.pdf`;
    const buffer   = Buffer.from(file_b64, 'base64');
    const fileBlob = new Blob([buffer], { type: mime_type });

    // Upload-Form
    const form = new FormData();
    form.append('file', fileBlob, safeName);
    form.append('bucketId', BUCKET);

    const uploadUrl = `${STORAGE_BASE}/v1/files`;

    // Helper: Upload mit Headern versuchen
    async function tryUpload(headers) {
      const r = await fetch(uploadUrl, { method: 'POST', headers, body: form });
      const t = await r.text();
      return { ok: r.ok, status: r.status, text: t };
    }

    // 1) Versuch: Admin-Secret
    let useBearer = false;
    let up = await tryUpload({ 'x-hasura-admin-secret': ADMIN_SECRET, 'x-hasura-role': 'admin' });

    // 2) Fallback bei 401/403: Service-User einloggen und mit Bearer hochladen
    if (!up.ok && (up.status === 401 || up.status === 403)) {
      if (!AUTH_BASE || !SERVICE_EMAIL || !SERVICE_PASSWORD) {
        return { statusCode: 502, body: JSON.stringify({ ok:false, error:`upload failed with admin-secret (${up.status}). Missing service-user envs for fallback.` }) };
      }
      const signinUrl = `${AUTH_BASE}/v1/signin/email-password`;
      const loginRes  = await fetch(signinUrl, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ email: SERVICE_EMAIL, password: SERVICE_PASSWORD })
      });
      const loginTxt = await loginRes.text();
      if (!loginRes.ok) {
        return { statusCode: 502, body: JSON.stringify({ ok:false, error:`service login failed: ${loginRes.status} ${loginTxt}` }) };
      }
      let token = null;
      try {
        const lj = JSON.parse(loginTxt);
        token = lj?.session?.accessToken || lj?.accessToken || null;
      } catch(_) {}
      if (!token) {
        return { statusCode: 502, body: JSON.stringify({ ok:false, error:`service login ok but no accessToken in: ${loginTxt}` }) };
      }

      useBearer = true;
      up = await tryUpload({ 'Authorization': `Bearer ${token}` });
    }

    if (!up.ok) {
      return { statusCode: 502, body: JSON.stringify({ ok:false, error:`upload failed @ ${uploadUrl}: ${up.status} ${up.text}` }) };
    }

    // ID extrahieren
    let uploadedId = null;
    try {
      const j = JSON.parse(up.text);
      if (Array.isArray(j) && j[0]?.id) uploadedId = j[0].id;
      else if (j?.id) uploadedId = j.id;
      else if (j?.fileMetadata?.[0]?.id) uploadedId = j.fileMetadata[0].id;
      else if (j?.processedFiles?.[0]?.id) uploadedId = j.processedFiles[0].id;
    } catch(_) {}
    if (!uploadedId) {
      return { statusCode: 502, body: JSON.stringify({ ok:false, error:`upload ok but no id found: ${up.text}` }) };
    }

    // --- Presigned URL erzeugen ---
    const exp = Math.max(60, Math.min(parseInt(expires_in,10) || 86400, 7*86400)); // 1min–7 Tage
    const presignUrl = `${STORAGE_BASE}/v1/files/${uploadedId}/presignedurl?expiresIn=${exp}`;

    const presignHeaders = useBearer
      ? { 'Authorization':'Bearer ' + (await (async ()=>{ /* reuse not needed; presign accepts same token */ return ''; })()) } // noop – Bearer wird nur gesetzt, wenn oben verwendet
      : { 'x-hasura-admin-secret': ADMIN_SECRET, 'x-hasura-role': 'admin' };

    // Wenn Bearer verwendet wurde, brauchen wir denselben Token:
    if (useBearer) {
      // wir holen nochmal schnell einen Token (kurzlebig, sicher)
      const signinUrl = `${AUTH_BASE}/v1/signin/email-password`;
      const loginRes  = await fetch(signinUrl, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ email: SERVICE_EMAIL, password: SERVICE_PASSWORD })
      });
      const loginTxt = await loginRes.text();
      if (!loginRes.ok) {
        return { statusCode: 502, body: JSON.stringify({ ok:false, error:`service login (presign) failed: ${loginRes.status} ${loginTxt}` }) };
      }
      let token2 = null;
      try {
        const lj = JSON.parse(loginTxt);
        token2 = lj?.session?.accessToken || lj?.accessToken || null;
      } catch(_) {}
      if (!token2) {
        return { statusCode: 502, body: JSON.stringify({ ok:false, error:`service login ok (presign) but no accessToken in: ${loginTxt}` }) };
      }
      presignHeaders.Authorization = `Bearer ${token2}`;
    }

    const preRes  = await fetch(presignUrl, { headers: presignHeaders });
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
      headers: { 'Content-Type':'application/json; charset=utf-8' },
      body: JSON.stringify({ ok:true, url, id: uploadedId, expires_in: exp })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:String(err?.message || err) }) };
  }
};
