// netlify/functions/presign.js
// POST { file_b64, filename, mime_type, expires_in }
// -> lädt Datei in Nhost Storage (Bucket) und liefert befristete Download-URL.

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

    // ENV & Normalisierung
    const RAW  = process.env.NHOST_STORAGE_URL || '';
    const BASE = RAW.replace(/\/v1\/?$/,'').replace(/\/$/,'');
    const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET || '';
    const BUCKET = process.env.PATIENT_DOCS_BUCKET || 'default';

    // Debug ohne Geheimnisse zu leaken
    console.log('STORAGE_BASE=', BASE);
    console.log('ADMIN_SECRET_LEN=', ADMIN_SECRET.length);
    console.log('BUCKET=', BUCKET);

    if (!BASE || !ADMIN_SECRET) {
      return { statusCode: 500, body: JSON.stringify({ ok:false, error:'Missing env NHOST_STORAGE_URL or NHOST_ADMIN_SECRET' }) };
    }
    if (!/\.storage\./.test(BASE)) {
      return { statusCode: 500, body: JSON.stringify({ ok:false, error:'NHOST_STORAGE_URL must be storage domain (…storage…nhost.run)', got: BASE }) };
    }

    // Datei vorbereiten
    const safeName = String(filename).replace(/[^\w.\-]+/g,'_').slice(0,120) || `file-${Date.now()}.pdf`;
    const buffer   = Buffer.from(file_b64, 'base64');
    const fileBlob = new Blob([buffer], { type: mime_type });

    // Nhost v1: Upload -> POST /v1/files
    const form = new FormData();
    form.append('file', fileBlob, safeName);
    form.append('bucketId', BUCKET);

    const uploadUrl = `${BASE}/v1/files`;
    const upRes  = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'x-hasura-admin-secret': ADMIN_SECRET,
        'x-hasura-role': 'admin'
      },
      body: form
    });
    const upText = await upRes.text();

    if (!upRes.ok) {
      return { statusCode: 502, body: JSON.stringify({ ok:false, error:`upload failed @ ${uploadUrl}: ${upRes.status} ${upText}` }) };
    }

    // ID aus Antwort lesen
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

    // Presigned URL erzeugen
    const exp = Math.max(60, Math.min(parseInt(expires_in,10) || 86400, 7*86400));
    const presignUrl = `${BASE}/v1/files/${uploadedId}/presignedurl?expiresIn=${exp}`;

    const preRes  = await fetch(presignUrl, {
      headers: {
        'x-hasura-admin-secret': ADMIN_SECRET,
        'x-hasura-role': 'admin'
      }
    });
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
