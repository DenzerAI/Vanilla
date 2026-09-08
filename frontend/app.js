const form = document.querySelector('#order-form');
const list = document.querySelector('#orders');
const health = document.querySelector('#health');
const refresh = document.querySelector('#refresh');
const whatsappStatus = document.querySelector('#whatsapp-status');
const whatsappContent = document.querySelector('#whatsapp-content');
const heroStatus = document.querySelector('#hero-status');
const heroContent = document.querySelector('#hero-content');

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[char]));

function render(orders) {
  if (!orders.length) {
    list.innerHTML = '<p class="empty">Noch keine Aufträge.</p>';
    return;
  }
  list.innerHTML = orders.map((order) => `
    <article>
      <div class="meta"><span class="status ${escapeHtml(order.status)}">${escapeHtml(order.status)}</span><span>${escapeHtml(order.engine)}</span><time>${new Date(order.createdAt).toLocaleString('de-DE')}</time></div>
      <h3>${escapeHtml(order.title)}</h3>
      <p>${escapeHtml(order.instructions)}</p>
      ${order.result !== null ? `<div class="result"><strong>Ergebnis</strong><p>${escapeHtml(order.result)}</p></div>` : ''}
      ${order.error ? `<div class="error"><strong>Fehler</strong><p>${escapeHtml(order.error)}</p></div>` : ''}
    </article>
  `).join('');
}

async function load() {
  try {
    const response = await fetch('/api/orders');
    if (!response.ok) throw new Error('API nicht erreichbar');
    render((await response.json()).orders);
    health.textContent = 'online';
    health.classList.add('online');
  } catch (error) {
    health.textContent = error.message;
    health.classList.remove('online');
  }
}

async function loadWhatsApp() {
  try {
    const response = await fetch('/api/whatsapp/status');
    if (!response.ok) throw new Error('Status nicht erreichbar');
    const state = await response.json();
    const labels = {
      disconnected: 'getrennt', connecting: 'verbindet …', qr: 'QR bereit',
      connected: 'verbunden', logged_out: 'abgemeldet', error: 'Fehler',
    };
    whatsappStatus.textContent = labels[state.status] || state.status;
    whatsappStatus.className = `bridge-status ${escapeHtml(state.status)}`;

    if (state.status === 'qr' && state.qrDataUrl) {
      whatsappContent.innerHTML = `
        <p class="bridge-copy">WhatsApp öffnen → Verknüpfte Geräte → Gerät hinzufügen.</p>
        <img class="qr" src="${escapeHtml(state.qrDataUrl)}" alt="WhatsApp QR-Code">
      `;
    } else if (state.status === 'connected') {
      whatsappContent.innerHTML = `
        <p class="bridge-copy">Verbunden${state.account ? ` als +${escapeHtml(state.account)}` : ''}. Sende eine Nachricht mit <code>!</code> am Anfang.</p>
      `;
    } else if (state.status === 'connecting') {
      whatsappContent.innerHTML = '<p class="bridge-copy">Verbindung wird vorbereitet …</p>';
    } else {
      whatsappContent.innerHTML = `
        <p class="bridge-copy">${state.error ? escapeHtml(state.error) : 'Verbinde ein WhatsApp-Konto, um Aufträge per Chat anzunehmen.'}</p>
        <button id="whatsapp-connect" type="button">QR-Code erzeugen</button>
      `;
    }
  } catch (error) {
    whatsappStatus.textContent = error.message;
    whatsappStatus.className = 'bridge-status error';
  }
}

async function loadHero() {
  try {
    const response = await fetch('/api/hero/status');
    if (!response.ok) throw new Error('HERO-Status nicht erreichbar');
    const state = await response.json();
    const connected = state.lastCheck?.ok;
    heroStatus.textContent = connected ? 'verbunden' : state.configured ? 'konfiguriert' : 'API-Key fehlt';
    heroStatus.className = `bridge-status ${connected ? 'connected' : state.configured ? 'configured' : 'unconfigured'}`;
    if (!state.configured) {
      heroContent.innerHTML = `
        <p class="bridge-copy">Lege <code>HERO_API_KEY=…</code> in <code>~/Documents/.env</code> ab und starte den Server neu.</p>
      `;
      return;
    }
    const detail = state.lastCheck?.error
      ? `Letzter Test: ${escapeHtml(state.lastCheck.error)}`
      : connected ? `Verbindung am ${new Date(state.lastCheck.checkedAt).toLocaleString('de-DE')} bestätigt.`
      : 'Der API-Key ist geladen. Die Verbindung wurde noch nicht geprüft.';
    heroContent.innerHTML = `
      <p class="bridge-copy">${detail}</p>
      <div class="actions">
        <button id="hero-test" type="button">Verbindung prüfen</button>
        <button id="hero-sync" class="secondary" type="button">Kontakte synchronisieren</button>
      </div>
    `;
  } catch (error) {
    heroStatus.textContent = error.message;
    heroStatus.className = 'bridge-status error';
  }
}

document.addEventListener('click', async (event) => {
  if (event.target.id !== 'whatsapp-connect') return;
  event.target.disabled = true;
  event.target.textContent = 'Wird gestartet …';
  try {
    const response = await fetch('/api/whatsapp/connect', { method: 'POST' });
    if (!response.ok) throw new Error((await response.json()).error || 'Start fehlgeschlagen');
    await loadWhatsApp();
  } catch (error) {
    alert(error.message);
    await loadWhatsApp();
  }
});

document.addEventListener('click', async (event) => {
  if (!['hero-test', 'hero-sync'].includes(event.target.id)) return;
  const action = event.target.id === 'hero-test' ? 'test' : 'sync/contacts';
  const original = event.target.textContent;
  event.target.disabled = true;
  event.target.textContent = 'Bitte warten …';
  try {
    const response = await fetch(`/api/hero/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event.target.id === 'hero-sync' ? { all: true } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'HERO-Aufruf fehlgeschlagen');
    if (event.target.id === 'hero-sync') {
      alert(`${result.imported} HERO-Kontakte aus ${result.pages} Seite(n) synchronisiert, ${result.skippedWithoutPhone} ohne Telefonnummer übersprungen.`);
    }
  } catch (error) {
    alert(error.message);
  } finally {
    event.target.textContent = original;
    await loadHero();
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fields = new FormData(form);
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(fields)),
  });
  if (!response.ok) return alert((await response.json()).error);
  form.reset();
  form.elements.engine.value = 'any';
  await load();
});

refresh.addEventListener('click', load);
load();
loadWhatsApp();
loadHero();
setInterval(load, 5000);
setInterval(loadWhatsApp, 2000);
