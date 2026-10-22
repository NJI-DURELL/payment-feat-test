/* ═══════════════════════════════════════════════
   PayForge Test — app.js
   Full payment simulation engine
═══════════════════════════════════════════════ */

'use strict';

// ─── State ───────────────────────────────────────────────────────
const state = {
  items: [
    { id: 1, name: 'PayForge Pro Plan', emoji: '💎', price: 49.00, qty: 1, category: 'Subscription' },
    { id: 2, name: 'API Add-on (1M calls)', emoji: '⚡', price: 19.00, qty: 1, category: 'Add-on' },
    { id: 3, name: 'Webhook Extension', emoji: '🔗', price: 9.00, qty: 1, category: 'Extension' },
  ],
  discount: 0,
  discountCode: '',
  taxRate: 0.08,
  currency: 'USD',
  installments: 1,
  method: 'card',
  scenario: 'success',
  wallet: null,
  transactions: [],
  cardType: 'unknown',
  cvvVisible: false,
  cryptoCoin: 'btc',
  isBusy: false,
};

const PROMO_CODES = {
  'FORGE20': 0.20,
  'TEST10':  0.10,
  'SAVE50':  0.50,
  'DEV15':   0.15,
};

const CURRENCY_RATES = {
  USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.36,
  AUD: 1.53, NGN: 1680, GHS: 15.2,
};
const CURRENCY_SYMBOLS = {
  USD:'$', EUR:'€', GBP:'£', CAD:'CA$',
  AUD:'A$', NGN:'₦', GHS:'₵',
};

const TEST_CARDS = [
  { label:'Visa — Success',          number:'4111 1111 1111 1111', exp:'12/28', cvv:'123', type:'visa',     scenario:'success',      tag:'success' },
  { label:'Visa — Declined',         number:'4000 0000 0000 0002', exp:'12/28', cvv:'123', type:'visa',     scenario:'decline',      tag:'fail'    },
  { label:'Mastercard — Success',    number:'5500 0000 0000 0004', exp:'06/27', cvv:'456', type:'mc',       scenario:'success',      tag:'success' },
  { label:'Mastercard — Insuff.',    number:'5105 1051 0510 5100', exp:'11/27', cvv:'321', type:'mc',       scenario:'insufficient', tag:'warn'    },
  { label:'Amex — Success',          number:'3714 496353 98431',   exp:'09/28', cvv:'1234',type:'amex',    scenario:'success',      tag:'success' },
  { label:'Discover — Success',      number:'6011 1111 1111 1117', exp:'03/29', cvv:'789', type:'discover', scenario:'success',      tag:'success' },
  { label:'Visa — 3DS Required',     number:'4000 0025 0000 3155', exp:'08/27', cvv:'123', type:'visa',     scenario:'3ds',          tag:'info'    },
  { label:'Any — Fraud Flagged',     number:'4000 0000 0000 4954', exp:'12/26', cvv:'000', type:'visa',     scenario:'fraud',        tag:'warn'    },
  { label:'Any — Timeout',           number:'4000 0000 0000 0119', exp:'05/28', cvv:'123', type:'visa',     scenario:'timeout',      tag:'warn'    },
];

const CRYPTO_DATA = {
  btc:  { name:'Bitcoin',  addr:'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', ticker:'BTC', color:'#f7931a' },
  eth:  { name:'Ethereum', addr:'0x742d35Cc6634C0532925a3b8D4C9F3A8Ddd4B9F8', ticker:'ETH', color:'#627eea' },
  usdt: { name:'USDT',     addr:'TRx7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',        ticker:'USDT',color:'#26a17b' },
  usdc: { name:'USDC',     addr:'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',  ticker:'USDC',color:'#2775ca' },
};

// ─── DOM Refs ─────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ─── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  renderOrderItems();
  updateTotals();
  renderTestCards();
  renderCryptoPanel();
  bindEvents();
  updatePayBtn();
  updateInstallmentDisplay();
});

// ─── Particles ───────────────────────────────────────────────────
function initParticles() {
  const canvas = $('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 60; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.4 + 0.05,
    });
  }
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(79,195,247,${p.alpha})`;
      ctx.fill();
      p.x += p.dx; p.y += p.dy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
    });
    requestAnimationFrame(animate);
  }
  animate();
}

// ─── Order Items ─────────────────────────────────────────────────
function renderOrderItems() {
  const container = $('orderItems');
  container.innerHTML = state.items.map(item => `
    <div class="order-item" id="item-${item.id}">
      <div class="order-item-img">${item.emoji}</div>
      <div class="order-item-info">
        <div class="order-item-name">${item.name}</div>
        <div class="order-item-meta">${item.category}</div>
        <div class="order-item-qty">
          <button class="qty-btn" onclick="changeQty(${item.id},-1)" aria-label="Decrease qty">−</button>
          <span class="qty-val" id="qty-${item.id}">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${item.id},1)" aria-label="Increase qty">+</button>
        </div>
      </div>
      <div class="order-item-price" id="item-price-${item.id}">${formatCurrency(item.price * item.qty)}</div>
    </div>
  `).join('');
}

function changeQty(id, delta) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  item.qty = Math.max(0, item.qty + delta);
  if (item.qty === 0) {
    state.items = state.items.filter(i => i.id !== id);
    renderOrderItems();
  } else {
    $(`qty-${id}`).textContent = item.qty;
    $(`item-price-${id}`).textContent = formatCurrency(item.price * item.qty);
  }
  updateTotals();
  updatePayBtn();
}
window.changeQty = changeQty;

// ─── Totals ───────────────────────────────────────────────────────
function computeTotals() {
  const subtotal = state.items.reduce((s, i) => s + i.price * i.qty, 0);
  const discountAmt = subtotal * state.discount;
  const taxable = subtotal - discountAmt;
  const tax = taxable * state.taxRate;
  const grand = taxable + tax;
  return { subtotal, discountAmt, tax, grand };
}

function updateTotals() {
  const { subtotal, discountAmt, tax, grand } = computeTotals();
  $('subtotal').textContent     = formatCurrency(subtotal);
  $('discountRow').textContent  = `-${formatCurrency(discountAmt)}`;
  $('taxRow').textContent       = formatCurrency(tax);
  $('grandTotal').textContent   = formatCurrency(grand);
  updatePayBtn();
  updateInstallmentDisplay();
}

function formatCurrency(val) {
  const rate = CURRENCY_RATES[state.currency] || 1;
  const sym  = CURRENCY_SYMBOLS[state.currency] || '$';
  const converted = val * rate;
  if (state.currency === 'NGN' || state.currency === 'GHS') {
    return sym + converted.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  return sym + converted.toFixed(2);
}

function updatePayBtn() {
  const { grand } = computeTotals();
  $('payBtnAmount').textContent = formatCurrency(grand);
}

function updateInstallmentDisplay() {
  const { grand } = computeTotals();
  const n = state.installments;
  const display = $('installmentDisplay');
  if (n <= 1) {
    display.classList.remove('visible');
  } else {
    const perMonth = grand / n;
    display.classList.add('visible');
    display.textContent = `${n} payments of ${formatCurrency(perMonth / (CURRENCY_RATES[state.currency]||1) * (CURRENCY_RATES[state.currency]||1))} — first charge today.`;
    display.textContent = `${n} payments of ${formatCurrency(grand / n)} — first payment due today.`;
  }
}

// ─── Promo Codes ─────────────────────────────────────────────────
function applyPromo() {
  const code = $('promoInput').value.trim().toUpperCase();
  const fb = $('promoFeedback');
  if (PROMO_CODES[code]) {
    if (state.discountCode === code) {
      fb.textContent = 'Code already applied.';
      fb.className = 'promo-feedback err';
      return;
    }
    state.discount = PROMO_CODES[code];
    state.discountCode = code;
    fb.textContent = `✓ "${code}" applied — ${(state.discount*100).toFixed(0)}% off!`;
    fb.className = 'promo-feedback ok';
    showToast(`${(state.discount*100).toFixed(0)}% discount applied!`, 'success');
    updateTotals();
  } else if (code === '') {
    fb.textContent = 'Please enter a promo code.';
    fb.className = 'promo-feedback err';
  } else {
    fb.textContent = `Code "${code}" is invalid or expired.`;
    fb.className = 'promo-feedback err';
    showToast('Invalid promo code', 'error');
  }
}

// ─── Test Cards ───────────────────────────────────────────────────
function renderTestCards() {
  const list = $('testCardList');
  list.innerHTML = TEST_CARDS.map((c, i) => `
    <div class="test-card-item" onclick="fillTestCard(${i})" role="button" tabindex="0"
         onkeydown="if(event.key==='Enter')fillTestCard(${i})">
      <div class="tci-top">
        <span class="tci-label">${c.label}</span>
        <span class="tci-tag ${c.tag}">${c.scenario.replace('decline','Declined').replace('success','Success').replace('insufficient','Insuff. Funds').replace('fraud','Fraud').replace('3ds','3DS').replace('timeout','Timeout')}</span>
      </div>
      <div class="tci-number">${c.number}</div>
      <div class="tci-meta">Exp: ${c.exp} · CVV: ${c.cvv} · ${c.type.toUpperCase()}</div>
    </div>
  `).join('');
}

function fillTestCard(index) {
  const c = TEST_CARDS[index];
  $('cardNumber').value  = c.number;
  $('cardExpiry').value  = c.exp.replace('/', ' / ');
  $('cardCvv').value     = c.cvv;
  $('cardHolder').value  = 'TEST USER';

  // switch to card method
  switchMethod('card');

  // set scenario
  setScenario(c.scenario);

  // trigger display updates
  updateCardDisplay();
  detectCardType(c.number.replace(/\s/g,''));

  // close drawer
  closeDrawer('testCardsOverlay');
  showToast(`${c.label} — auto-filled`, 'info');
}
window.fillTestCard = fillTestCard;

// ─── Crypto Panel ────────────────────────────────────────────────
function renderCryptoPanel(coin) {
  coin = coin || state.cryptoCoin;
  state.cryptoCoin = coin;
  const data = CRYPTO_DATA[coin];
  const { grand } = computeTotals();
  const rate = CURRENCY_RATES['USD']; // always convert to USD first
  const usdAmt = grand / (CURRENCY_RATES[state.currency] || 1);
  const fakeRate = { btc:0.0000148, eth:0.00032, usdt:1, usdc:1 };
  const cryptoAmt = (usdAmt * fakeRate[coin]).toFixed(coin==='btc'?6:4);

  // Generate simple QR-like SVG (visual only)
  const qrSvg = generateFakeQR(data.addr);

  $('cryptoPanelInner').innerHTML = `
    <div class="crypto-amount-row">
      <span>Send exactly</span>
      <strong>${cryptoAmt} <span class="crypto-ticker">${data.ticker}</span></strong>
    </div>
    <div class="crypto-qr">${qrSvg}</div>
    <div class="crypto-addr">${data.addr}</div>
    <div class="crypto-copy-row">
      <button class="copy-btn" onclick="copyText('${data.addr}',this)">Copy Address</button>
      <button class="copy-btn" onclick="copyText('${cryptoAmt}',this)">Copy Amount</button>
    </div>
    <p style="font-size:12px;color:var(--text-dim);text-align:center">
      Rate refreshes every 60 seconds · Expires in <span id="cryptoTimer">10:00</span>
    </p>
  `;
  startCryptoTimer();
}
window.copyText = function(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 2000);
    showToast('Copied to clipboard', 'info');
  });
};

let cryptoTimerInterval = null;
function startCryptoTimer() {
  clearInterval(cryptoTimerInterval);
  let secs = 600;
  cryptoTimerInterval = setInterval(() => {
    secs--;
    const el = $('cryptoTimer');
    if (!el) { clearInterval(cryptoTimerInterval); return; }
    const m = Math.floor(secs / 60), s = secs % 60;
    el.textContent = `${m}:${s.toString().padStart(2,'0')}`;
    if (secs <= 0) { clearInterval(cryptoTimerInterval); el.textContent = 'Expired'; }
  }, 1000);
}

function generateFakeQR(addr) {
  // Generate a visually convincing QR SVG (pattern based on addr hash)
  const size = 21; const cellSz = 6;
  let cells = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const isCorner = (r < 7 && c < 7) || (r < 7 && c >= size-7) || (r >= size-7 && c < 7);
      const isInner  = (r >= 2 && r <= 4 && c >= 2 && c <= 4) || (r >= 2 && r <= 4 && c >= size-5 && c <= size-3) || (r >= size-5 && r <= size-3 && c >= 2 && c <= 4);
      if (isCorner) cells.push(`<rect x="${c*cellSz}" y="${r*cellSz}" width="${cellSz}" height="${cellSz}" fill="black"/>`);
      else if (isInner) cells.push(`<rect x="${c*cellSz}" y="${r*cellSz}" width="${cellSz}" height="${cellSz}" fill="black"/>`);
      else {
        const hash = (addr.charCodeAt(r % addr.length) * 31 + addr.charCodeAt(c % addr.length)) % 3;
        if (hash === 0) cells.push(`<rect x="${c*cellSz}" y="${r*cellSz}" width="${cellSz}" height="${cellSz}" fill="black"/>`);
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size*cellSz}" height="${size*cellSz}" viewBox="0 0 ${size*cellSz} ${size*cellSz}">${cells.join('')}</svg>`;
}

// ─── Card Detection & Display ────────────────────────────────────
function detectCardType(num) {
  let type = 'unknown';
  if (/^4/.test(num))             type = 'visa';
  else if (/^5[1-5]/.test(num))  type = 'mc';
  else if (/^3[47]/.test(num))   type = 'amex';
  else if (/^6011/.test(num))    type = 'discover';

  state.cardType = type;
  $$('.network-visa, .network-mc, .network-amex, .network-discover').forEach(el => el.classList.add('hidden'));
  if (type !== 'unknown') {
    const map = { visa:'network-visa', mc:'network-mc', amex:'network-amex', discover:'network-discover' };
    document.querySelectorAll(`.${map[type]}`).forEach(el => el.classList.remove('hidden'));
  }
}

function formatCardNumber(val) {
  const type = state.cardType;
  const clean = val.replace(/\D/g,'');
  if (type === 'amex') {
    return clean.replace(/(\d{4})(\d{0,6})(\d{0,5})/, (_, a, b, c) => [a, b, c].filter(Boolean).join(' '));
  }
  return clean.replace(/(\d{4})/g,'$1 ').trim();
}

function updateCardDisplay() {
  const numRaw = ($('cardNumber').value || '').replace(/\s/g,'');
  const num    = numRaw || '••••••••••••••••';
  const holder = ($('cardHolder').value || 'FULL NAME').toUpperCase();
  const exp    = ($('cardExpiry').value || 'MM/YY').replace(' ','');
  const cvv    = $('cardCvv').value || '•••';

  // Card number display with masking
  if (numRaw.length > 0) {
    const padded = numRaw.padEnd(16, '•');
    const parts = [];
    for (let i = 0; i < padded.length; i += 4) parts.push(padded.slice(i, i+4));
    $('cardNumberDisplay').textContent = parts.join(' ');
  } else {
    $('cardNumberDisplay').textContent = '•••• •••• •••• ••••';
  }

  $('cardHolderDisplay').textContent = holder.slice(0, 22) || 'FULL NAME';
  $('cardExpDisplay').textContent    = exp || 'MM/YY';
  $('cvvDisplay').textContent        = cvv ? cvv.replace(/./g, '•') : '•••';
}

// ─── Validation ───────────────────────────────────────────────────
function luhn(num) {
  let sum = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = parseInt(num[i], 10);
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d; alt = !alt;
  }
  return sum % 10 === 0;
}

function setError(fieldId, errId, msg) {
  const el = $(fieldId);
  const errEl = $(errId);
  if (msg) {
    if (el) el.classList.add('error');
    if (errEl) errEl.textContent = msg;
    return false;
  } else {
    if (el) { el.classList.remove('error'); el.classList.add('valid'); }
    if (errEl) errEl.textContent = '';
    return true;
  }
}

function validateForm() {
  let valid = true;
  const fn = $('firstName').value.trim();
  const ln = $('lastName').value.trim();
  const em = $('email').value.trim();
  const ph = $('phone').value.trim();
  const ad = $('address').value.trim();
  const cy = $('city').value.trim();
  const zp = $('zip').value.trim();
  const co = $('country').value;

  if (!setError('firstName','firstNameErr', fn ? '' : 'First name is required')) valid = false;
  if (!setError('lastName','lastNameErr',   ln ? '' : 'Last name is required'))  valid = false;
  if (!setError('email','emailErr',         /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) ? '' : 'Valid email required')) valid = false;
  if (!setError('phone','phoneErr',         ph.replace(/\D/g,'').length >= 7 ? '' : 'Valid phone required')) valid = false;
  if (!setError('address','addressErr',     ad ? '' : 'Address is required')) valid = false;
  if (!setError('city','cityErr',           cy ? '' : 'City is required'))    valid = false;
  if (!setError('zip','zipErr',             zp ? '' : 'ZIP is required'))     valid = false;
  if (!setError('country','countryErr',     co ? '' : 'Country is required')) valid = false;

  if (state.method === 'card') {
    const cn = $('cardNumber').value.replace(/\s/g,'');
    const ch = $('cardHolder').value.trim();
    const ce = $('cardExpiry').value.replace(/\s/g,'');
    const cv = $('cardCvv').value.trim();
    const cvvLen = state.cardType === 'amex' ? 4 : 3;

    if (!setError('cardNumber','cardNumberErr', cn.length >= 13 && luhn(cn) ? '' : 'Invalid card number')) valid = false;
    if (!setError('cardHolder','cardHolderErr', ch.length >= 2 ? '' : 'Cardholder name required'))         valid = false;

    const [m,y] = ce.split('/').map(Number);
    const now = new Date(), nowM = now.getMonth()+1, nowY = now.getFullYear() % 100;
    const expOk = m >= 1 && m <= 12 && (y > nowY || (y === nowY && m >= nowM));
    if (!setError('cardExpiry','cardExpiryErr', expOk ? '' : 'Invalid expiry date')) valid = false;
    if (!setError('cardCvv','cardCvvErr',       cv.length === cvvLen ? '' : `CVV must be ${cvvLen} digits`)) valid = false;
  }
  return valid;
}

// ─── Payment Processing ───────────────────────────────────────────
function pay() {
  if (state.isBusy) return;
  if (!validateForm()) {
    showToast('Please fix the form errors.', 'error');
    document.querySelector('.error')?.scrollIntoView({ behavior:'smooth', block:'center' });
    return;
  }

  const scenario = state.scenario;

  if (scenario === '3ds') {
    show3DS();
    return;
  }

  startProcessing();
  const delay = scenario === 'timeout' ? 5000 : 1800 + Math.random() * 800;

  setTimeout(() => {
    stopProcessing();
    switch (scenario) {
      case 'success':      showSuccess(); break;
      case 'decline':      showFail('Card Declined', 'ERR_CARD_DECLINED', 'Your card was declined by the issuer.'); break;
      case 'insufficient': showFail('Insufficient Funds', 'ERR_INSUFFICIENT_FUNDS', 'Your card has insufficient funds.'); break;
      case 'fraud':        showFail('Fraud Alert', 'ERR_FRAUD_RISK', 'Transaction flagged by fraud protection.'); break;
      case 'timeout':      showFail('Request Timeout', 'ERR_GATEWAY_TIMEOUT', 'The payment gateway timed out.'); break;
      default:             showSuccess(); break;
    }
  }, delay);
}

function startProcessing() {
  state.isBusy = true;
  const btn = $('payBtn');
  btn.disabled = true;
  btn.querySelector('.pay-btn-text').classList.add('hidden');
  btn.querySelector('.pay-btn-loading').classList.remove('hidden');
}

function stopProcessing() {
  state.isBusy = false;
  const btn = $('payBtn');
  btn.disabled = false;
  btn.querySelector('.pay-btn-text').classList.remove('hidden');
  btn.querySelector('.pay-btn-loading').classList.add('hidden');
}

function showSuccess() {
  const { grand } = computeTotals();
  const ref = generateRef();
  const tx = {
    ref, amount: grand, currency: state.currency,
    method: state.method, scenario: 'success',
    name: `${$('firstName').value} ${$('lastName').value}`,
    time: new Date(),
  };
  state.transactions.unshift(tx);

  $('successMsg').textContent = `Transaction approved for ${formatCurrency(grand)}.`;
  $('successDetails').innerHTML = `
    <div class="det-row"><span>Reference</span><span class="det-val">${ref}</span></div>
    <div class="det-row"><span>Amount</span><span class="det-val">${formatCurrency(grand)}</span></div>
    <div class="det-row"><span>Method</span><span class="det-val">${methodLabel()}</span></div>
    <div class="det-row"><span>Time</span><span class="det-val">${new Date().toLocaleTimeString()}</span></div>
    <div class="det-row"><span>Name</span><span class="det-val">${tx.name}</span></div>
  `;
  showModal('modalSuccess');
  showToast('Payment successful!', 'success');
}

function showFail(title, code, msg) {
  const { grand } = computeTotals();
  const ref = generateRef();
  state.transactions.unshift({
    ref, amount: grand, currency: state.currency,
    method: state.method, scenario: 'failed',
    name: `${$('firstName').value} ${$('lastName').value}`,
    time: new Date(),
  });

  $('failMsg').textContent = msg;
  $('failCode').textContent = code;
  showModal('modalFail');
  showToast(title, 'error');
}

function show3DS() {
  $$('.otp-input').forEach(i => i.value = '');
  showModal('modal3DS');
  $('otp1').focus();
}

function confirm3DS() {
  const otp = Array.from($$('.otp-input')).map(i => i.value).join('');
  if (otp.length < 6) { showToast('Enter complete OTP', 'warn'); return; }
  hideModal('modal3DS');
  if (otp === '123456') {
    startProcessing();
    setTimeout(() => { stopProcessing(); showSuccess(); }, 1500);
  } else {
    showFail('3DS Authentication Failed', 'ERR_3DS_FAILED', 'OTP verification failed. Please try again.');
  }
}

function generateRef() {
  return 'PFT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,6).toUpperCase();
}

function methodLabel() {
  const labels = { card:'Credit/Debit Card', bank:'Bank Transfer', wallet: state.wallet || 'Digital Wallet', crypto:'Crypto' };
  return labels[state.method] || state.method;
}

// ─── Transaction Log ─────────────────────────────────────────────
function renderTxLog() {
  const list = $('txList');
  if (state.transactions.length === 0) {
    list.innerHTML = '<div class="tx-empty">No transactions yet.</div>';
    return;
  }
  list.innerHTML = state.transactions.map(tx => `
    <div class="tx-item">
      <div class="tx-top">
        <span class="tx-ref">${tx.ref}</span>
        <span class="tx-status ${tx.scenario}">${tx.scenario.toUpperCase()}</span>
      </div>
      <div class="tx-amount">${CURRENCY_SYMBOLS[tx.currency] || '$'}${(tx.amount * (CURRENCY_RATES[tx.currency]||1)).toFixed(2)}</div>
      <div class="tx-meta">${tx.method} · ${tx.name} · ${tx.time.toLocaleTimeString()}</div>
    </div>
  `).join('');
}

// ─── Download Receipt ────────────────────────────────────────────
function downloadReceipt() {
  const tx = state.transactions[0];
  if (!tx) return;
  const { grand } = computeTotals();
  const content = [
    '═══════════════════════════════════',
    '       PAYFORGE TEST RECEIPT       ',
    '═══════════════════════════════════',
    `Date:      ${new Date().toLocaleString()}`,
    `Reference: ${tx.ref}`,
    `Status:    APPROVED`,
    '───────────────────────────────────',
    `Name:      ${tx.name}`,
    `Email:     ${$('email').value}`,
    `Method:    ${methodLabel()}`,
    '───────────────────────────────────',
    ...state.items.map(i => `  ${i.name.padEnd(28)} ${formatCurrency(i.price * i.qty)}`),
    '───────────────────────────────────',
    `Subtotal:  ${formatCurrency(computeTotals().subtotal)}`,
    `Discount:  -${formatCurrency(computeTotals().discountAmt)}`,
    `Tax:       ${formatCurrency(computeTotals().tax)}`,
    `TOTAL:     ${formatCurrency(grand)}`,
    '═══════════════════════════════════',
    '  ⚡ PayForge Test — Sandbox Mode  ',
    '  No real charge was made.         ',
    '═══════════════════════════════════',
  ].join('\n');

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `receipt-${tx.ref}.txt`;
  a.click(); URL.revokeObjectURL(url);
  showToast('Receipt downloaded', 'success');
}

// ─── Method Switching ─────────────────────────────────────────────
function switchMethod(method) {
  state.method = method;
  $$('.method-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.method === method);
    t.setAttribute('aria-selected', t.dataset.method === method);
  });
  $$('.method-panel').forEach(p => p.classList.remove('active'));
  $(`panel-${method}`)?.classList.add('active');
}

// ─── Scenario ────────────────────────────────────────────────────
function setScenario(sc) {
  state.scenario = sc;
  $$('.scenario-btn').forEach(b => b.classList.toggle('active', b.dataset.scenario === sc));
}

// ─── Modals / Drawers ─────────────────────────────────────────────
function showModal(id) { $(id).classList.remove('hidden'); }
function hideModal(id) { $(id).classList.add('hidden'); }
function openDrawer(id) { $(id).classList.remove('hidden'); }
function closeDrawer(id) { $(id).classList.add('hidden'); }

// ─── Toast ───────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = $('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span class="toast-dot ${type}"></span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

// ─── Copy helper ─────────────────────────────────────────────────
function setupCopyBtns() {
  $$('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.copy).then(() => {
        const orig = btn.textContent;
        btn.textContent = '✓ Copied';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 2000);
        showToast('Copied!', 'info');
      });
    });
  });
}

// ─── Event Binding ───────────────────────────────────────────────
function bindEvents() {

  // Header buttons
  $('btnTestCards').addEventListener('click', () => openDrawer('testCardsOverlay'));
  $('btnTransactionLog').addEventListener('click', () => { renderTxLog(); openDrawer('txLogOverlay'); });

  // Drawers
  $('closeTestCards').addEventListener('click', () => closeDrawer('testCardsOverlay'));
  $('closeTxLog').addEventListener('click',     () => closeDrawer('txLogOverlay'));
  $('testCardsOverlay').addEventListener('click', e => { if(e.target === $('testCardsOverlay')) closeDrawer('testCardsOverlay'); });
  $('txLogOverlay').addEventListener('click',     e => { if(e.target === $('txLogOverlay')) closeDrawer('txLogOverlay'); });
  $('clearTxLog').addEventListener('click', () => { state.transactions = []; renderTxLog(); showToast('Log cleared', 'info'); });

  // Method tabs
  $$('.method-tab').forEach(tab => {
    tab.addEventListener('click', () => switchMethod(tab.dataset.method));
  });

  // Promo
  $('applyPromo').addEventListener('click', applyPromo);
  $('promoInput').addEventListener('keydown', e => { if (e.key === 'Enter') applyPromo(); });

  // Scenarios
  $$('.scenario-btn').forEach(btn => {
    btn.addEventListener('click', () => setScenario(btn.dataset.scenario));
  });

  // Currency
  $('currency').addEventListener('change', e => {
    state.currency = e.target.value;
    updateTotals();
    updatePayBtn();
    renderCryptoPanel();
  });

  // Installments
  $('installments').addEventListener('change', e => {
    state.installments = parseInt(e.target.value);
    updateInstallmentDisplay();
  });

  // Pay button
  $('payBtn').addEventListener('click', pay);

  // 3DS modal
  $('cancel3DS').addEventListener('click', () => hideModal('modal3DS'));
  $('confirm3DS').addEventListener('click', confirm3DS);

  // OTP auto-advance
  $$('.otp-input').forEach((input, idx, arr) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/,'').slice(0,1);
      if (input.value && idx < arr.length - 1) arr[idx+1].focus();
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !input.value && idx > 0) arr[idx-1].focus();
    });
  });

  // Success modal
  $('downloadReceipt').addEventListener('click', downloadReceipt);
  $('newPayment').addEventListener('click', () => { hideModal('modalSuccess'); resetForm(); });

  // Fail modal
  $('retryPayment').addEventListener('click', () => { hideModal('modalFail'); });
  $('changeMethod').addEventListener('click', () => { hideModal('modalFail'); document.querySelector('.method-tabs').scrollIntoView({behavior:'smooth'}); });

  // Modal overlay close
  $('modalSuccess').addEventListener('click', e => { if(e.target===$('modalSuccess')) hideModal('modalSuccess'); });
  $('modalFail').addEventListener('click',    e => { if(e.target===$('modalFail'))    hideModal('modalFail'); });

  // Card number input
  $('cardNumber').addEventListener('input', e => {
    const raw = e.target.value.replace(/\D/g,'').slice(0, state.cardType === 'amex' ? 15 : 16);
    detectCardType(raw);
    e.target.value = formatCardNumber(raw);
    updateCardDisplay();
    if ($('cardNumberErr').textContent) setError('cardNumber','cardNumberErr', raw.length >= 13 && luhn(raw) ? '' : 'Invalid card number');
  });

  // Card holder
  $('cardHolder').addEventListener('input', () => {
    updateCardDisplay();
    if ($('cardHolderErr').textContent) setError('cardHolder','cardHolderErr', $('cardHolder').value.trim().length >= 2 ? '' : 'Required');
  });

  // Expiry
  $('cardExpiry').addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g,'');
    if (v.length >= 2) v = v.slice(0,2) + ' / ' + v.slice(2,4);
    e.target.value = v;
    updateCardDisplay();
  });

  // CVV — flip card
  $('cardCvv').addEventListener('focus', () => {
    $('creditCard').classList.add('flipped');
    updateCardDisplay();
  });
  $('cardCvv').addEventListener('blur', () => {
    $('creditCard').classList.remove('flipped');
  });
  $('cardCvv').addEventListener('input', () => { updateCardDisplay(); });

  // Toggle CVV visibility
  $('toggleCvv').addEventListener('click', () => {
    const inp = $('cardCvv');
    state.cvvVisible = !state.cvvVisible;
    inp.type = state.cvvVisible ? 'text' : 'password';
    $('eyeIcon').innerHTML = state.cvvVisible
      ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
      : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
  });

  // CVV tooltip
  $('cvvHelpBtn').addEventListener('click', () => {
    $('cvvTooltip').classList.toggle('hidden');
  });
  document.addEventListener('click', e => {
    if (!$('cvvHelpBtn').contains(e.target)) $('cvvTooltip').classList.add('hidden');
  });

  // Wallet selection
  $$('.wallet-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.wallet-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.wallet = btn.dataset.wallet;
      const nameMap = { paypal:'PayPal', apple:'Apple Pay', google:'Google Pay', venmo:'Venmo' };
      $('walletSelectedName').textContent = nameMap[state.wallet] || state.wallet;
      $('walletSelectedMsg').classList.remove('hidden');
      showToast(`${nameMap[state.wallet]} selected`, 'info');
    });
  });

  // Crypto tabs
  $$('.crypto-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.crypto-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderCryptoPanel(tab.dataset.coin);
    });
  });

  // Copy bank ref
  $('copyBankRef').addEventListener('click', () => {
    const ref = $('bankRef').textContent;
    navigator.clipboard.writeText(ref);
    $('copyBankRef').textContent = '✓ Copied';
    $('copyBankRef').classList.add('copied');
    setTimeout(() => { $('copyBankRef').textContent = 'Copy'; $('copyBankRef').classList.remove('copied'); }, 2000);
    showToast('Reference copied', 'info');
  });

  setupCopyBtns();

  // Live validation on blur
  const liveFields = ['firstName','lastName','email','phone','address','city','zip'];
  liveFields.forEach(id => {
    $(id)?.addEventListener('blur', () => validateField(id));
  });

  // Escape key closes modals/drawers
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      hideModal('modal3DS');
      hideModal('modalSuccess');
      hideModal('modalFail');
      closeDrawer('testCardsOverlay');
      closeDrawer('txLogOverlay');
    }
  });
}

function validateField(id) {
  const val = $(id).value.trim();
  const rules = {
    firstName:  v => v ? '' : 'First name is required',
    lastName:   v => v ? '' : 'Last name is required',
    email:      v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Valid email required',
    phone:      v => v.replace(/\D/g,'').length >= 7 ? '' : 'Valid phone required',
    address:    v => v ? '' : 'Address is required',
    city:       v => v ? '' : 'City is required',
    zip:        v => v ? '' : 'ZIP is required',
  };
  if (rules[id]) setError(id, id+'Err', rules[id](val));
}

function resetForm() {
  $$('input[type="text"], input[type="email"], input[type="tel"], input[type="password"]').forEach(i => {
    i.value = ''; i.classList.remove('error','valid');
  });
  $$('.field-error').forEach(e => e.textContent = '');
  state.discount = 0; state.discountCode = '';
  $('promoInput').value = '';
  $('promoFeedback').textContent = '';
  updateTotals();
  updateCardDisplay();
  setScenario('success');
  showToast('Form reset', 'info');
}
