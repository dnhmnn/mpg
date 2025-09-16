// Minimal-API für Patientendokumentation-Dateien
// Aktionen: ping, list, send
exports.handler = async (event) => {
  const action = (event.queryStringParameters?.action || '').toLowerCase();

  const json = (code, obj) => ({
    statusCode: code,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(obj),
  });

  if (!action) return json(400, { ok: false, error: 'Missing action' });
  if (action === 'ping') return json(200, { ok: true, pong: true, ts: Date.now() });
  if (action === 'list') {
    // Admin-Ansicht: gib vorerst eine leere Liste zurück
    return json(200, { ok: true, items: [] });
  }
  if (action === 'send') {
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Use POST' });
    let payload = {};
    try { payload = JSON.parse(event.body || '{}'); } catch {}

    // Hier würdest du normal speichern/hochladen. Wir bestätigen nur.
    const id = 'pd_' + Date.now().toString(36);
    const photoCount = (payload?.formData?.__photos || []).length;
    const sigLen = (payload?.authorSignature || '').length;

    return json(200, { ok: true, id, info: { photoCount, sigLen } });
  }

  return json(400, { ok: false, error: 'Unknown action: ' + action });
};
