/* =========================================================
   infra/repo.js — الگوی Repository
   ========================================================= */
window.App = window.App || {};

App.Repo = (function () {
  const DB = App.DB;

  function create(storeName) {
    return {
      name: storeName,
      get:     (key)     => DB.get(storeName, key),
      all:     ()        => DB.getAll(storeName),
      count:   ()        => DB.count(storeName),
      put:     (obj)     => DB.put(storeName, obj),
      putMany: (arr)     => DB.putMany(storeName, arr),
      del:     (key)     => DB.del(storeName, key),
      clear:   ()        => DB.clear(storeName),
      byIndex: (idx, v)  => DB.byIndex(storeName, idx, v)
    };
  }

  return { create };
})();