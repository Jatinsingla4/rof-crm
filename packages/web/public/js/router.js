// ROF CRM — Client-Side Router
// Hash-based routing: #/page?param=value
// Maps URL hash fragments to page modules and renders them into #content

const Router = {
  routes: {},
  currentPage: null,

  register(path, handler) {
    this.routes[path] = handler;
  },

  navigate(path, params = {}) {
    const qs = new URLSearchParams(params).toString();
    window.location.hash = '#' + path + (qs ? '?' + qs : '');
  },

  getParams() {
    const hash = window.location.hash.slice(1);
    const [path, qs] = hash.split('?');
    const params = {};
    if (qs) {
      new URLSearchParams(qs).forEach((v, k) => { params[k] = v; });
    }
    return params;
  },

  getPath() {
    const hash = window.location.hash.slice(1);
    return hash.split('?')[0] || '/dashboard';
  },

  async dispatch() {
    const path = this.getPath();
    const params = this.getParams();

    const handler = this.routes[path];
    if (!handler) {
      console.warn('No route for:', path);
      // Redirect to dashboard if unknown route
      if (path !== '/dashboard') this.navigate('/dashboard');
      return;
    }

    // Update nav active state
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    this.currentPage = path;
    try {
      await handler(params);
    } catch (err) {
      console.error('Route handler error:', err);
      Utils.error('Failed to load page: ' + err.message);
    }
  },

  init() {
    window.addEventListener('hashchange', () => this.dispatch());
    // Initial dispatch
    if (!window.location.hash || window.location.hash === '#') {
      this.navigate('/dashboard');
    } else {
      this.dispatch();
    }
  },
};
