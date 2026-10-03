// Live notice feed for the header bell: polls the notice collection and pushes
// notices that were not there before to every connected WebSocket client.
const FEED_FIELDS = ['id', 'title', 'date', 'url', 'sourceName', 'imageUrl', 'collectedAt'];

const pick = item => Object.fromEntries(FEED_FIELDS.map(key => [key, item[key] ?? null]));
const LOG_LIMIT = 200;

export class NoticeFeed {
  constructor(notices, { intervalMs = 60000, latestCount = 20, heartbeatMs = 30000, replayIntervalMs = 0 } = {}) {
    Object.assign(this, { notices, intervalMs, latestCount, heartbeatMs, replayIntervalMs });
    this.clients = new Set();
    this.known = null;
    this.latest = [];
    this.timers = [];
    // HTTP polling fallback (e.g. a Vercel-hosted front can't proxy WebSockets):
    // arrivals are logged with a sequence number; cursors are `${epoch}:${seq}`.
    this.epoch = Date.now().toString(36);
    this.seq = 0;
    this.log = [];
    // Replay mode (NOTICE_FEED_REPLAY_INTERVAL_MS): when real arrivals are rare, re-announce
    // stored real notices one at a time, newest first beyond the initial list. Only real
    // notices (real titles/links) are sent; nothing is fabricated.
    this.replayQueue = null;
    this.arrived = [];
  }

  // First run only records what exists; later runs broadcast notices with unseen ids.
  async refresh() {
    const items = await this.notices.list();
    const fresh = this.known ? items.filter(item => !this.known.has(item.id)) : [];
    this.known = new Set(items.map(item => item.id));
    this.base = items.slice(0, this.latestCount).map(pick);
    this.replayQueue ??= items.slice(this.latestCount).map(pick);
    this.updateLatest();
    if (fresh.length) this.announce(fresh.map(pick));
    return fresh;
  }

  // Latest list = announced arrivals (newest first) followed by the newest stored notices.
  updateLatest() {
    const seen = new Set();
    this.latest = [...this.arrived, ...(this.base || [])].filter(item => !seen.has(item.id) && seen.add(item.id)).slice(0, this.latestCount);
  }

  announce(items) {
    for (const item of items) this.log.push({ seq: ++this.seq, item });
    this.log.splice(0, Math.max(0, this.log.length - LOG_LIMIT));
    this.arrived = [...items, ...this.arrived.filter(a => !items.some(i => i.id === a.id))].slice(0, this.latestCount);
    this.updateLatest();
    this.broadcast({ type: 'notices', items, at: new Date().toISOString() });
  }

  // Replay mode: announce the next stored notice that has not been shown yet.
  replay() {
    const next = this.replayQueue?.find(item => !this.arrived.some(a => a.id === item.id));
    if (!next) return null;
    this.replayQueue = this.replayQueue.filter(item => item.id !== next.id);
    this.announce([next]);
    return next;
  }

  cursor() { return `${this.epoch}:${this.seq}`; }

  // GET /api/notice-feed?after=<cursor>: no/foreign cursor → latest list (type hello);
  // otherwise the notices that arrived after that cursor (type notices).
  poll(after) {
    const [epoch, seqText] = String(after || '').split(':');
    const seq = Number(seqText);
    const base = { cursor: this.cursor(), intervalMs: this.intervalMs, at: new Date().toISOString() };
    if (epoch !== this.epoch || !Number.isInteger(seq) || seq < 0 || seq > this.seq) return { type: 'hello', items: this.latest, ...base };
    return { type: 'notices', items: this.log.filter(entry => entry.seq > seq).map(entry => entry.item).reverse(), ...base };
  }

  broadcast(message) {
    for (const client of this.clients) client.send(message);
  }

  add(client) {
    this.clients.add(client);
    client.onClose(() => this.clients.delete(client));
    client.send({ type: 'hello', items: this.latest, intervalMs: this.intervalMs, at: new Date().toISOString() });
  }

  start() {
    const tick = () => this.refresh().catch(error => console.warn(`공지 알림 갱신 실패: ${error.message}`));
    tick();
    this.timers.push(setInterval(tick, this.intervalMs), setInterval(() => { for (const client of this.clients) client.ping(); }, this.heartbeatMs));
    if (this.replayIntervalMs > 0) this.timers.push(setInterval(() => this.replay(), this.replayIntervalMs));
    for (const timer of this.timers) timer.unref?.();
    return this;
  }

  stop() {
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
    for (const client of this.clients) client.close(1001);
  }
}
