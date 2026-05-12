// ═══════════════════════════════════════════
// ChatGPT Checkout Generator v2.0 - Frontend
// ═══════════════════════════════════════════

const CHATGPT_BASE = 'https://chatgpt.com';

function getMode() {
  return document.querySelector('input[name="mode"]:checked')?.value || 'external';
}

function getCountry() {
  return document.querySelector('input[name="country"]:checked')?.value || 'ID';
}

function getProxyUrl() {
  return document.getElementById('proxyInput')?.value.trim() || '';
}

// Toggle proxy section visibility based on mode
document.addEventListener('change', (e) => {
  if (e.target.name === 'mode') {
    document.getElementById('proxySection').style.display = e.target.value === 'proxy' ? 'block' : 'none';
  }
});

async function checkIP() {
  const proxyUrl = getProxyUrl();
  const el = document.getElementById('ipResult');
  el.style.display = 'block';
  el.className = 'ip-result';
  el.textContent = '⏳ Checking IP...';

  try {
    const res = await fetch('/api/check-ip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proxyUrl: proxyUrl || null }),
    });
    const data = await res.json();
    if (data.error) {
      el.className = 'ip-result error';
      el.textContent = `❌ Error: ${data.error}`;
    } else {
      const isJapan = (data.country || '').toLowerCase().includes('japan');
      el.className = isJapan ? 'ip-result success' : 'ip-result warning';
      el.textContent = `${isJapan ? '✅' : '⚠️'} IP: ${data.ip} | ${data.city}, ${data.country}${!isJapan ? ' (bukan Japan!)' : ''}`;
    }
  } catch (e) {
    el.className = 'ip-result error';
    el.textContent = `❌ ${e.message}`;
  }
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    document.getElementById('sessionInput').value = text;
  } catch {
    alert('Paste manual dengan Ctrl+V.');
  }
}

function clearInput() {
  document.getElementById('sessionInput').value = '';
}

function showLoading(text) {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}

function extractToken(raw) {
  const trimmed = raw.trim();
  try {
    const obj = JSON.parse(trimmed);
    if (obj.accessToken) return obj.accessToken;
  } catch {}
  if (trimmed.length > 50 && trimmed.startsWith('ey')) return trimmed;
  return null;
}

function findCheckoutUrls(data) {
  const s = JSON.stringify(data);
  const urls = [];
  for (const m of s.matchAll(/cs_(live|test)_[a-zA-Z0-9_-]+/g)) {
    const full = `${CHATGPT_BASE}/checkout/openai_llc/${m[0]}`;
    if (!urls.includes(full)) urls.push(full);
  }
  for (const m of s.matchAll(/https:\/\/checkout\.stripe\.com\/[^\s"'\\]+/g)) {
    if (!urls.includes(m[0])) urls.push(m[0]);
  }
  for (const m of s.matchAll(/"(?:url|checkout_url|redirect_url|portal_url|billing_url)"\s*:\s*"(https?:\/\/[^"]+)"/g)) {
    if (!urls.includes(m[1])) urls.push(m[1]);
  }
  return urls;
}

function renderAccountInfo(account) {
  const block = document.getElementById('accountBlock');
  const cards = document.getElementById('accountCards');
  const summary = document.getElementById('accountSummary');
  if (!account) { block.style.display = 'none'; return; }

  const email = account.email || '—';
  const plan = account.plan_type || 'unknown';
  const name = account.name || '—';

  summary.textContent = `${email} • ${plan}`;
  cards.innerHTML = `
    <div class="account-card"><div class="label">Email</div><div class="value">${email}</div></div>
    <div class="account-card"><div class="label">Plan</div><div class="value plan">${plan.toUpperCase()}</div></div>
    <div class="account-card"><div class="label">Nama</div><div class="value">${name}</div></div>
    <div class="account-card"><div class="label">Status</div><div class="value">${account.phone ? '📱 Verified' : '⏳ Unverified'}</div></div>`;
  block.style.display = 'block';
}

function renderAccountInfoFromV4(data) {
  const block = document.getElementById('accountBlock');
  const cards = document.getElementById('accountCards');
  const summary = document.getElementById('accountSummary');
  if (!data?.accounts) { block.style.display = 'none'; return; }

  let html = '', summaryText = '';
  for (const [, acct] of Object.entries(data.accounts)) {
    const email = acct?.account?.email || '—';
    const plan = acct?.entitlement?.plan_type || 'unknown';
    const name = acct?.account?.name || '—';
    const id = acct?.account?.account_id?.substring(0, 8) || '—';
    summaryText = `${email} • ${plan}`;
    html += `
      <div class="account-card"><div class="label">Email</div><div class="value">${email}</div></div>
      <div class="account-card"><div class="label">Plan</div><div class="value plan">${plan.toUpperCase()}</div></div>
      <div class="account-card"><div class="label">Nama</div><div class="value">${name}</div></div>
      <div class="account-card"><div class="label">Account ID</div><div class="value">${id}...</div></div>`;
  }
  summary.textContent = summaryText;
  cards.innerHTML = html;
  block.style.display = 'block';
}

function renderPromoStatus(eligible, promo) {
  const statusEl = document.getElementById('promoStatus');
  const tagEl = document.getElementById('promoTag');
  
  if (eligible) {
    tagEl.className = 'promo-tag promo-ok';
    tagEl.innerHTML = `🎉 <strong>Promo Active!</strong> ${promo?.campaign_id || 'plus-1-month-free'} — Gratis 1 bulan pertama!`;
  } else {
    tagEl.className = 'promo-tag promo-no';
    tagEl.innerHTML = `⚠️ <strong>Tidak eligible promo</strong> — Harga normal akan berlaku`;
  }
  statusEl.style.display = 'block';
}

function renderCheckoutLinks(allUrls) {
  const block = document.getElementById('checkoutBlock');
  const container = document.getElementById('checkoutLinks');

  if (allUrls.length === 0) {
    container.innerHTML = `<div class="no-links">⚠️ Tidak ada link checkout ditemukan.<br>Pastikan akun belum pernah subscribe sebelumnya.</div>`;
    block.style.display = 'block';
    return;
  }

  let html = '';
  for (const url of allUrls) {
    const escaped = url.replace(/'/g, "\\'");
    html += `
      <div class="checkout-link-item">
        <div class="link-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        </div>
        <div class="link-content">
          <div class="link-url">${url}</div>
        </div>
        <button class="btn-copy" onclick="copyUrl('${escaped}', this)">Copy</button>
        <button class="btn-open" onclick="window.open('${escaped}','_blank')">Open</button>
      </div>`;
  }
  container.innerHTML = html;
  block.style.display = 'block';
}

function copyUrl(url, btn) {
  navigator.clipboard.writeText(url).then(() => {
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
  });
}

// ─── Main Generate Function ────────────────────────────────
async function generate() {
  const raw = document.getElementById('sessionInput').value;
  const mode = getMode();
  const country = getCountry();
  const btn = document.getElementById('generateBtn');
  const results = document.getElementById('resultsSection');
  const rawLog = document.getElementById('rawLog');

  btn.disabled = true;
  results.style.display = 'block';
  rawLog.textContent = '';

  // Hide previous results
  document.getElementById('promoStatus').style.display = 'none';
  document.getElementById('accountBlock').style.display = 'none';
  document.getElementById('checkoutBlock').style.display = 'none';

  const allUrls = [];
  const logs = [];

  if (mode === 'external') {
    // ═══ AUTO MODE: Use external API (gpt-plus-gen) ═══
    showLoading('Mengirim ke server Jepang...');
    
    try {
      const res = await fetch('/api/generate-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: raw.trim(), country }),
      });
      const data = await res.json();
      logs.push({ step: 'external-api', data });

      if (data.success && data.url) {
        allUrls.push(data.url);
        renderPromoStatus(data.promoEligible, data.codexUsage?.promo);
        if (data.account) renderAccountInfo(data.account);
      } else {
        // Show error info
        if (data.logs) {
          logs.push({ step: 'server-logs', data: data.logs });
        }
        if (data.error) {
          logs.push({ step: 'error', message: data.error });
        }
      }
    } catch (e) {
      logs.push({ step: 'external-api', error: e.message });
    }

  } else {
    // ═══ MANUAL PROXY MODE ═══
    const token = extractToken(raw);
    if (!token) {
      alert('Paste JSON sesi atau access token yang valid!');
      btn.disabled = false;
      hideLoading();
      return;
    }

    const proxyUrl = getProxyUrl() || null;

    // Step 1: Account info
    showLoading('Mengambil info akun...');
    try {
      const res = await fetch('/api/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token, proxyUrl }),
      });
      const { status, data } = await res.json();
      logs.push({ step: 'account', status, data });
      if (status === 200) renderAccountInfoFromV4(data);
    } catch (e) {
      logs.push({ step: 'account', error: e.message });
    }

    // Step 2: Promo check
    showLoading('Mengecek promo eligibility...');
    try {
      const res = await fetch('/api/promo-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token, proxyUrl }),
      });
      const data = await res.json();
      logs.push({ step: 'promo-check', data });
      renderPromoStatus(data.promoEligible, data.promo);
    } catch (e) {
      logs.push({ step: 'promo-check', error: e.message });
    }

    // Step 3: Checkout
    showLoading('Generating checkout link...');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token, planType: 'plus', proxyUrl }),
      });
      const { results: endpoints } = await res.json();
      for (const ep of endpoints) {
        logs.push(ep);
        if (ep.data) {
          for (const u of findCheckoutUrls(ep.data)) {
            if (!allUrls.includes(u)) allUrls.push(u);
          }
        }
      }
    } catch (e) {
      logs.push({ step: 'checkout', error: e.message });
    }
  }

  hideLoading();
  renderCheckoutLinks(allUrls);
  rawLog.textContent = JSON.stringify(logs, null, 2);
  btn.disabled = false;
}
