// Live notice feed for the header bell: polls the notice collection and pushes
// notices that were not there before to every connected WebSocket client.
const FEED_FIELDS = ['id', 'title', 'date', 'url', 'sourceName', 'imageUrl', 'collectedAt'];

const pick = item => Object.fromEntries(FEED_FIELDS.map(key => [key, item[key] ?? null]));

export class NoticeFeed {
  constructor(notices, { intervalMs = 60000, latestCount = 20, heartbeatMs = 30000 } = {}) {
    Object.assign(this, { notices, intervalMs, latestCount, heartbeatMs });
    this.clients = new Set();
    this.known = null;
    this.latest = [];
    this.timers = [];
  }

  // First run only records what exists; later runs broadcast notices with unseen ids.
  async refresh() {
    const items = await this.notices.list();
    const fresh = this.known ? items.filter(item => !this.known.has(item.id)) : [];
    this.known = new Set(items.map(item => item.id));
    this.latest = items.slice(0, this.latestCount).map(pick);
    if (fresh.length) this.broadcast({ type: 'notices', items: fresh.map(pick), at: new Date().toISOString() });
    return fresh;
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
    for (const timer of this.timers) timer.unref?.();
    return this;
  }

  stop() {
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
    for (const client of this.clients) client.close(1001);
  }
}
