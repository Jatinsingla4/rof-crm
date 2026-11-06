// The Surrender/Cancellation Report is the "report" tab of the Surrender screen; this old address goes there.
(() => {
  window.SurrenderReport = {};
  Pages.surrenderReport = function () {
    Router.navigate('/surrender');
    setTimeout(() => { if (window.SurrenderApp) SurrenderApp.switchTab('report'); }, 100);
  };
})();
