// Notices come from Qdrant via the backend. On failure the client falls back to sample data.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8001";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const upstream = await fetch(new URL("/api/db/notices", BACKEND_URL), {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);
    const data = await upstream.json();
    return Response.json({ items: data.items, source: "qdrant", fetchedAt: data.fetchedAt });
  } catch {
    return Response.json(
      { error: { code: "NOTICES_UNAVAILABLE", message: "공지 데이터를 불러오지 못했습니다." } },
      { status: 502 },
    );
  }
}
