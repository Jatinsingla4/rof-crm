(() => {
  window.SurrenderReport = {};
  Pages.surrenderReport = function(params) {
    const container = document.getElementById('content') || document.body;
    container.innerHTML = `
      <div style="padding:20px">
        <div style="background:#1d3a6e;color:#fff;padding:8px 14px;border-radius:3px;font-weight:bold;margin-bottom:16px">
          SURRENDER/CANCELLATION REPORT
        </div>
        <p style="color:#888;font-size:13px">Report coming soon.</p>
      </div>`;
  };
})();
