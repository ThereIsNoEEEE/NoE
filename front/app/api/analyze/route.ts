// Empty results keep the reference's local rule-based fallback active.
// Replace with a server-side AI provider when its credentials are configured.
export async function POST() {
  return Response.json({ results: [] });
}
