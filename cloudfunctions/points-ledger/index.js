const cloudbase = require('@cloudbase/node-sdk');
const { createRepository } = require('./repository');
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const repository = createRepository(app.database());
const service = import('./service.mjs');

// Expose ONLY through authenticated CloudBase SDK calls. No unauthenticated HTTP trigger.
exports.main = async event => {
  const { createHandler } = await service;
  return createHandler({
    repository,
    getIdentity: async () => {
      const { uid, isAnonymous } = app.auth().getUserInfo();
      if (!uid || isAnonymous) return null;
      const result = await app.auth().getEndUserInfo(uid);
      if (result.code) throw new Error('Identity lookup failed');
      const { userInfo } = result;
      // This application only supports registered email accounts, never anonymous users.
      return userInfo?.uid === uid && userInfo.email ? uid : null;
    },
  })(event);
};
