import { createHash } from 'node:crypto';
import { LedgerError, validateRecord, validateYear, dateRange, completeSummary } from './domain.mjs';

const publicRecord = ({ _id, incomeDate, pointsMinor, source, note, createdAt, updatedAt, version }) =>
  ({ id: _id, incomeDate, pointsMinor, source, note, createdAt, updatedAt, version });
const notFound = () => new LedgerError('NOT_FOUND', '记录不存在或已被删除，请刷新列表。');

export function createHandler({ repository, getIdentity, now = () => new Date(), log = console.error }) {
  return async function handle(event) {
    try {
      // Identity must come from the authenticated platform context, never from event data.
      const uid = await getIdentity();
      if (typeof uid !== 'string' || !uid) throw new LedgerError('UNAUTHENTICATED', '请先登录后再操作。');
      if (!event || typeof event !== 'object' || Array.isArray(event)) throw new LedgerError('VALIDATION', '请求格式错误。');
      const data = event.data || {};
      let result;
      switch (event.action) {
        case 'list': {
          const range = dateRange(data.year, data.month);
          const page = data.page ?? 1;
          const pageSize = data.pageSize ?? 10;
          if (!Number.isInteger(page) || page < 1 || page > 100000 || ![5, 10, 20, 50].includes(pageSize)) {
            throw new LedgerError('VALIDATION', '分页参数无效。');
          }
          const { records, total } = await repository.list(uid, range, page, pageSize);
          result = { records: records.map(publicRecord), total, page, pageSize };
          break;
        }
        case 'summary': {
          const year = validateYear(data.year);
          const buckets = await repository.aggregate(uid, dateRange(year));
          result = completeSummary(year, buckets);
          break;
        }
        case 'create': {
          const fields = validateRecord(data);
          if (typeof data.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(data.requestId)) {
            throw new LedgerError('VALIDATION', '提交标识无效，请重新打开录入窗口。');
          }
          const id = createHash('sha256').update(`${uid}:${data.requestId}`).digest('hex').slice(0, 32);
          const timestamp = now().toISOString();
          const record = { _id: id, ownerId: uid, ...fields, createdAt: timestamp, updatedAt: timestamp, version: 1 };
          const existing = await repository.get(uid, id);
          if (existing) {
            if (Object.keys(fields).some(key => fields[key] !== existing[key])) {
              throw new LedgerError('CONFLICT', '上一笔提交已保存，请关闭窗口并刷新后再新增。');
            }
            result = publicRecord(existing);
          } else {
            try { await repository.create(record); }
            catch (error) {
              // A concurrent retry may have won the insert. Do not add a second income.
              const winner = await repository.get(uid, id);
              if (!winner || Object.keys(fields).some(key => fields[key] !== winner[key])) throw error;
              result = publicRecord(winner);
            }
            result ||= publicRecord(record);
          }
          break;
        }
        case 'update':
        case 'delete': {
          if (typeof data.id !== 'string' || !/^[a-f0-9]{32}$/.test(data.id)) throw notFound();
          if (!Number.isInteger(data.version) || data.version < 1) throw new LedgerError('VALIDATION', '版本无效，请刷新。');
          if (!await repository.get(uid, data.id)) throw notFound();
          if (event.action === 'delete') {
            const deleted = await repository.remove(uid, data.id, data.version);
            if (!deleted) throw new LedgerError('CONFLICT', '记录已在其他页面更新，请刷新后再删除。');
            result = { id: data.id };
          } else {
            const fields = validateRecord(data);
            const update = { ...fields, updatedAt: now().toISOString(), version: data.version + 1 };
            const changed = await repository.update(uid, data.id, data.version, update);
            if (!changed) throw new LedgerError('CONFLICT', '记录已在其他页面更新，请刷新后再编辑。');
            const saved = await repository.get(uid, data.id);
            result = saved ? publicRecord(saved) : { id: data.id };
          }
          break;
        }
        default: throw new LedgerError('VALIDATION', '不支持的操作。');
      }
      return { ok: true, data: result };
    } catch (error) {
      if (error instanceof LedgerError) return { ok: false, error: { code: error.code, message: error.message } };
      log('ledger_request_failed', { code: error?.code || 'UNKNOWN' });
      return { ok: false, error: { code: 'UNAVAILABLE', message: '服务暂时不可用，请稍后重试。' } };
    }
  };
}
