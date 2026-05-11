function getBillingPeriod(date) {
  const d = date ? new Date(date) : new Date();
  let startYear, startMonth, endYear, endMonth;

  if (d.getDate() >= 20) {
    startYear = d.getFullYear();
    startMonth = d.getMonth();
    endYear = d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
    endMonth = d.getMonth() === 11 ? 0 : d.getMonth() + 1;
  } else {
    endYear = d.getFullYear();
    endMonth = d.getMonth();
    startYear = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
    startMonth = d.getMonth() === 0 ? 11 : d.getMonth() - 1;
  }

  return {
    start: new Date(startYear, startMonth, 20),
    end: new Date(endYear, endMonth, 19, 23, 59, 59, 999),
    label: `${startYear}/${startMonth + 1}/20 ～ ${endYear}/${endMonth + 1}/19`
  };
}

function getAllBillingPeriods(receipts) {
  const periods = new Set();
  receipts.forEach(r => {
    const p = getBillingPeriod(new Date(r.date));
    periods.add(p.label);
  });
  const current = getBillingPeriod();
  periods.add(current.label);
  return [...periods].sort().reverse();
}

function filterReceiptsByPeriod(receipts, periodLabel) {
  return receipts.filter(r => {
    const p = getBillingPeriod(new Date(r.date));
    return p.label === periodLabel;
  });
}

function formatYen(amount) {
  return '¥' + Number(amount).toLocaleString('ja-JP');
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
}

function isSubmissionDay() {
  return new Date().getDate() === 21;
}

function todayString() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}
