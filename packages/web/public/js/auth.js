// ROF CRM — Authentication
// JWT token management + login/logout

const Auth = {
  getToken() {
    return localStorage.getItem(ROF.TOKEN_KEY);
  },

  setToken(token) {
    localStorage.setItem(ROF.TOKEN_KEY, token);
  },

  clearToken() {
    localStorage.removeItem(ROF.TOKEN_KEY);
  },

  isAuthenticated() {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = this._parseJWT(token);
      // Check expiry (exp is in seconds)
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        this.clearToken();
        return false;
      }
      return true;
    } catch {
      return false;
    }
  },

  getUser() {
    const token = this.getToken();
    if (!token) return null;
    try {
      return this._parseJWT(token);
    } catch {
      return null;
    }
  },

  _parseJWT(token) {
    const base64 = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(atob(base64));
  },

  async login(email, password) {
    const res = await fetch(`${ROF.API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || 'Login failed');
    this.setToken(data.token || data.data?.token);
    return data;
  },

  logout() {
    this.clearToken();
    window.location.href = '/pages/login.html';
  },

  requireAuth() {
    if (!this.isAuthenticated()) {
      this.logout();
      return false;
    }
    return true;
  },
};
