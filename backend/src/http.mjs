export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}

export function json(response, status, body, headers = {}) {
  const bytes = Buffer.from(JSON.stringify(body));
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  response.end(bytes);
}

export async function readJson(request, limit = 32 * 1024) {
  if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type: application/json이 필요합니다.');
  }
  if (request.headers['content-encoding'] && request.headers['content-encoding'] !== 'identity') {
    throw new ApiError(415, 'UNSUPPORTED_ENCODING', '압축하지 않은 JSON 본문을 보내 주세요.');
  }
  if (Number(request.headers['content-length']) > limit) throw new ApiError(413, 'BODY_TOO_LARGE', '요청 본문은 32KB 이하만 허용합니다.');
  const body = await new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    const timer = setTimeout(() => fail(new ApiError(408, 'REQUEST_TIMEOUT', '요청 본문 수신 시간이 초과되었습니다.')), 10000);
    function cleanup() { clearTimeout(timer); request.off('data', onData); request.off('end', onEnd); request.off('error', fail); request.off('aborted', onAbort); }
    function fail(error) { cleanup(); request.resume(); reject(error); }
    function onAbort() { fail(new ApiError(400, 'REQUEST_ABORTED', '요청이 중단되었습니다.')); }
    function onData(chunk) { size += chunk.length; if (size > limit) fail(new ApiError(413, 'BODY_TOO_LARGE', '요청 본문은 32KB 이하만 허용합니다.')); else chunks.push(chunk); }
    function onEnd() { cleanup(); resolve(Buffer.concat(chunks).toString('utf8')); }
    request.on('data', onData).on('end', onEnd).on('error', fail).on('aborted', onAbort);
  });
  try { return JSON.parse(body); } catch { throw new ApiError(400, 'INVALID_JSON', '올바른 JSON 본문이 필요합니다.'); }
}
