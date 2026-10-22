// Whop Checkout Variant API Handler
// Compatible with Vercel Serverless Functions and Node.js
require('dotenv').config();
const { WhopClient } = require('@whop/sdk');

module.exports = async function handler(req, res) {
  // CORS support
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  try {
    // Parse body if not parsed yet
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {}
    }

    const token = process.env.WHOP_API_KEY || body?.token;
    const account_id = process.env.WHOP_ACCOUNT_ID || body?.account_id;
    const product_id = process.env.WHOP_PRODUCT_ID || body?.product_id;

    if (!token || token.includes('your_whop_account_api_key_here')) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Missing WHOP_API_KEY. Configure it in .env or provide it in your request.'
      }));
      return;
    }

    if (!account_id || !product_id) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Missing account_id (biz_...) or product_id (prod_...).'
      }));
      return;
    }

    const initial_price = Number(body?.amount) || 10.0;
    const plan_type = body?.plan_type || 'one_time';

    const client = new WhopClient({ token });

    const variant = await client.variants.create({
      account_id,
      product_id,
      initial_price,
      plan_type,
    });

    console.log('[Whop Checkout] Generated purchase_url:', variant.purchase_url);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: true,
      purchase_url: variant.purchase_url,
      variant_id: variant.id,
      initial_price: variant.initial_price,
    }));
  } catch (err) {
    console.error('[Whop Error]:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: err.message || 'Failed to create Whop checkout variant'
    }));
  }
};
