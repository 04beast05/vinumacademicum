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
  const th = (t: string, a = "left") => `<td align="${a}" style="padding:0 0 10px;font-size:9px;letter-spacing:1.3px;text-transform:uppercase;color:#777777;border-bottom:1px solid #111111;">${t}</td>`;
  const rows = o.items.map((i) => `<tr>
    <td style="padding:16px 8px 16px 0;border-bottom:1px solid #e8e8e8;font-size:12px;line-height:1.6;color:#111111;text-transform:uppercase;letter-spacing:.35px;">${esc(i.product_name)}</td>
    <td align="right" style="padding:16px 0 16px 8px;border-bottom:1px solid #e8e8e8;font-size:12px;line-height:1.6;color:#333333;">${qtyText(i.quantity, showPrice ? i.line_total : null, o.currency)}</td>
    ${showPrice ? `<td align="right" style="padding:16px 0 16px 12px;border-bottom:1px solid #e8e8e8;font-size:12px;color:#333333;white-space:nowrap;">${eur(i.unit_price!, o.currency)}</td>
    <td align="right" style="padding:16px 0 16px 12px;border-bottom:1px solid #e8e8e8;font-size:12px;font-weight:bold;color:#111111;white-space:nowrap;">${eur(i.line_total!, o.currency)}</td>` : ""}
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

const button = (href: string, label: string, filled: boolean) => `<td align="center" valign="top" style="width:50%;padding:0 5px;">
  <a href="${esc(href)}" style="display:block;padding:15px 9px;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.5;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;text-decoration:none;${filled ? "background:#050505;color:#ffffff;border:1px solid #050505;" : "background:#ffffff;color:#050505;border:1px solid #050505;"}">${label}</a></td>`;

const label = (t: string) => `<div style="font-size:10px;line-height:1.5;letter-spacing:2px;color:#777777;text-transform:uppercase;margin-bottom:13px;padding-bottom:9px;border-bottom:1px solid #d8d8d8;">${t}</div>`;

function layout(cfg: Cfg, opt: { preheader: string; kicker: string; badge?: string; inner: string }): string {
  // cfg.logoUrl može pokazivati na javno dostupan SVG ili PNG.
  // Za e-mail je potreban apsolutni HTTPS URL; relativne putanje poput assets/img/... ne rade.
  // SVG podrška ovisi o e-mail klijentu, pa je PNG sigurnija rezervna opcija.
  const logo = cfg.logoUrl
    ? `<img src="${esc(cfg.logoUrl)}" alt="Vinum Academicum" width="190" style="display:block;width:190px;max-width:100%;height:auto;margin:0 auto;border:0;outline:none;text-decoration:none;">`
    : `<div style="font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:1.3;letter-spacing:4px;color:#ffffff;text-transform:uppercase;">Vinum Academicum</div>`;
  return `<!DOCTYPE html><html lang="hr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:0;background:#eeeeee;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#eeeeee;font-size:1px;line-height:1px;">${esc(opt.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#eeeeee;">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
    <tr><td align="center" style="background:#050505;padding:42px 28px 34px;border-bottom:4px solid #d8d8d8;">
      ${logo}
      <div style="margin-top:20px;font-size:9px;line-height:1.6;letter-spacing:3px;color:#b8b8b8;text-transform:uppercase;">${opt.kicker}</div>
      ${opt.badge ? `<div style="margin-top:18px;"><span style="display:inline-block;padding:8px 13px;border:1px solid #777777;color:#ffffff;font-size:9px;line-height:1.4;letter-spacing:2px;text-transform:uppercase;">${opt.badge}</span></div>` : ""}
    </td></tr>
    ${opt.inner}
    <tr><td style="padding:0 36px;"><div style="height:1px;background:#e7e7e7;font-size:1px;line-height:1px;">&nbsp;</div></td></tr>
    <tr><td align="center" style="background:#050505;padding:27px 24px 30px;font-size:10px;line-height:1.9;letter-spacing:1px;color:#a3a3a3;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;letter-spacing:2px;color:#ffffff;margin-bottom:8px;">VINUM ACADEMICUM</div>
      <div style="text-transform:uppercase;font-size:9px;letter-spacing:1.5px;">Vinum Academicum d.o.o. &middot; ${WINERY.hq}</div>
      <div style="margin-top:10px;">
        <a href="tel:+385995226371" style="color:#ffffff;text-decoration:none;white-space:nowrap;">&#9742;&nbsp; ${WINERY.phone}</a>
        <span style="color:#666666;">&nbsp;&nbsp;|&nbsp;&nbsp;</span>
        <a href="mailto:${WINERY.email}" style="color:#ffffff;text-decoration:none;">${WINERY.email}</a>
      </div>
    </td></tr>
  </table>
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.6;color:#888888;text-align:center;padding:14px 12px 0;">Automatska poruka sustava Vinum Academicum.</div>
</td></tr></table></body></html>`;
}

const section = (html: string, top = 30) => `<tr><td style="padding:${top}px 36px 0;">${html}</td></tr>`;
const note = (title: string, text: string) => section(`${label(title)}<div style="font-size:13px;line-height:1.8;color:#333333;background:#f5f5f5;border-left:3px solid #111111;padding:17px 18px;">${esc(text).replace(/\n/g, "<br>")}</div>`);
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
