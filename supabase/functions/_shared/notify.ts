import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { adminNotificationEmail, customerConfirmationEmail, customerReceiptEmail, customerRejectionEmail, type Order } from "./email.ts";

export type Kind = "admin_notification" | "customer_receipt" | "customer_confirmation" | "customer_rejection";
export const KINDS: Kind[] = ["admin_notification", "customer_receipt", "customer_confirmation", "customer_rejection"];

// Šalje e-mail putem Resenda (samo na serveru) i UVIJEK upisuje rezultat u email_log.
// Nikada ne baca iznimku – neuspjeh e-maila ne smije utjecati na spremljenu narudžbu.
export async function sendOrderEmail(sb: SupabaseClient, orderId: string, kind: Kind): Promise<{ ok: boolean; error?: string }> {
  const adminEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL") ?? "irengel@ftrr.hr";
  let recipient = adminEmail;
  try {
    const { data, error } = await sb.from("orders").select("*, items:order_items(product_name, quantity, unit_price, line_total)").eq("id", orderId).single();
    if (error || !data) throw new Error("Narudžba nije pronađena");
    const order = data as unknown as Order;
    const cfg = { siteUrl: Deno.env.get("SITE_URL") ?? "https://vinumacademicum.ftrr.hr", logoUrl: Deno.env.get("EMAIL_LOGO_URL") || undefined, adminEmail };

    const mail = kind === "admin_notification" ? adminNotificationEmail(order, cfg)
      : kind === "customer_receipt" ? customerReceiptEmail(order, cfg)
      : kind === "customer_confirmation" ? customerConfirmationEmail(order, cfg)
      : customerRejectionEmail(order, cfg);
    recipient = kind === "admin_notification" ? adminEmail : order.email;

    const apiKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "Vinum Academicum <narudzbe@vinumacademicum.ftrr.hr>";
    if (!apiKey) throw new Error("RESEND_API_KEY nije postavljen");

    const { count } = await sb.from("email_log").select("id", { count: "exact", head: true }).eq("order_id", orderId).eq("kind", kind);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `${orderId}/${kind}/${(count ?? 0) + 1}` },
      body: JSON.stringify({ from, to: [recipient], subject: mail.subject, html: mail.html, reply_to: kind === "admin_notification" ? order.email : adminEmail }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Resend ${res.status}: ${body?.message ?? JSON.stringify(body)}`.slice(0, 500));
    await sb.from("email_log").insert({ order_id: orderId, kind, recipient, status: "sent", provider_message_id: body?.id ?? null });
    return { ok: true };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).slice(0, 500);
    console.error(`E-mail ${kind} za ${orderId} nije poslan:`, msg);
    try { await sb.from("email_log").insert({ order_id: orderId, kind, recipient, status: "failed", error: msg }); } catch (_) { /* ignore */ }
    return { ok: false, error: msg };
  }
}
