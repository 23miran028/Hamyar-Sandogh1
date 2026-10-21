/* =========================================================
   state.js — وضعیت درون‌حافظه برنامه
   ========================================================= */
window.App = window.App || {};

App.State = (function () {
  const LS_THEME = 'gh_fund_theme';

  const state = {
    months: [], years: [], members: new Map(), loans: [],
    tab: 'dashboard',
    monthIdx: null, yearIdx: null,
    memberQuery: '',
    dbStatus: null, loading: false, lastError: null
  };

  function reset() {
    state.months = []; state.years = []; state.members = new Map();
    state.loans = []; state.monthIdx = null; state.yearIdx = null;
    state.memberQuery = ''; state.dbStatus = null; state.lastError = null;
  }

  const isEmpty = () => state.members.size === 0;
  const getTheme = () => localStorage.getItem(LS_THEME) || 'light';
  const setTheme = (t) => localStorage.setItem(LS_THEME, t);

  return { state, reset, isEmpty, getTheme, setTheme, LS_THEME };
})();