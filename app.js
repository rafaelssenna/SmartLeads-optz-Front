// URL do seu backend no Railway
const BASE_URL = 'https://smart-leads-2-back-production.up.railway.app';

const form = document.getElementById('searchForm');
const submitBtn = document.getElementById('submitBtn');
const loading = document.getElementById('loading');
const resultsTable = document.getElementById('resultsTable');
const resultsBody = document.getElementById('resultsBody');
const downloadLink = document.getElementById('downloadLink');           // backend CSV
const downloadLocalLink = document.getElementById('downloadLocalLink'); // CSV local (fallback)
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

function escapeCsv(value = '') {
  const s = String(value ?? '');
  // escapa aspas e envolve em aspas
  return `"${s.replace(/"/g, '""')}"`;
}

function buildLocalCsv(rows) {
  const header = 'Nome,Telefone\n';
  const lines = rows.map(r => `${escapeCsv(r.name)},${escapeCsv(r.phone)}`).join('\n');
  return header + lines;
}

function renderRows(entries) {
  resultsBody.innerHTML = '';
  entries.forEach(item => {
    const row = document.createElement('tr');
    const nameCell = document.createElement('td');
    nameCell.textContent = item.name || '';
    const phoneCell = document.createElement('td');
    phoneCell.textContent = item.phone || '';
    row.appendChild(nameCell);
    row.appendChild(phoneCell);
    resultsBody.appendChild(row);
  });
  resultsTable.style.display = entries.length ? '' : 'none';
}

async function fetchJson(url) {
  const res = await fetch(url, { method: 'GET' });
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  // reset UI
  resultsBody.innerHTML = '';
  resultsTable.style.display = 'none';
  downloadLink.style.display = 'none';
  downloadLocalLink.style.display = 'none';
  progressContainer.style.display = 'none';
  progressBar.value = 0;
  progressText.textContent = '';
  loading.style.display = 'block';
  submitBtn.disabled = true;

  const category = document.getElementById('category').value.trim();
  const location = document.getElementById('location').value.trim();
  const limit = document.getElementById('limit').value;

  // Utiliza SSE para obter resultados progressivos
  try {
    const params = new URLSearchParams({ category, location, limit });
    const streamUrl = `${BASE_URL}/api/scrape/stream?${params.toString()}`;
    const entries = [];
    progressContainer.style.display = 'block';
    progressBar.value = 0;
    progressBar.max = 100;
    progressText.textContent = `0 / ${limit}`;

    const es = new EventSource(streamUrl);

    es.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data);
        // Atualiza progresso e adiciona linha à tabela
        if (payload.progress) {
          const found = payload.progress.found;
          const total = payload.progress.total;
          const pct = total > 0 ? Math.floor((found / total) * 100) : 0;
          progressBar.value = pct;
          progressText.textContent = `${found} / ${total}`;
        }
        if (payload.contact) {
          entries.push(payload.contact);
          const row = document.createElement('tr');
          const nameCell = document.createElement('td');
          nameCell.textContent = payload.contact.name;
          const phoneCell = document.createElement('td');
          phoneCell.textContent = payload.contact.phone;
          row.appendChild(nameCell);
          row.appendChild(phoneCell);
          resultsBody.appendChild(row);
          resultsTable.style.display = '';
        }
      } catch (err) {
        console.error('Erro ao processar mensagem SSE', err);
      }
    });

    es.addEventListener('done', () => {
      // Streaming finalizado: permite download e encerra
      progressBar.value = 100;
      progressText.textContent = `${entries.length} / ${limit}`;
      loading.style.display = 'none';
      submitBtn.disabled = false;
      // Gera CSV local
      const csv = buildLocalCsv(entries);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const urlCsv = URL.createObjectURL(blob);
      downloadLocalLink.href = urlCsv;
      downloadLocalLink.style.display = 'inline-block';
      // Link para baixar via backend (CSV com os mesmos parâmetros)
      downloadLink.href = `${BASE_URL}/api/scrape/csv?${params.toString()}`;
      downloadLink.style.display = 'inline-block';
      es.close();
    });

    es.addEventListener('error', (event) => {
      console.error('Erro no stream SSE', event);
      try { es.close(); } catch {}
      loading.style.display = 'none';
      progressContainer.style.display = 'none';
      submitBtn.disabled = false;
      alert('Erro ao buscar dados. Tente novamente.');
    });
  } catch (err) {
    loading.style.display = 'none';
    submitBtn.disabled = false;
    alert('Erro: ' + err.message);
  }
});
