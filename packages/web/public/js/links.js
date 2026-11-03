// Pages open letters, receipts and applicant files in a new tab through a ?token= address. The login token must not sit in a web address,
// so any such address is swapped for a link token made for that one page and valid for 2 minutes.
(function () {
  const isLink = (u) => typeof u === 'string' && /^\/api\/[^?]*\?(.*&)?token=/.test(u);
  async function linkUrl(url) {
    const u = new URL(url, location.origin);
    u.searchParams.delete('token');
    const r = await fetch('/api/auth/link-token', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (Auth.getToken() || '') }, body: JSON.stringify({ path: u.pathname }) });
    if (!r.ok) throw new Error('Could not open the link. Please sign in again.');
    u.searchParams.set('token', (await r.json()).token);
    return u.pathname + u.search;
  }
  window.linkUrl = linkUrl;
  // Opens a vault document from a button carrying data-id, data-has-file and data-url (a stored file goes through a link token, a scan link opens as it is)
  window.openStored = (btn) => {
    const d = btn.dataset;
    if (d.hasFile === 'true') window.open('/api/documents/vault/file/' + d.id + '?token=1', '_blank');
    else if (d.url) window.open(d.url, '_blank', 'noopener');
    else if (window.Utils && Utils.warn) Utils.warn('This document has no file');
  };
  const open = window.open.bind(window);
  window.open = function (url, target, features) {
    if (!isLink(url)) return open(url, target, features);
    const w = open('about:blank', target, features);
    linkUrl(url).then((u) => { if (w) w.location.href = u; }).catch((e) => { if (w) w.close(); if (window.Utils && Utils.error) Utils.error(e.message); });
    return w;
  };
  // A link must not carry the login token where "Copy link address" or the status bar can show it: the address is kept aside until the click
  const hideOne = (a) => { const h = a.getAttribute('href'); if (isLink(h)) { a.dataset.href = h; a.setAttribute('href', 'javascript:void(0)'); } };
  const hide = (n) => { if (n.nodeType !== 1) return; if (n.matches('a[href]')) hideOne(n); n.querySelectorAll('a[href*="token="]').forEach(hideOne); };
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach(hide))).observe(document.documentElement, { childList: true, subtree: true });
  const route = (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    const h = a && (a.dataset.href || a.getAttribute('href'));
    if (!a || !isLink(h)) return;
    e.preventDefault();
    window.open(h, '_blank');
  };
  document.addEventListener('click', route, true);
  document.addEventListener('auxclick', route, true);
})();
