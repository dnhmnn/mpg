// Netlify Function: presign
exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*', // optional: deine Domain eintragen
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };
  }

  try {
    const { file_b64, filename, mime_type = 'application/pdf', expires_in = 86400 } =
      JSON.parse(event.body || '{}');
    if (!file_b64 || !filename) {
      return { statusCode: 400, headers: cors, body: 'file_b64 & filename required' };
    }

    const STORAGE_URL  = process.env.NHOST_STORAGE_URL;   // z.B. https://...nhost.run (ohne /v1)
    const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET;
    const BUCKET_ID    = process.env.PATIENT_DOCS_BUCKET || 'patient-docs';

    // Upload
    const bin = Buffer.from(file_b64, 'base64');
    const form = new FormData();
    form.append('file', new Blob([bin], { type: mime_type }), filename);
    form.append('bucketId', BUCKET_ID);

    const up = await fetch(`${STORAGE_URL}/v1/storage/files`, {
      method: 'POST',
      headers: { 'x-hasura-admin-secret': ADMIN_SECRET },
      body: form
    });
    if (!up.ok) {
      const t = await up.text();
      console.error('UPLOAD_FAIL', up.status, t);
      return { statusCode: 502, headers: cors, body: 'upload failed: ' + t };
    }
    const uploaded = await up.json(); // { id, ... }
    const fileId = uploaded?.id;

    // Presigned URL
    const ps = await fetch(`${STORAGE_URL}/v1/storage/files/${fileId}/presignedurl?expiresIn=${expires_in}`, {
      headers: { 'x-hasura-admin-secret': ADMIN_SECRET }
    });
    if (!ps.ok) {
      const t = await ps.text();
      console.error('PRESIGN_FAIL', ps.status, t);
      return { statusCode: 502, headers: cors, body: 'presign failed: ' + t };
    }
    const { presignedUrl } = await ps.json();

    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, url: presignedUrl })
    };
  } catch (e) {
    console.error('FUNCTION_ERROR', e);
    return { statusCode: 500, headers: cors, body: 'error: ' + (e?.message || String(e)) };
  }
};