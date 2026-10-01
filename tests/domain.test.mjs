import test from 'node:test';
import assert from 'node:assert/strict';
import { beijingDate, parsePoints, formatPoints, validateRecord, dateRange, completeSummary } from '../cloudfunctions/points-ledger/domain.mjs';

test('decimal income is stored and summed exactly', () => {
  assert.equal(formatPoints(parsePoints('0.10') + parsePoints('0.20')), '0.30');
  assert.equal(parsePoints('999999999.99'), 99999999999);
  for (const invalid of ['0', '-1', '1.001', 'NaN', '1e3', '.5', '1000000000', 10, 'Infinity']) {
    assert.throws(() => parsePoints(invalid));
  }
});
test('Beijing date changes at 16:00 UTC, including year rollover', () => {
  assert.equal(beijingDate(new Date('2025-12-31T15:59:59Z')), '2025-12-31');
  assert.equal(beijingDate(new Date('2025-12-31T16:00:00Z')), '2026-01-01');
});
test('strict calendar validation permits leap days and rejects future or invalid dates', () => {
  const input = { incomeDate: '2024-02-29', points: '12.35', source: ' 客户推荐 ', note: ' 备注 ' };
  assert.deepEqual(validateRecord(input, '2026-10-01'), { incomeDate: '2024-02-29', pointsMinor: 1235, source: '客户推荐', note: '备注' });
  for (const incomeDate of ['2025-02-29', '2026-04-31', '2026-13-01', '2026-10-02', '1899-12-31', '2026-1-01']) {
    assert.throws(() => validateRecord({ ...input, incomeDate }, '2026-10-01'));
  }
  assert.throws(() => validateRecord({ ...input, source: '  ' }));
  assert.throws(() => validateRecord({ ...input, note: '字'.repeat(501) }));
});
test('half-open date ranges separate months and years', () => {
  assert.deepEqual(dateRange(2024, 12), { start: '2024-12-01', end: '2025-01-01' });
  assert.deepEqual(dateRange(2024), { start: '2024-01-01', end: '2025-01-01' });
  assert.throws(() => dateRange(2024, 0));
  assert.throws(() => dateRange('2024'));
});
test('summary contains twelve months, zeros and precise annual total', () => {
  const result = completeSummary(2024, [{ month: '2024-02', pointsMinor: 30, count: 2 }]);
  assert.equal(result.months.length, 12);
  assert.equal(result.months[0].pointsMinor, 0);
  assert.equal(result.months[1].pointsMinor, 30);
  assert.equal(result.totalMinor, 30);
  assert.equal(result.count, 2);
  assert.throws(() => completeSummary(2024, [{ month: '2024-03', pointsMinor: 0.1, count: 1 }]));
});
