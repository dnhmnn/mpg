// netlify/functions/graphql.js

// Erwartete ENV Variablen (bei Netlify > Site > Environment variables):
// - HASURA_GRAPHQL_ENDPOINT  (z. B. https://hpjfrhktprpuuxvvlpsb.hasura.eu-central-1.nhost.run/v1/graphql)
// - HASURA_ADMIN_SECRET      (Admin Secret aus Nhost/Hasura)
// Optional:
// - HASURA_DEFAULT_ROLE      (z. B. "user" oder "anonymous")
// - CORS_ALLOW_ORIGIN        (Standard "*")

const HASURA_ENDPOINT =
  process.env.HASURA_GRAPHQL_ENDPOINT ||
  process.env.HASURA_GRAPHQL_URL ||
  process.env.GRAPHQL_URL;

const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;
const ALLOW_ORIGIN = process.env.CORS_ALLOW_ORIGIN || "*";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-hasura-role",
  };
}

exports.handler = async (event) => {
  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }

  if (!HASURA_ENDPOINT || !HASURA_ADMIN_SECRET) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        error:
          "Missing env vars: HASURA_GRAPHQL_ENDPOINT and/or HASURA_ADMIN_SECRET",
      }),
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Use POST with { query, variables }" }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const { query, variables, operationName } = payload || {};
  if (!query) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Body must contain 'query'" }),
    };
  }

  try {
    const res = await fetch(HASURA_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": HASURA_ADMIN_SECRET,
        ...(process.env.HASURA_DEFAULT_ROLE
          ? { "x-hasura-role": process.env.HASURA_DEFAULT_ROLE }
          : {}),
      },
      body: JSON.stringify({ query, variables, operationName }),
    });

    const text = await res.text();
    let out;
    try {
      out = JSON.parse(text);
    } catch {
      out = { raw: text };
    }

    return {
      statusCode: res.ok ? 200 : res.status,
      headers: corsHeaders(),
      body: JSON.stringify(out),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Fetch to Hasura failed", detail: String(err) }),
    };
  }
};