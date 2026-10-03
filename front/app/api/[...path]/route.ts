// Proxies /api/* requests without a dedicated route to the backend service.
// The backend stays private (127.0.0.1 / docker network); only this server talks to it.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8001";

async function proxy(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = new URL(`/api/${path.map(encodeURIComponent).join("/")}`, BACKEND_URL);
  target.search = new URL(request.url).search;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const responseHeaders = new Headers();
    for (const name of ["content-type", "cache-control", "x-content-type-options"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json(
      { error: { code: "BACKEND_UNAVAILABLE", message: "백엔드에 연결하지 못했습니다." } },
      { status: 502 },
    );
  }
}

export const dynamic = "force-dynamic";
export { proxy as GET, proxy as POST, proxy as PUT };
