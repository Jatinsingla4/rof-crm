(() => {
  window.SurrenderRestore = {};
  Pages.surrenderRestore = function(params) {
    Router.navigate('/surrender');
    setTimeout(() => {
      if (window.SurrenderApp && window.SurrenderApp.switchTab) {
        window.SurrenderApp.switchTab('restore');
      }
    }, 100);
  };
})();
