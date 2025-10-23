// URL do seu backend no Railway
const BASE_URL = 'https://smart-leads-2-back-production.up.railway.app';

const form = document.getElementById('searchForm');
const submitBtn = document.getElementById('submitBtn');
const loading = document.getElementById('loading');
const resultsTable = document.getElementById('resultsTable');
const resultsBody = document.getElementById('resultsBody');
const downloadLink = document.getElementById('downloadLink');           // backend CSV
const downloadLocalLink = document.getElementById('downloadLocalLink'); // CSV local (fallback)

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
  loading.style.display = 'block';
  submitBtn.disabled = true;

  const category = document.getElementById('category').value.trim();
  const location = document.getElementById('location').value.trim();
  const limit = document.getElementById('limit').value;

  try {
    const params = new URLSearchParams({ category, location, limit });
    const apiUrl = `${BASE_URL}/api/scrape?${params.toString()}`;

    const payload = await fetchJson(apiUrl);
    const entries = Array.isArray(payload?.data) ? payload.data : [];

    renderRows(entries);

    if (!entries.length) {
      alert('Nenhum contato encontrado com WhatsApp.');
      return;
    }

    // Link para baixar via backend
    downloadLink.href = `${BASE_URL}/api/scrape/csv?${params.toString()}`;
    downloadLink.style.display = 'inline-block';

    // Fallback: CSV gerado localmente
    const csv = buildLocalCsv(entries);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    downloadLocalLink.href = url;
    downloadLocalLink.style.display = 'inline-block';
  } catch (err) {
    alert('Erro: ' + err.message);
  } finally {
    loading.style.display = 'none';
    submitBtn.disabled = false;
  }
});
