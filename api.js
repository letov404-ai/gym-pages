/**
 * API fetch wrapper with Telegram auth.
 */
const API = {
  _baseUrl: 'https://gym.sergey-letov.ru',

  _headers() {
    const h = {};
    if (window.Telegram?.WebApp?.initData) {
      h['Authorization'] = 'tma ' + window.Telegram.WebApp.initData;
    } else {
      h['X-Dev-Mode'] = '1';
    }
    return h;
  },

  async get(path) {
    const resp = await fetch(this._baseUrl + path, { headers: this._headers() });
    if (!resp.ok) throw new Error(`API ${resp.status}: ${path}`);
    return resp.json();
  },

  async post(path, body) {
    const headers = { ...this._headers(), 'Content-Type': 'application/json' };
    const resp = await fetch(this._baseUrl + path, {
      method: 'POST', headers, body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`API ${resp.status}: ${path}`);
    return resp.json();
  },

  async put(path, body) {
    const headers = { ...this._headers(), 'Content-Type': 'application/json' };
    const resp = await fetch(this._baseUrl + path, {
      method: 'PUT', headers, body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`API ${resp.status}: ${path}`);
    return resp.json();
  },

  async del(path) {
    const resp = await fetch(this._baseUrl + path, {
      method: 'DELETE', headers: this._headers(),
    });
    if (!resp.ok) throw new Error(`API ${resp.status}: ${path}`);
    return resp.json();
  },

  async upload(path, formData) {
    const resp = await fetch(this._baseUrl + path, {
      method: 'POST', headers: this._headers(), body: formData,
    });
    if (!resp.ok) throw new Error(`API ${resp.status}: ${path}`);
    return resp.json();
  }
};
