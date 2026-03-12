export interface ApiStatus {
  name: string
  version: string
  uptimeSeconds: number
  timestamp: string
  routes: string[]
}

export interface ChannelStatus {
  id: string
  label: string
  reach: string
  state: 'ready' | 'staged' | 'paused'
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export function fetchStatus() {
  return fetchJson<ApiStatus>('/api/status')
}

export function fetchChannels() {
  return fetchJson<ChannelStatus[]>('/api/channels')
}
