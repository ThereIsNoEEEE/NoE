// Thin REST adapter: API keys and Qdrant details never reach the frontend.
export class QdrantError extends Error {
  constructor(status = 0) { super('Qdrant 요청에 실패했습니다.'); this.status = status; }
}

export class QdrantClient {
  constructor({ url, apiKey = '', timeoutMs = 5000 }, fetchImpl = fetch) {
    Object.assign(this, { url, apiKey, timeoutMs, fetchImpl });
  }

  async request(method, path, body) {
    try {
      const response = await this.fetchImpl(this.url + path, {
        method, redirect: 'error', signal: AbortSignal.timeout(this.timeoutMs),
        headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(this.apiKey ? { 'api-key': this.apiKey } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) { await response.body?.cancel(); throw new QdrantError(response.status); }
      const data = await response.json();
      if (data.status !== 'ok') throw new QdrantError(response.status);
      return data.result;
    } catch (error) {
      if (error instanceof QdrantError) throw error;
      throw new QdrantError();
    }
  }

  collectionPath(name) { return `/collections/${encodeURIComponent(name)}`; }
  collection(name) { return this.request('GET', this.collectionPath(name)); }
  createCollection(name) { return this.request('PUT', this.collectionPath(name), { vectors: {} }); }
  async upsert(name, id, payload) {
    const result = await this.request('PUT', `${this.collectionPath(name)}/points?wait=true`, { points: [{ id, vector: {}, payload }] });
    if (result?.status !== 'completed') throw new QdrantError();
  }
  point(name, id) { return this.request('GET', `${this.collectionPath(name)}/points/${encodeURIComponent(id)}`); }
}
