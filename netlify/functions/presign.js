// netlify/functions/presign.js
// POST { file_b64, filename, mime_type, expires_in }
// -> lädt in Nhost Storage (Bucket) und liefert eine befristete Download-URL.

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { file_b64, filename = `patient-doc-${Date.now()}.pdf`,
            mime_type = 'application/pdf', expires_in = 86400 } =
      JSON.parse(event.body || '{}');

    if (!file_b64) {
      return { statusCode: 400, body: JSON.stringify({ ok:false, error:'file_b64 missing' }) };
    }

    // --- ENV lesen & normalisieren ---
    const RAW  = process.env.NHOST_STORAGE_URL || '';
    const BASE = RAW.replace(/\/v1\/?$/,'').replace(/\/$/,'');   // entfernt evtl. /v1 & Slash
    const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET;
    const BUCKET = process.env.PATIENT_DOCS_BUCKET || 'default';

    // Debug ins Log (nicht im Response)
    console.log('NHOST_STORAGE_URL (RAW)=', RAW);
    console.log('Storage BASE           =', BASE);
    console.log('Bucket                 =', BUCKET);

    if (!BASE || !ADMIN_SECRET) {
      return { statusCode: 500, body: JSON.stringify({ ok:false, error:'Missing env NHOST_STORAGE_URL or NHOST_ADMIN_SECRET' }) };
    }
    if (!/\.storage\./.test(BASE)) {
      // Ganz typischer Fehler: GraphQL-URL statt Storage-URL
      return { statusCode: 500, body: JSON.stringify({
        ok:false,
        error:'NHOST_STORAGE_URL must be the *storage* domain (…storage…nhost.run), not graphql.',
        got: BASE
      })};
    }

    // --- Datei vorbereiten ---
    const safeName = String(filename).replace(/[^\w.\-]+/g,'_').slice(0,120) || `file-${Date.now()}.pdf`;
    const buffer   = Buffer.from(file_b64, 'base64');

    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mime_type }), safeName);
    form.append('bucketId', BUCKET);

    // --- Upload: versuche beide bekannten Routen nacheinander ---
    const candidates = [`${BASE}/v1/storage/files`, `${BASE}/v1/storage/upload`];
    let uploadedId = null, lastFail = null;

    for (const url of candidates) {
      console.log('Try upload endpoint:', url);
      try {
        const upRes  = await fetch(url, { method:'POST', headers:{ 'x-hasura-admin-secret': ADMIN_SECRET }, body: form });
        const upText = await upRes.text();
        if (!upRes.ok) {
          lastFail = `upload failed @ ${url}: ${upRes.status} ${upText}`;
          console.warn(lastFail);
          continue; // probiere den nächsten Kandidaten
        }
        // IDs aus verschiedenen Response-Formaten holen
        let id = null;
        try {
          const j = JSON.parse(upText);
          if (Array.isArray(j) && j[0]?.id) id = j[0].id;
          else if (j?.id) id = j.id;
          else if (j?.fileMetadata?.[0]?.id) id = j.fileMetadata[0].id;
          else if (j?.processedFiles?.[0]?.id) id = j.processedFiles[0].id;
        } catch {}
        if (!id) { lastFail = `upload ok @ ${url} but no id found: ${upText}`; console.warn(lastFail); continue; }
        uploadedId = id;
        break; // Upload hat geklappt
      } catch (e) {
        lastFail = `upload error @ ${url}: ${String(e?.message || e)}`;
        console.warn(lastFail);
      }
    }

    if (!uploadedId) {
      return { statusCode: 502, body: JSON.stringify({ ok:false, error: lastFail || 'upload failed' }) };
    }

    // --- Presigned URL erzeugen ---
    const exp = Math.max(60, Math.min(parseInt(expires_in,10) || 86400, 7*86400)); // 1min–7Tage
    const presignUrl = `${BASE}/v1/storage/files/${uploadedId}/presignedurl?expiresIn=${exp}`;
    console.log('Presign URL:', presignUrl);

    const preRes  = await fetch(presignUrl, { headers:{ 'x-hasura-admin-secret': ADMIN_SECRET } });
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

    return { statusCode: 200, headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ ok:true, url, id: uploadedId, expires_in: exp }) };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:String(err?.message || err) }) };
  }
};
