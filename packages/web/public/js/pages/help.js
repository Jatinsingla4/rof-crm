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
            ${HelpPage.SECTIONS.map((item, i) => `
              <div class="hln-link" data-section="${i}" onclick="HelpPage.show(${i})">
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
            </div>
          </div>
        </div>
      </div>

      <!-- Content area -->
      <div>
        <div class="sp" id="help-content"></div>
      </div>
    </div>
    </div>
  `;
  HelpPage.show(0);
};

const HelpPage = {
  // Plain statements about how this CRM works, kept short on purpose: numbers that belong to a project (plan percentages, interest rate) are set in the
  // system and are not repeated here, so this page cannot drift from them.
  SECTIONS: [
    { icon: '📋', label: 'User Guide', desc: 'Where to do what', title: 'ROF CRM User Guide', html: () => `
      <div class="hln-cards">
        ${[
          ['👤', 'Customers', 'Leads move from enquiry through application and e-draw to allotment. Open a customer to see payments, documents and messages.'],
          ['🏠', 'Booking and allotment', 'Booking takes the applicant, the unit and the payment plan; confirming the booking payment makes the allocation. Allotment issues the allotment letter.'],
          ['💳', 'Payments', 'Demands are raised per instalment, receipts are recorded and then authorised by a checker; cheques go through deposit and clearing.'],
          ['📄', 'Documents', 'Allotment letters, demand letters, receipts and agreements are made from templates. Sending them by email or WhatsApp is not connected yet: download or print them.'],
          ['💬', 'Communications', 'A message written in the CRM is recorded as queued. Nothing is sent until an email, WhatsApp or SMS sender is connected.'],
          ['📊', 'Reports and Analytics', 'Reports show sales, collection, ageing and inventory. Analytics shows the same numbers as charts; its dates apply to leads, money and units are as of today.'],
        ].map(([ico, t, b]) => `<div class="hln-card"><div class="hln-ico">${ico}</div><b>${t}</b><p>${b}</p></div>`).join('')}
      </div>
      <div class="hln-sub"><div class="hln-sub-h">The usual order of work</div><div><table><tbody>
        ${[
          ['1', 'Set Projects', 'Project, towers, units, payment plans, charges and GST are set up first.'],
          ['2', 'Booking', 'Start the booking, then confirm the booking payment.'],
          ['3', 'Allotment', 'Create the allotment or agreement; e-draw results come in on the E-Draw Import tab.'],
          ['4', 'Demands', 'Raise the instalment with a due date, then note that the letter was sent.'],
          ['5', 'Receipts', 'Record the receipt; a checker authorises it; cheques are deposited and cleared.'],
          ['6', 'Surrender or Transfer', 'When a customer leaves or sells the unit.'],
        ].map(([n, t, b]) => `<tr><td style="width:34px;font-weight:700;color:var(--teal)">${n}</td><td style="font-weight:600;white-space:nowrap">${t}</td><td style="font-size:12px;color:var(--text3)">${b}</td></tr>`).join('')}
      </tbody></table></div></div>` },
    { icon: '💰', label: 'Payment Plans', desc: 'Instalment schedule', title: 'Payment Plans', html: () => `
      <p>A payment plan is a list of instalments (a percentage and a timing for each). Plans are set <b>per project</b> in <b>Set Projects</b>.</p>
      <p>When a booking is confirmed the demands are made from the plan. A demand stays <b>pending</b> until somebody raises it with a due date; it becomes <b>paid</b> when receipts cover it.</p>
      <div class="alert alert-info">To see the percentages that apply to a customer, open the plan in Set Projects. They are not repeated on this page because they differ per project.</div>` },
    { icon: '📜', label: 'Penal Interest', desc: 'Late payment interest', title: 'Penal Interest', html: () => `
      <p>Interest on a late instalment is worked out from the penal rate. There is a company-wide rate in the settings, and a project can have its own rate in <b>Interest Master</b>; the project rate wins.</p>
      <p>The interest due is shown on the customer's ledger and on demand letters. A waiver of interest needs the maker and checker approval.</p>
      <div class="alert alert-info">The rate itself is not written here on purpose: ask your administrator which rate is set for your project.</div>` },
    { icon: '🏠', label: 'AHP Policy', desc: 'Affordable housing', title: 'Affordable Housing Policy', html: () => `
      <p>The affordable housing policy is issued by the Haryana government (Town and Country Planning department). The CRM follows the plan, charges and GST that were set up for each project; it does not apply a policy by itself.</p>
      <p>For the text of the policy and any change to it, use the TCP Haryana website below.</p>` },
    { icon: '🎯', label: 'E-Draw Process', desc: 'Allotment by draw', title: 'E-Draw Process', html: () => `
      <ol style="line-height:2">
        <li>Applications are filed and the draw is held on the TCP Haryana e-draw portal (outside this CRM).</li>
        <li>Download the result file from the portal.</li>
        <li>In the CRM open <b>Allotment of Unit</b> and the <b>E-Draw Import</b> tab, choose the project and upload the file.</li>
        <li>Check the result of the import, then continue with the allotment letters.</li>
      </ol>` },
    { icon: '🔒', label: 'Roles & Permissions', desc: 'Who can do what', title: 'Roles and Permissions', html: () => `
      <div class="hln-sub"><div><table>
        <thead><tr><th>Role</th><th>What it can do</th></tr></thead><tbody>
        ${[
          ['Super admin', 'Everything, including deleting and the settings.'],
          ['Project manager', 'Create and change customers, units, allotments, payments, documents, messages and set-up data; sees reports and users. Cannot delete.'],
          ['Sales executive', 'Create and change customers and holds; creates documents and messages; sees units, allotments, payments and reports.'],
          ['Accounts and finance', 'Records and changes payments, brokers and calling; creates reports; sees the rest.'],
          ['Support agent', 'Sees most screens and writes messages. No reports.'],
          ['Read-only viewer', 'Looks only. Cannot change anything.'],
        ].map(([r, t]) => `<tr><td style="font-weight:600;white-space:nowrap">${r}</td><td style="font-size:12px;color:var(--text3)">${t}</td></tr>`).join('')}
      </tbody></table></div></div>
      <p style="font-size:12px;color:var(--text3)">The administrator can also make custom roles, and limit a login to some projects. A button that does nothing for you, or a "forbidden" message, usually means your role does not allow it.</p>` },
  ],

  show(i) {
    const sec = this.SECTIONS[i];
    const box = document.getElementById('help-content');
    if (!sec || !box) return;
    document.querySelectorAll('.hln-link').forEach(l => l.style.background = l.dataset.section === String(i) ? 'var(--surface2)' : '');
    box.innerHTML = `<div class="sp-hdr"><div class="sp-title">${sec.title}</div></div>
      <div class="sp-body">${sec.html()}
        <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost" onclick="HelpPage.open('https://haryanarera.gov.in')">Haryana RERA</button>
          <button class="btn btn-ghost" onclick="HelpPage.open('https://tcpharyana.gov.in')">TCP Haryana</button>
          <button class="btn btn-ghost" onclick="HelpPage.open('https://edraw.tcpharyana.gov.in')">E-Draw Portal</button>
        </div>
      </div>`;
  },

  open(url) { window.open(url, '_blank', 'noopener,noreferrer'); },
};
