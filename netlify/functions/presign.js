// netlify/functions/presign.js
// Erwartet POST-JSON: { file_b64, filename, mime_type, expires_in }
// -> lädt Datei in Nhost-Storage (Bucket) und gibt befristete Download-URL zurück.

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
    const RAW  = process.env.NHOST_STORAGE_URL || '';
    const BASE = RAW.replace(/\/v1\/?$/,'').replace(/\/$/,''); // entfernt evtl. /v1 & trailing /
    const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET;
    const BUCKET = process.env.PATIENT_DOCS_BUCKET || 'default';

    if (!BASE || !ADMIN_SECRET) {
      return { statusCode: 500, body: JSON.stringify({ ok:false, error:'Missing env NHOST_STORAGE_URL or NHOST_ADMIN_SECRET' }) };
    }
    if (!/\.storage\./.test(BASE)) {
      return { statusCode: 500, body: JSON.stringify({
        ok:false,
        error:'NHOST_STORAGE_URL must be a *storage* domain (…storage…nhost.run), not graphql.',
        got: BASE
      })};
    }

    // --- Datei vorbereiten ---
    const safeName = String(filename).replace(/[^\w.\-]+/g,'_').slice(0,120) || `file-${Date.now()}.pdf`;
    const buffer   = Buffer.from(file_b64, 'base64');
    const fileBlob = new Blob([buffer], { type: mime_type });

    // Node 18: fetch/FormData/Blob sind global
    // Laut Nhost-Docs: Upload → POST /v1/files  (einzeln: "file" | mehrere: "file[]")
    // Wir versuchen erst "file", bei Bedarf "file[]".
    const formA = new FormData();
    formA.append('file', fileBlob, safeName);
    formA.append('bucketId', BUCKET);

    const formB = new FormData();
    formB.append('file[]', fileBlob, safeName);
    formB.append('bucketId', BUCKET);

    const uploadUrl = `${BASE}/v1/files`;
    let uploadedId = null;
    let lastErr = null;

    for (const [label, form] of [['file', formA], ['file[]', formB]]) {
      try {
        const upRes  = await fetch(uploadUrl, {
          method: 'POST',
          // Admin-Zugriff:
          headers: { 'x-hasura-admin-secret': ADMIN_SECRET },
          body: form
        });
        const upText = await upRes.text();
        if (!upRes.ok) {
          lastErr = `${label} → ${upRes.status} ${upText}`;
          continue;
        }
        // ID aus möglichen Formaten ziehen
        let id = null;
        try {
          const j = JSON.parse(upText);
          if (Array.isArray(j) && j[0]?.id) id = j[0].id;
          else if (j?.id) id = j.id;
          else if (j?.fileMetadata?.[0]?.id) id = j.fileMetadata[0].id;
          else if (j?.processedFiles?.[0]?.id) id = j.processedFiles[0].id;
        } catch {}
        if (!id) { lastErr = `upload ok but no id in: ${upText}`; continue; }
        uploadedId = id;
        break;
      } catch (e) {
        lastErr = String(e?.message || e);
      }
    }

    if (!uploadedId) {
      return { statusCode: 502, body: JSON.stringify({ ok:false, error:`upload failed @ ${uploadUrl}: ${lastErr}` }) };
    }

    // --- Presigned URL erzeugen ---
    const exp = Math.max(60, Math.min(parseInt(expires_in,10) || 86400, 7*86400)); // 1min–7 Tage
    const presignUrl = `${BASE}/v1/files/${uploadedId}/presignedurl?expiresIn=${exp}`;

    const preRes  = await fetch(presignUrl, { headers: { 'x-hasura-admin-secret': ADMIN_SECRET } });
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
