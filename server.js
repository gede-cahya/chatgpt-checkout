#!/usr/bin/env node
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3456;
const CHATGPT_BASE = 'https://chatgpt.com';
const API_BASE = `${CHATGPT_BASE}/backend-api`;

app.use(express.json({ limit: '5mb' }));
app.use(express.static(join(__dirname, 'public')));

// ─── Proxy Agent Builder ───────────────────────────────────
function buildAgent(proxyUrl) {
  if (!proxyUrl) return undefined;
  const lower = proxyUrl.toLowerCase();
  if (lower.startsWith('socks5://') || lower.startsWith('socks4://') || lower.startsWith('socks://')) {
    return new SocksProxyAgent(proxyUrl);
  }
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return new HttpsProxyAgent(proxyUrl);
  }
  return new SocksProxyAgent(`socks5://${proxyUrl}`);
}

// Fetch with optional proxy — always uses node-fetch for consistency
async function proxyFetch(url, opts = {}, proxyUrl = null) {
  const { default: nodeFetch } = await import('node-fetch');
  const agent = buildAgent(proxyUrl);
  if (agent) {
    return nodeFetch(url, { ...opts, agent });
  }
  return nodeFetch(url, opts);
}

function makeHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
    'Origin': CHATGPT_BASE,
    'Referer': `${CHATGPT_BASE}/`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'oai-language': 'en-US',
  };
}

// ─── Check IP endpoint ─────────────────────────────────────
app.post('/api/check-ip', async (req, res) => {
  const { proxyUrl } = req.body;
  try {
    const { default: nodeFetch } = await import('node-fetch');
    const agent = buildAgent(proxyUrl);
    const opts = agent ? { agent } : {};
    const r = await nodeFetch('https://ipapi.co/json/', opts);
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = {}; }
    res.json({
      ip: data.ip || 'unknown',
      country: data.country_name || data.country || 'unknown',
      country_code: data.country_code || '',
      city: data.city || 'unknown',
      region: data.region || '',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Account info ──────────────────────────────────────────
app.post('/api/account', async (req, res) => {
  const { accessToken, proxyUrl } = req.body;
  if (!accessToken) return res.status(400).json({ error: 'accessToken required' });
  try {
    const r = await proxyFetch(`${API_BASE}/accounts/check/v4-2023-04-27`, { headers: makeHeaders(accessToken) }, proxyUrl);
    const data = await r.json().catch(() => ({}));
    res.json({ status: r.status, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Promo check via Codex rate limit ──────────────────────
app.post('/api/promo-check', async (req, res) => {
  const { accessToken, proxyUrl } = req.body;
  if (!accessToken) return res.status(400).json({ error: 'accessToken required' });
  try {
    const r = await proxyFetch(`${API_BASE}/codex/rate_limit`, { headers: makeHeaders(accessToken) }, proxyUrl);
    const data = await r.json().catch(() => ({}));
    const promo = data?.promo || null;
    const isEligible = promo?.campaign_id === 'plus-1-month-free';
    res.json({ 
      status: r.status, 
      promoEligible: isEligible,
      promo,
      codexUsage: data,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Generate checkout link (direct) ───────────────────────
app.post('/api/checkout', async (req, res) => {
  const { accessToken, planType = 'plus', proxyUrl } = req.body;
  if (!accessToken) return res.status(400).json({ error: 'accessToken required' });

  const endpoints = [
    // Primary: invite-based checkout (used by gpt-plus-gen)
    { method: 'POST', path: '/payments/checkout', body: { plan_type: planType } },
    // Stripe checkout session
    { method: 'POST', path: '/payments/checkout_session', body: { plan_type: planType } },
    // Start subscription
    { method: 'POST', path: '/payments/start_subscription', body: { plan_type: planType, billing_cycle: 'monthly' } },
    // Subscription checkout
    { method: 'POST', path: '/payments/subscription/checkout', body: { plan_type: planType, is_deferred: false } },
    // Create checkout session
    { method: 'POST', path: '/payments/create_checkout_session', body: { plan_type: planType } },
    // Billing portal
    { method: 'GET', path: '/payments/billing_portal_url', body: null },
    // Plans info
    { method: 'GET', path: '/payments/subscription/plans', body: null },
  ];

  const results = [];
  for (const ep of endpoints) {
    try {
      const url = `${API_BASE}${ep.path}`;
      const opts = { method: ep.method, headers: makeHeaders(accessToken) };
      if (ep.body) opts.body = JSON.stringify(ep.body);
      const r = await proxyFetch(url, opts, proxyUrl);
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text.substring(0, 500) }; }
      results.push({ endpoint: ep.path, method: ep.method, status: r.status, data });
    } catch (e) {
      results.push({ endpoint: ep.path, method: ep.method, status: 0, error: e.message });
    }
  }
  res.json({ results });
});

// ─── Generate via external (gpt-plus-gen fallback) ─────────
app.post('/api/generate-external', async (req, res) => {
  const { session, country = 'ID' } = req.body;
  if (!session) return res.status(400).json({ error: 'session required' });

  try {
    const { default: nodeFetch } = await import('node-fetch');
    const deviceId = `dev_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    
    const r = await nodeFetch('https://gpt-plus-gen.vercel.app/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session, country, device_id: deviceId }),
    });
    
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Custom proxy fetch ────────────────────────────────────
app.post('/api/proxy', async (req, res) => {
  const { accessToken, url, method = 'GET', body = null, proxyUrl } = req.body;
  if (!accessToken || !url) return res.status(400).json({ error: 'accessToken and url required' });
  try {
    const opts = { method, headers: makeHeaders(accessToken) };
    if (body) opts.body = JSON.stringify(body);
    const r = await proxyFetch(url, opts, proxyUrl);
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text.substring(0, 2000) }; }
    res.json({ status: r.status, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║  🛒 ChatGPT Checkout Generator v2.0          ║');
  console.log(`║  🌐 http://localhost:${PORT}                    ║`);
  console.log('║  🇯🇵 Proxy + External API enabled              ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log('');
});
