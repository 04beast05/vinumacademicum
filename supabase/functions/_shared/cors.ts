// Javni obrazac ne koristi kolačiće, pa se Origin uvijek vraća natrag.
// Ako se umjesto toga vrati druga domena, preglednik odbije preflight i kupac
// vidi „Nema veze s poslužiteljem”, iako je OPTIONS na poslužitelju prošao.
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const requested = req.headers.get("access-control-request-headers");
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": requested || "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin, Access-Control-Request-Headers",
  };
}
export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
}
