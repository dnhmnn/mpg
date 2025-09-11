// netlify/functions/patient-docs-admin.js
export const handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, cors);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const action = body.action;
    if (!action) return json({ error: 'Missing action' }, 400, cors);

    switch (action) {
      /* ====== PROTOKOLLE ====== */
      case 'list':            return json(await listProt(body), 200, cors);
      case 'get':             return json(await getProt(body), 200, cors);
      case 'approve':         return json(await approveProt(body), 200, cors);
      case 'insert_manual':   return json(await insertManualProt(body), 200, cors);

      /* ====== NACHERFASSUNG ====== */
      case 'n_list':          return json(await listNach(body), 200, cors);
      case 'n_get':           return json(await getNach(body), 200, cors);
      case 'n_insert':        return json(await insertNach(body), 200, cors);

      default:
        return json({ error: `Unknown action: ${action}` }, 400, cors);
    }
  } catch (e) {
    return json({ error: e.message || String(e) }, 500, cors);
  }
};

/* ================== Helpers ================== */
const GQL = process.env.HASURA_GRAPHQL_ENDPOINT;
const ADMIN = process.env.HASURA_ADMIN_SECRET;

async function gql(query, variables = {}) {
  if (!GQL || !ADMIN) throw new Error('HASURA env not set');
  const res = await fetch(GQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const out = await res.json();
  if (out.errors?.length) throw new Error(out.errors[0].message);
  return out.data;
}
function json(data, status = 200, headers = {}) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) };
}
function includesCI(hay, needle) {
  return (hay || '').toString().toLowerCase().includes((needle || '').toString().toLowerCase());
}

/* ================== GraphQL ================== */
const FIELDS_PROT = `
  id created_at status submitter_name author_signature
  team_lead_name team_lead_signature approved_at expires_at
  payload
`;
const QUERY_LIST_PROT = `
  query ($limit:Int!) {
    patient_docs(order_by:{created_at:desc}, limit:$limit) { ${FIELDS_PROT} }
  }
`;
const QUERY_LIST_PROT_STATUS = `
  query ($limit:Int!, $status:String!) {
    patient_docs(order_by:{created_at:desc}, limit:$limit, where:{status:{_eq:$status}}) { ${FIELDS_PROT} }
  }
`;
const QUERY_GET_PROT = `
  query ($id:uuid!) { patient_docs_by_pk(id:$id){ ${FIELDS_PROT} } }
`;
const MUT_APPROVE = `
  mutation ($id:uuid!, $name:String!, $sig:String!, $ts:timestamptz!) {
    update_patient_docs_by_pk(
      pk_columns:{id:$id},
      _set:{ status:"approved", team_lead_name:$name, team_lead_signature:$sig, approved_at:$ts }
    ){ id }
  }
`;
const MUT_INSERT_MANUAL = `
  mutation ($payload:jsonb!, $submitter:String, $authorSig:String) {
    insert_patient_docs_one(object:{
      payload:$payload,
      submitter_name:$submitter,
      author_signature:$authorSig,
      status:"submitted"
    }) { id }
  }
`;

/* ===== Nacherfassung ===== */
const FIELDS_N = ` id created_at expires_at payload `;
const QUERY_LIST_N = `
  query ($limit:Int!) {
    patient_docs_nacherfassung(order_by:{created_at:desc}, limit:$limit){ ${FIELDS_N} }
  }
`;
const QUERY_GET_N = `
  query ($id:uuid!){
    patient_docs_nacherfassung_by_pk(id:$id){ ${FIELDS_N} }
  }
`;
const MUT_INSERT_N = `
  mutation ($payload:jsonb!){
    insert_patient_docs_nacherfassung_one(object:{ payload:$payload }){ id }
  }
`;

/* ================== Actions (Protokolle) ================== */
async function listProt({ search = '', status = '', limit = 200 }) {
  const q = status ? QUERY_LIST_PROT_STATUS : QUERY_LIST_PROT;
  const vars = status ? { limit, status } : { limit };
  const data = await gql(q, vars);
  let items = (data.patient_docs || []);
  if (search) {
    items = items.filter(it => {
      const p = it.payload || {};
      return (
        includesCI(it.id, search) ||
        includesCI(it.submitter_name, search) ||
        includesCI(it.team_lead_name, search) ||
        includesCI(p.name, search) ||
        includesCI(p.vorname, search) ||
        includesCI(p.einsatz_nr, search)
      );
    });
  }
  return { items };
}
async function getProt({ id }) {
  if (!id) throw new Error('id missing');
  const data = await gql(QUERY_GET_PROT, { id });
  if (!data.patient_docs_by_pk) throw new Error('not found');
  return { item: data.patient_docs_by_pk };
}
async function approveProt({ id, name, signature }) {
  if (!id || !name || !signature) throw new Error('id/name/signature missing');
  const ts = new Date().toISOString();
  const data = await gql(MUT_APPROVE, { id, name, sig: signature, ts });
  return { id: data.update_patient_docs_by_pk?.id };
}
async function insertManualProt({ payload, submitterName = null, authorSignature = null }) {
  if (!payload || typeof payload !== 'object') throw new Error('payload missing');
  const data = await gql(MUT_INSERT_MANUAL, { payload, submitter: submitterName, authorSig: authorSignature });
  return { id: data.insert_patient_docs_one?.id };
}

/* ================== Actions (Nacherfassung) ================== */
async function listNach({ search = '', limit = 200 }) {
  const data = await gql(QUERY_LIST_N, { limit });
  let items = (data.patient_docs_nacherfassung || []);
  if (search) {
    items = items.filter(it => {
      const p = it.payload || {};
      return (
        includesCI(it.id, search) ||
        includesCI(p.n_name, search) ||
        includesCI(p.n_vorname, search) ||
        includesCI(p.n_stichwort, search) ||
        includesCI(p.n_adresse, search)
      );
    });
  }
  return { items };
}
async function getNach({ id }) {
  if (!id) throw new Error('id missing');
  const data = await gql(QUERY_GET_N, { id });
  if (!data.patient_docs_nacherfassung_by_pk) throw new Error('not found');
  return { item: data.patient_docs_nacherfassung_by_pk };
}
async function insertNach({ payload }) {
  if (!payload || typeof payload !== 'object') throw new Error('payload missing');
  const data = await gql(MUT_INSERT_N, { payload });
  return { id: data.insert_patient_docs_nacherfassung_one?.id };
}
