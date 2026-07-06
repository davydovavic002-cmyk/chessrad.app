export async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    ...options,
  });
  return res;
}

export async function apiJson(path, options = {}) {
  const res = await api(path, options);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
