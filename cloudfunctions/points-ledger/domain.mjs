export class LedgerError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export function beijingDate(now = new Date()) {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function parsePoints(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(value.trim())) {
    throw new LedgerError('VALIDATION', '积分请输入正数，最多 9 位整数和 2 位小数。');
  }
  const [whole, fraction = ''] = value.trim().split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (minor <= 0) throw new LedgerError('VALIDATION', '积分必须大于 0。');
  return minor;
}

export function formatPoints(minor) {
  if (!Number.isSafeInteger(minor) || minor < 0) throw new LedgerError('DATA', '积分数据异常。');
  const whole = Math.floor(minor / 100).toLocaleString('zh-CN');
  return `${whole}.${String(minor % 100).padStart(2, '0')}`;
}

export function inputPoints(minor) {
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
}

export function validateRecord(input, today = beijingDate()) {
  if (!input || typeof input !== 'object') throw new LedgerError('VALIDATION', '请填写收入记录。');
  const { incomeDate, points, source, note = '' } = input;
  const date = typeof incomeDate === 'string' ? new Date(`${incomeDate}T00:00:00Z`) : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(incomeDate || '') || !date || Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== incomeDate || incomeDate < '1900-01-01' || incomeDate > today) {
    throw new LedgerError('VALIDATION', '请选择有效的收入日期，不可晚于今天。');
  }
  if (typeof source !== 'string' || !source.trim() || source.trim().length > 60) {
    throw new LedgerError('VALIDATION', '请填写收入来源，最多 60 个字符。');
  }
  if (typeof note !== 'string' || note.trim().length > 500) {
    throw new LedgerError('VALIDATION', '备注最多 500 个字符。');
  }
  return { incomeDate, pointsMinor: parsePoints(points), source: source.trim(), note: note.trim() };
}

export function validateYear(year, today = beijingDate()) {
  if (!Number.isInteger(year) || year < 1900 || year > Number(today.slice(0, 4))) {
    throw new LedgerError('VALIDATION', '请选择有效年份。');
  }
  return year;
}

export function dateRange(year, month) {
  validateYear(year);
  if (month != null && (!Number.isInteger(month) || month < 1 || month > 12)) {
    throw new LedgerError('VALIDATION', '请选择有效月份。');
  }
  return month == null
    ? { start: `${year}-01-01`, end: `${year + 1}-01-01` }
    : { start: `${year}-${String(month).padStart(2, '0')}-01`,
      end: month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01` };
}

export function completeSummary(year, buckets) {
  const months = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, pointsMinor: 0, count: 0 }));
  for (const bucket of buckets) {
    const match = new RegExp(`^${year}-(0[1-9]|1[0-2])$`).exec(bucket.month);
    if (!match || !Number.isSafeInteger(bucket.pointsMinor) || bucket.pointsMinor < 0 ||
        !Number.isSafeInteger(bucket.count) || bucket.count < 0) {
      throw new LedgerError('DATA', '统计数据异常，请稍后重试。');
    }
    months[Number(match[1]) - 1] = { month: Number(match[1]), pointsMinor: bucket.pointsMinor, count: bucket.count };
  }
  const totalMinor = months.reduce((sum, m) => sum + m.pointsMinor, 0);
  const count = months.reduce((sum, m) => sum + m.count, 0);
  if (!Number.isSafeInteger(totalMinor)) throw new LedgerError('DATA', '累计积分超出精确统计范围。');
  return { year, totalMinor, count, months };
}
