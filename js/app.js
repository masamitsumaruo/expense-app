let currentEditId = null;
let pendingAttachments = [];
let editAttachments = [];
let capturedReceiptImage = null;

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  initCamera();
  initForm();
  initList();
  initExport();
  initSettings();
  updatePeriodHeader();

  if (isSubmissionDay()) {
    document.getElementById('submissionNotice').style.display = 'block';
  }

  const profile = await getUserProfile();
  if (!profile) {
    switchPage('page-settings');
    showToast('まず氏名を設定してください');
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});

// --- タブ切り替え ---
function initTabs() {
  document.querySelectorAll('.tab-bar button').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      switchPage(page);
    });
  });
}

function switchPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  document.querySelectorAll('.tab-bar button').forEach(b => {
    b.classList.toggle('active', b.dataset.page === pageId);
  });

  if (pageId === 'page-list') refreshList();
  if (pageId === 'page-export') refreshExport();
}

function updatePeriodHeader() {
  const period = getBillingPeriod();
  document.getElementById('currentPeriod').textContent = period.label;
}

// --- カメラ・OCR ---
function initCamera() {
  const cameraArea = document.getElementById('cameraArea');
  const cameraInput = document.getElementById('cameraInput');

  cameraArea.addEventListener('click', () => cameraInput.click());

  cameraInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const imageDataURL = await readFileAsDataURL(file);
    capturedReceiptImage = { name: file.name, type: file.type, data: imageDataURL };

    const img = document.createElement('img');
    img.src = imageDataURL;
    cameraArea.innerHTML = '';
    cameraArea.appendChild(img);

    const progress = document.getElementById('ocrProgress');
    const status = document.getElementById('ocrStatus');
    progress.style.display = 'block';

    try {
      const result = await recognizeReceipt(file, (msg) => {
        status.textContent = msg;
      });

      document.getElementById('inputStore').value = result.storeName;
      document.getElementById('inputAmount').value = result.amount || '';
      document.getElementById('inputDetails').value = result.details;
      document.getElementById('inputDate').value = result.date || todayString();
      document.getElementById('receiptForm').style.display = 'block';
      showToast('読み取り完了。内容を確認してください');
    } catch (err) {
      if (err.message === 'API_KEY_MISSING') {
        showToast('設定画面でClaude APIキーを登録してください');
        switchPage('page-settings');
      } else if (err.message === 'API_KEY_INVALID') {
        showToast('APIキーが無効です。設定を確認してください');
      } else {
        showToast('解析に失敗しました: ' + err.message);
      }
      document.getElementById('inputDate').value = todayString();
      document.getElementById('receiptForm').style.display = 'block';
    } finally {
      progress.style.display = 'none';
    }
  });
}

// --- フォーム ---
function initForm() {
  document.getElementById('btnManualAdd').addEventListener('click', () => {
    resetForm();
    document.getElementById('inputDate').value = todayString();
    document.getElementById('receiptForm').style.display = 'block';
  });

  document.getElementById('btnAddAttachment').addEventListener('click', () => {
    document.getElementById('inputAttachments').click();
  });
  document.getElementById('btnCameraAttachment').addEventListener('click', () => {
    document.getElementById('inputCameraAttachment').click();
  });
  document.getElementById('inputAttachments').addEventListener('change', (e) => {
    handleNewAttachments(e.target.files, pendingAttachments, 'addAttachmentList');
    e.target.value = '';
  });
  document.getElementById('inputCameraAttachment').addEventListener('change', (e) => {
    handleNewAttachments(e.target.files, pendingAttachments, 'addAttachmentList');
    e.target.value = '';
  });

  document.getElementById('btnSave').addEventListener('click', async () => {
    const date = document.getElementById('inputDate').value;
    const storeName = document.getElementById('inputStore').value.trim();
    const amount = parseInt(document.getElementById('inputAmount').value, 10) || 0;
    const details = document.getElementById('inputDetails').value.trim();
    const companion = document.getElementById('inputCompanion').value.trim();
    const purpose = document.getElementById('inputPurpose').value.trim();

    if (!storeName) {
      showToast('店名を入力してください');
      return;
    }
    if (!date) {
      showToast('日付を入力してください');
      return;
    }

    await addReceipt({ date, storeName, amount, details, companion, purpose, receiptImage: capturedReceiptImage, attachments: pendingAttachments.slice(), createdAt: new Date().toISOString() });
    showToast('保存しました');
    resetForm();
    resetCamera();
  });
}

async function handleNewAttachments(files, targetArray, listElementId) {
  for (const file of files) {
    const data = await readFileAsDataURL(file);
    targetArray.push({ name: file.name, type: file.type, data });
  }
  renderAttachmentList(targetArray, listElementId);
}

function renderAttachmentList(attachments, listElementId) {
  const container = document.getElementById(listElementId);
  if (attachments.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = attachments.map((att, i) => {
    const isImage = att.type.startsWith('image/');
    const thumb = isImage
      ? `<img class="att-thumb" src="${att.data}" alt="">`
      : `<div class="att-icon">PDF</div>`;
    return `<div class="attachment-item">
      ${thumb}
      <span class="att-name">${escapeHtml(att.name)}</span>
      <button class="att-remove" data-idx="${i}" data-list="${listElementId}">&times;</button>
    </div>`;
  }).join('');

  container.querySelectorAll('.att-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const listId = btn.dataset.list;
      if (listId === 'addAttachmentList') {
        pendingAttachments.splice(idx, 1);
        renderAttachmentList(pendingAttachments, listId);
      } else {
        editAttachments.splice(idx, 1);
        renderAttachmentList(editAttachments, listId);
      }
    });
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resetForm() {
  document.getElementById('inputDate').value = '';
  document.getElementById('inputStore').value = '';
  document.getElementById('inputAmount').value = '';
  document.getElementById('inputDetails').value = '';
  document.getElementById('inputCompanion').value = '';
  document.getElementById('inputPurpose').value = '';
  document.getElementById('receiptForm').style.display = 'none';
  pendingAttachments = [];
  capturedReceiptImage = null;
  document.getElementById('addAttachmentList').innerHTML = '';
}

function resetCamera() {
  const cameraArea = document.getElementById('cameraArea');
  cameraArea.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/>
      <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/>
    </svg>
    <p>レシート・領収書を撮影・選択</p>
  `;
  document.getElementById('cameraInput').value = '';
}

// --- 一覧 ---
function initList() {
  document.getElementById('periodSelect').addEventListener('change', refreshList);
}

async function refreshList() {
  const receipts = await getAllReceipts();
  const periods = getAllBillingPeriods(receipts);
  const select = document.getElementById('periodSelect');
  const currentVal = select.value;

  select.innerHTML = periods.map(p => `<option value="${p}" ${p === currentVal ? 'selected' : ''}>${p}</option>`).join('');

  const selectedPeriod = select.value;
  const filtered = filterReceiptsByPeriod(receipts, selectedPeriod);

  const list = document.getElementById('receiptList');
  const empty = document.getElementById('emptyState');

  if (filtered.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    document.getElementById('totalAmount').textContent = '¥0';
    return;
  }

  empty.style.display = 'none';
  const total = filtered.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  document.getElementById('totalAmount').textContent = formatYen(total);

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  list.innerHTML = filtered.map(r => {
    const receiptThumb = r.receiptImage
      ? `<img class="receipt-thumb" src="${r.receiptImage.data}" alt="レシート" onclick="viewReceiptImage(${r.id})">`
      : '';
    const attCount = (r.attachments || []).length;
    const attBadges = attCount > 0
      ? `<div class="receipt-attachments">${(r.attachments || []).map((a, i) =>
          `<button class="att-badge" onclick="viewAttachment(${r.id}, ${i})">${a.type.startsWith('image/') ? '📷' : '📄'} ${escapeHtml(a.name.length > 10 ? a.name.substring(0,10) + '...' : a.name)}</button>`
        ).join('')}</div>`
      : '';
    return `<li class="receipt-item" style="flex-wrap:wrap;">
      ${receiptThumb}
      <div class="receipt-info">
        <div class="store">${escapeHtml(r.storeName)}</div>
        <div class="meta">${formatDate(r.date)} | ${escapeHtml(r.purpose || '目的未設定')} | ${escapeHtml(r.companion || '-')}</div>
        ${attBadges}
      </div>
      <div class="receipt-amount">${formatYen(r.amount)}</div>
      <div class="receipt-actions">
        <button onclick="openEdit(${r.id})" title="編集">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button onclick="confirmDelete(${r.id})" title="削除">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </div>
    </li>`;
  }).join('');
}

// --- 編集モーダル ---
async function openEdit(id) {
  const r = await getReceipt(id);
  if (!r) return;
  currentEditId = id;
  document.getElementById('editDate').value = r.date;
  document.getElementById('editStore').value = r.storeName;
  document.getElementById('editAmount').value = r.amount;
  document.getElementById('editDetails').value = r.details || '';
  document.getElementById('editCompanion').value = r.companion || '';
  document.getElementById('editPurpose').value = r.purpose || '';
  editAttachments = (r.attachments || []).slice();
  renderAttachmentList(editAttachments, 'editAttachmentList');
  document.getElementById('editModal').classList.add('active');
}

document.getElementById('btnEditAttachment').addEventListener('click', () => {
  document.getElementById('editAttachments').click();
});
document.getElementById('btnEditCameraAttachment').addEventListener('click', () => {
  document.getElementById('editCameraAttachment').click();
});
document.getElementById('editAttachments').addEventListener('change', (e) => {
  handleNewAttachments(e.target.files, editAttachments, 'editAttachmentList');
  e.target.value = '';
});
document.getElementById('editCameraAttachment').addEventListener('change', (e) => {
  handleNewAttachments(e.target.files, editAttachments, 'editAttachmentList');
  e.target.value = '';
});

document.getElementById('btnCancelEdit').addEventListener('click', () => {
  document.getElementById('editModal').classList.remove('active');
  currentEditId = null;
  editAttachments = [];
});

document.getElementById('btnSaveEdit').addEventListener('click', async () => {
  if (currentEditId == null) return;
  const receipt = await getReceipt(currentEditId);
  receipt.date = document.getElementById('editDate').value;
  receipt.storeName = document.getElementById('editStore').value.trim();
  receipt.amount = parseInt(document.getElementById('editAmount').value, 10) || 0;
  receipt.details = document.getElementById('editDetails').value.trim();
  receipt.companion = document.getElementById('editCompanion').value.trim();
  receipt.purpose = document.getElementById('editPurpose').value.trim();
  receipt.attachments = editAttachments.slice();
  await updateReceipt(receipt);
  document.getElementById('editModal').classList.remove('active');
  currentEditId = null;
  editAttachments = [];
  showToast('更新しました');
  refreshList();
});

async function confirmDelete(id) {
  if (confirm('このレシートを削除しますか？')) {
    await deleteReceipt(id);
    showToast('削除しました');
    refreshList();
  }
}

// --- CSV出力 ---
function initExport() {
  document.getElementById('exportPeriodSelect').addEventListener('change', refreshExport);
  document.getElementById('btnDownloadCSV').addEventListener('click', handleDownloadCSV);
  document.getElementById('btnSendEmail').addEventListener('click', handleSendEmail);
}

async function refreshExport() {
  const receipts = await getAllReceipts();
  const periods = getAllBillingPeriods(receipts);
  const select = document.getElementById('exportPeriodSelect');
  const currentVal = select.value;

  select.innerHTML = periods.map(p => `<option value="${p}" ${p === currentVal ? 'selected' : ''}>${p}</option>`).join('');

  const filtered = filterReceiptsByPeriod(receipts, select.value);
  const total = filtered.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  document.getElementById('exportSummary').innerHTML = `
    <p style="font-size:14px;color:var(--text-light);">対象期間: <strong>${select.value}</strong></p>
    <p style="font-size:14px;color:var(--text-light);">件数: <strong>${filtered.length}件</strong></p>
    <p style="font-size:14px;color:var(--text-light);">合計金額: <strong>${formatYen(total)}</strong></p>
  `;

  const profile = await getUserProfile();
  const soumuEmail = profile?.soumuEmail || '';
  document.getElementById('inputSoumuEmail').value = soumuEmail;
}

async function handleDownloadCSV() {
  const receipts = await getAllReceipts();
  const period = document.getElementById('exportPeriodSelect').value;
  const filtered = filterReceiptsByPeriod(receipts, period);
  const profile = await getUserProfile();
  const userName = profile?.name || '未設定';

  if (filtered.length === 0) {
    showToast('対象期間のレシートがありません');
    return;
  }

  const csv = generateCSV(filtered, userName);
  const filename = getCSVFilename(period, userName);
  downloadCSV(csv, filename);
  showToast('CSVをダウンロードしました');
}

async function handleSendEmail() {
  const receipts = await getAllReceipts();
  const period = document.getElementById('exportPeriodSelect').value;
  const filtered = filterReceiptsByPeriod(receipts, period);
  const profile = await getUserProfile();
  const userName = profile?.name || '未設定';
  const soumuEmail = document.getElementById('inputSoumuEmail').value.trim();

  if (filtered.length === 0) {
    showToast('対象期間のレシートがありません');
    return;
  }

  const total = filtered.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const subject = encodeURIComponent(`経費精算書 ${period} ${userName}`);
  const body = encodeURIComponent(
    `経費精算書を提出いたします。\n\n` +
    `氏名: ${userName}\n` +
    `部署: ${profile?.dept || ''}\n` +
    `対象期間: ${period}\n` +
    `件数: ${filtered.length}件\n` +
    `合計金額: ${formatYen(total)}\n\n` +
    `※ CSVファイルを別途添付してください。\n` +
    `先にCSVをダウンロードし、このメールに添付してお送りください。`
  );

  const mailto = `mailto:${soumuEmail}?subject=${subject}&body=${body}`;
  window.location.href = mailto;
  showToast('メールアプリを起動しました。CSVを添付して送信してください');
}

// --- 設定 ---
function initSettings() {
  loadProfile();

  document.getElementById('btnSaveProfile').addEventListener('click', async () => {
    const name = document.getElementById('settingName').value.trim();
    const email = document.getElementById('settingEmail').value.trim();
    const dept = document.getElementById('settingDept').value.trim();
    if (!name) {
      showToast('氏名を入力してください');
      return;
    }

    const existing = await getUserProfile();
    await saveUserProfile({ name, email, dept, soumuEmail: existing?.soumuEmail || '' });
    showToast('設定を保存しました');
  });

  document.getElementById('btnSaveSoumuEmail').addEventListener('click', async () => {
    const soumuEmail = document.getElementById('inputSoumuEmail').value.trim();
    const profile = await getUserProfile();
    if (profile) {
      await saveUserProfile({ ...profile, soumuEmail });
    } else {
      await saveUserProfile({ name: '', email: '', dept: '', soumuEmail });
    }
    showToast('総務メールアドレスを保存しました');
  });

  document.getElementById('btnClearData').addEventListener('click', async () => {
    if (confirm('全てのデータを削除しますか？この操作は取り消せません。')) {
      indexedDB.deleteDatabase('ExpenseApp');
      showToast('全データを削除しました');
      setTimeout(() => location.reload(), 1000);
    }
  });
}

async function loadProfile() {
  const profile = await getUserProfile();
  if (profile) {
    document.getElementById('settingName').value = profile.name || '';
    document.getElementById('settingEmail').value = profile.email || '';
    document.getElementById('settingDept').value = profile.dept || '';
  }
}

// --- レシート画像表示 ---
async function viewReceiptImage(receiptId) {
  const r = await getReceipt(receiptId);
  if (!r || !r.receiptImage) return;
  const win = window.open('', '_blank');
  if (!win) { showToast('ポップアップを許可してください'); return; }
  win.document.write(`<html><head><title>レシート・領収書</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;}img{max-width:100%;max-height:100vh;object-fit:contain;}</style></head><body><img src="${r.receiptImage.data}"></body></html>`);
}

// --- 添付ファイル表示 ---
async function viewAttachment(receiptId, attIndex) {
  const r = await getReceipt(receiptId);
  if (!r || !r.attachments || !r.attachments[attIndex]) return;
  const att = r.attachments[attIndex];
  const win = window.open('', '_blank');
  if (!win) {
    showToast('ポップアップを許可してください');
    return;
  }
  if (att.type.startsWith('image/')) {
    win.document.write(`<html><head><title>${escapeHtml(att.name)}</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;}img{max-width:100%;max-height:100vh;object-fit:contain;}</style></head><body><img src="${att.data}"></body></html>`);
  } else {
    win.document.write(`<html><head><title>${escapeHtml(att.name)}</title></head><body><embed src="${att.data}" type="application/pdf" width="100%" height="100%" style="position:fixed;top:0;left:0;width:100%;height:100%;"></body></html>`);
  }
}

// --- ユーティリティ ---
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
