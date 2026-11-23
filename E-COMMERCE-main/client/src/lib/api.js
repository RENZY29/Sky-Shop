const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

/** Small JSON API client for the SkyShop Express server. */
export async function apiRequest(path, options = {}) {
  const { headers: suppliedHeaders = {}, body, ...rest } = options;
  const headers = {
    Accept: 'application/json',
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...suppliedHeaders,
  };

  let token = '';
  try { token = window.localStorage.getItem('skyshop-token') || ''; } catch { /* storage may be unavailable */ }
  if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers,
      ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error(`Could not reach the SkyShop API at ${API_BASE_URL}. Make sure the server is running.`);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export { API_BASE_URL };
