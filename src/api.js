// Cliente da API. Só nome, avatar, registros do dia e sequência são enviados; peso e IMC ficam no aparelho.
// Os endpoints do grupo usam o apelido "me" (o grupo de quem está logado): assim o app continua
// funcionando quando o administrador troca o código de convite.
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
  recover: (b) => call('POST', '/recover', b),
  ranking: (token) => call('GET', '/groups/me/ranking', null, token),
  members: (token) => call('GET', '/groups/me/members', null, token),
  newCode: (token) => call('POST', '/groups/me/code', {}, token),
  newSeason: (token, today) => call('POST', '/groups/me/season', { today }, token),
  transferOwner: (token, memberId) => call('POST', '/groups/me/owner', { memberId }, token),
  kick: (token, memberId) => call('DELETE', `/groups/me/members/${encodeURIComponent(memberId)}`, null, token),
  deleteGroup: (token) => call('DELETE', '/groups/me', null, token),
  sync: (payload, token) => call('PUT', '/sync', payload, token),
  setPin: (pin, token) => call('PUT', '/me/pin', { pin }, token),
  deleteMe: (token) => call('DELETE', '/me', null, token),
}
