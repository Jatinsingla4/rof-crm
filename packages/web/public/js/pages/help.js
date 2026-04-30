// ROF CRM — Help & Documentation Page

Pages.help = async function(params = {}) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-hdr">
      <h1>Help & Support</h1>
      <div class="breadcrumb">Settings / <b>Help</b></div>
    </div>

    <div style="display:grid;grid-template-columns:260px 1fr;gap:16px">
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
              <div style="padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;align-items:center;gap:10px" onclick="HelpPage.showSection(${i})">
                <span style="font-size:18px">${item.icon}</span>
                <div>
                  <div style="font-size:12px;font-weight:600">${item.label}</div>
                  <div style="font-size:10.5px;color:var(--text3)">${item.desc}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="sp" style="margin-top:12px">
          <div class="sp-hdr"><div class="sp-title">Support</div></div>
          <div class="sp-body">
            <div style="font-size:11px;line-height:1.8">
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
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:20px">
              ${[
                { title:'Consumer Management', body:'Manage leads from enquiry through allotment. Use the Consumer tab to track status, payments, and documents.', icon:'👤' },
                { title:'Allotment Process', body:'After e-draw results, import CSV from TCP Haryana. System auto-matches by Aadhaar and updates statuses.', icon:'🏠' },
                { title:'Payment Tracking', body:'Record receipts, raise demands, and track overdue payments with HRERA-compliant penal interest calculation.', icon:'💳' },
                { title:'Document Generation', body:'Generate allotment letters, demand letters, receipts, and BBAs with one click. Auto-deliver via email/WhatsApp.', icon:'📄' },
                { title:'Communications', body:'Send WhatsApp, email, and SMS messages from within the CRM. All communications logged automatically.', icon:'💬' },
                { title:'Reports & Analytics', body:'View sales pipeline, collection efficiency, overdue ageing, and project fill rates in real time.', icon:'📊' },
              ].map(card => `
                <div style="padding:14px;background:var(--bg2);border-radius:8px">
                  <div style="font-size:24px;margin-bottom:8px">${card.icon}</div>
                  <div style="font-weight:600;font-size:12px;margin-bottom:6px">${card.title}</div>
                  <div style="font-size:11px;color:var(--text3);line-height:1.6">${card.body}</div>
                </div>
              `).join('')}
            </div>

            <div class="sp" style="margin-bottom:12px">
              <div class="sp-hdr"><div class="sp-title">AHP Payment Plan</div></div>
              <div class="sp-body">
                <table>
                  <thead><tr><th>Instalment</th><th>%</th><th>Timing</th></tr></thead>
                  <tbody>
                    ${[
                      ['Booking Amount', '5%', 'On application'],
                      ['On Allotment', '20%', 'Within 15 days of allotment'],
                      ['Instalment 1–6', '12.5% × 6', 'Half-yearly over 3 years'],
                      ['On Possession', '5%', 'On handover'],
                    ].map(([n,p,t]) => `<tr><td>${n}</td><td style="font-weight:700;color:var(--teal)">${p}</td><td style="font-size:10.5px;color:var(--text3)">${t}</td></tr>`).join('')}
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
  `;
};

const HelpPage = {
  showSection(i) {
    Utils.info('Detailed help section coming soon — contact support for immediate assistance');
  },
};
