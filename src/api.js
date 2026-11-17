// Cliente da API. Só nome, avatar, pontos e sequência são enviados; peso e IMC ficam no aparelho.
async function call(method, path, body, token) {
  let res
  try {
    res = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw Object.assign(new Error('Sem conexão com o servidor. Tente novamente.'), { offline: true })
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'Erro inesperado.'), { status: res.status })
  return data
}

export const api = {
  createGroup: (b) => call('POST', '/groups', b),
  joinGroup: (b) => call('POST', '/groups/join', b),
  ranking: (code, token) => call('GET', `/groups/${encodeURIComponent(code)}/ranking`, null, token),
  newCode: (code, token) => call('POST', `/groups/${encodeURIComponent(code)}/code`, {}, token),
  newSeason: (code, token, today) => call('POST', `/groups/${encodeURIComponent(code)}/season`, { today }, token),
  sync: (payload, token) => call('PUT', '/sync', payload, token),
  deleteMe: (token) => call('DELETE', '/me', null, token),
}
