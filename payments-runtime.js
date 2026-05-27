const crypto = require('node:crypto');
const express = require('express');

const PORT = Number(process.env.PORT || 8787);
const RAW_FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || process.env.PUBLIC_URL || 'http://localhost:3000';
const FRONTEND_BASE_URL = String(RAW_FRONTEND_BASE_URL).replace(/\/+$/, '');
const PAYMENTS_ENABLED = String(process.env.PAYMENTS_ENABLED || '').toLowerCase() === 'true';
const OWNER_APPROVED_PAYMENTS = String(process.env.OWNER_APPROVED_PAYMENTS || '').toLowerCase() === 'true';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || '';
const DATABASE_URL = process.env.DATABASE_URL || '';
const EXPECTED_CURRENCY = String(process.env.EXPECTED_CURRENCY || 'usd').toLowerCase();
const EXPECTED_PAYMENT_AMOUNT = Number(process.env.EXPECTED_PAYMENT_AMOUNT || 1200);
const ALLOW_TEST_KEYS = String(process.env.ALLOW_TEST_KEYS || '').toLowerCase() === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true' || process.env.GO_LIVE === 'true';
const PAYMENT_HOLD_MESSAGE = 'Stripe checkout is currently on hold. No payment will be started.';

let stripe;
let db;
let liveConfigChecked = false;

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', true);

function safeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return 'http://localhost:3000';
  }
}

const ALLOWED_ORIGIN = safeOrigin(FRONTEND_BASE_URL);

app.use((request, response, next) => {
  const requestId = crypto.randomUUID();
  request.requestId = requestId;
  response.set('X-Request-Id', requestId);
  response.set('X-Content-Type-Options', 'nosniff');
  response.set('Referrer-Policy', 'no-referrer');
  response.set('Cache-Control', 'no-store');
  if (IS_PRODUCTION) {
    response.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use((request, response, next) => {
  const origin = request.headers.origin;
  response.set('Vary', 'Origin');
  response.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Content-Type,Stripe-Signature');

  if (!origin || origin === ALLOWED_ORIGIN) {
    response.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  }

  if (request.method === 'OPTIONS') {
    if (origin && origin !== ALLOWED_ORIGIN) {
      response.status(403).end();
      return;
    }

    response.status(204).end();
    return;
  }

  next();
});

function requireReportId(reportId) {
  return typeof reportId === 'string' && /^[a-zA-Z0-9_-]{10,120}$/.test(reportId);
}

function paymentsAllowed() {
  return PAYMENTS_ENABLED && OWNER_APPROVED_PAYMENTS;
}

function normalizeCurrency(value) {
  return String(value || '').toLowerCase();
}

function getSessionReportId(session) {
  return String(session?.metadata?.report_id || session?.client_reference_id || '');
}

function parseConfiguredUrl(name, value) {
  try {
    return new URL(value);
  } catch {
    throw Object.assign(new Error(`${name} must be a valid absolute URL.`), { status: 500 });
  }
}

function missingPaymentRequirements() {
  const missing = [];
  if (!PAYMENTS_ENABLED) missing.push('PAYMENTS_ENABLED=true');
  if (!OWNER_APPROVED_PAYMENTS) missing.push('OWNER_APPROVED_PAYMENTS=true');
  if (!STRIPE_SECRET_KEY) missing.push('STRIPE_SECRET_KEY');
  if (!STRIPE_WEBHOOK_SECRET) missing.push('STRIPE_WEBHOOK_SECRET');
  if (!DATABASE_URL) missing.push('DATABASE_URL');
  return missing;
}

function assertLivePaymentConfig() {
  const missing = missingPaymentRequirements();
  if (missing.length) {
    const error = new Error(`Payments runtime is held or incomplete. Missing: ${missing.join(', ')}.`);
    error.status = 503;
    throw error;
  }

  const frontendUrl = parseConfiguredUrl('FRONTEND_BASE_URL/PUBLIC_URL', FRONTEND_BASE_URL);
  if (IS_PRODUCTION && frontendUrl.protocol !== 'https:') {
    throw new Error('FRONTEND_BASE_URL/PUBLIC_URL must use https:// in production.');
  }

  if (STRIPE_SECRET_KEY.startsWith('pk_')) {
    throw new Error('STRIPE_SECRET_KEY must be a server-side secret or restricted key, not a publishable key.');
  }

  const usingTestKey = STRIPE_SECRET_KEY.startsWith('sk_test_') || STRIPE_SECRET_KEY.startsWith('rk_test_');
  const usingLiveKey = STRIPE_SECRET_KEY.startsWith('sk_live_') || STRIPE_SECRET_KEY.startsWith('rk_live_');
  if (usingTestKey && (!ALLOW_TEST_KEYS || IS_PRODUCTION)) {
    throw new Error('Refusing to start live payments with a Stripe test key. Use a live key in production.');
  }
  if (!usingLiveKey && !(ALLOW_TEST_KEYS && usingTestKey)) {
    throw new Error('STRIPE_SECRET_KEY must look like sk_live_, rk_live_, or an explicitly allowed non-production test key.');
  }

  if (!STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) {
    throw new Error('STRIPE_WEBHOOK_SECRET must be the whsec_ signing secret for the configured Stripe webhook endpoint.');
  }

  if (!Number.isSafeInteger(EXPECTED_PAYMENT_AMOUNT) || EXPECTED_PAYMENT_AMOUNT <= 0) {
    throw new Error('EXPECTED_PAYMENT_AMOUNT must be a positive integer number of the smallest currency unit.');
  }

  liveConfigChecked = true;
}

function ensurePaymentClients() {
  if (!liveConfigChecked) {
    assertLivePaymentConfig();
  }

  if (!stripe || !db) {
    const Stripe = require('stripe');
    const { Pool } = require('pg');
    stripe = new Stripe(STRIPE_SECRET_KEY);
    db = new Pool({ connectionString: DATABASE_URL });
  }

  return { stripe, db };
}

function sendCheckoutHold(response, request) {
  response.status(503).json({
    ok: false,
    available: false,
    mode: 'hold',
    error: PAYMENT_HOLD_MESSAGE,
    requestId: request.requestId,
  });
}

function entitlementHold(reportId, request) {
  return {
    ok: true,
    available: false,
    mode: 'hold',
    reportId,
    paid: false,
    status: 'held',
    paymentStatus: 'unpaid',
    requestId: request.requestId,
  };
}

async function initDb() {
  const { db: database } = ensurePaymentClients();

  await database.query(`
    CREATE TABLE IF NOT EXISTS report_entitlements (
      report_id TEXT PRIMARY KEY,
      checkout_session_id TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      amount_total INTEGER,
      currency TEXT,
      paid_at TIMESTAMPTZ,
      failure_reason TEXT,
      last_event_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await database.query('ALTER TABLE report_entitlements ADD COLUMN IF NOT EXISTS failure_reason TEXT;');
  await database.query('ALTER TABLE report_entitlements ADD COLUMN IF NOT EXISTS last_event_id TEXT;');

  await database.query(`
    CREATE TABLE IF NOT EXISTS processed_webhook_events (
      event_id TEXT PRIMARY KEY,
      processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

function buildLineItems() {
  if (STRIPE_PRICE_ID) {
    return [{ price: STRIPE_PRICE_ID, quantity: 1 }];
  }

  return [
    {
      price_data: {
        currency: EXPECTED_CURRENCY,
        product_data: { name: 'Between The Lines Full Report' },
        unit_amount: EXPECTED_PAYMENT_AMOUNT,
      },
      quantity: 1,
    },
  ];
}

app.post('/api/checkout/session', express.json({ limit: '200kb' }), async (request, response, next) => {
  try {
    if (!paymentsAllowed()) {
      sendCheckoutHold(response, request);
      return;
    }

    const { stripe: stripeClient, db: database } = ensurePaymentClients();
    const reportId = String(request.body?.reportId || '');
    if (!requireReportId(reportId)) {
      response.status(400).json({ error: 'A valid reportId is required.' });
      return;
    }

    const existing = await database.query(
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

    const session = await stripeClient.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: reportId,
      line_items: buildLineItems(),
      metadata: {
        report_id: reportId,
      },
      success_url: `${FRONTEND_BASE_URL}/?paid=success&report_id=${encodeURIComponent(reportId)}`,
      cancel_url: `${FRONTEND_BASE_URL}/?paid=cancelled&report_id=${encodeURIComponent(reportId)}`,
    });

    await database.query(
      `INSERT INTO report_entitlements (report_id, checkout_session_id, status, payment_status, updated_at)
       VALUES ($1, $2, 'pending', 'unpaid', NOW())
       ON CONFLICT (report_id)
       DO UPDATE SET
        checkout_session_id = EXCLUDED.checkout_session_id,
        status = 'pending',
        payment_status = 'unpaid',
        failure_reason = NULL,
        updated_at = NOW()
       WHERE report_entitlements.status <> 'paid'`,
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

    if (!paymentsAllowed()) {
      response.json(entitlementHold(reportId, request));
      return;
    }

    const { db: database } = ensurePaymentClients();
    const result = await database.query(
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

async function retrieveAuthoritativeSession(stripeClient, session) {
  if (!session?.id) return session;
  return stripeClient.checkout.sessions.retrieve(session.id, {
    expand: ['line_items.data.price'],
  });
}

function validatePaidSession(session) {
  const failures = [];

  if (session.mode && session.mode !== 'payment') {
    failures.push('checkout session mode is not payment');
  }

  if (session.payment_status !== 'paid') {
    failures.push(`payment_status is ${session.payment_status || 'missing'}`);
  }

  if (Number(session.amount_total) !== EXPECTED_PAYMENT_AMOUNT) {
    failures.push('amount_total does not match expected amount');
  }

  if (normalizeCurrency(session.currency) !== EXPECTED_CURRENCY) {
    failures.push('currency does not match expected currency');
  }

  if (STRIPE_PRICE_ID) {
    const lineItems = Array.isArray(session.line_items?.data) ? session.line_items.data : [];
    const hasExpectedPrice = lineItems.some((item) => item?.price?.id === STRIPE_PRICE_ID);
    if (!hasExpectedPrice) {
      failures.push('checkout line item price does not match STRIPE_PRICE_ID');
    }
  }

  return failures;
}

async function markEntitlement(client, session, status, eventId, failureReason = null) {
  const reportId = getSessionReportId(session);
  if (!requireReportId(reportId)) {
    console.warn(`[${eventId}] Ignoring checkout session with invalid or missing report_id.`);
    return;
  }

  const paidAt = status === 'paid' ? 'NOW()' : 'NULL';
  await client.query(
    `INSERT INTO report_entitlements
      (report_id, checkout_session_id, status, payment_status, amount_total, currency, paid_at, failure_reason, last_event_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, ${paidAt}, $7, $8, NOW())
     ON CONFLICT (report_id)
     DO UPDATE SET
      checkout_session_id = EXCLUDED.checkout_session_id,
      status = EXCLUDED.status,
      payment_status = EXCLUDED.payment_status,
      amount_total = EXCLUDED.amount_total,
      currency = EXCLUDED.currency,
      paid_at = EXCLUDED.paid_at,
      failure_reason = EXCLUDED.failure_reason,
      last_event_id = EXCLUDED.last_event_id,
      updated_at = NOW()
     WHERE report_entitlements.status <> 'paid' OR EXCLUDED.status = 'paid'`,
    [
      reportId,
      session.id || null,
      status,
      session.payment_status || 'unpaid',
      Number.isFinite(Number(session.amount_total)) ? Number(session.amount_total) : null,
      normalizeCurrency(session.currency) || null,
      failureReason,
      eventId,
    ],
  );
}

async function handleCheckoutSuccess(stripeClient, client, event) {
  const session = await retrieveAuthoritativeSession(stripeClient, event.data.object);
  const validationFailures = validatePaidSession(session);

  if (validationFailures.length > 0) {
    await markEntitlement(client, session, 'rejected', event.id, validationFailures.join('; '));
    return;
  }

  await markEntitlement(client, session, 'paid', event.id);
}

async function handleCheckoutFailure(client, event, status) {
  const session = event.data.object;
  await markEntitlement(client, session, status, event.id, event.type);
}

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (request, response) => {
  if (!paymentsAllowed()) {
    sendCheckoutHold(response, request);
    return;
  }

  const { stripe: stripeClient, db: database } = ensurePaymentClients();
  const signature = request.headers['stripe-signature'];
  if (!signature) {
    response.status(400).send('Missing Stripe signature.');
    return;
  }

  let event;
  try {
    event = stripeClient.webhooks.constructEvent(request.body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    response.status(400).send(`Webhook Error: ${error.message}`);
    return;
  }

  const client = await database.connect();
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

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      await handleCheckoutSuccess(stripeClient, client, event);
    } else if (event.type === 'checkout.session.async_payment_failed') {
      await handleCheckoutFailure(client, event, 'failed');
    } else if (event.type === 'checkout.session.expired') {
      await handleCheckoutFailure(client, event, 'expired');
    }

    await client.query('INSERT INTO processed_webhook_events(event_id) VALUES ($1)', [event.id]);
    await client.query('COMMIT');
    response.json({ received: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[${request.requestId || event.id}] Webhook processing failed.`, error);
    response.status(500).send('Webhook processing failed.');
  } finally {
    client.release();
  }
});

app.get('/healthz', async (_request, response, next) => {
  try {
    if (!paymentsAllowed()) {
      response.status(200).json({
        ok: true,
        service: 'btl-payments-runtime',
        available: false,
        mode: 'hold',
        now: new Date().toISOString(),
      });
      return;
    }

    const { db: database } = ensurePaymentClients();
    await database.query('SELECT 1');
    response.status(200).json({
      ok: true,
      service: 'btl-payments-runtime',
      available: true,
      mode: 'live',
      now: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, request, response, _next) => {
  const requestId = request.requestId || crypto.randomUUID();
  console.error(`[${requestId}]`, error);
  const status = Number(error.status || 500);
  response.status(status).json({
    error: status >= 500 ? 'Internal server error.' : error.message,
    requestId,
  });
});

async function start() {
  if (paymentsAllowed()) {
    await initDb();
  }

  app.listen(PORT, () => {
    const mode = paymentsAllowed() ? 'live' : 'hold';
    console.log(`BTL payments runtime listening on port ${PORT}; mode=${mode}; frontend=${FRONTEND_BASE_URL}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { app, initDb, paymentsAllowed, validatePaidSession };
