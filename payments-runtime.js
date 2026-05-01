const crypto = require('node:crypto');
const express = require('express');
const Stripe = require('stripe');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 8787);
const FRONTEND_BASE_URL = String(process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

if (!STRIPE_SECRET_KEY) throw new Error('Missing STRIPE_SECRET_KEY for payments runtime.');
if (!STRIPE_WEBHOOK_SECRET) throw new Error('Missing STRIPE_WEBHOOK_SECRET for payments runtime.');
if (!DATABASE_URL) throw new Error('Missing DATABASE_URL for payments runtime.');

const stripe = new Stripe(STRIPE_SECRET_KEY);
const db = new Pool({ connectionString: DATABASE_URL });
const app = express();

app.use((request, response, next) => {
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Content-Type,Stripe-Signature');
  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }
  next();
});

function requireReportId(reportId) {
  return typeof reportId === 'string' && /^[a-zA-Z0-9_-]{10,120}$/.test(reportId);
}

async function initDb() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS report_entitlements (
      report_id TEXT PRIMARY KEY,
      checkout_session_id TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      amount_total INTEGER,
      currency TEXT,
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS processed_webhook_events (
      event_id TEXT PRIMARY KEY,
      processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

app.post('/api/checkout/session', express.json({ limit: '200kb' }), async (request, response, next) => {
  try {
    const reportId = String(request.body?.reportId || '');
    if (!requireReportId(reportId)) {
      response.status(400).json({ error: 'A valid reportId is required.' });
      return;
    }

    const existing = await db.query(
      'SELECT status, payment_status FROM report_entitlements WHERE report_id = $1 LIMIT 1',
      [reportId],
    );

    if (existing.rowCount && existing.rows[0].status === 'paid') {
      response.json({
        alreadyPaid: true,
        reportId,
      });
      return;
    }

    const lineItems = STRIPE_PRICE_ID
      ? [{ price: STRIPE_PRICE_ID, quantity: 1 }]
      : [
          {
            price_data: {
              currency: 'usd',
              product_data: { name: 'Between The Lines Full Report' },
              unit_amount: 1200,
            },
            quantity: 1,
          },
        ];

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      metadata: {
        report_id: reportId,
      },
      success_url: `${FRONTEND_BASE_URL}/?paid=success&report_id=${encodeURIComponent(reportId)}`,
      cancel_url: `${FRONTEND_BASE_URL}/?paid=cancelled&report_id=${encodeURIComponent(reportId)}`,
    });

    await db.query(
      `INSERT INTO report_entitlements (report_id, checkout_session_id, status, payment_status)
       VALUES ($1, $2, 'pending', 'unpaid')
       ON CONFLICT (report_id)
       DO UPDATE SET checkout_session_id = EXCLUDED.checkout_session_id, updated_at = NOW()`,
      [reportId, session.id],
    );

    response.json({
      reportId,
      checkoutUrl: session.url,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/checkout/entitlement/:reportId', async (request, response, next) => {
  try {
    const reportId = String(request.params.reportId || '');
    if (!requireReportId(reportId)) {
      response.status(400).json({ error: 'A valid reportId is required.' });
      return;
    }

    const result = await db.query(
      `SELECT report_id, status, payment_status, paid_at
       FROM report_entitlements
       WHERE report_id = $1
       LIMIT 1`,
      [reportId],
    );

    if (!result.rowCount) {
      response.json({ reportId, paid: false, status: 'missing', paymentStatus: 'unpaid' });
      return;
    }

    const row = result.rows[0];
    response.set('Cache-Control', 'no-store');
    response.json({
      reportId,
      paid: row.status === 'paid',
      status: row.status,
      paymentStatus: row.payment_status,
      paidAt: row.paid_at,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (request, response) => {
  const signature = request.headers['stripe-signature'];
  if (!signature) {
    response.status(400).send('Missing Stripe signature.');
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(request.body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    response.status(400).send(`Webhook Error: ${error.message}`);
    return;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const alreadyProcessed = await client.query(
      'SELECT event_id FROM processed_webhook_events WHERE event_id = $1 LIMIT 1',
      [event.id],
    );

    if (alreadyProcessed.rowCount) {
      await client.query('COMMIT');
      response.json({ received: true, duplicate: true });
      return;
    }

    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object;
      const reportId = String(session.metadata?.report_id || '');

      if (requireReportId(reportId)) {
        await client.query(
          `INSERT INTO report_entitlements
            (report_id, checkout_session_id, status, payment_status, amount_total, currency, paid_at, updated_at)
           VALUES ($1, $2, 'paid', $3, $4, $5, NOW(), NOW())
           ON CONFLICT (report_id)
           DO UPDATE SET
            checkout_session_id = EXCLUDED.checkout_session_id,
            status = 'paid',
            payment_status = EXCLUDED.payment_status,
            amount_total = EXCLUDED.amount_total,
            currency = EXCLUDED.currency,
            paid_at = NOW(),
            updated_at = NOW()`,
          [reportId, session.id, session.payment_status || 'paid', session.amount_total || null, session.currency || null],
        );
      }
    }

    await client.query('INSERT INTO processed_webhook_events(event_id) VALUES ($1)', [event.id]);
    await client.query('COMMIT');
    response.json({ received: true });
  } catch (error) {
    await client.query('ROLLBACK');
    response.status(500).send('Webhook processing failed.');
  } finally {
    client.release();
  }
});

app.get('/healthz', async (_request, response) => {
  await db.query('SELECT 1');
  response.status(200).json({ ok: true, service: 'btl-payments-runtime', now: new Date().toISOString() });
});

app.use((error, _request, response, _next) => {
  const requestId = crypto.randomUUID();
  console.error(`[${requestId}]`, error);
  response.status(500).json({ error: 'Internal server error.', requestId });
});

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`BTL payments runtime listening on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { app, initDb };
