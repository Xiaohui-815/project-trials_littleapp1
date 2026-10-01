import type { Account, Income, LedgerClient } from '../types';
import { beijingDate, completeSummary, validateRecord } from '../../cloudfunctions/points-ledger/domain.mjs';

// Local visual QA only. No browser persistence, fake password form, or production fallback.
export function createPreviewClient(): LedgerClient {
  const today = beijingDate();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  let account: Account | null = { id: 'preview', email: 'preview@example.com' };
  let listener: (account: Account | null) => void = () => {};
  let records: Income[] = Array.from({ length: month * 4 }, (_, index) => {
    const m = Math.floor(index / 4) + 1;
    const day = m === month ? 1 : [5, 12, 19, 26][index % 4];
    return { id: String(index).padStart(32, '0'), incomeDate: `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      pointsMinor: [125050, 84000, 62050, 186000][index % 4] + m * 1500,
      source: ['日常经营', '客户推荐', '活动奖励', '合作业务'][index % 4],
      note: ['本期经营结算', '客户转介绍积分', '', '项目结算'][index % 4],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1 };
  });
  return {
    configured: true, preview: true,
    getAccount: async () => account,
    onAccountChange(callback) { listener = callback; return () => { listener = () => {}; }; },
    async signIn() { account = { id: 'preview', email: 'preview@example.com' }; listener(account); },
    async signOut() { account = null; listener(null); },
    async list(filters) {
      const prefix = filters.month ? `${filters.year}-${String(filters.month).padStart(2, '0')}` : String(filters.year);
      const selected = records.filter(r => r.incomeDate.startsWith(prefix)).sort((a, b) => b.incomeDate.localeCompare(a.incomeDate) || b.id.localeCompare(a.id));
      return { records: selected.slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize), total: selected.length, page: filters.page, pageSize: filters.pageSize };
    },
    async summary(selectedYear) {
      const buckets = new Map<string, { month: string; pointsMinor: number; count: number }>();
      records.filter(r => r.incomeDate.startsWith(`${selectedYear}-`)).forEach(r => {
        const key = r.incomeDate.slice(0, 7);
        const bucket = buckets.get(key) || { month: key, pointsMinor: 0, count: 0 };
        bucket.pointsMinor += r.pointsMinor; bucket.count++;
        buckets.set(key, bucket);
      });
      return completeSummary(selectedYear, [...buckets.values()]);
    },
    async save(input) {
      const fields = validateRecord(input);
      if (input.id) records = records.map(r => r.id === input.id ? { ...r, ...fields, version: r.version + 1 } : r);
      else records.unshift({ id: crypto.randomUUID().replaceAll('-', ''), ...fields, version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    },
    async remove(record) { records = records.filter(r => r.id !== record.id); },
  };
}
