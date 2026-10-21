(() => {
  window.SurrenderReport = {};
  Pages.surrenderReport = function(params) {
    const container = document.getElementById('content') || document.body;
    container.innerHTML = `
      <div style="max-width:1100px;margin:0 auto">
        <div class="page-hdr">
          <h1>Surrender / Cancellation Report</h1>
          <div class="breadcrumb">Application / <b>Surrender Report</b></div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border2);border-radius:10px;overflow:hidden">
          <div style="background:var(--teal-bg);padding:14px 18px;border-bottom:1px solid var(--border);font-size:12px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:var(--text)">Surrender / Cancellation Report</div>
          <p style="color:var(--text3);font-size:13px;text-align:center;padding:36px 18px;margin:0">Report coming soon.</p>
        </div>
      </div>`;
  };
})();
