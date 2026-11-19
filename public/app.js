const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const date = value => value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Request could not be completed.');
  return body;
}
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2600); }
function selectOptions(select, records, label) { select.innerHTML = `<option value="">Select ${label}</option>` + records.map(item => `<option value="${item._id}">${escapeHtml(item.name)}</option>`).join(''); }

async function loadLookups() {
  const data = await api('/api/lookups');
  document.querySelectorAll('select[name="bloodGroupId"]').forEach(el => selectOptions(el, data.bloodGroups, 'group'));
  selectOptions($('select[name="hospitalId"]'), data.hospitals, 'hospital');
  selectOptions($('select[name="bankId"]'), data.banks, 'bank');
  const donorSelect = $('select[name="donorId"]');
  donorSelect.innerHTML = '<option value="">Select eligible donor</option>' + data.donors.map(d => `<option value="${d._id}">${escapeHtml(d.name)} · ${escapeHtml(d.bloodGroup || '—')}</option>`).join('');
}
async function loadDashboard() {
  const data = await api('/api/dashboard');
  $('#donorCount').textContent = data.donors; $('#bankCount').textContent = data.banks;
  $('#hospitalCount').textContent = data.hospitals; $('#pendingCount').textContent = data.pending;
  const max = Math.max(1, ...data.inventory.map(x => x.unitsAvailable));
  $('#inventoryGrid').innerHTML = data.inventory.map(item => `<article class="inventory-card"><div class="blood-type">${escapeHtml(item.bloodGroup)}</div><div class="units"><b>${item.unitsAvailable}</b> units available</div><div class="bar"><span style="width:${Math.max(8, item.unitsAvailable / max * 100)}%"></span></div><div class="bank-name">${escapeHtml(item.bankName)}</div></article>`).join('') || '<p class="empty">No inventory recorded yet.</p>';
}
async function loadDonors() {
  const rows = await api('/api/donors');
  $('#donorRows').innerHTML = rows.map(d => `<tr><td><b>${escapeHtml(d.name)}</b></td><td><span class="badge Approved">${escapeHtml(d.bloodGroup || '—')}</span></td><td>${escapeHtml(d.phone)}</td><td>${escapeHtml(d.email || '—')}</td><td>${escapeHtml(d.address || '—')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No donors yet. Register the first donor above.</td></tr>';
}
async function loadRequests() {
  const rows = await api('/api/requests');
  $('#requestRows').innerHTML = rows.map(r => `<tr><td><b>${escapeHtml(r.hospitalName)}</b></td><td>${escapeHtml(r.bloodGroup)}</td><td>${escapeHtml(r.bankName)}</td><td>${r.unitsRequired}</td><td>${date(r.requestDate)}</td><td><span class="badge ${escapeHtml(r.status)}">${escapeHtml(r.status)}</span></td><td>${r.status === 'Pending' ? `<div class="review-actions"><button class="approve" data-review="Approved" data-id="${r._id}">Approve</button><button class="reject" data-review="Rejected" data-id="${r._id}">Reject</button></div>` : '—'}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">No requests submitted yet.</td></tr>';
}
async function refresh() { await Promise.all([loadDashboard(), loadDonors(), loadRequests()]); }

$('#donorForm').addEventListener('submit', async event => {
  event.preventDefault(); const message = $('#donorMessage'); message.textContent = ''; message.className = 'form-message';
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try { await api('/api/donors', { method: 'POST', body: JSON.stringify(data) }); event.currentTarget.reset(); message.textContent = 'Donor registered successfully.'; await Promise.all([loadLookups(), refresh()]); }
  catch (error) { message.textContent = error.message; message.classList.add('error'); }
});
$('#requestForm').addEventListener('submit', async event => {
  event.preventDefault(); const message = $('#requestMessage'); message.textContent = ''; message.className = 'form-message';
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try { await api('/api/requests', { method: 'POST', body: JSON.stringify(data) }); event.currentTarget.reset(); message.textContent = 'Request submitted and marked Pending.'; await Promise.all([loadLookups(), refresh()]); }
  catch (error) { message.textContent = error.message; message.classList.add('error'); }
});
$('#donationForm').addEventListener('submit', async event => {
  event.preventDefault(); const message = $('#donationMessage'); message.textContent = ''; message.className = 'form-message';
  try {
    await api('/api/donations', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
    event.currentTarget.reset(); message.textContent = 'Donation recorded and inventory updated.'; await Promise.all([loadLookups(), refresh()]);
  } catch (error) { message.textContent = error.message; message.classList.add('error'); }
});
$('#requestRows').addEventListener('click', async event => {
  const button = event.target.closest('[data-review]'); if (!button) return;
  try { await api(`/api/requests/${button.dataset.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.review }) }); toast(`Request ${button.dataset.review.toLowerCase()}.`); await refresh(); }
  catch (error) { toast(error.message); }
});
$('#refresh').addEventListener('click', () => refresh().catch(error => toast(error.message)));

(async () => {
  try {
    await loadLookups(); await refresh();
    const state = $('#dbStatus'); state.innerHTML = '<i></i> MongoDB connected'; state.className = 'status online';
  } catch (error) {
    const state = $('#dbStatus'); state.innerHTML = '<i></i> MongoDB offline'; state.className = 'status offline'; toast(error.message);
  }
})();
