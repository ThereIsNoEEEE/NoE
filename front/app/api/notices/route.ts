import { createSampleNotices } from "@/data/notices";
import { normalizeNotices } from "@/services/notices"; // Replace this adapter with the crawler when the backend is connected.
export async function GET() {
  return Response.json({
    items: normalizeNotices(createSampleNotices()),
    source: "sample",
    fetchedAt: new Date().toISOString(),
  });
}
