// netlify/functions/graphql.js
// Serverless-Proxy zu Hasura (POST /api/graphql)

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type'
};

exports.handler = async (event) => {
  // CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Use POST' };
  }

  try {
    const endpoint = process.env.HASURA_GRAPHQL_ENDPOINT;
    const adminSecret = process.env.HASURA_ADMIN_SECRET;

    if (!endpoint || !adminSecret) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing env vars' })
      };
    }

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hasura-admin-secret': adminSecret
      },
      body: event.body
    });

    const text = await resp.text();
    return {
      statusCode: resp.status,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      body: text
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: e.message || String(e) })
    };
  }
};