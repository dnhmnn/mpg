'use strict';

// POST JSON: { file_b64, filename?, mime_type?, expires_in? }
// Antwort: { ok:true, url, id, expires_in } oder { ok:false, error }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function json(status, obj) {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS_HEADERS },
    body: JSON.stringify(obj)
  };
}

const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS };
    if (event.httpMethod !== 'POST')   return json(405, { ok: false, error: 'Method Not Allowed' });

    // ---- Payload parsen ----
    let body = {};
    try { body = JSON.parse(event.body || '{}'); }
    catch { return json(400, { ok:false, error:'Bad JSON payload' }); }

    const file_b64   = body.file_b64;
    const filename   = body.filename || ('patient-doc-' + Date.now() + '.pdf');
    const mime_type  = body.mime_type || 'application/pdf';
    const expires_in = parseInt(body.expires_in, 10) || 86400;

    if (!file_b64) return json(400, { ok:false, error:'file_b64 missing' });

    // ---- ENV lesen & normalisieren ----
    const STORAGE_BASE = (process.env.NHOST_STORAGE_URL || '').replace(/\/v1\/?$/,'').replace(/\/$/,'');
    const AUTH_BASE    = (process.env.NHOST_AUTH_URL || '').replace(/\/v1\/?$/,'').replace(/\/$/,'');
    const SVC_EMAIL    = process.env.NHOST_SERVICE_EMAIL || '';
    const SVC_PASS     = process.env.NHOST_SERVICE_PASSWORD || '';
    const BUCKET       = process.env.PATIENT_DOCS_BUCKET || 'default';

    if (!/\.storage\./.test(STORAGE_BASE) || !/\.auth\./.test(AUTH_BASE) || !SVC_EMAIL || !SVC_PASS) {
      return json(500, { ok:false, error:'Missing NHOST_STORAGE_URL / NHOST_AUTH_URL / NHOST_SERVICE_EMAIL / NHOST_SERVICE_PASSWORD' });
    }

    // ---- Service-Login ----
    const signinUrl = AUTH_BASE + '/v1/signin/email-password';
    const loginRes  = await fetch(signinUrl, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ email: SVC_EMAIL, password: SVC_PASS })
    });
    const loginTxt = await loginRes.text();
    if (!loginRes.ok) return json(502, { ok:false, error: 'service login failed: ' + loginRes.status + ' ' + loginTxt });

    let token = null;
    try {
      const lj = JSON.parse(loginTxt);
      // ohne optional chaining, damit der Bundler nichts zu meckern hat
      token = (lj && lj.session && lj.session.accessToken) ? lj.session.accessToken : (lj && lj.accessToken ? lj.accessToken : null);
    } catch (e) { /* ignore */ }
    if (!token) return json(502, { ok:false, error:'service login ok but no accessToken in: ' + loginTxt });

    // ---- Datei vorbereiten ----
    const safeName = String(filename).replace(/[^\w.\-]+/g, '_').slice(0, 120) || ('file-' + Date.now() + '.pdf');
    const buffer   = Buffer.from(file_b64, 'base64');
    const blob     = new Blob([buffer], { type: mime_type });

    const form = new FormData();
    form.append('file', blob, safeName);
    form.append('bucketId', BUCKET);

    // ---- Upload ----
    const uploadUrl = STORAGE_BASE + '/v1/files';
    const upRes  = await fetch(uploadUrl, { method:'POST', headers:{ Authorization:'Bearer ' + token }, body: form });
    const upText = await upRes.text();
    if (!upRes.ok) return json(502, { ok:false, error:'upload failed @ ' + uploadUrl + ': ' + upRes.status + ' ' + upText });

    // ---- ID extrahieren ----
    let uploadedId = null;
    try {
      const j = JSON.parse(upText);
      if (Array.isArray(j) && j[0] && j[0].id) uploadedId = j[0].id;
      else if (j && j.id) uploadedId = j.id;
      else if (j && j.fileMetadata && j.fileMetadata[0] && j.fileMetadata[0].id) uploadedId = j.fileMetadata[0].id;
      else if (j && j.processedFiles && j.processedFiles[0] && j.processedFiles[0].id) uploadedId = j.processedFiles[0].id;
    } catch (e) { /* ignore */ }
    if (!uploadedId) return json(502, { ok:false, error:'upload ok but no id found: ' + upText });

    // ---- Presigned URL ----
    const exp = Math.max(60, Math.min(expires_in, 7*86400));
    const presignUrl = STORAGE_BASE + '/v1/files/' + uploadedId + '/presignedurl?expiresIn=' + exp;
    const preRes  = await fetch(presignUrl, { headers: { Authorization:'Bearer ' + token } });
    const preText = await preRes.text();
    if (!preRes.ok) return json(502, { ok:false, error:'presign failed: ' + preRes.status + ' ' + preText });

    let url = null;
    try {
      const pj = JSON.parse(preText);
      url = (pj && (pj.url || pj.presignedUrl || pj.signedUrl)) ? (pj.url || pj.presignedUrl || pj.signedUrl) : null;
    } catch (e) { /* ignore */ }
    if (!url && /^https?:\/\//i.test(preText.trim())) url = preText.trim();
    if (!url) return json(502, { ok:false, error:'presign ok but no url found: ' + preText });

    return json(200, { ok:true, url: url, id: uploadedId, expires_in: exp });
  } catch (err) {
    return json(500, { ok:false, error: String(err && err.message ? err.message : err) });
  }
};

module.exports = { handler };
/* EOF */
