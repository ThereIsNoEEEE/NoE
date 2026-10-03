// Minimal RFC 6455 WebSocket server side (text frames, ping/pong, close) so the
// backend keeps zero npm dependencies. Server → client only; client text is ignored.
import { createHash } from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_CLIENT_FRAME = 4096;

function frame(opcode, payload = Buffer.alloc(0)) {
  const length = payload.length;
  const header = length < 126 ? Buffer.from([0x80 | opcode, length])
    : length < 65536 ? Buffer.from([0x80 | opcode, 126, length >> 8, length & 0xff])
    : Buffer.concat([Buffer.from([0x80 | opcode, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(length)); return b; })()]);
  return Buffer.concat([header, payload]);
}

export class WebSocketConnection {
  constructor(socket) {
    this.socket = socket;
    this.open = true;
    this.closeHandlers = [];
    this.buffer = Buffer.alloc(0);
    socket.on('data', chunk => this.onData(chunk));
    socket.on('close', () => this.finish());
    socket.on('error', () => this.finish());
    socket.setNoDelay?.(true);
  }

  send(message) {
    if (!this.open) return;
    this.socket.write(frame(0x1, Buffer.from(JSON.stringify(message))));
  }

  ping() { if (this.open) this.socket.write(frame(0x9)); }

  close(code = 1000) {
    if (!this.open) return;
    const payload = Buffer.alloc(2); payload.writeUInt16BE(code);
    this.socket.end(frame(0x8, payload));
    this.finish();
  }

  onClose(handler) { this.closeHandlers.push(handler); }

  finish() {
    if (!this.open) return;
    this.open = false;
    for (const handler of this.closeHandlers) handler();
  }

  // Client frames are masked; only control frames matter here.
  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const opcode = this.buffer[0] & 0x0f;
      const masked = (this.buffer[1] & 0x80) !== 0;
      let length = this.buffer[1] & 0x7f, offset = 2;
      if (length === 126) { if (this.buffer.length < 4) return; length = this.buffer.readUInt16BE(2); offset = 4; }
      else if (length === 127) { this.close(1009); return; }
      if (!masked || length > MAX_CLIENT_FRAME) { this.close(1002); return; }
      if (this.buffer.length < offset + 4 + length) return;
      const mask = this.buffer.subarray(offset, offset + 4);
      const payload = Buffer.from(this.buffer.subarray(offset + 4, offset + 4 + length)).map((byte, i) => byte ^ mask[i % 4]);
      this.buffer = this.buffer.subarray(offset + 4 + length);
      if (opcode === 0x8) { this.close(); return; }
      if (opcode === 0x9) this.socket.write(frame(0xa, Buffer.from(payload)));
    }
  }
}

// Completes the HTTP upgrade handshake; returns null (and rejects) for non-WebSocket requests.
export function acceptWebSocket(request, socket) {
  const key = request.headers['sec-websocket-key'];
  if (request.method !== 'GET' || String(request.headers.upgrade).toLowerCase() !== 'websocket' || !key || request.headers['sec-websocket-version'] !== '13') {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    return null;
  }
  const accept = createHash('sha1').update(key + GUID).digest('base64');
  socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept}`, '', ''].join('\r\n'));
  return new WebSocketConnection(socket);
}
