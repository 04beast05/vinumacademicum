// Administratorske radnje nad narudžbom. Provjerava Supabase Auth JWT i tablicu admins,
// status mijenja preko admin_apply, a e-mail kupcu šalje tek kad se status stvarno promijeni.
import { corsHeaders, json } from "../_shared/cors.ts";
import { KINDS, sendOrderEmail, type Kind } from "../_shared/notify.ts";
import { serviceClient } from "../_shared/supabase.ts";

const STATUS_ACTIONS = ["contacted", "confirm", "reject", "complete", "save_note"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Metoda nije dopuštena." }, 405);

  try {
    const header = req.headers.get("Authorization") ?? "";
    const jwt = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!jwt) return json(req, { error: "Prijava je potrebna." }, 401);

    const sb = serviceClient();
    const { data: userData, error: userErr } = await sb.auth.getUser(jwt);
    const user = userData?.user;
    if (userErr || !user) return json(req, { error: "Sesija je istekla. Prijavite se ponovno." }, 401);

    const { data: admin } = await sb.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!admin) return json(req, { error: "Ovaj račun nema administratorske ovlasti." }, 403);

    const b = await req.json().catch(() => ({}));
    const action = String(b.action ?? "");
    const orderId = String(b.order_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json(req, { error: "Nepoznata narudžba." }, 400);

    if (action === "resend_email") {
      const kind = String(b.kind ?? "");
      if (!KINDS.includes(kind as Kind)) return json(req, { error: "Nepoznata vrsta e-maila." }, 400);
      const email = await sendOrderEmail(sb, orderId, kind as Kind);
      return json(req, email.ok ? { ok: true, email } : { ok: false, email, error: email.error }, email.ok ? 200 : 502);
    }

    if (!STATUS_ACTIONS.includes(action)) return json(req, { error: "Nepoznata radnja." }, 400);

    const p: Record<string, unknown> = {
      order_id: orderId,
      action,
      actor_id: user.id,
      actor_email: user.email ?? "",
      note: typeof b.note === "string" ? b.note : "",
      message: typeof b.message === "string" ? b.message : "",
    };
    if (b.pickup_method === "ftrr" || b.pickup_method === "delivery") p.pickup_method = b.pickup_method;
    if (Array.isArray(b.items)) p.items = b.items;

    const { data, error } = await sb.rpc("admin_apply", { p });
    if (error) {
      const m = error.message ?? "";
      if (m.includes("NOT_FOUND")) return json(req, { error: "Narudžba nije pronađena." }, 404);
      if (m.includes("REASON_REQUIRED")) return json(req, { error: "Unesite razlog odbijanja." }, 400);
      if (m.includes("INVALID_TRANSITION")) return json(req, { error: "Taj prijelaz statusa nije dopušten." }, 400);
      if (m.includes("INVALID_ITEMS")) return json(req, { error: "Neispravne stavke narudžbe." }, 400);
      if (m.includes("INVALID_ACTION")) return json(req, { error: "Nepoznata radnja." }, 400);
      console.error("admin_apply:", error);
      return json(req, { error: "Radnja nije uspjela. Pokušajte ponovno." }, 500);
    }

    const row = (data ?? {}) as { changed?: boolean; already?: boolean; status?: string; order_number?: string };
    let email: { ok: boolean; error?: string } | undefined;
    if (row.changed && action === "confirm") email = await sendOrderEmail(sb, orderId, "customer_confirmation");
    if (row.changed && action === "reject") email = await sendOrderEmail(sb, orderId, "customer_rejection");

    return json(req, {
      ok: true,
      already: !!row.already,
      changed: row.changed !== false,
      status: row.status,
      order_number: row.order_number,
      email,
    });
  } catch (e) {
    console.error(e);
    return json(req, { error: "Došlo je do greške. Pokušajte ponovno." }, 500);
  }
});
