/* Vinum Academicum – košarica, cijene iz Supabasea, obrazac s pregledom i slanje narudžbe.
   Cijene i nazivi vina dolaze iz tablice `products` (isti izvor koristi i server pri izradi narudžbe). */
(function(){
  // ====== POSTAVKE: Supabase > Project Settings > API (anon/publishable ključ smije biti javan) ======
  var SUPABASE_URL = 'https://XXXXXXXX.supabase.co';
  var SUPABASE_ANON_KEY = 'ANON_PUBLIC_KEY';
  // ================================================================================================

  var CART_KEY = 'va_kosarica_v1', DRAFT_KEY = 'va_obrazac_v1', IDEM_KEY = 'va_idem_v1', KARTON = 6;
  var PICKUP = { ftrr: 'Osobno preuzimanje na FTRR-u (Fakultet za turizam i ruralni razvoj), Vukovarska 17, Požega',
                 delivery: 'Dostava / preuzimanje po dogovoru (veće količine) – detalje naknadno dogovaramo s vinarijom' };
  var configured = SUPABASE_URL.indexOf('XXXXXXXX') === -1;
  var products = {};   // id -> {name, price}

  /* ---------- pomoćne ---------- */
  function load(){ try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch(e){ return []; } }
  function save(c){ try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch(e){} badge(); }
  function slug(s){ return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
  function brojBoca(c){ return c.reduce(function(a,i){ return a + i.qty; },0); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function eur(n){ return n.toFixed(2).replace('.',',') + ' €'; }
  function cijena(id){ var p = products[id]; return p && p.price != null ? Number(p.price) : null; }
  function kartonText(q){ var k = Math.floor(q / KARTON), o = q % KARTON; if (!k) return ''; return k + (k === 1 ? ' karton' : ' kartona') + (o ? ' + ' + o + ' boca' : ''); }
  function ukupno(c){ // null ako je bilo koja stavka bez cijene
    var t = 0; for (var i = 0; i < c.length; i++){ var p = cijena(c[i].id); if (p == null) return null; t += p * c[i].qty; } return t;
  }
  function oibOk(o){
    if (!/^\d{11}$/.test(o)) return false;
    var a = 10; for (var i = 0; i < 10; i++){ a = (a + +o[i]) % 10; if (a === 0) a = 10; a = (a * 2) % 11; }
    var k = 11 - a; if (k === 10) k = 0; return k === +o[10];
  }
  function phoneOk(p){ if (!/^\+?[\d\s()./-]+$/.test(p)) return false; var d = p.replace(/\D/g,'').length; return d >= 8 && d <= 15; }
  function emailOk(e){ return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e); }

  function dodaj(item, qty){
    var c = load(), f = c.filter(function(i){ return i.id === item.id; })[0];
    if (f) f.qty += qty; else c.push({ id:item.id, name:item.name, img:item.img, qty:qty });
    save(c);
    var fab = document.querySelector('.va-fab');
    if (fab){ fab.classList.remove('va-bump'); void fab.offsetWidth; fab.classList.add('va-bump'); }
  }

  /* ---------- proizvodi i cijene iz Supabasea ---------- */
  function ucitajProizvode(){
    if (!configured) return Promise.resolve();
    return fetch(SUPABASE_URL + '/rest/v1/products?select=id,name,price&active=eq.true', {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY }
    }).then(function(r){ return r.ok ? r.json() : []; }).then(function(rows){
      rows.forEach(function(p){ products[p.id] = { name:p.name, price:p.price }; });
    }).catch(function(){});
  }
  function popuniCijeneNaKarticama(){
    document.querySelectorAll('.wine-card').forEach(function(card){
      var n = card.querySelector('.wine-name'), pr = card.querySelector('.wine-price');
      if (!n || !pr || pr.textContent.trim()) return;      // ručno upisana cijena u HTML-u ima prednost za prikaz
      var p = cijena(slug(n.textContent.trim()));
      if (p != null) pr.textContent = eur(p);
    });
  }

  /* ---------- oznaka košarice: plutajuća ikona + poveznica u navigaciji ---------- */
  function badge(){
    var n = brojBoca(load());
    var fab = document.querySelector('.va-fab');
    if (fab){ fab.querySelector('.va-cart-count').textContent = n; fab.classList.toggle('is-visible', n > 0); fab.setAttribute('aria-label', 'Košarica (' + n + ' boca)'); }
    document.querySelectorAll('.va-nav-count').forEach(function(el){ el.textContent = n; el.style.display = n ? 'inline-flex' : 'none'; });
  }
  function ubaciOznake(){
    var nl = document.querySelector('.nav-links');
    if (nl && !nl.querySelector('.va-nav-cart')){
      var li = document.createElement('li'); li.className = 'va-nav-cart';
      li.innerHTML = '<a href="kosarica.html">Košarica <span class="va-nav-count" style="display:none">0</span></a>';
      nl.appendChild(li);
    }
    if (!document.getElementById('vaItems') && !document.querySelector('.va-fab')){
      var a = document.createElement('a'); a.href = 'kosarica.html'; a.className = 'va-fab';
      a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.2 12H6.2L5 8Z M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/></svg><span class="va-cart-count">0</span>';
      document.body.appendChild(a);
    }
    badge();
  }

  /* ---------- kontrole uz svako vino ---------- */
  function ubaciKontrole(){
    document.querySelectorAll('.wine-card').forEach(function(card){
      if (card.querySelector('.va-buy')) return;
      var nameEl = card.querySelector('.wine-name'), imgEl = card.querySelector('.wine-img-box img');
      if (!nameEl) return;
      var item = { id: slug(nameEl.textContent.trim()), name: nameEl.textContent.trim().replace(/\s+/g,' '), img: imgEl ? imgEl.getAttribute('src') : '' };
      var mode = 1, q = 1;
      var box = document.createElement('div'); box.className = 'va-buy';
      box.innerHTML =
        '<div class="va-mode"><button type="button" class="is-on" data-m="1">Boca</button><button type="button" data-m="6">Karton (6)</button></div>' +
        '<div class="va-qty"><button type="button" data-d="-1" aria-label="Manje">−</button><span class="va-q">1</span><button type="button" data-d="1" aria-label="Više">+</button></div>' +
        '<button type="button" class="va-add">Dodaj u košaricu</button>';
      ['click','mousedown','pointerdown','touchstart'].forEach(function(ev){ box.addEventListener(ev, function(e){ e.stopPropagation(); }); });
      var qEl = box.querySelector('.va-q'), add = box.querySelector('.va-add');
      box.querySelectorAll('.va-mode button').forEach(function(b){
        b.addEventListener('click', function(){
          mode = +b.dataset.m; q = 1; qEl.textContent = q;
          box.querySelectorAll('.va-mode button').forEach(function(x){ x.classList.toggle('is-on', x === b); });
        });
      });
      box.querySelectorAll('.va-qty button').forEach(function(b){
        b.addEventListener('click', function(){ q = Math.max(1, Math.min(99, q + +b.dataset.d)); qEl.textContent = q; });
      });
      add.addEventListener('click', function(){
        dodaj(item, q * mode);
        add.textContent = 'Dodano ✓'; add.classList.add('is-done');
        setTimeout(function(){ add.textContent = 'Dodaj u košaricu'; add.classList.remove('is-done'); }, 1400);
        q = 1; qEl.textContent = 1;
      });
      card.appendChild(box);
    });
  }

  /* ---------- stranica košarice: stavke ---------- */
  function renderKosarica(){
    var host = document.getElementById('vaItems');
    if (!host) return;
    var c = load(), empty = document.getElementById('vaEmpty'), side = document.getElementById('vaCheckout');
    if (!c.length){ host.innerHTML = ''; empty.hidden = false; side.hidden = true; return; }
    empty.hidden = true; side.hidden = false;
    host.innerHTML = c.map(function(i){
      var p = cijena(i.id), kt = kartonText(i.qty);
      return '<div class="va-line" data-id="'+esc(i.id)+'">' +
        '<div class="va-line-img">'+(i.img ? '<img src="'+esc(i.img)+'" alt="'+esc(i.name)+'">' : '')+'</div>' +
        '<div class="va-line-info"><div class="va-line-name">'+esc(i.name)+'</div>' +
        '<div class="va-line-sub">'+(p != null ? eur(p)+' / boca · ' : '')+i.qty+' boca'+(kt ? ' · <b>'+kt+'</b>' : '')+'</div>' +
        '<div class="va-line-ctrl"><div class="va-qty"><button type="button" data-a="-1" aria-label="Manje">−</button><span class="va-q">'+i.qty+'</span><button type="button" data-a="1" aria-label="Više">+</button></div>' +
        '<button type="button" class="va-link" data-a="k">+ Karton (6)</button></div></div>' +
        (p != null ? '<div class="va-line-total">'+eur(p * i.qty)+'</div>' : '') +
        '<button type="button" class="va-remove" data-a="x" aria-label="Ukloni '+esc(i.name)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5 L19 19 M19 5 L5 19" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg></button></div>';
    }).join('');
    var boca = brojBoca(c), t = ukupno(c);
    document.getElementById('vaSumBoca').textContent = boca + ' boca (' + (boca / KARTON).toFixed(1).replace('.',',') + ' kartona)';
    document.getElementById('vaSumTotal').textContent = t != null ? eur(t) : 'Prema ponudi';
    document.getElementById('vaSumTotal').classList.toggle('is-small', t == null);
    var veca = boca >= 12, r = document.getElementById('vaPickupBig');
    if (r){ r.closest('label').style.display = veca ? '' : 'none'; if (!veca && r.checked) document.getElementById('vaPickupFtrr').checked = true; }
  }

  /* ---------- obrazac ---------- */
  var form, tip = 'individual';
  function postaviTip(t){
    tip = t; form.dataset.tip = t;
    document.querySelectorAll('.va-tip button').forEach(function(b){ var on = b.dataset.t === t; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
    form.querySelectorAll('[data-only]').forEach(function(g){
      var on = g.dataset.only === t; g.hidden = !on;
      g.querySelectorAll('input').forEach(function(i){ i.disabled = !on; });
    });
    form.elements.first_name.placeholder = t === 'company' ? 'Ime kontakt osobe*' : 'Ime*';
    form.elements.last_name.placeholder = t === 'company' ? 'Prezime kontakt osobe*' : 'Prezime*';
  }
  function spremiNacrt(){
    var d = { tip: tip };
    Array.prototype.forEach.call(form.elements, function(el){
      if (!el.name || el.name === 'web') return;
      if (el.type === 'radio'){ if (el.checked) d[el.name] = el.value; }
      else if (el.type === 'checkbox'){ d[el.name] = el.checked; }
      else d[el.name] = el.value;
    });
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch(e){}
  }
  function vratiNacrt(){
    var d; try { d = JSON.parse(sessionStorage.getItem(DRAFT_KEY)); } catch(e){}
    if (!d) return;
    postaviTip(d.tip === 'company' ? 'company' : 'individual');
    Array.prototype.forEach.call(form.elements, function(el){
      if (!el.name || !(el.name in d)) return;
      if (el.type === 'radio') el.checked = (el.value === d[el.name]);
      else if (el.type === 'checkbox') el.checked = !!d[el.name];
      else el.value = d[el.name];
    });
  }
  function greska(el, msg){
    var w = el.closest('.va-field') || el.parentNode, e = w.querySelector('.va-err');
    if (msg){ if (!e){ e = document.createElement('span'); e.className = 'va-err'; e.setAttribute('role','alert'); w.appendChild(e); } e.textContent = msg; el.setAttribute('aria-invalid','true'); }
    else { if (e) e.remove(); el.removeAttribute('aria-invalid'); }
  }
  function validiraj(){
    var first = null, ok = true;
    function chk(name, test, msg){
      var el = form.elements[name]; if (!el || el.disabled) return;
      var v = (el.value || '').trim(), bad = !test(v);
      greska(el, bad ? msg : ''); if (bad){ ok = false; if (!first) first = el; }
    }
    var req = function(v){ return v.length > 0; };
    if (tip === 'company'){
      chk('company_name', req, 'Unesite naziv tvrtke.');
      chk('oib', oibOk, 'Unesite ispravan OIB (11 znamenki).');
      chk('street_address', req, 'Unesite ulicu i kućni broj.');
      chk('postal_code', function(v){ return /^\d{5}$/.test(v); }, 'Unesite poštanski broj (5 znamenki).');
      chk('city', req, 'Unesite grad.');
    }
    chk('first_name', req, tip === 'company' ? 'Unesite ime kontakt osobe.' : 'Unesite ime.');
    chk('last_name', req, tip === 'company' ? 'Unesite prezime kontakt osobe.' : 'Unesite prezime.');
    chk('phone', phoneOk, 'Unesite ispravan broj mobitela (npr. +385 99 123 4567).');
    chk('email', emailOk, 'Unesite ispravnu e-mail adresu.');
    var g = form.elements.gdpr; var gBad = !g.checked; greska(g, gBad ? 'Potrebno je prihvatiti Politiku privatnosti.' : ''); if (gBad){ ok = false; if (!first) first = g; }
    if (first) first.focus();
    return ok;
  }

  /* ---------- pregled i slanje ---------- */
  function podaci(){
    var f = new FormData(form), v = function(n){ return String(f.get(n) || '').trim(); };
    var d = { customer_type: tip, email: v('email'), phone: v('phone'), pickup_method: v('pickup_method') === 'delivery' ? 'delivery' : 'ftrr',
              customer_note: v('customer_note'), gdpr_consent: !!f.get('gdpr'), web: v('web') };
    if (tip === 'company'){
      d.company_name = v('company_name'); d.oib = v('oib'); d.street_address = v('street_address'); d.postal_code = v('postal_code'); d.city = v('city');
      d.contact_first_name = v('first_name'); d.contact_last_name = v('last_name');
    } else { d.first_name = v('first_name'); d.last_name = v('last_name'); }
    return d;
  }
  function prikaziPregled(){
    var c = load(), d = podaci(), t = ukupno(c), rv = document.getElementById('vaReview');
    var red = function(k, val){ return val ? '<div class="va-rv-row"><span>'+k+'</span><b>'+esc(val)+'</b></div>' : ''; };
    var items = c.map(function(i){
      var p = cijena(i.id), kt = kartonText(i.qty);
      return '<div class="va-rv-item"><div><b>'+esc(i.name)+'</b><small>'+i.qty+' boca'+(kt ? ' ('+kt+')' : '')+(p != null ? ' × '+eur(p) : '')+'</small></div>'+(p != null ? '<span>'+eur(p*i.qty)+'</span>' : '')+'</div>';
    }).join('');
    rv.querySelector('.va-rv-body').innerHTML =
      '<h3>Odabrana vina</h3>' + items +
      '<div class="va-rv-total"><span>Ukupno '+brojBoca(c)+' boca</span><b>'+(t != null ? eur(t) : 'Cijena prema ponudi')+'</b></div>' +
      '<h3>Podaci o naručitelju</h3>' +
      red('Vrsta', tip === 'company' ? 'Pravna osoba' : 'Fizička osoba') +
      (tip === 'company'
        ? red('Tvrtka', d.company_name) + red('OIB', d.oib) + red('Sjedište', d.street_address + ', ' + d.postal_code + ' ' + d.city) + red('Kontakt osoba', d.contact_first_name + ' ' + d.contact_last_name)
        : red('Ime i prezime', d.first_name + ' ' + d.last_name)) +
      red('E-mail', d.email) + red('Mobitel', d.phone) +
      '<h3>Preuzimanje</h3><p class="va-rv-text">'+esc(PICKUP[d.pickup_method])+'</p>' +
      (d.customer_note ? '<h3>Napomena</h3><p class="va-rv-text">'+esc(d.customer_note)+'</p>' : '');
    form.hidden = true; rv.hidden = false;
    document.getElementById('vaCheckout').scrollIntoView({ behavior:'smooth', block:'start' });
  }
  function nazadNaObrazac(){ document.getElementById('vaReview').hidden = true; form.hidden = false; document.getElementById('vaMsg').textContent = ''; }

  function idemKey(c){
    var h = c.map(function(i){ return i.id + ':' + i.qty; }).join('|'), s;
    try { s = JSON.parse(sessionStorage.getItem(IDEM_KEY)); } catch(e){}
    if (s && s.h === h) return s.k;
    var k = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    try { sessionStorage.setItem(IDEM_KEY, JSON.stringify({ h:h, k:k })); } catch(e){}
    return k;
  }
  var saljem = false;
  function posalji(){
    if (saljem) return;                       // sprječava višestruko slanje višestrukim klikom
    var c = load(), msg = document.getElementById('vaMsg'), btn = document.getElementById('vaSend');
    if (!c.length) return;
    if (!configured){ msg.textContent = 'Stranica još nije povezana sa Supabaseom (postavite SUPABASE_URL i ključ u assets/kosarica.js).'; msg.className = 'va-msg is-err'; return; }
    var body = podaci();
    body.idempotency_key = idemKey(c);
    body.items = c.map(function(i){ return { product_id: i.id, quantity: i.qty }; });
    saljem = true; btn.disabled = true; btn.classList.add('is-loading'); btn.textContent = 'Šaljem narudžbu…'; msg.textContent = ''; msg.className = 'va-msg';
    fetch(SUPABASE_URL + '/functions/v1/posalji-narudzbu', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'apikey':SUPABASE_ANON_KEY, 'Authorization':'Bearer '+SUPABASE_ANON_KEY },
      body: JSON.stringify(body)
    }).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ return { ok:r.ok, j:j }; }); })
    .then(function(res){
      if (!res.ok || !res.j.ok) throw new Error(res.j.error || 'Slanje nije uspjelo.');
      save([]);                                // košarica se briše TEK nakon uspješnog spremanja
      try { sessionStorage.removeItem(DRAFT_KEY); sessionStorage.removeItem(IDEM_KEY); } catch(e){}
      document.getElementById('vaMain').hidden = true; document.getElementById('vaSteps').hidden = true;
      document.getElementById('vaDone').hidden = false;
      document.getElementById('vaDoneBroj').textContent = res.j.order_number || '';
      window.scrollTo({ top:0, behavior:'smooth' });
    }).catch(function(err){
      var m = (err && err.message) ? err.message : 'Slanje nije uspjelo.';
      if (err instanceof TypeError) m = 'Nema veze s poslužiteljem. Provjerite internet i pokušajte ponovno.';
      msg.textContent = m + ' Vaša košarica i podaci su sačuvani.'; msg.className = 'va-msg is-err';
      saljem = false; btn.disabled = false; btn.classList.remove('is-loading'); btn.textContent = 'Pošalji narudžbu';
    });
  }

  function veziKosaricu(){
    var host = document.getElementById('vaItems');
    if (!host) return;
    form = document.getElementById('vaForm');
    host.addEventListener('click', function(e){
      var b = e.target.closest('button[data-a]'); if (!b) return;
      var id = b.closest('.va-line').dataset.id, c = load(), it = c.filter(function(i){ return i.id === id; })[0];
      if (!it) return;
      var a = b.dataset.a;
      if (a === 'x') c = c.filter(function(i){ return i !== it; });
      else if (a === 'k') it.qty += KARTON;
      else { it.qty += +a; if (it.qty < 1) c = c.filter(function(i){ return i !== it; }); }
      save(c); renderKosarica(); if (!document.getElementById('vaReview').hidden) prikaziPregled();
    });
    document.querySelectorAll('.va-tip button').forEach(function(b){ b.addEventListener('click', function(){ postaviTip(b.dataset.t); spremiNacrt(); }); });
    postaviTip('individual'); vratiNacrt();
    form.addEventListener('input', function(e){ if (e.target.name) greska(e.target, ''); spremiNacrt(); });
    form.addEventListener('change', spremiNacrt);
    form.addEventListener('submit', function(e){ e.preventDefault(); if (validiraj()) prikaziPregled(); });
    document.getElementById('vaBack').addEventListener('click', nazadNaObrazac);
    document.getElementById('vaSend').addEventListener('click', posalji);
  }

  document.addEventListener('DOMContentLoaded', function(){
    ubaciOznake(); ubaciKontrole(); renderKosarica(); veziKosaricu();
    ucitajProizvode().then(function(){ popuniCijeneNaKarticama(); renderKosarica(); });
  });
  window.addEventListener('storage', function(){ badge(); renderKosarica(); });
  window.addEventListener('pageshow', badge);
})();
