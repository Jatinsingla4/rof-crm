"use strict";
/**
 * Document Recalculation Engine — Phase 2
 * Applies field overrides to stored document HTML using data-field-key attributes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyOverridesToHtml = applyOverridesToHtml;
exports.extractFieldValue = extractFieldValue;
exports.recalcDemandLetter = recalcDemandLetter;
exports.recalcReceipt = recalcReceipt;
exports.recalcAllotmentLetter = recalcAllotmentLetter;
exports.recalcApplicantFile = recalcApplicantFile;
exports.buildEditScript = buildEditScript;
exports.applyRecalc = applyRecalc;
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Applies a map of { fieldKey → newValue } to HTML by targeting elements
 * that carry  data-field-key="fieldKey"  attributes.
 * Replaces the text content between the opening tag and the next closing tag.
 */
function applyOverridesToHtml(html, overrides) {
    let result = html;
    for (const [key, value] of Object.entries(overrides)) {
        const safeKey = escapeRegex(key);
        // Matches: <tag ... data-field-key="KEY" ...>CONTENT</closetag>
        const regex = new RegExp(`(data-field-key="${safeKey}"[^>]*>)[^<]*(</[a-zA-Z][a-zA-Z0-9]*>)`, 'g');
        result = result.replace(regex, (_m, open, close) => open + value + close);
    }
    return result;
}
/**
 * Extracts the current rendered value of a field from the stored HTML.
 * Returns null if the field is not tagged with data-field-key.
 */
function extractFieldValue(html, fieldKey) {
    const safeKey = escapeRegex(fieldKey);
    const match = html.match(new RegExp(`data-field-key="${safeKey}"[^>]*>([^<]*)<`));
    return match ? match[1].trim() : null;
}
// ── Per-document-type recalc functions ────────────────────────────────────────
// Phase 2: text/date/number override application.
// Phase 3 will add cascade recalculation (totals, GST, interest).
function recalcDemandLetter(html, overrides) {
    return applyOverridesToHtml(html, overrides);
}
function recalcReceipt(html, overrides) {
    return applyOverridesToHtml(html, overrides);
}
function recalcAllotmentLetter(html, overrides) {
    return applyOverridesToHtml(html, overrides);
}
function recalcApplicantFile(html, overrides) {
    return applyOverridesToHtml(html, overrides);
}
/**
 * Builds the inline-edit JavaScript + CSS snippet injected into every document HTML page.
 * Call with the concrete docId, auth token, and document type so no placeholder replacement
 * is needed by the caller.
 */
function buildEditScript(docId, token, docType) {
    return `<script>
(function() {
  var DOC_ID   = '${docId.replace(/'/g, "\\'")}';
  var TOKEN    = localStorage.getItem('rof-jwt') || '';   // never written into the page; a link token cannot call the edit route
  var DOC_TYPE = '${docType.replace(/'/g, "\\'")}';

  var isEditMode    = false;
  var originalValues = {};
  var changedFields  = {};

  document.addEventListener('DOMContentLoaded', init);
  // Also run immediately in case DOM is already ready (receipt/applicant-file pages)
  if (document.readyState === 'interactive' || document.readyState === 'complete') { init(); }

  function init() {
    addEditButton();
  }

  function addEditButton() {
    var actionBar = document.querySelector('.action-bar, .no-print');
    if (!actionBar) return;

    var editBtn = document.createElement('button');
    editBtn.id = 'doc-edit-btn';
    editBtn.innerHTML = '&#9999;&#65039; Edit Document';
    editBtn.style.cssText = 'background:#fff;color:#e67e22;border:2px solid #e67e22;padding:7px 14px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600;transition:all 0.2s;font-family:Arial;';
    editBtn.onmouseover = function() { editBtn.style.background = '#e67e22'; editBtn.style.color = '#fff'; };
    editBtn.onmouseout  = function() { editBtn.style.background = '#fff';    editBtn.style.color = '#e67e22'; };
    editBtn.onclick = enterEditMode;
    // Use the first button's direct parent as the button row container.
    // Some action bars wrap buttons in a nested flex div (e.g. demand letter),
    // so insertBefore/appendChild must target the immediate parent of the buttons.
    var firstBtn = actionBar.querySelector('button');
    var btnRow = firstBtn ? firstBtn.parentElement : actionBar;
    btnRow.insertBefore(editBtn, firstBtn);

    var saveBtn = document.createElement('button');
    saveBtn.id = 'doc-save-btn';
    saveBtn.innerHTML = '&#128190; Save Changes';
    saveBtn.style.cssText = 'background:#28a745;color:#fff;border:2px solid #28a745;padding:7px 14px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600;display:none;font-family:Arial;';
    saveBtn.onclick = saveChanges;

    var cancelBtn = document.createElement('button');
    cancelBtn.id = 'doc-cancel-btn';
    cancelBtn.innerHTML = '&#10005; Cancel Edit';
    cancelBtn.style.cssText = 'background:#fff;color:#dc3545;border:2px solid #dc3545;padding:7px 14px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600;display:none;font-family:Arial;';
    cancelBtn.onclick = cancelEdit;

    var reasonContainer = document.createElement('div');
    reasonContainer.id = 'doc-reason-container';
    reasonContainer.style.cssText = 'display:none;align-items:center;gap:8px;flex:1;';
    reasonContainer.innerHTML = '<label style="color:#fff;font-size:12px;white-space:nowrap;font-weight:600;font-family:Arial;">Reason for Edit:</label>' +
      '<input type="text" id="doc-edit-reason" placeholder="e.g. Customer requested correction" style="flex:1;padding:6px 10px;border:2px solid #fff;border-radius:4px;font-size:12px;min-width:220px;background:rgba(255,255,255,0.95);color:#333;font-family:Arial;">';

    btnRow.appendChild(reasonContainer);
    btnRow.appendChild(saveBtn);
    btnRow.appendChild(cancelBtn);
  }

  function enterEditMode() {
    isEditMode = true;
    document.getElementById('doc-edit-btn').style.display = 'none';
    document.getElementById('doc-save-btn').style.display = 'inline-flex';
    document.getElementById('doc-cancel-btn').style.display = 'inline-flex';
    document.getElementById('doc-reason-container').style.display = 'flex';
    document.body.style.outline = '3px solid #e67e22';
    document.body.style.outlineOffset = '-3px';
    showEditBanner();

    var fields = document.querySelectorAll('[data-field-key]');
    fields.forEach(function(field) {
      var key       = field.getAttribute('data-field-key');
      var valueType = field.getAttribute('data-value-type') || 'text';
      var currentValue = field.textContent.trim();
      originalValues[key] = currentValue;

      var input;
      if (valueType === 'date') {
        input = document.createElement('input');
        input.type = 'date';
        var parts = currentValue.split('/');
        if (parts.length === 3) {
          input.value = parts[2] + '-' + parts[1] + '-' + parts[0];
        } else {
          input.value = currentValue;
        }
      } else if (valueType === 'number' || valueType === 'currency') {
        input = document.createElement('input');
        input.type = 'number';
        input.step = '0.01';
        input.value = currentValue.replace(/[\\u20B9,]/g, '').trim();
      } else if (valueType === 'percentage') {
        input = document.createElement('input');
        input.type = 'number';
        input.step = '0.01';
        input.max = '100';
        input.value = currentValue.replace('%', '').trim();
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.value = currentValue;
      }

      input.style.cssText = 'border:2px solid #e67e22;border-radius:3px;padding:2px 6px;font-size:inherit;font-family:inherit;color:#1a3c5e;background:#fff9f0;min-width:80px;width:auto;';

      input.addEventListener('input', function(e) {
        var span = e.target.closest('[data-field-key]');
        if (!span) return;
        var k       = span.getAttribute('data-field-key');
        var label   = span.getAttribute('data-field-label') || k;
        var section = span.getAttribute('data-section') || 'general';
        var vt      = span.getAttribute('data-value-type') || 'text';
        var rawVal  = e.target.value;
        changedFields[k] = {
          field_key:   k,
          field_label: label,
          section:     section,
          new_value:   rawVal,
          value_type:  vt
        };
        e.target.style.background  = '#fff3cd';
        e.target.style.borderColor = '#28a745';
        // Receipt cascade: recalculate GST + totals when an amount cell changes
        if (DOC_TYPE === 'payment_receipt' && k.indexOf('amountNet_') === 0) {
          rcCascadeRow(k.replace('amountNet_', ''), parseFloat(rawVal.replace(/[^0-9.]/g, '')) || 0);
        }
        // Demand letter cascade
        if (DOC_TYPE === 'demand_letter') {
          if (k.indexOf('basicAmt_') === 0) {
            dlCascadeAmt(k.replace('basicAmt_', ''), parseFloat(rawVal.replace(/[^0-9.]/g, '')) || 0);
          } else if (k.indexOf('basicInterest_') === 0) {
            dlCascadeInterest(k.replace('basicInterest_', ''), parseFloat(rawVal.replace(/[^0-9.]/g, '')) || 0);
          } else if (k.indexOf('dueDate_') === 0) {
            dlCascadeDueDate(k.replace('dueDate_', ''), rawVal);
          }
        }
        // Allotment letter cascade
        if (DOC_TYPE === 'allotment_letter') {
          if (k === 'totalConsideration') {
            alCascadeTotalConsideration(parseFloat(rawVal.replace(/[^0-9.]/g, '')) || 0);
          } else if (k === 'carpetArea') {
            alCascadeCarpetArea(parseFloat(rawVal.replace(/[^0-9.]/g, '')) || 0);
          } else if (k.indexOf('schedulePercentage_') === 0) {
            alCascadeSchedulePct(k.replace('schedulePercentage_', ''), parseFloat(rawVal.replace(/[^0-9.]/g, '')) || 0);
          }
        }
        // Applicant file cascade
        if (DOC_TYPE === 'applicant_file') {
          if (k === 'carpetArea' || k === 'ratePerSqft') {
            afCascadePricing();
          } else if (k === 'plcCharge' || k === 'otherCharges') {
            afCascadeFromAgreement();
          } else if (k.indexOf('schedAmount_') === 0) {
            afCascadeSchedAmount(k.replace('schedAmount_', ''), parseFloat(rawVal.replace(/[^0-9.]/g, '')) || 0);
          }
        }
      });

      field.setAttribute('data-original-html', field.innerHTML);
      field.innerHTML = '';
      field.appendChild(input);
    });
  }

  function showEditBanner() {
    var banner = document.createElement('div');
    banner.id = 'edit-mode-banner';
    banner.style.cssText = 'position:fixed;top:52px;left:0;right:0;background:linear-gradient(135deg,#e67e22,#d35400);color:#fff;text-align:center;padding:6px;font-size:12px;font-weight:600;z-index:999;letter-spacing:0.5px;font-family:Arial;';
    banner.textContent = '&#9999;&#65039; EDIT MODE — Modify fields below. Fill reason and click Save when done.';
    document.body.insertBefore(banner, document.body.firstChild);
  }

  function cancelEdit() {
    isEditMode = false;
    changedFields  = {};
    originalValues = {};
    var fields = document.querySelectorAll('[data-field-key]');
    fields.forEach(function(field) {
      var orig = field.getAttribute('data-original-html');
      if (orig !== null) {
        field.innerHTML = orig;
        field.removeAttribute('data-original-html');
      }
    });
    document.getElementById('doc-edit-btn').style.display = 'inline-flex';
    document.getElementById('doc-save-btn').style.display = 'none';
    document.getElementById('doc-cancel-btn').style.display = 'none';
    document.getElementById('doc-reason-container').style.display = 'none';
    document.body.style.outline = 'none';
    var banner = document.getElementById('edit-mode-banner');
    if (banner) banner.remove();
    var reasonInput = document.getElementById('doc-edit-reason');
    if (reasonInput) reasonInput.value = '';
  }

  function saveChanges() {
    var reasonInput = document.getElementById('doc-edit-reason');
    var reason = reasonInput ? reasonInput.value.trim() : '';
    if (!reason) {
      showToast('Please enter a reason for edit', 'error');
      if (reasonInput) reasonInput.focus();
      return;
    }
    var fieldsToSave = Object.values(changedFields);
    if (fieldsToSave.length === 0) {
      showToast('No changes detected', 'warning');
      return;
    }
    var saveBtn = document.getElementById('doc-save-btn');
    var originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '&#9203; Saving...';
    saveBtn.disabled = true;

    fetch('/api/documents/' + DOC_ID + '/edit', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + TOKEN
      },
      body: JSON.stringify({ fields: fieldsToSave, edit_reason: reason })
    })
    .then(function(response) {
      return response.json().then(function(data) {
        return { ok: response.ok, data: data };
      });
    })
    .then(function(result) {
      if (!result.ok) throw new Error(result.data.error || 'Save failed');
      showToast(
        '\\u2705 Document saved successfully \\u2014 ' +
        fieldsToSave.length + ' field' + (fieldsToSave.length > 1 ? 's' : '') +
        ' updated (v' + result.data.version_number + ')',
        'success'
      );
      setTimeout(function() { window.location.reload(); }, 1500);
    })
    .catch(function(err) {
      showToast('\\u274C Save failed: ' + err.message, 'error');
      saveBtn.innerHTML = originalText;
      saveBtn.disabled = false;
    });
  }

  function showToast(message, type) {
    var existing = document.getElementById('doc-edit-toast');
    if (existing) existing.remove();
    var bg = type === 'success' ? 'linear-gradient(135deg,#28a745,#20913a)' :
             type === 'error'   ? 'linear-gradient(135deg,#dc3545,#c82333)' :
                                  'linear-gradient(135deg,#ffc107,#e0a800)';
    var borderColor = type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#ffc107';
    var toast = document.createElement('div');
    toast.id = 'doc-edit-toast';
    toast.style.cssText = 'position:fixed;bottom:30px;right:30px;background:' + bg +
      ';color:#fff;padding:14px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:9999;' +
      'box-shadow:0 4px 20px rgba(0,0,0,0.3);max-width:400px;line-height:1.5;' +
      'animation:rof-slide-in 0.3s ease;border-left:4px solid ' + borderColor + ';font-family:Arial;';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() {
      toast.style.animation = 'rof-slide-in 0.3s ease reverse';
      setTimeout(function() { toast.remove(); }, 300);
    }, 4000);
  }

  // ── RECEIPT CASCADE RECALC (payment_receipt only) ────────────────────────
  var _rcOnes = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  var _rcTens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function _rcTwoDigit(x) {
    if (x < 20) return _rcOnes[x];
    return _rcTens[Math.floor(x/10)] + (x % 10 ? ' ' + _rcOnes[x % 10] : '');
  }
  function _rcWords(n) {
    n = Math.round(Math.abs(n)); if (!n) return 'Zero Only';
    var parts = [];
    if (n >= 10000000) { parts.push(_rcTwoDigit(Math.floor(n/10000000)) + ' Crore'); n %= 10000000; }
    if (n >= 100000)   { parts.push(_rcTwoDigit(Math.floor(n/100000))   + ' Lakh');  n %= 100000; }
    if (n >= 1000)     { parts.push(_rcTwoDigit(Math.floor(n/1000))     + ' Thousand'); n %= 1000; }
    if (n >= 100)      { parts.push(_rcOnes[Math.floor(n/100)]          + ' Hundred'); n %= 100; }
    if (n > 0)         { parts.push(_rcTwoDigit(n)); }
    return parts.join(' ') + ' Only';
  }
  function _rcFmtIN(n) {
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function _rcSetVal(key, val, vtype) {
    var el = document.querySelector('[data-field-key="' + key + '"]');
    if (!el) return;
    var inp = el.querySelector('input');
    if (!inp) return;
    inp.value = inp.type === 'number' ? String(parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0) : val;
    inp.style.background  = '#fff3cd';
    inp.style.borderColor = '#28a745';
    changedFields[key] = {
      field_key:   key,
      field_label: el.getAttribute('data-field-label') || key,
      section:     el.getAttribute('data-section') || 'table',
      new_value:   val,
      value_type:  vtype || 'currency'
    };
  }
  function _rcSumField(selector) {
    var total = 0;
    document.querySelectorAll(selector).forEach(function(el) {
      var inp = el.querySelector('input');
      var raw = inp ? inp.value : el.textContent;
      total += parseFloat((raw || '0').replace(/[^0-9.]/g, '')) || 0;
    });
    return total;
  }
  function _rcRecalcTotals() {
    var net  = _rcSumField('[data-field-key^="amountNet_"]');
    var cgst = _rcSumField('[data-field-key^="cgstAmount_"]');
    var sgst = _rcSumField('[data-field-key^="sgstAmount_"]');
    var grand = net + cgst + sgst;
    _rcSetVal('grandTotalNet',  _rcFmtIN(net),   'currency');
    _rcSetVal('grandTotalCgst', _rcFmtIN(cgst),  'currency');
    _rcSetVal('grandTotalSgst', _rcFmtIN(sgst),  'currency');
    _rcSetVal('grandTotal',     _rcFmtIN(grand), 'currency');
    _rcSetVal('amountBox',      _rcFmtIN(grand), 'currency');
    _rcSetVal('narrativeAmount',_rcFmtIN(grand), 'currency');
    _rcSetVal('amountInWords',  _rcWords(grand), 'text');
  }
  function rcCascadeRow(idx, amountNet) {
    var amtEl  = document.querySelector('[data-field-key="amountNet_' + idx + '"]');
    var gstType = amtEl ? (amtEl.getAttribute('data-gst-type') || 'addon') : 'addon';
    var rate   = gstType === 'basic' ? 0.005 : 0.09;
    var cgst   = Math.round(amountNet * rate * 100) / 100;
    var sgst   = cgst;
    var rowTotal = amountNet + cgst + sgst;
    _rcSetVal('cgstAmount_' + idx, _rcFmtIN(cgst),     'currency');
    _rcSetVal('sgstAmount_' + idx, _rcFmtIN(sgst),     'currency');
    _rcSetVal('rowTotal_'   + idx, _rcFmtIN(rowTotal), 'currency');
    _rcRecalcTotals();
  }

  // ── DEMAND LETTER CASCADE (demand_letter only) ────────────────────────────
  function _dlParseFmt(s) {
    return parseFloat(String(s || '0').replace(/[^0-9.]/g, '')) || 0;
  }
  function _dlGetVal(key) {
    var els = document.querySelectorAll('[data-field-key="' + key + '"]');
    if (!els.length) return 0;
    var el = els[0];
    var inp = el.querySelector('input');
    return _dlParseFmt(inp ? inp.value : el.textContent);
  }
  function _dlFmtIN(n) {
    return Math.round(n).toLocaleString('en-IN');
  }
  function _dlSetVal(key, val, vtype) {
    document.querySelectorAll('[data-field-key="' + key + '"]').forEach(function(el) {
      var inp = el.querySelector('input');
      if (!inp) return;
      inp.value = inp.type === 'number' ? String(parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0) : val;
      inp.style.background  = '#fff3cd';
      inp.style.borderColor = '#28a745';
      changedFields[key] = {
        field_key:   key,
        field_label: el.getAttribute('data-field-label') || key,
        section:     el.getAttribute('data-section') || 'payment_table',
        new_value:   val,
        value_type:  vtype || 'currency'
      };
    });
  }
  function _dlRecalcTotals() {
    var seen = {};
    var totalDue = 0;
    document.querySelectorAll('[data-field-key^="basicTotal_"],[data-field-key^="balconyTotal_"]').forEach(function(el) {
      var k = el.getAttribute('data-field-key');
      if (seen[k]) return;
      seen[k] = true;
      totalDue += _dlGetVal(k);
    });
    var seenP = {};
    var totalPaid = 0;
    document.querySelectorAll('[data-field-key^="basicPaid_"],[data-field-key^="balconyPaid_"]').forEach(function(el) {
      var k = el.getAttribute('data-field-key');
      if (seenP[k]) return;
      seenP[k] = true;
      totalPaid += _dlGetVal(k);
    });
    var totalPayable = Math.max(0, totalDue - totalPaid);
    _dlSetVal('totalDue',      _dlFmtIN(totalDue),   'currency');
    _dlSetVal('totalPaid',     _dlFmtIN(totalPaid),  'currency');
    _dlSetVal('totalPayable',  _dlFmtIN(totalPayable), 'currency');
    _dlSetVal('amountInWords', _rcWords(totalPayable), 'text');
  }
  function dlCascadeAmt(idx, newAmt) {
    var amtEl = document.querySelector('[data-field-key="basicAmt_' + idx + '"]');
    var cgstPct = amtEl ? (parseFloat(amtEl.getAttribute('data-cgst-pct') || '0.5') || 0.5) : 0.5;
    var basicCgst = Math.round(newAmt * cgstPct / 100);
    var basicSgst = basicCgst;
    var basicDue  = newAmt + basicCgst + basicSgst;
    var basicPaid = _dlGetVal('basicPaid_' + idx);
    var basicPayable = Math.max(0, basicDue - basicPaid);
    _dlSetVal('basicCgst_'    + idx, _dlFmtIN(basicCgst),    'currency');
    _dlSetVal('basicSgst_'    + idx, _dlFmtIN(basicSgst),    'currency');
    _dlSetVal('basicTotal_'   + idx, _dlFmtIN(basicDue),     'currency');
    _dlSetVal('basicPayable_' + idx, _dlFmtIN(basicPayable), 'currency');
    _dlRecalcTotals();
  }
  function dlCascadeInterest(idx, newInterest) {
    var basicAmt  = _dlGetVal('basicAmt_'  + idx);
    var basicCgst = _dlGetVal('basicCgst_' + idx);
    var basicSgst = _dlGetVal('basicSgst_' + idx);
    var basicDueWI    = basicAmt + basicCgst + basicSgst + newInterest;
    var basicPaid     = _dlGetVal('basicPaid_' + idx);
    var basicPayableWI = Math.max(0, basicDueWI - basicPaid);
    _dlSetVal('basicTotal_'   + idx, _dlFmtIN(basicDueWI),     'currency');
    _dlSetVal('basicPayable_' + idx, _dlFmtIN(basicPayableWI), 'currency');
    // Recalculate amountInWordsWithInterest from all interest rows
    var seenI = {};
    var totalInterest = 0;
    document.querySelectorAll('[data-field-key^="basicInterest_"],[data-field-key^="balconyInterest_"]').forEach(function(el) {
      var k = el.getAttribute('data-field-key');
      if (seenI[k]) return;
      seenI[k] = true;
      totalInterest += _dlGetVal(k);
    });
    var totalPayable = _dlGetVal('totalPayable') || 0;
    var totalPayableWI = totalPayable + totalInterest;
    _dlSetVal('totalPayableWithInterest', _dlFmtIN(totalPayableWI),  'currency');
    _dlSetVal('amountInWordsWithInterest', _rcWords(totalPayableWI), 'text');
  }
  function dlCascadeDueDate(idx, newDateStr) {
    if (!newDateStr) return;
    var dueDate = new Date(newDateStr);
    if (isNaN(dueDate.getTime())) return;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86400000));
    if (daysOverdue <= 0) return;
    var penalRateEl = document.querySelector('[data-field-key="penalRate"]');
    var penalRateRaw = penalRateEl ? (penalRateEl.querySelector('input') || penalRateEl) : null;
    var penalRate = penalRateRaw ? (_dlParseFmt(penalRateRaw.value !== undefined ? penalRateRaw.value : penalRateRaw.textContent) || 15) : 15;
    var basicAmt = _dlGetVal('basicAmt_' + idx);
    var basicInterest = parseFloat((basicAmt * (penalRate / 100) * daysOverdue / 365).toFixed(2));
    _dlSetVal('basicInterest_' + idx, _dlFmtIN(basicInterest), 'currency');
    dlCascadeInterest(idx, basicInterest);
  }

  // ── ALLOTMENT LETTER CASCADE (allotment_letter only) ──────────────────────
  function _alFmtIN(n) { return Math.round(n).toLocaleString('en-IN'); }
  function _alGetVal(key) {
    var els = document.querySelectorAll('[data-field-key="' + key + '"]');
    if (!els.length) return 0;
    var el = els[0];
    var inp = el.querySelector('input');
    return parseFloat(String(inp ? inp.value : el.textContent).replace(/[^0-9.]/g, '')) || 0;
  }
  function _alSetVal(key, val, vtype) {
    document.querySelectorAll('[data-field-key="' + key + '"]').forEach(function(el) {
      var inp = el.querySelector('input');
      if (!inp) return;
      inp.value = inp.type === 'number' ? String(parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0) : val;
      inp.style.background  = '#fff3cd';
      inp.style.borderColor = '#28a745';
      changedFields[key] = {
        field_key:   key,
        field_label: el.getAttribute('data-field-label') || key,
        section:     el.getAttribute('data-section') || 'payment_schedule',
        new_value:   val,
        value_type:  vtype || 'currency'
      };
    });
  }
  function alCascadeTotalConsideration(newTotal) {
    // Recalculate every schedule row amount from its percentage
    document.querySelectorAll('[data-field-key^="schedulePercentage_"]').forEach(function(el) {
      var k   = el.getAttribute('data-field-key');
      var idx = k.replace('schedulePercentage_', '');
      var inp = el.querySelector('input');
      var pct = parseFloat((inp ? inp.value : el.textContent).replace(/[^0-9.]/g, '')) || 0;
      if (pct > 0) {
        _alSetVal('scheduleAmount_' + idx, _alFmtIN(Math.round(pct / 100 * newTotal)), 'currency');
      }
    });
    // Recalculate rate per sqft
    var carpetArea = _alGetVal('carpetArea');
    if (carpetArea > 0) {
      _alSetVal('ratePerSqft', _alFmtIN(Math.round(newTotal / carpetArea)), 'currency');
    }
  }
  function alCascadeCarpetArea(newArea) {
    var totalConsideration = _alGetVal('totalConsideration');
    if (newArea > 0 && totalConsideration > 0) {
      _alSetVal('ratePerSqft', _alFmtIN(Math.round(totalConsideration / newArea)), 'currency');
    }
  }
  function alCascadeSchedulePct(idx, newPct) {
    var totalConsideration = _alGetVal('totalConsideration');
    if (totalConsideration > 0) {
      _alSetVal('scheduleAmount_' + idx, _alFmtIN(Math.round(newPct / 100 * totalConsideration)), 'currency');
    }
  }

  // ── APPLICANT FILE CASCADE (applicant_file only) ──────────────────────────
  function _afGetVal(key) {
    var els = document.querySelectorAll('[data-field-key="' + key + '"]');
    if (!els.length) return 0;
    var el = els[0];
    var inp = el.querySelector('input');
    return parseFloat(String(inp ? inp.value : el.textContent).replace(/[^0-9.]/g, '')) || 0;
  }
  function _afSetVal(key, val, vtype) {
    document.querySelectorAll('[data-field-key="' + key + '"]').forEach(function(el) {
      var inp = el.querySelector('input');
      if (!inp) return;
      inp.value = inp.type === 'number' ? String(parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0) : val;
      inp.style.background  = '#fff3cd';
      inp.style.borderColor = '#28a745';
      changedFields[key] = {
        field_key:   key,
        field_label: el.getAttribute('data-field-label') || key,
        section:     el.getAttribute('data-section') || 'pricing',
        new_value:   val,
        value_type:  vtype || 'currency'
      };
    });
  }
  function _afFmtIN(n) { return Math.round(n).toLocaleString('en-IN'); }
  function _afRecalcFromAgreement(agreementValue) {
    var cgstEl  = document.querySelector('[data-field-key="cgstAmount"]');
    var cgstPct = cgstEl ? (parseFloat(cgstEl.getAttribute('data-cgst-pct') || '0') || 0) : 0;
    var sgstEl  = document.querySelector('[data-field-key="sgstAmount"]');
    var sgstPct = sgstEl ? (parseFloat(sgstEl.getAttribute('data-sgst-pct') || '0') || 0) : 0;
    var cgst = agreementValue * cgstPct / 100;
    var sgst = agreementValue * sgstPct / 100;
    var totalWithGst = agreementValue + cgst + sgst;
    var interestAmt = _afGetVal('interestAmt');
    var totalReceivables = totalWithGst + interestAmt;
    _afSetVal('agreementValue',     _afFmtIN(agreementValue),   'currency');
    _afSetVal('cgstAmount',         _afFmtIN(cgst),             'currency');
    _afSetVal('sgstAmount',         _afFmtIN(sgst),             'currency');
    _afSetVal('totalAmountWithGst', _afFmtIN(totalWithGst),     'currency');
    _afSetVal('totalReceivables',   _afFmtIN(totalReceivables), 'currency');
    // Recalculate all schedule row amounts from percentages
    document.querySelectorAll('[data-field-key^="schedPercentage_"]').forEach(function(el) {
      var k   = el.getAttribute('data-field-key');
      var idx = k.replace('schedPercentage_', '');
      var inp = el.querySelector('input');
      var pct = parseFloat((inp ? inp.value : el.textContent).replace(/[^0-9.]/g, '')) || 0;
      if (pct > 0) {
        var newAmt  = Math.round(pct / 100 * agreementValue);
        var rowCgst = Math.round(newAmt * cgstPct / 100);
        var rowSgst = rowCgst;
        var rowTotal = newAmt + rowCgst + rowSgst;
        var rowPaid  = _afGetVal('schedPaid_' + idx);
        _afSetVal('schedAmount_'  + idx, _afFmtIN(newAmt),                       'currency');
        _afSetVal('schedCgst_'    + idx, _afFmtIN(rowCgst),                      'currency');
        _afSetVal('schedSgst_'    + idx, _afFmtIN(rowSgst),                      'currency');
        _afSetVal('schedTotal_'   + idx, _afFmtIN(rowTotal),                     'currency');
        _afSetVal('schedBalance_' + idx, _afFmtIN(Math.max(0, rowTotal - rowPaid)), 'currency');
      }
    });
  }
  function afCascadePricing() {
    var carpetArea  = _afGetVal('carpetArea');
    var ratePerSqft = _afGetVal('ratePerSqft');
    var netBasicPrice = carpetArea * ratePerSqft;
    _afSetVal('netBasicPrice', _afFmtIN(netBasicPrice), 'currency');
    var plcCharge   = _afGetVal('plcCharge');
    var otherCharges = _afGetVal('otherCharges');
    _afRecalcFromAgreement(netBasicPrice + plcCharge + otherCharges);
  }
  function afCascadeFromAgreement() {
    var netBasicPrice = _afGetVal('netBasicPrice');
    var plcCharge    = _afGetVal('plcCharge');
    var otherCharges = _afGetVal('otherCharges');
    _afRecalcFromAgreement(netBasicPrice + plcCharge + otherCharges);
  }
  function afCascadeSchedAmount(idx, newAmt) {
    var cgstEl  = document.querySelector('[data-field-key="cgstAmount"]');
    var cgstPct = cgstEl ? (parseFloat(cgstEl.getAttribute('data-cgst-pct') || '0') || 0) : 0;
    var rowCgst = Math.round(newAmt * cgstPct / 100);
    var rowSgst = rowCgst;
    var rowTotal = newAmt + rowCgst + rowSgst;
    var rowPaid  = _afGetVal('schedPaid_' + idx);
    _afSetVal('schedCgst_'    + idx, _afFmtIN(rowCgst),                      'currency');
    _afSetVal('schedSgst_'    + idx, _afFmtIN(rowSgst),                      'currency');
    _afSetVal('schedTotal_'   + idx, _afFmtIN(rowTotal),                     'currency');
    _afSetVal('schedBalance_' + idx, _afFmtIN(Math.max(0, rowTotal - rowPaid)), 'currency');
  }
})();
</script>
<style>
  [data-field-key]:hover { outline:1px dashed #e67e22; outline-offset:2px; }
  @keyframes rof-slide-in {
    from { transform:translateX(100px); opacity:0; }
    to   { transform:translateX(0);     opacity:1; }
  }
  @media print {
    #doc-edit-btn, #doc-save-btn, #doc-cancel-btn,
    #doc-reason-container, #edit-mode-banner, #doc-edit-toast { display:none !important; }
  }
</style>`;
}
/** Dispatch to the correct recalc function based on document_type. */
function applyRecalc(documentType, html, overrides) {
    switch (documentType) {
        case 'demand_letter': return recalcDemandLetter(html, overrides);
        case 'payment_receipt': return recalcReceipt(html, overrides);
        case 'allotment_letter': return recalcAllotmentLetter(html, overrides);
        case 'applicant_file': return recalcApplicantFile(html, overrides);
        default: return applyOverridesToHtml(html, overrides);
    }
}
//# sourceMappingURL=document-recalc.js.map