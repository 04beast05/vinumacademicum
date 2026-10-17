// Javna funkcija: kupac šalje narudžbu. Validira sve, sprema atomarno u Postgres (create_order), zatim šalje e-mailove.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { emailOk, oibOk, phoneOk, postalOk, str } from "../_shared/validate.ts";
import { sendOrderEmail } from "../_shared/notify.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Metoda nije dopuštena." }, 405);

  try {
    const b = await req.json();
    if (b.web) return json(req, { ok: true }); // honeypot – botovi popune skriveno polje

    const type = b.customer_type === "company" ? "company" : "individual";
    const p: Record<string, unknown> = {
      idempotency_key: str(b.idempotency_key, 80) || null,
      customer_type: type,
      email: str(b.email, 120), phone: str(b.phone, 30),
      pickup_method: b.pickup_method === "delivery" ? "delivery" : "ftrr",
      customer_note: str(b.customer_note, 1500),
    };
    const err = (m: string) => json(req, { error: m }, 400);

    if (!emailOk(p.email as string)) return err("Unesite ispravnu e-mail adresu.");
    if (!phoneOk(p.phone as string)) return err("Unesite ispravan broj mobitela.");
    if (b.gdpr_consent !== true) return err("Potrebno je prihvatiti Politiku privatnosti.");

    if (type === "individual") {
      p.first_name = str(b.first_name, 60); p.last_name = str(b.last_name, 60);
      if (!p.first_name || !p.last_name) return err("Unesite ime i prezime.");
    } else {
      p.company_name = str(b.company_name, 160); p.oib = str(b.oib, 11);
      p.street_address = str(b.street_address, 160); p.postal_code = str(b.postal_code, 10); p.city = str(b.city, 80);
      p.contact_first_name = str(b.contact_first_name, 60); p.contact_last_name = str(b.contact_last_name, 60);
      if (!p.company_name || !p.street_address || !p.city || !p.contact_first_name || !p.contact_last_name) return err("Ispunite sva obvezna polja za pravnu osobu.");
      if (!oibOk(p.oib as string)) return err("Unesite ispravan OIB.");
      if (!postalOk(p.postal_code as string)) return err("Unesite ispravan poštanski broj (5 znamenki).");
    }

    // stavke: zbroji duplikate; naziv i cijenu server uzima iz tablice products
    if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > 40) return err("Košarica je prazna.");
    const agg = new Map<string, number>();
    for (const it of b.items) {
      const id = str(it?.product_id, 120), q = Math.floor(Number(it?.quantity));
      if (!/^[a-z0-9-]+$/.test(id) || !(q >= 1 && q <= 1200)) return err("Neispravna stavka narudžbe.");
      agg.set(id, (agg.get(id) ?? 0) + q);
    }
    p.items = [...agg].map(([product_id, quantity]) => ({ product_id, quantity }));

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data, error } = await sb.rpc("create_order", { p });
    if (error) {
      const m = error.message ?? "";
      if (m.includes("RATE_LIMIT")) return json(req, { error: "Previše narudžbi u kratkom vremenu. Pokušajte kasnije ili nas nazovite." }, 429);
      if (m.includes("INVALID_PRODUCT")) return json(req, { error: "Neko od odabranih vina trenutno nije dostupno. Osvježite stranicu i pokušajte ponovno." }, 400);
      if (m.includes("INVALID_ITEMS")) return err("Neispravna stavka narudžbe.");
      console.error("create_order:", error);
      return json(req, { error: "Spremanje narudžbe nije uspjelo. Pokušajte ponovno." }, 500);
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row.existed) return json(req, { ok: true, order_number: row.o_number, duplicate: true }); // ponovljeni klik – bez novih e-mailova

    // Narudžba JE spremljena. E-mailovi su sekundarni: njihov neuspjeh se samo bilježi (email_log) i ne ruši odgovor.
    const [adm, cust] = await Promise.all([
      sendOrderEmail(sb, row.o_id, "admin_notification"),
      sendOrderEmail(sb, row.o_id, "customer_receipt"),
    ]);
    return json(req, { ok: true, order_number: row.o_number, email_admin: adm.ok, email_customer: cust.ok });
  } catch (e) {
    console.error(e);
    return json(req, { error: "Došlo je do greške. Pokušajte ponovno." }, 500);
  }
});
