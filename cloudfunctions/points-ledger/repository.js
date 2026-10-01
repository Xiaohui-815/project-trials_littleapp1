const COLLECTION = 'point_records';

exports.createRepository = function createRepository(db) {
  const records = db.collection(COLLECTION);
  const $ = db.command.aggregate;
  const match = (uid, range) => ({ ownerId: uid, incomeDate: db.command.gte(range.start).and(db.command.lt(range.end)) });
  return {
    async get(uid, id) {
      const res = await records.where({ _id: id, ownerId: uid }).limit(1).get();
      return res.data[0] || null;
    },
    async create(record) { await records.add(record); },
    async list(uid, range, page, pageSize) {
      const where = match(uid, range);
      const [result, count] = await Promise.all([
        records.where(where).orderBy('incomeDate', 'desc').orderBy('_id', 'desc').skip((page - 1) * pageSize).limit(pageSize).get(),
        records.where(where).count(),
      ]);
      return { records: result.data, total: count.total };
    },
    async aggregate(uid, range) {
      const result = await records.aggregate().match(match(uid, range))
        .group({ _id: $.substr(['$incomeDate', 0, 7]), pointsMinor: $.sum('$pointsMinor'), count: $.sum(1) })
        .limit(12).end();
      return result.data.map(row => ({ month: row._id, pointsMinor: row.pointsMinor, count: row.count }));
    },
    async update(uid, id, version, fields) {
      const res = await records.where({ _id: id, ownerId: uid, version }).update(fields);
      return res.updated === 1;
    },
    async remove(uid, id, version) {
      const res = await records.where({ _id: id, ownerId: uid, version }).remove();
      return res.deleted === 1;
    },
  };
};
