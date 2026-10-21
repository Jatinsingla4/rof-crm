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
  const open = window.open.bind(window);
  window.open = function (url, target, features) {
    if (!isLink(url)) return open(url, target, features);
    const w = open('about:blank', target, features);
    linkUrl(url).then((u) => { if (w) w.location.href = u; }).catch((e) => { if (w) w.close(); if (window.Utils && Utils.error) Utils.error(e.message); });
    return w;
  };
  const route = (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || !isLink(a.getAttribute('href'))) return;
    e.preventDefault();
    window.open(a.getAttribute('href'), '_blank');
  };
  document.addEventListener('click', route, true);
  document.addEventListener('auxclick', route, true);
})();
