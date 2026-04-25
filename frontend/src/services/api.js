import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('dzm:unauthorized'));
    }
    return Promise.reject(err);
  }
);

export const Servers = {
  list: () => api.get('/servers').then((r) => r.data),
  get: (id) => api.get(`/servers/${id}`).then((r) => r.data),
  create: (body) => api.post('/servers', body).then((r) => r.data),
  update: (id, patch) => api.patch(`/servers/${id}`, patch).then((r) => r.data),
  remove: (id, wipe = false) => api.delete(`/servers/${id}${wipe ? '?wipe=1' : ''}`).then((r) => r.data),
  start: (id) => api.post(`/servers/${id}/start`).then((r) => r.data),
  stop: (id, force = false) => api.post(`/servers/${id}/stop${force ? '?force=1' : ''}`).then((r) => r.data),
  restart: (id) => api.post(`/servers/${id}/restart`).then((r) => r.data),
  install: (id, body = {}) => api.post(`/servers/${id}/install`, body).then((r) => r.data),
  config: {
    get: (id) => api.get(`/servers/${id}/config`).then((r) => r.data),
    save: (id, payload) => api.put(`/servers/${id}/config`, payload).then((r) => r.data),
  },
  logsTail: (id, limit = 500) => api.get(`/servers/${id}/logs?limit=${limit}`).then((r) => r.data),
  installedMods: (id) => api.get(`/servers/${id}/installed-mods`).then((r) => r.data),
};

export const Mods = {
  list: (serverId) => api.get(`/mods/${serverId}`).then((r) => r.data),
  add: (serverId, body) => api.post(`/mods/${serverId}`, body).then((r) => r.data),
  update: (serverId, modId, patch) => api.patch(`/mods/${serverId}/${modId}`, patch).then((r) => r.data),
  remove: (serverId, modId) => api.delete(`/mods/${serverId}/${modId}`).then((r) => r.data),
  reorder: (serverId, order) => api.patch(`/mods/${serverId}/order`, { order }).then((r) => r.data),
  install: (serverId, modId) => api.post(`/mods/${serverId}/${modId}/install`).then((r) => r.data),
};

export const System = {
  info: () => api.get('/system/info').then((r) => r.data),
  installSteamcmd: () => api.post('/system/install-steamcmd').then((r) => r.data),
};

export const Steam = {
  status: () => api.get('/steam/status').then((r) => r.data),
  install: () => api.post('/steam/install').then((r) => r.data),
};

export const Configs = {
  defaults: () => api.get('/configs/defaults').then((r) => r.data),
  render: (cfg) => api.post('/configs/render', cfg, { responseType: 'text' }).then((r) => r.data),
};

export const Presets = {
  list: () => api.get('/presets').then((r) => r.data),
  save: (name, payload) => api.post('/presets', { name, payload }).then((r) => r.data),
  remove: (id) => api.delete(`/presets/${id}`).then((r) => r.data),
};

export const Auth = {
  session: () => api.get('/auth/session').then((r) => r.data),
  login: (username, password) => api.post('/auth/login', { username, password }).then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
};

export const Settings = {
  get: () => api.get('/settings').then((r) => r.data),
  updateSteam: (body) => api.put('/settings/steam', body).then((r) => r.data),
  testLogin: () => api.post('/settings/steam/test-login').then((r) => r.data),
  submitGuard: (code) => api.post('/settings/steam/guard', { code }).then((r) => r.data),
  cancel: () => api.post('/settings/steam/cancel').then((r) => r.data),
};

export default api;
