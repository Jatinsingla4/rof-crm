// ROF CRM — API Client
// Centralized fetch wrapper with JWT auth, error handling, and response unwrapping

const Api = {
  _buildHeaders(extra = {}) {
    const token = Auth.getToken() || 'mock-jwt-token';
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...extra,
    };
  },

  async _request(method, path, { body, params } = {}) {
    let url = `${ROF.API_BASE}${path}`;
    if (params) {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, v);
      });
      const qstr = qs.toString();
      if (qstr) url += '?' + qstr;
    }

    const opts = {
      method,
      headers: this._buildHeaders(),
    };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);

    if (res.status === 401) {
      Auth.logout();
      throw new Error('Session expired. Please log in again.');
    }

    let data;
    try { data = await res.json(); } catch { data = {}; }

    if (!res.ok) {
      throw new Error(data.error || data.message || `Request failed (${res.status})`);
    }

    // Our API wraps responses in { success, data } — unwrap transparently
    return data.data !== undefined ? data : data;
  },

  get(path, options = {}) {
    return this._request('GET', path, options);
  },

  post(path, body, options = {}) {
    return this._request('POST', path, { body, ...options });
  },

  patch(path, body, options = {}) {
    return this._request('PATCH', path, { body, ...options });
  },

  put(path, body, options = {}) {
    return this._request('PUT', path, { body, ...options });
  },

  delete(path, options = {}) {
    return this._request('DELETE', path, options);
  },

  async uploadFile(path, formData) {
    const token = Auth.getToken() || 'mock-jwt-token';
    const res = await fetch(`${ROF.API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) throw new Error(data.error || data.message || `Upload failed (${res.status})`);
    return data.data !== undefined ? data : data;
  },
};
