// Čisti generatori HTML e-mailova (bez Deno API-ja – mogu se testirati i izvan Supabasea).
// Dizajn: crno-bijeli, uredničke serife (Georgia) + sans (Arial) – web-fontovi nisu pouzdani u e-mail klijentima.

export interface Item { product_name: string; quantity: number; unit_price: number | null; line_total: number | null }
export interface Order {
  id: string; order_number: string; customer_type: "individual" | "company"; status: string;
  first_name: string | null; last_name: string | null; company_name: string | null; oib: string | null;
  street_address: string | null; postal_code: string | null; city: string | null;
  contact_first_name: string | null; contact_last_name: string | null;
  email: string; phone: string; pickup_method: "ftrr" | "delivery"; customer_note: string | null;
  total_amount: number | null; currency: string; final_message: string | null; rejection_reason: string | null;
  created_at: string; confirmed_at: string | null; items: Item[];
}
export interface Cfg { siteUrl: string; logoUrl?: string; adminEmail: string }

const KARTON = 6;
export const WINERY = { name: "Vinum Academicum", phone: "+385 99 271 0088", email: "imalcic@ftrr.hr",
  hq: "Vukovarska ul. 17, 34000 Požega", shop: "Cehovska ul. 1, 34000 Požega" };

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export const eur = (n: number, cur = "EUR") => n.toFixed(2).replace(".", ",") + (cur === "EUR" ? " €" : " " + cur);
export const when = (iso: string) => new Date(iso).toLocaleString("hr-HR", { timeZone: "Europe/Zagreb", dateStyle: "long", timeStyle: "short" });
export const pickupText = (m: string) => m === "ftrr"
  ? "Osobno preuzimanje – FTRR (Fakultet turizma i ruralnog razvoja), Vukovarska 17, Požega"
  : "Dostava / preuzimanje po dogovoru (detalji se naknadno dogovaraju s vinarijom)";
export const typeText = (t: string) => t === "company" ? "Pravna osoba" : "Fizička osoba";
export const customerName = (o: Order) => o.customer_type === "company" ? (o.company_name ?? "") : `${o.first_name ?? ""} ${o.last_name ?? ""}`.trim();
export const contactName = (o: Order) => o.customer_type === "company" ? `${o.contact_first_name ?? ""} ${o.contact_last_name ?? ""}`.trim() : customerName(o);
const bottles = (o: Order) => o.items.reduce((a, i) => a + i.quantity, 0);
const priced = (o: Order) => o.total_amount !== null && o.items.every((i) => i.unit_price !== null);

function qtyText(k: number, lineTotal: number | null, currency: string): string {
  const kart = Math.floor(k / KARTON), ost = k % KARTON, p: string[] = [];
  if (kart) p.push(`${kart} ${kart === 1 ? "karton" : "kartona"}`);
  if (ost) p.push(`${ost} boca`);
  const iznos = lineTotal != null
    ? `<div style="margin-top:6px;font-weight:bold;color:#1a1a1a;white-space:nowrap;">${eur(lineTotal, currency)} <span style="font-weight:normal;color:#868686;">s PDV-om</span></div>`
    : "";
  return `<b>${k} boca</b>` + (kart ? ` <span style="color:#868686;">(${p.join(" + ")})</span>` : "") + iznos;
}

function itemsTable(o: Order): string {
  const showPrice = priced(o);
  const th = (t: string, a = "left") => `<td align="${a}" style="padding:0 0 8px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#868686;border-bottom:1px solid #1a1a1a;">${t}</td>`;
  const rows = o.items.map((i) => `<tr>
    <td style="padding:14px 8px 14px 0;border-bottom:1px solid #ececec;font-size:13px;color:#1a1a1a;text-transform:uppercase;letter-spacing:.3px;">${esc(i.product_name)}</td>
    <td align="right" style="padding:14px 0 14px 8px;border-bottom:1px solid #ececec;font-size:13px;color:#494949;">${qtyText(i.quantity, showPrice ? i.line_total : null, o.currency)}</td>
    ${showPrice ? `<td align="right" style="padding:14px 0 14px 12px;border-bottom:1px solid #ececec;font-size:13px;color:#494949;white-space:nowrap;">${eur(i.unit_price!, o.currency)}</td>
    <td align="right" style="padding:14px 0 14px 12px;border-bottom:1px solid #ececec;font-size:13px;font-weight:bold;color:#1a1a1a;white-space:nowrap;">${eur(i.line_total!, o.currency)}</td>` : ""}
  </tr>`).join("");
  const total = showPrice
    ? `<td align="right" colspan="2" style="padding:18px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#000;white-space:nowrap;">${eur(o.total_amount!, o.currency)}<div style="margin-top:4px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#868686;">s PDV-om</div></td>`
    : `<td align="right" style="padding:18px 0 0;font-size:12px;color:#868686;">Cijena prema ponudi</td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>${th("Vino")}${th("Količina", "right")}${showPrice ? th("Cijena / boca", "right") + th("Iznos s PDV-om", "right") : ""}</tr>
    ${rows}
    <tr><td colspan="${showPrice ? 1 : 1}" style="padding:18px 0 0;font-size:12px;color:#868686;text-transform:uppercase;letter-spacing:1px;">Ukupno ${bottles(o)} boca (${(bottles(o) / KARTON).toFixed(1).replace(".", ",")} kartona)</td>${showPrice ? total : total}</tr>
  </table>`;
}

const button = (href: string, label: string, filled: boolean) => `<td align="center" style="padding:0 6px;">
  <a href="${esc(href)}" style="display:block;padding:16px 10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;${filled ? "background:#000;color:#fff;border:1px solid #000;" : "background:#fff;color:#000;border:1px solid #000;"}">${label}</a></td>`;

const label = (t: string) => `<div style="font-size:11px;letter-spacing:2px;color:#868686;text-transform:uppercase;margin-bottom:8px;">${t}</div>`;

function layout(cfg: Cfg, opt: { preheader: string; kicker: string; badge?: string; inner: string }): string {
  const logo = cfg.logoUrl
    ? `<img src="${esc(cfg.logoUrl)}" alt="Vinum Academicum" width="180" style="display:block;margin:0 auto;border:0;max-width:180px;height:auto;">`
    : `<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:6px;color:#ffffff;text-transform:uppercase;">Vinum Academicum</div>`;
  return `<!DOCTYPE html><html lang="hr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f2f2f2;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f2f2f2;">${esc(opt.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:28px 10px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center" style="background:#000000;padding:38px 20px 30px;">${logo}
    <div style="margin-top:14px;font-size:10px;letter-spacing:3px;color:#9a9a9a;text-transform:uppercase;">${opt.kicker}</div>
    ${opt.badge ? `<div style="margin-top:16px;"><span style="display:inline-block;padding:6px 14px;border:1px solid #ffffff;color:#ffffff;font-size:10px;letter-spacing:2px;text-transform:uppercase;">${opt.badge}</span></div>` : ""}
  </td></tr>
  ${opt.inner}
  <tr><td align="center" style="background:#000000;padding:22px 20px;font-size:10px;line-height:1.9;letter-spacing:1.5px;color:#8a8a8a;text-transform:uppercase;">
    Vinum Academicum d.o.o. &middot; ${WINERY.hq}<br>
    <a href="tel:+385995226371" style="color:#8a8a8a;text-decoration:none;">${WINERY.phone}</a> &middot; <a href="mailto:${WINERY.email}" style="color:#8a8a8a;text-decoration:none;">${WINERY.email}</a>
  </td></tr>
</table></td></tr></table></body></html>`;
}

const section = (html: string, top = 28) => `<tr><td style="padding:${top}px 36px 0;">${html}</td></tr>`;
const note = (title: string, text: string) => section(`${label(title)}<div style="font-size:13px;line-height:1.75;color:#494949;background:#f8f8f8;padding:16px 18px;">${esc(text).replace(/\n/g, "<br>")}</div>`);
const kv = (k: string, v: string) => `<span style="color:#868686;">${k}:</span> ${v}<br>`;
const tel = (p: string) => p.replace(/[^\d+]/g, "");

// ---------- 1) Obavijest administratoru o novoj narudžbi ----------
export function adminNotificationEmail(o: Order, cfg: Cfg): { subject: string; html: string } {
  const panel = `${cfg.siteUrl.replace(/\/$/, "")}/admin/#order=${o.id}`;
  const company = o.customer_type === "company"
    ? kv("Tvrtka", esc(o.company_name)) + kv("OIB", esc(o.oib)) + kv("Sjedište", `${esc(o.street_address)}, ${esc(o.postal_code)} ${esc(o.city)}`) + kv("Kontakt osoba", esc(contactName(o)))
    : kv("Kupac", esc(customerName(o)));
  const inner =
    section(`${label(`Narudžba ${esc(o.order_number)}`)}
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;color:#1a1a1a;">${esc(customerName(o))}</div>
      <div style="font-size:12px;color:#868686;margin-top:8px;">Zaprimljeno: ${esc(when(o.created_at))} &middot; ${typeText(o.customer_type)}</div>`, 34) +
    `<tr><td style="padding:26px 30px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      ${button(panel, "Otvori u panelu", true)}${button("tel:" + tel(o.phone), "&#9742;&nbsp; Nazovi kupca", false)}
    </tr></table></td></tr>` +
    section(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ececec;"><tr><td style="padding:18px 20px;font-size:13px;line-height:1.95;color:#1a1a1a;">
      ${company}
      ${kv("E-mail", `<a href="mailto:${esc(o.email)}" style="color:#1a1a1a;">${esc(o.email)}</a>`)}
      ${kv("Mobitel", `<a href="tel:${esc(tel(o.phone))}" style="color:#1a1a1a;">${esc(o.phone)}</a>`)}
      ${kv("Preuzimanje", esc(pickupText(o.pickup_method)))}
    </td></tr></table>`, 26) +
    section(`${label("Naručena vina")}${itemsTable(o)}`, 30) +
    (o.customer_note ? note("Napomena kupca", o.customer_note) : "") +
    section(`<div style="font-size:11px;line-height:1.7;color:#868686;border-top:1px solid #ececec;padding:18px 0 34px;">Narudžba još nije potvrđena. Kontaktirajte kupca, dogovorite detalje, a zatim je potvrdite u administratorskom panelu. Odgovor na ovaj e-mail ide izravno kupcu.</div>`, 30);
  return { subject: `[Vinum Academicum] Nova narudžba #${o.order_number}`, html: layout(cfg, { preheader: `Nova narudžba ${o.order_number} – ${customerName(o)}`, kicker: "Obavijest za vinariju", badge: "Nova narudžba", inner }) };
}

// ---------- 2) Potvrda primitka kupcu ----------
export function customerReceiptEmail(o: Order, cfg: Cfg): { subject: string; html: string } {
  const inner =
    section(`<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#1a1a1a;">Poštovani/a ${esc(contactName(o))},</div>
      <p style="font-size:14px;line-height:1.8;color:#494949;margin:16px 0 0;">hvala vam na narudžbi. Zaprimili smo je pod brojem <b>${esc(o.order_number)}</b>.</p>
      <p style="font-size:14px;line-height:1.8;color:#494949;margin:12px 0 0;"><b>Narudžba još nije konačno potvrđena.</b> Vinarija će vas uskoro kontaktirati radi dogovora o detaljima, nakon čega ćete od nas primiti e-mail s potvrdom.</p>`, 34) +
    section(`${label("Vaša narudžba")}${itemsTable(o)}`, 30) +
    section(`${label("Preuzimanje")}<div style="font-size:13px;line-height:1.75;color:#494949;">${esc(pickupText(o.pickup_method))}</div>`, 26) +
    (o.customer_note ? note("Vaša napomena", o.customer_note) : "") +
    section(`<div style="font-size:12px;line-height:1.8;color:#868686;border-top:1px solid #ececec;padding:18px 0 34px;">Ako imate pitanja, nazovite nas na <a href="tel:+385995226371" style="color:#1a1a1a;">${WINERY.phone}</a> ili nam pišite na <a href="mailto:${WINERY.email}" style="color:#1a1a1a;">${WINERY.email}</a>. Ova poruka ne predstavlja potvrdu narudžbe ni obvezujuću ponudu.</div>`, 30);
  return { subject: `[Vinum Academicum] Zaprimili smo vašu narudžbu #${o.order_number}`, html: layout(cfg, { preheader: `Narudžba ${o.order_number} je zaprimljena.`, kicker: "Potvrda primitka", inner }) };
}

// ---------- 3) Potvrda narudžbe kupcu ----------
export function customerConfirmationEmail(o: Order, cfg: Cfg): { subject: string; html: string } {
  const inner =
    section(`<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#1a1a1a;">Poštovani/a ${esc(contactName(o))},</div>
      <p style="font-size:14px;line-height:1.8;color:#494949;margin:16px 0 0;">s veseljem vam potvrđujemo narudžbu <b>${esc(o.order_number)}</b>${o.confirmed_at ? ` (potvrđeno ${esc(when(o.confirmed_at))})` : ""}. Ispod je konačan popis dogovorenih vina.</p>`, 34) +
    section(`${label("Dogovorena narudžba")}${itemsTable(o)}`, 30) +
    section(`${label("Preuzimanje")}<div style="font-size:13px;line-height:1.75;color:#494949;">${esc(pickupText(o.pickup_method))}</div>`, 26) +
    (o.final_message ? note("Poruka vinarije", o.final_message) : "") +
    section(`<div style="font-size:12px;line-height:1.8;color:#868686;border-top:1px solid #ececec;padding:18px 0 34px;">Za sva pitanja nazovite nas na <a href="tel:+385995226371" style="color:#1a1a1a;">${WINERY.phone}</a> ili pišite na <a href="mailto:${WINERY.email}" style="color:#1a1a1a;">${WINERY.email}</a>. Hvala vam na povjerenju.</div>`, 30);
  return { subject: `[Vinum Academicum] Potvrda narudžbe #${o.order_number}`, html: layout(cfg, { preheader: `Vaša narudžba ${o.order_number} je potvrđena.`, kicker: "Potvrda narudžbe", badge: "Potvrđeno", inner }) };
}

// ---------- 4) Odbijena narudžba ----------
export function customerRejectionEmail(o: Order, cfg: Cfg): { subject: string; html: string } {
  const inner =
    section(`<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#1a1a1a;">Poštovani/a ${esc(contactName(o))},</div>
      <p style="font-size:14px;line-height:1.8;color:#494949;margin:16px 0 0;">zahvaljujemo vam na interesu za naša vina. Nažalost, narudžbu <b>${esc(o.order_number)}</b> ovaj put nismo u mogućnosti realizirati.</p>`, 34) +
    (o.rejection_reason ? note("Poruka vinarije", o.rejection_reason) : "") +
    section(`<div style="font-size:12px;line-height:1.8;color:#868686;border-top:1px solid #ececec;padding:18px 0 34px;">Rado ćemo vam pomoći oko nove narudžbe. Nazovite nas na <a href="tel:+385995226371" style="color:#1a1a1a;">${WINERY.phone}</a> ili pišite na <a href="mailto:${WINERY.email}" style="color:#1a1a1a;">${WINERY.email}</a>.</div>`, 30);
  return { subject: `[Vinum Academicum] Obavijest o narudžbi #${o.order_number}`, html: layout(cfg, { preheader: `Obavijest o narudžbi ${o.order_number}.`, kicker: "Obavijest o narudžbi", inner }) };
}

