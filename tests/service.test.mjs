import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createHandler } from '../cloudfunctions/points-ledger/service.mjs';

function fixture() {
  const rows = new Map();
  const belongs = (r, uid, range) => r.ownerId === uid && r.incomeDate >= range.start && r.incomeDate < range.end;
  const repository = {
    async get(uid, id) { const row = rows.get(id); return row?.ownerId === uid ? { ...row } : null; },
    async create(row) { if (rows.has(row._id)) throw new Error('duplicate'); rows.set(row._id, { ...row }); },
    async list(uid, range, page, size) {
      const selected = [...rows.values()].filter(r => belongs(r, uid, range)).sort((a, b) => b.incomeDate.localeCompare(a.incomeDate));
      return { records: selected.slice((page - 1) * size, page * size), total: selected.length };
    },
    async aggregate(uid, range) {
      const buckets = new Map();
      for (const r of rows.values()) if (belongs(r, uid, range)) {
        const key = r.incomeDate.slice(0, 7);
        const group = buckets.get(key) || { month: key, pointsMinor: 0, count: 0 };
        group.pointsMinor += r.pointsMinor; group.count++; buckets.set(key, group);
      }
      return [...buckets.values()];
    },
    async update(uid, id, version, fields) {
      const row = rows.get(id);
      if (row?.ownerId !== uid || row.version !== version) return false;
      rows.set(id, { ...row, ...fields }); return true;
    },
    async remove(uid, id, version) {
      const row = rows.get(id);
      return row?.ownerId === uid && row.version === version ? rows.delete(id) : false;
    },
  };
  const as = uid => createHandler({ repository, getIdentity: async () => uid, log: () => {} });
  const income = (extra = {}) => ({ incomeDate: '2024-02-29', points: '0.10', source: '经营收入', note: '', requestId: randomUUID(), ...extra });
  return { rows, repository, as, income };
}

test('all actions reject anonymous callers even when identity is forged in request', async () => {
  const { as, income } = fixture();
  for (const action of ['create', 'list', 'summary', 'update', 'delete']) {
    const response = await as(null)({ action, uid: 'victim', data: { ...income(), ownerId: 'victim' } });
    assert.equal(response.error.code, 'UNAUTHENTICATED');
  }
});
test('two accounts cannot list, summarize, edit, delete or forge ownership of each other', async () => {
  const { as, income, rows } = fixture();
  const a = as('alice'), b = as('bob');
  const created = await a({ action: 'create', data: income({ ownerId: 'bob' }) });
  assert.equal(created.ok, true);
  assert.equal(rows.get(created.data.id).ownerId, 'alice');
  assert.equal('ownerId' in created.data, false);
  assert.equal((await b({ action: 'list', data: { year: 2024 } })).data.total, 0);
  assert.equal((await b({ action: 'summary', data: { year: 2024 } })).data.totalMinor, 0);
  for (const action of ['update', 'delete']) {
    const result = await b({ action, data: { ...income(), id: created.data.id, version: 1, ownerId: 'alice' } });
    assert.equal(result.error.code, 'NOT_FOUND');
  }
  assert.equal(rows.size, 1);
});
test('retrying a create, including concurrent attempts, does not double count income', async () => {
  const { as, income, rows } = fixture();
  const a = as('alice'); const data = income();
  const [first, retry] = await Promise.all([a({ action: 'create', data }), a({ action: 'create', data })]);
  assert.equal(first.ok, true); assert.equal(retry.ok, true);
  assert.equal(first.data.id, retry.data.id); assert.equal(rows.size, 1);
  assert.equal((await a({ action: 'create', data: { ...data, points: '9' } })).error.code, 'CONFLICT');
});
test('aggregation spans every record rather than the displayed page', async () => {
  const { as, income } = fixture(); const a = as('alice');
  for (let i = 0; i < 57; i++) await a({ action: 'create', data: income() });
  const list = await a({ action: 'list', data: { year: 2024, page: 2, pageSize: 10 } });
  const summary = await a({ action: 'summary', data: { year: 2024 } });
  assert.equal(list.data.records.length, 10); assert.equal(list.data.total, 57);
  assert.equal(summary.data.totalMinor, 570); assert.equal(summary.data.count, 57);
});
test('moving income across year boundaries and deleting updates each period', async () => {
  const { as, income } = fixture(); const a = as('alice');
  const record = (await a({ action: 'create', data: income() })).data;
  const updated = await a({ action: 'update', data: { ...income({ incomeDate: '2025-01-01', points: '0.20' }), id: record.id, version: 1 } });
  assert.equal(updated.data.version, 2);
  assert.equal((await a({ action: 'summary', data: { year: 2024 } })).data.totalMinor, 0);
  assert.equal((await a({ action: 'summary', data: { year: 2025 } })).data.totalMinor, 20);
  assert.equal((await a({ action: 'delete', data: { id: record.id, version: 1 } })).error.code, 'CONFLICT');
  assert.equal((await a({ action: 'delete', data: { id: record.id, version: 2 } })).ok, true);
  assert.equal((await a({ action: 'summary', data: { year: 2025 } })).data.totalMinor, 0);
});
test('stale edits never overwrite a newer record', async () => {
  const { as, income } = fixture(); const a = as('alice');
  const row = (await a({ action: 'create', data: income() })).data;
  const edit = points => a({ action: 'update', data: { ...income({ points }), id: row.id, version: 1 } });
  assert.equal((await edit('12')).ok, true);
  assert.equal((await edit('13')).error.code, 'CONFLICT');
  assert.equal((await a({ action: 'summary', data: { year: 2024 } })).data.totalMinor, 1200);
});
test('invalid inputs are rejected and unexpected errors do not expose internals', async () => {
  const { as, income, repository } = fixture(); const a = as('alice');
  assert.equal((await a({ action: 'create', data: income({ points: '0.001' }) })).error.code, 'VALIDATION');
  assert.equal((await a({ action: 'list', data: { year: 2024, page: -1 } })).error.code, 'VALIDATION');
  repository.list = async () => { throw new Error('database secret'); };
  const response = await a({ action: 'list', data: { year: 2024 } });
  assert.equal(response.error.code, 'UNAVAILABLE');
  assert.equal(JSON.stringify(response).includes('secret'), false);
});
