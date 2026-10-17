# Vinum Academicum – sustav narudžbi: upute za puštanje u rad

Cilj: kupac napuni košaricu → pošalje narudžbu → ona se sprema u Supabase → `imalcic@ftrr.hr` dobiva dizajniran e-mail s poveznicom na `/admin/` → vinarija nazove kupca → u panelu jednim klikom potvrdi → kupac dobije e-mail potvrde.

Trebate: Supabase račun, Resend račun, Node.js (za Supabase CLI), pristup hostingu stranice. Procijenjeno vrijeme: 45–60 min (bez čekanja na DNS).

---
## 0. Što je u paketu

| Datoteka | Namjena |
|---|---|
| `index.html`, `kontakt.html`, `kosarica.html`, `gdpr.html` | stranice (kosarica.html i gdpr.html su nove/izmijenjene) |
| `assets/kosarica.js`, `assets/kosarica.css` | košarica, obrazac, pregled, slanje |
| `assets/sekcije.css/js`, `assets/img/partneri/` | ranije napravljene sekcije (priča, restorani) |
| `admin/index.html`, `admin/admin.js`, `admin/admin.css` | administratorski panel (`/admin/`) |
| `supabase/migrations/001_narudzbe.sql` | tablice, RLS, funkcije |
| `supabase/migrations/002_proizvodi.sql` | popis 14 vina (cijene unosite u njoj ili u panelu) |
| `supabase/functions/posalji-narudzbu/` | javna funkcija: prima narudžbu |
| `supabase/functions/admin-order-action/` | admin funkcija: status, potvrda, e-mailovi |
| `supabase/functions/_shared/` | e-mail predlošci (`email.ts`), slanje (`notify.ts`), validacija |
| `supabase/config.toml` | postavke funkcija |
| `docs/primjeri-emailova/*.html` | otvorite u pregledniku da vidite izgled svih 5 e-mailova |

**Stari `supabase/schema.sql` i tablica `narudzbe` iz prve verzije se više NE koriste** (ako ste ih već pokrenuli, tablicu možete obrisati: `drop table if exists public.narudzbe;`).

---
## 1. Supabase

### 1.1 Projekt
1. supabase.com → **New project**. Region: **EU (Frankfurt)** (zbog GDPR-a; Politika privatnosti tvrdi da su podaci u EU). Spremite lozinku baze.
2. Kad se projekt kreira: **Project Settings → API**. Zapišite:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon / publishable key** (smije biti javan)
   - **service_role key** – TAJAN, nikad ga ne stavljajte u HTML/JS. Ne trebate ga nigdje upisivati: Edge funkcije ga dobivaju automatski.
   - **Project ref** = dio adrese prije `.supabase.co`.

### 1.2 Baza
1. **SQL Editor → New query** → zalijepite cijeli `001_narudzbe.sql` → **Run**. (Poruke "does not exist, skipping" su normalne.)
2. Novi query → `002_proizvodi.sql` → **Run**.
3. Provjera: **Table Editor** mora imati `products` (14 redaka), `orders`, `order_items`, `order_status_history`, `email_log`, `admins`. Uz `orders` ne smije stajati upozorenje "RLS disabled".

### 1.3 Cijene vina
Cijene su **jedini izvor istine u tablici `products`** – server po njima računa narudžbu i klijent ih ne može krivotvoriti. Dva načina:
- SQL: `update public.products set price = 9.50 where id = 'grasevina';` (decimalna točka),
- ili poslije u panelu: kartica **Cijene vina** (preporučeno).

Dok je cijena prazna, vino se prikazuje bez cijene, a u košarici/e-mailovima piše "cijena prema ponudi". Ukupan iznos prikazuje se samo kad **sva** vina u narudžbi imaju cijenu.
Kartice na početnoj stranici **prikazuju cijenu iz baze** čim se stranica učita (isti iznos kao košarica i narudžba). Iznos u HTML-u je samo rezerva dok se baza ne učita, ili ako do baze nema veze. Cijene mijenjajte u panelu, kartica **Cijene vina**.

### 1.4 Autentifikacija – zaključavanje
1. **Authentication → Sign In / Providers → Email**: isključite **"Allow new users to sign up"** (nema samostalne registracije). Postavite **minimalnu duljinu lozinke na 12**.
2. **Authentication → URL Configuration**: *Site URL* = `https://vinumacademicum.ftrr.hr`; u *Redirect URLs* dodajte `https://vinumacademicum.ftrr.hr/admin/` (i `https://www.…/admin/` ako se koristi).

### 1.5 Administratorski račun (siguran postupak)
1. **Authentication → Users → Add user → Create new user**: e-mail `imalcic@ftrr.hr`, **privremena** lozinka (generirajte dugu, npr. iz upravitelja lozinki), uključite **Auto Confirm User**. Lozinku NE zapisujte u kod ni u chat.
2. **SQL Editor**: 
```sql
insert into public.admins (user_id, email)
select id, email from auth.users where email = 'imalcic@ftrr.hr';
```
3. Pri prvoj prijavi na `/admin/` panel **prisiljava na postavljanje vlastite lozinke** (min. 12 znakova) prije pristupa. "Zaboravljena lozinka?" šalje poveznicu za oporavak (traži ispravne Redirect URLs iz 1.4 i da Supabase može slati e-mail; za veći volumen postavite SMTP – vidi 2.4).
4. Samo korisnici iz tablice `admins` mogu išta vidjeti – drugi prijavljeni korisnici dobivaju prazno/odbijeno i na razini baze (RLS) i na serveru.

---
## 2. Resend (e-mailovi)

### 2.1 Račun i ključ
resend.com → registracija → **API Keys → Create API Key** (Sending access). Ključ se vidi samo jednom.

### 2.2 Pošiljatelj (OBAVEZNO prije produkcije)
`RESEND_FROM_EMAIL` mora biti adresa na **verificiranoj domeni**:
1. Resend → **Domains → Add Domain** (npr. `ftrr.hr` ili posebna domena vinarije).
2. Resend prikaže DNS zapise (SPF/DKIM, MX). **Njih mora dodati osoba koja upravlja DNS-om te domene (IT službe fakulteta).** Pošaljite im zaslon s tim zapisima.
3. Kad domena postane *Verified*, koristite npr. `Vinum Academicum <narudzbe@ftrr.hr>`.

> **Do verifikacije:** možete testirati s `onboarding@resend.dev`, ali Resend tada šalje **samo na e-mail računa s kojim ste se registrirali**. Zato bi obavijest vinariji stigla (ako je račun otvoren na imalcic@ftrr.hr), ali **potvrde kupcima neće**. Nemojte u produkciju bez verificirane domene.

### 2.3 Logo u e-mailu (neobavezno)
E-mail klijenti ne podržavaju SVG. Izvezite logo kao **PNG** (bijeli logo, prozirna ili crna pozadina, ~360 px širine), postavite ga na stranicu (npr. `assets/img/vinumlogo-email.png`) i postavite `EMAIL_LOGO_URL=https://vinumacademicum.ftrr.hr/assets/img/vinumlogo-email.png`. Bez toga se koristi tekstualni logotip "VINUM ACADEMICUM".

### 2.4 Oporavak lozinke (neobavezno)
Supabase ugrađeni e-mail ima stroga ograničenja. Za pouzdan oporavak lozinke: **Project Settings → Auth → SMTP Settings** → unesite Resend SMTP (host `smtp.resend.com`, port 465, user `resend`, lozinka = API ključ).

---
## 3. Edge funkcije i varijable okruženja

### 3.1 Instalacija CLI-ja i deploy
```bash
npm i -g supabase
supabase login
cd <mapa-projekta>            # mora sadržavati mapu supabase/ iz ovog paketa
supabase link --project-ref VAS_PROJECT_REF
```

### 3.2 Tajne (serverske varijable) – nikad u frontend kod
```bash
supabase secrets set \
  RESEND_API_KEY="re_xxxxxxxxxxxx" \
  RESEND_FROM_EMAIL="Vinum Academicum <narudzbe@VASA-VERIFICIRANA-DOMENA>" \
  ADMIN_NOTIFICATION_EMAIL="imalcic@ftrr.hr" \
  SITE_URL="https://vinumacademicum.ftrr.hr" \
  ALLOWED_ORIGINS="https://vinumacademicum.ftrr.hr,https://www.vinumacademicum.ftrr.hr" \
  EMAIL_LOGO_URL="https://vinumacademicum.ftrr.hr/assets/img/vinumlogo-email.png"
```
(Isto možete u dashboardu: **Edge Functions → Secrets**.)

| Varijabla | Što je | Obavezno |
|---|---|---|
| `RESEND_API_KEY` | Resend API ključ | da |
| `RESEND_FROM_EMAIL` | pošiljatelj na verificiranoj domeni | da |
| `ADMIN_NOTIFICATION_EMAIL` | primatelj narudžbi (zadano `imalcic@ftrr.hr`) | ne |
| `SITE_URL` | osnova za poveznicu na `/admin/` u e-mailu | da (provjerite da odgovara stvarnoj domeni) |
| `ALLOWED_ORIGINS` | domene s kojih se smije slati narudžba (CORS) | preporučeno; bez toga je otvoreno za sve |
| `EMAIL_LOGO_URL` | PNG logo za e-mail | ne |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | **Supabase ih sam postavlja** | – |

### 3.3 Deploy
```bash
supabase functions deploy posalji-narudzbu --no-verify-jwt
supabase functions deploy admin-order-action --no-verify-jwt
```
`--no-verify-jwt` je namjerno: obje funkcije same provjeravaju pozivatelja (javna: validacija + honeypot + ograničenje učestalosti; admin: Supabase Auth JWT + tablica `admins`), a tako rade i s novim "publishable" ključevima.

---
## 4. Stranica (hosting)

1. U **`assets/kosarica.js`** i **`admin/admin.js`** na vrhu zamijenite:
   ```js
   var SUPABASE_URL = 'https://XXXXXXXX.supabase.co';   // → vaš Project URL
   var SUPABASE_ANON_KEY = 'ANON_PUBLIC_KEY';            // → anon/publishable ključ
   ```
2. Na hosting prenesite: `index.html`, `kontakt.html`, `kosarica.html`, `gdpr.html`, cijelu mapu `assets/` (uključujući `assets/img/partneri/`) i mapu `admin/`. Mapa `supabase/` i `docs/` **ne smiju** biti javno dostupne (nisu potrebne na hostingu).
3. Panel je na `https://vinumacademicum.ftrr.hr/admin/` (poveznica u e-mailu: `/admin/#order=ID`). Ako hosting ne servira `index.html` za mapu, koristite `/admin/index.html`. Panel ima `noindex`, ali **sigurnost ne ovisi o skrivenosti URL-a** nego o prijavi + RLS-u.
4. HTTPS mora biti uključen (Supabase prijava i e-mail poveznice to traže).
5. Supabase paket: besplatni projekti se pauziraju nakon 7 dana neaktivnosti – za produkciju razmislite o Pro planu.

---
## 5. Probni test na produkciji (10 min) – obavezno prije objave
1. U panelu → **Cijene vina** upišite barem dvije cijene.
2. Na stranici dodajte vina u košaricu, ispunite obrazac **kao fizička osoba** s VAŠIM e-mailom → pregled → **Pošalji narudžbu**. Očekivano: stranica zahvale s brojem `VA-2026-00001`.
3. Provjerite: red u `orders` + `order_items` + `order_status_history`; dva e-maila (vinariji i vama kao kupcu) i zapisi u `email_log` sa statusom `sent`.
4. Klik "Otvori u panelu" u e-mailu → prijava → detalji narudžbe → **Označi kao kontaktirano** → **Potvrdi narudžbu** (izmijenite količinu, upišite poruku) → stigne e-mail potvrde s izmijenjenim stavkama.
5. Ponovite kao **pravna osoba** (stvarni OIB), zatim **Odbij**.
6. Provjerite u anonimnom prozoru da `https://xxxx.supabase.co/rest/v1/orders?select=*` s anon ključem vraća `[]` (ili 401), a ne narudžbe.
7. Ako e-mail ne stigne: panel → detalj narudžbe → "E-mailovi" prikazuje točnu grešku Resenda i gumb **Pošalji ponovno**. Najčešći uzrok: domena nije verificirana ili `RESEND_FROM_EMAIL` ne odgovara domeni.

Brisanje testnih narudžbi: SQL Editor → `delete from public.orders;` (kaskadno briše stavke, povijest i log).

---
## 6. Održavanje i GDPR
- Automatsko brisanje neostvarenih narudžbi starijih od 24 mjeseca: omogućite ekstenziju **pg_cron** (Database → Extensions) i pokrenite redak iz dna `001_narudzbe.sql` (`cron.schedule(...)`). Ostvarene narudžbe ostaju dulje zbog zakonskih obveza. Rokove i tekst `gdpr.html` uskladite s pravnom službom fakulteta.
- Zahtjev ispitanika za brisanje: `delete from public.orders where lower(email) = 'kupac@…';`
- Rotacija ključeva: ako sumnjate na curenje, u Supabaseu/Resendu generirajte novi ključ i ponovno `supabase secrets set`.
- Zaštita od spama trenutno: honeypot polje + ograničenje (3 narudžbe/sat po e-mailu, 60/sat ukupno) + serverska validacija. Ako se pojavi zlouporaba, dodajte Cloudflare Turnstile (traži Cloudflare račun).

---
## 7. Što je TESTIRANO, a što NIJE

**Testirano (u sandboxu, bez vaših računa):**
- SQL migracije izvršene na stvarnom PostgreSQL-u 16: tablice/ograničenja se kreiraju; narudžba kreirana s cijenama iz baze (6×9,50 + 2×12 = 81,00); idempotentni ponovljeni zahtjev vraća istu narudžbu; nepostojeći proizvod odbijen bez zaostalih redaka; rate limit; prijelazi statusa kontaktirano → potvrđeno → izvršeno uz povijest; dvostruka potvrda vraća `changed=false`; nedozvoljeni prijelaz odbijen; RLS: anon i neadministrator ne vide narudžbe i ne smiju zvati funkcije, administrator vidi i može mijenjati cijene, a ne može brisati narudžbe izravno. (U testu su Supabase uloge `anon/authenticated/service_role` i `auth.uid()` simulirani.)
- Frontend košarica/obrazac u simuliranom pregledniku (jsdom): cijene i ukupno, validacija (e-mail, telefon, OIB kontrolna znamenka, poštanski broj), pregled i povratak uz sačuvane podatke, jedan zahtjev pri višestrukom kliku, košarica se briše tek nakon uspjeha i ostaje nakon greške, ispravni payload fizičke i pravne osobe (20/20 provjera).
- Edge funkcije s lažiranim Supabaseom i Resendom: validacija, honeypot, zbrajanje duplikata, e-mailovi (primatelj/predmet/reply-to), neuspjeh e-maila ne ruši narudžbu i bilježi se u `email_log`, 401/403 za neprijavljene/neadministratore, e-mail kupcu samo kad se status stvarno promijenio (31/31).
- Admin panel u jsdom-u s lažiranim Supabaseom: prijava, obvezna promjena lozinke, odbijanje računa izvan `admins`, nadzorna ploča, filtri, detalji i `#order=ID`, modal potvrde s uređivanjem stavki, XSS escapanje (17/17).
- HTML svih 5 e-mailova generiran (`docs/primjeri-emailova/`).

**NIJE testirano i ne može se tvrditi dok ne napravite korake iz odjeljka 5:**
- Stvarni Supabase projekt (deploy funkcija, Auth prijava, Auth e-mail za oporavak lozinke).
- Stvarno slanje putem Resenda i izgled e-mailova u Gmailu/Outlooku/mobilnim klijentima.
- Rad na produkcijskoj domeni, vizualni izgled `kosarica.html` i `/admin/` na stvarnim uređajima (testirana je logika, ne izgled).
- Deno runtime funkcija (kod je provjeren transpilacijom i simuliran u Nodeu).

---
## 8. Što traži pristup koji ja nemam
| Korak | Tko |
|---|---|
| DNS zapisi za verifikaciju domene u Resendu (SPF/DKIM) | administrator DNS-a / IT fakulteta |
| Prijenos datoteka na hosting; HTTPS; da `/admin/` radi | administrator hostinga |
| Supabase i Resend računi, ključevi, `supabase secrets set`, `functions deploy` | vi |
| Kreiranje admin korisnika u Supabase Auth + `insert into admins` | vi |
| Pravna provjera `gdpr.html` i rokova čuvanja | pravna služba / službenik za zaštitu podataka |
