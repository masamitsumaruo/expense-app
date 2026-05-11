function generateCSV(receipts, userName) {
  const BOM = '﻿';
  const headers = ['日付', '店名', '金額', '明細', '同行者', '目的', '申請者'];
  const rows = receipts.map(r => [
    formatDate(r.date),
    csvEscape(r.storeName),
    r.amount,
    csvEscape(r.details),
    csvEscape(r.companion),
    csvEscape(r.purpose),
    csvEscape(userName)
  ]);

  let total = receipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  rows.push(['', '', total, '', '', '合計', userName]);

  const csv = BOM + headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
  return csv;
}

function csvEscape(val) {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getCSVFilename(periodLabel, userName) {
  const safe = periodLabel.replace(/[\/～\s]/g, '_');
  return `経費精算_${userName}_${safe}.csv`;
}
