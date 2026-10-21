// ROF CRM — Mobile navigation (hamburger drawer)
// The menu itself (open/close of dropdowns) is handled by app.js through the `.open` classes.
// This file only adds the phone/tablet drawer around it. On wide screens it does nothing visible.
(function () {
  function init() {
    var topbar = document.getElementById('topbar');
    var nav = document.getElementById('navbar');
    if (!topbar || !nav || document.getElementById('nav-toggle')) return;

    var btn = document.createElement('button');
    btn.id = 'nav-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span></span><span></span><span></span>';
    topbar.insertBefore(btn, topbar.firstChild);

    var backdrop = document.createElement('div');
    backdrop.id = 'nav-backdrop';
    document.body.appendChild(backdrop);

    // "Welcome, user" + date at the top of the drawer (the top bar hides them on small screens)
    var who = document.createElement('div');
    who.id = 'nav-user';
    nav.insertBefore(who, nav.firstChild);

    function fillUser() {
      var u = document.getElementById('tb-user');
      var d = document.getElementById('tb-date');
      who.innerHTML = '<b></b><span></span>';
      who.firstChild.textContent = u ? u.textContent : '';
      who.lastChild.textContent = d ? d.textContent : '';
    }
    function setOpen(on) {
      if (on) fillUser();
      document.body.classList.toggle('nav-open', on);
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? 'Close menu' : 'Open menu');
    }
    function close() { setOpen(false); }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(!document.body.classList.contains('nav-open'));
    });
    backdrop.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    window.addEventListener('hashchange', close);
    window.addEventListener('resize', function () { if (window.innerWidth > 900) close(); });

    // Picking a real page (not a submenu parent) closes the drawer. Capture phase, because
    // app.js stops propagation on clicks inside .nav-item.
    nav.addEventListener('click', function (e) {
      var link = e.target.closest ? e.target.closest('.dd-link, .nav-right .nav-btn') : null;
      if (!link) return;
      if (link.classList.contains('has-sub')) return;
      close();
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
