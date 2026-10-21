// ROF CRM — Help & Documentation Page

Pages.help = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <style>
      #content:has(.hln) { margin-left:auto; margin-right:auto; width:100% }
      .hln { max-width:1300px; margin:0 auto }
      .hln-cols { display:grid; grid-template-columns:280px 1fr; gap:16px; align-items:start }
      .hln .sp { background:var(--surface); border:1px solid var(--border2); border-radius:10px; overflow:hidden }
      .hln .sp-hdr { padding:14px 18px; background:var(--teal-bg); border-bottom:1px solid var(--border) }
      .hln .sp-title { font-size:12px; font-weight:600; color:var(--text); text-transform:uppercase; letter-spacing:.6px }
      .hln .sp-body { padding:18px }
      .hln-link { padding:12px 18px; border-bottom:1px solid var(--border); cursor:pointer; display:flex; align-items:center; gap:12px; transition:background .15s }
      .hln-link:last-child { border-bottom:none }
      .hln-link:hover { background:var(--surface2) }
      .hln-ico { width:36px; height:36px; border-radius:10px; background:var(--teal-bg); display:flex; align-items:center; justify-content:center; font-size:17px; flex-shrink:0 }
      .hln-link b { display:block; font-size:12.5px; font-weight:600; color:var(--text) }
      .hln-link span { font-size:11px; color:var(--text3) }
      .hln-support { font-size:12.5px; line-height:2; color:var(--text2) }
      .hln-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:14px; margin-bottom:20px }
      .hln-card { padding:16px; background:var(--surface2); border:1px solid var(--border2); border-radius:12px }
      .hln-card .hln-ico { margin-bottom:12px; width:40px; height:40px; font-size:20px }
      .hln-card b { display:block; font-size:13px; font-weight:600; margin-bottom:6px; color:var(--text) }
      .hln-card p { font-size:12px; color:var(--text3); line-height:1.6; margin:0 }
      .hln-sub { border:1px solid var(--border2); border-radius:10px; overflow:hidden; margin-bottom:16px }
      .hln-sub-h { padding:12px 18px; background:var(--surface2); border-bottom:1px solid var(--border2); font-size:11.5px; font-weight:600; letter-spacing:.5px; text-transform:uppercase; color:var(--text) }
      .hln table { width:100%; border-collapse:collapse; font-size:12.5px }
      .hln table th { background:var(--surface2); color:var(--text3); font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.4px; padding:10px 18px; text-align:left; border-bottom:1px solid var(--border2) }
      .hln table td { padding:10px 18px; border-bottom:1px solid var(--border); color:var(--text) }
      .hln table tbody tr:last-child td { border-bottom:none }
      .hln .alert { border-radius:8px; padding:12px 16px; font-size:12.5px; line-height:1.6 }
      .hln .btn-ghost { border-radius:8px; min-height:38px; padding:9px 18px; font-size:12.5px }
      @media (max-width:900px) { .hln-cols { grid-template-columns:minmax(0,1fr) } }
    </style>
    <div class="hln">
    <div class="page-hdr">
      <h1>Help & Support</h1>
      <div class="breadcrumb">Settings / <b>Help</b></div>
    </div>

    <div class="hln-cols">
      <!-- Quick links sidebar -->
      <div>
        <div class="sp">
          <div class="sp-hdr"><div class="sp-title">Quick Links</div></div>
          <div class="sp-body" style="padding:0">
            ${[
              { icon:'📋', label:'User Guide', desc:'Complete CRM usage guide' },
              { icon:'💰', label:'Payment Plans', desc:'AHP instalment schedule' },
              { icon:'📜', label:'HRERA Rules', desc:'Penal interest & regulations' },
              { icon:'🏠', label:'AHP Policy', desc:'Haryana Affordable Housing Policy' },
              { icon:'🎯', label:'E-Draw Process', desc:'TCP Haryana lottery guide' },
              { icon:'🔒', label:'Roles & Permissions', desc:'Access control reference' },
            ].map((item, i) => `
              <div class="hln-link" onclick="HelpPage.showSection(${i})">
                <span class="hln-ico">${item.icon}</span>
                <div>
                  <b>${item.label}</b>
                  <span>${item.desc}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="sp" style="margin-top:12px">
          <div class="sp-hdr"><div class="sp-title">Support</div></div>
          <div class="sp-body">
            <div class="hln-support">
              <div>📧 <a href="mailto:support@grapesworldwide.com" style="color:var(--teal)">support@grapesworldwide.com</a></div>
              <div>📞 +91 124-XXXXXXX</div>
              <div>🕐 Mon–Sat, 9 AM–7 PM IST</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Content area -->
      <div>
        <div class="sp" id="help-content">
          <div class="sp-hdr"><div class="sp-title">ROF CRM User Guide</div></div>
          <div class="sp-body">
            <div class="hln-cards">
              ${[
                { title:'Consumer Management', body:'Manage leads from enquiry through allotment. Use the Consumer tab to track status, payments, and documents.', icon:'👤' },
                { title:'Allotment Process', body:'After e-draw results, import CSV from TCP Haryana. System auto-matches by Aadhaar and updates statuses.', icon:'🏠' },
                { title:'Payment Tracking', body:'Record receipts, raise demands, and track overdue payments with HRERA-compliant penal interest calculation.', icon:'💳' },
                { title:'Document Generation', body:'Generate allotment letters, demand letters, receipts, and BBAs with one click. Auto-deliver via email/WhatsApp.', icon:'📄' },
                { title:'Communications', body:'Send WhatsApp, email, and SMS messages from within the CRM. All communications logged automatically.', icon:'💬' },
                { title:'Reports & Analytics', body:'View sales pipeline, collection efficiency, overdue ageing, and project fill rates in real time.', icon:'📊' },
              ].map(card => `
                <div class="hln-card">
                  <div class="hln-ico">${card.icon}</div>
                  <b>${card.title}</b>
                  <p>${card.body}</p>
                </div>
              `).join('')}
            </div>

            <div class="hln-sub">
              <div class="hln-sub-h">AHP Payment Plan</div>
              <div>
                <table>
                  <thead><tr><th>Instalment</th><th>%</th><th>Timing</th></tr></thead>
                  <tbody>
                    ${[
                      ['Booking Amount', '5%', 'On application'],
                      ['On Allotment', '20%', 'Within 15 days of allotment'],
                      ['Instalment 1–6', '12.5% × 6', 'Half-yearly over 3 years'],
                      ['On Possession', '5%', 'On handover'],
                    ].map(([n,p,t]) => `<tr><td>${n}</td><td style="font-weight:700;color:var(--teal)">${p}</td><td style="font-size:12px;color:var(--text3)">${t}</td></tr>`).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="alert alert-info">
              <strong>HRERA Penal Interest:</strong> 11.10% per annum on overdue instalments, calculated per HRERA Rule 15. The system automatically computes and flags overdue amounts.
            </div>

            <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-ghost" onclick="window.open('/api/documents/templates/user-guide','_blank')">Download User Guide PDF</button>
              <button class="btn btn-ghost" onclick="window.open('https://hrera.org.in','_blank')">HRERA Website</button>
              <button class="btn btn-ghost" onclick="window.open('https://tcpharyana.gov.in','_blank')">TCP Haryana</button>
              <button class="btn btn-ghost" onclick="window.open('https://edraw.tcpharyana.gov.in','_blank')">E-Draw Portal</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  `;
};

const HelpPage = {
  showSection(i) {
    Utils.info('Detailed help section coming soon — contact support for immediate assistance');
  },
};
