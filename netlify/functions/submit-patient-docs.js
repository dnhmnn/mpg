const fetch = require('node-fetch');

exports.handler = async (event) => {
  // CORS Headers für Frontend
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // OPTIONS Request (CORS Preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Nur POST erlauben
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { title, payload, status } = JSON.parse(event.body);

    // Validierung
    if (!title || !payload || !status) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: title, payload, status' })
      };
    }

    const GRAPHQL_ENDPOINT = 'https://hpjfrhktprpuuxvvlpsb.hasura.eu-central-1.nhost.run/v1/graphql';
    const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET;

    if (!ADMIN_SECRET) {
      console.error('NHOST_ADMIN_SECRET not configured!');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    const mutation = `
      mutation($title: String!, $payload: jsonb!, $status: String!) {
        insert_patient_docs_one(object: {
          title: $title
          payload: $payload
          status: $status
        }) {
          id
          title
          created_at
        }
      }
    `;

    console.log('Sending GraphQL request to Nhost...');

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hasura-admin-secret': ADMIN_SECRET
      },
      body: JSON.stringify({
        query: mutation,
        variables: { title, payload, status }
      })
    });

    const result = await response.json();

    console.log('Nhost response:', JSON.stringify(result));

    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: result.errors[0].message,
          details: result.errors 
        })
      };
    }

    if (!result.data || !result.data.insert_patient_docs_one) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'No data returned from database' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        document: result.data.insert_patient_docs_one
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};
