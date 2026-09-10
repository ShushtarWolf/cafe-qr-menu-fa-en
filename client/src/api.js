async function req(path, options = {}) {
  const res = await fetch(path, {
    headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
    body:
      options.body instanceof FormData
        ? options.body
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined
  });
  if (res.status === 401) {
    const err = new Error('unauthorized');
    err.unauthorized = true;
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  me: () => req('/api/me'),
  login: (password) => req('/api/login', { method: 'POST', body: { password } }),
  logout: () => req('/api/logout', { method: 'POST' }),

  venues: () => req('/api/venues'),
  venue: (id) => req(`/api/venues/${id}`),
  createVenue: (body) =>
    req('/api/venues', {
      method: 'POST',
      body: typeof body === 'string' ? { name: body } : body
    }),
  updateVenue: (id, body) => req(`/api/venues/${id}`, { method: 'PUT', body }),
  deleteVenue: (id) => req(`/api/venues/${id}`, { method: 'DELETE' }),
  duplicateMenu: (id, targetId) =>
    req(`/api/venues/${id}/duplicate-menu`, { method: 'POST', body: { target_venue_id: targetId } }),
  uploadLogo: (id, file) => {
    const fd = new FormData();
    fd.append('logo', file);
    return req(`/api/venues/${id}/logo`, { method: 'POST', body: fd });
  },

  createCategory: (venueId, body) =>
    req(`/api/venues/${venueId}/categories`, {
      method: 'POST',
      body: typeof body === 'string' ? { name: body } : body
    }),
  updateCategory: (id, body) =>
    req(`/api/categories/${id}`, {
      method: 'PUT',
      body: typeof body === 'string' ? { name: body } : body
    }),
  deleteCategory: (id) => req(`/api/categories/${id}`, { method: 'DELETE' }),
  reorderCategories: (venueId, ids) =>
    req(`/api/venues/${venueId}/categories/reorder`, { method: 'POST', body: { ids } }),

  createItem: (categoryId, body) => req(`/api/categories/${categoryId}/items`, { method: 'POST', body }),
  updateItem: (id, body) => req(`/api/items/${id}`, { method: 'PUT', body }),
  deleteItem: (id) => req(`/api/items/${id}`, { method: 'DELETE' }),
  reorderItems: (categoryId, ids) =>
    req(`/api/categories/${categoryId}/items/reorder`, { method: 'POST', body: { ids } }),
  uploadPhoto: (id, file) => {
    const fd = new FormData();
    fd.append('photo', file);
    return req(`/api/items/${id}/photo`, { method: 'POST', body: fd });
  },
  deletePhoto: (id) => req(`/api/items/${id}/photo`, { method: 'DELETE' }),

  settings: () => req('/api/settings'),
  saveSettings: (body) => req('/api/settings', { method: 'PUT', body })
};

export function centsToInput(cents) {
  return ((Number(cents) || 0) / 100).toFixed(2);
}

export function inputToCents(str) {
  const n = Number(String(str).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** تومان — whole units from text input */
export function inputToToman(str) {
  const n = Number(String(str).replace(/[^0-9]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function moneyEn(cents, symbol = '$') {
  return `${symbol}${((Number(cents) || 0) / 100).toFixed(2)}`;
}

export function moneyFa(amount, symbol = 'تومان') {
  const n = Math.round(Number(amount) || 0);
  return `${n.toLocaleString('fa-IR')} ${symbol}`;
}

/** @deprecated use moneyEn — kept for older call sites */
export function money(cents, symbol = '$') {
  return moneyEn(cents, symbol);
}
