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
    const BASE = RAW.replace(/\/v1\/?$/,'').replace(/\/$/,'');   // entfernt evtl. /v1 & trailing /
    const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET;
    const BUCKET = process.env.PATIENT_DOCS_BUCKET || 'default';

    console.log('RAW STORAGE URL =', RAW);
    console.log('BASE            =', BASE);
    console.log('BUCKET          =', BUCKET);

    if (!BASE || !ADMIN_SECRET) {
      return { statusCode: 500, body: JSON.stringify({ ok:false, error:'Missing env NHOST_STORAGE_URL or NHOST_ADMIN_SECRET' }) };
    }
    if (!/\.storage\./.test(BASE)) {
      return { statusCode: 500, body: JSON.stringify({
        ok:false,
        error:'NHOST_STORAGE_URL must be the *storage* domain (…storage…nhost.run), not graphql.',
        got: BASE
      })};
    }

    // --- Datei vorbereiten ---
    const safeName = String(filename).replace(/[^\w.\-]+/g,'_').slice(0,120) || `file-${Date.now()}.pdf`;
    const buffer   = Buffer.from(file_b64, 'base64');

    // Node 18: fetch/FormData/Blob global
    const formA = new FormData(); // Variante A: "file"
    formA.append('file', new Blob([buffer], { type: mime_type }), safeName);
    formA.append('bucketId', BUCKET);

    const formB = new FormData(); // Variante B: "files[]"
    formB.append('files[]', new Blob([buffer], { type: mime_type }), safeName);
    formB.append('bucketId', BUCKET);

    // ---- Upload-Versuche (beste Reihenfolge) ----
    const attempts = [
      { url: `${BASE}/v1/storage/files`,  form: formA, label: 'files(file)' },
      { url: `${BASE}/v1/storage/files`,  form: formB, label: 'files(files[])' },
      { url: `${BASE}/v1/storage/upload`, form: formA, label: 'upload(file)' } // legacy / manche Images
    ];

    let uploadedId = null;
    const errors = [];

    for (const a of attempts) {
      console.log('Try:', a.label, a.url);
      try {
        const r = await fetch(a.url, {
          method: 'POST',
          headers: { 'x-hasura-admin-secret': ADMIN_SECRET },
          body: a.form
        });
        const t = await r.text();
        if (!r.ok) {
          errors.push(`${a.label} @ ${a.url}: ${r.status} ${t.slice(0,200)}`);
          continue;
        }
        // ID aus versch. Formaten extrahieren
        let id = null;
        try {
          const j = JSON.parse(t);
          if (Array.isArray(j) && j[0]?.id) id = j[0].id;
          else if (j?.id) id = j.id;
          else if (j?.fileMetadata?.[0]?.id) id = j.fileMetadata[0].id;
          else if (j?.processedFiles?.[0]?.id) id = j.processedFiles[0].id;
        } catch {}
        if (!id) { errors.push(`${a.label} ok but no id in: ${t.slice(0,200)}`); continue; }
        uploadedId = id;
        break;
      } catch (e) {
        errors.push(`${a.label} fetch error: ${String(e?.message || e)}`);
      }
    }

    if (!uploadedId) {
      return { statusCode: 502, body: JSON.stringify({ ok:false, error:'upload failed', details: errors }) };
    }

    // --- Presigned URL erzeugen ---
    const exp = Math.max(60, Math.min(parseInt(expires_in,10) || 86400, 7*86400));
    const presignUrl = `${BASE}/v1/storage/files/${uploadedId}/presignedurl?expiresIn=${exp}`;
    console.log('Presign:', presignUrl);

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

    return { statusCode: 200, headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ ok:true, url, id: uploadedId, expires_in: exp }) };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:String(err?.message || err) }) };
  }
};
