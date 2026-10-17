/* Administracija narudžbi – Vinum Academicum. Čita podatke preko Supabase RLS-a (samo administrator),
   a sve promjene (status, potvrda, e-mailovi) radi Edge Function `admin-order-action` koja provjerava ovlasti na serveru. */
(function(){
  // ====== POSTAVKE: iste vrijednosti kao u assets/kosarica.js ======
  var SUPABASE_URL = 'https://aewezoonconyljfavnly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_geSXFDGLpUGuqcdWtlX6Rg_3UFtTLEh';
  // =================================================================

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  var $ = function(id){ return document.getElementById(id); };
  var S = { user:null, orders:[], products:[], recovery:false };
  var ST = { pending:'Nova', contacted:'Kontaktiran', confirmed:'Potvrđena', rejected:'Odbijena', completed:'Izvršena' };
  var KIND = { admin_notification:'Obavijest vinariji', customer_receipt:'Potvrda primitka kupcu', customer_confirmation:'Potvrda narudžbe kupcu', customer_rejection:'Obavijest o odbijanju kupcu' };
  var PICK = { ftrr:'Osobno preuzimanje – FTRR, Vukovarska 17, Požega', delivery:'Dostava / preuzimanje po dogovoru' };

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function eur(n){ return n == null ? '—' : Number(n).toFixed(2).replace('.',',') + ' €'; }
  function dt(iso){ return iso ? new Date(iso).toLocaleString('hr-HR',{ dateStyle:'medium', timeStyle:'short' }) : '—'; }
  function dshort(iso){ return new Date(iso).toLocaleDateString('hr-HR'); }
  function toast(m, err){ var t = $('toast'); t.textContent = m; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(toast._t); toast._t = setTimeout(function(){ t.className = 'toast'; }, 4200); }
  function show(v){ ['vLogin','vPass','vApp'].forEach(function(i){ $(i).hidden = (i !== v); }); }
  function name(o){ return o.customer_type === 'company' ? o.company_name : ((o.first_name||'') + ' ' + (o.last_name||'')).trim(); }
  function contact(o){ return o.customer_type === 'company' ? ((o.contact_first_name||'') + ' ' + (o.contact_last_name||'')).trim() : name(o); }
  function bottles(o){ return (o.order_items||[]).reduce(function(a,i){ return a + i.quantity; },0); }
  function badge(s){ return '<span class="badge '+s+'">'+esc(ST[s]||s)+'</span>'; }
  function tel(p){ return String(p||'').replace(/[^\d+]/g,''); }

  /* ================= PRIJAVA ================= */
  sb.auth.onAuthStateChange(function(ev){ if (ev === 'PASSWORD_RECOVERY'){ S.recovery = true; $('passSub').textContent = 'Postavite novu lozinku'; show('vPass'); } });

  function boot(){
    sb.auth.getSession().then(function(r){
      var s = r.data && r.data.session;
      if (S.recovery) return;
      if (!s) return show('vLogin');
      gate(s.user);
    });
  }
  function gate(user){
    sb.from('admins').select('user_id').eq('user_id', user.id).maybeSingle().then(function(r){
      if (!r.data){ sb.auth.signOut(); $('mLogin').textContent = 'Ovaj račun nema administratorske ovlasti.'; return show('vLogin'); }
      S.user = user;
      if (!(user.user_metadata && user.user_metadata.password_changed)){ $('passSub').textContent = 'Prije nastavka postavite vlastitu lozinku'; return show('vPass'); }
      enter();
    });
  }
  $('fLogin').addEventListener('submit', function(e){
    e.preventDefault(); var f = e.target, m = $('mLogin'), b = f.querySelector('button.btn'); m.textContent = '';
    if (!f.email.value || !f.password.value){ m.textContent = 'Unesite e-mail i lozinku.'; return; }
    b.disabled = true;
    sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value }).then(function(r){
      b.disabled = false;
      if (r.error){ m.textContent = 'Prijava nije uspjela. Provjerite e-mail i lozinku.'; return; }
      f.password.value = ''; gate(r.data.user);
    });
  });
  $('bForgot').addEventListener('click', function(){
    var f = $('fLogin'), m = $('mLogin'), em = f.email.value.trim();
    if (!em){ m.textContent = 'Najprije upišite e-mail adresu.'; return; }
    sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin + location.pathname }).then(function(){
      m.className = 'msg ok'; m.textContent = 'Ako račun postoji, poslali smo poveznicu za postavljanje nove lozinke.';
    });
  });
  $('fPass').addEventListener('submit', function(e){
    e.preventDefault(); var f = e.target, m = $('mPass'), b = f.querySelector('button.btn'); m.textContent = ''; m.className = 'msg';
    if (f.p1.value.length < 12){ m.textContent = 'Lozinka mora imati najmanje 12 znakova.'; return; }
    if (f.p1.value !== f.p2.value){ m.textContent = 'Lozinke se ne podudaraju.'; return; }
    b.disabled = true;
    sb.auth.updateUser({ password: f.p1.value, data: { password_changed: true } }).then(function(r){
      b.disabled = false;
      if (r.error){ m.textContent = 'Spremanje nije uspjelo: ' + r.error.message; return; }
      S.recovery = false; f.reset(); history.replaceState(null,'',location.pathname);
      sb.auth.getUser().then(function(u){ gate(u.data.user); });
    });
  });
  $('bLogout').addEventListener('click', function(){ sb.auth.signOut().then(function(){ S.user = null; S.orders = []; show('vLogin'); }); });

  /* ================= APLIKACIJA ================= */
  function enter(){
    show('vApp'); $('whoEmail').textContent = S.user.email;
    Promise.all([loadOrders(), loadProducts()]).then(function(){ renderAll(); route(); });
  }
  function loadOrders(){
    $('recent').innerHTML = '<div class="loading">Učitavanje…</div>';
    return sb.from('orders').select('*, order_items(*)').order('created_at',{ ascending:false }).limit(2000).then(function(r){
      if (r.error){ toast('Učitavanje narudžbi nije uspjelo: ' + r.error.message, true); S.orders = []; } else S.orders = r.data;
    });
  }
  function loadProducts(){
    return sb.from('products').select('*').order('sort_order').then(function(r){ S.products = r.data || []; });
  }
  function renderAll(){ renderCards(); renderRecent(); renderList(); renderProducts(); }

  $('tabs').addEventListener('click', function(e){
    var b = e.target.closest('button[data-tab]'); if (!b) return;
    document.querySelectorAll('#tabs button').forEach(function(x){ x.classList.toggle('is-on', x === b); });
    $('tPregled').hidden = b.dataset.tab !== 'pregled'; $('tNarudzbe').hidden = b.dataset.tab !== 'narudzbe'; $('tCijene').hidden = b.dataset.tab !== 'cijene';
  });
  function goTab(t){ var b = document.querySelector('#tabs button[data-tab="'+t+'"]'); if (b) b.click(); }

  function renderCards(){
    var c = function(s){ return S.orders.filter(function(o){ return o.status === s; }).length; };
    var done = S.orders.filter(function(o){ return (o.status === 'confirmed' || o.status === 'completed') && o.total_amount != null; });
    var sum = done.reduce(function(a,o){ return a + Number(o.total_amount); },0);
    var items = [['Ukupno narudžbi', S.orders.length,''],['Nove – čekaju obradu', c('pending'),'hot'],['Kontaktirani kupci', c('contacted'),''],['Potvrđene', c('confirmed'),''],['Izvršene', c('completed'),'']];
    if (done.length) items.push(['Vrijednost potvrđenih i izvršenih', eur(sum), '']);
    $('cards').innerHTML = items.map(function(i){ return '<div class="card '+i[2]+'"><b>'+esc(i[1])+'</b><span>'+esc(i[0])+'</span></div>'; }).join('');
  }
  function rowsTable(list){
    if (!list.length) return '<div class="empty">Nema narudžbi.</div>';
    return '<table class="t"><thead><tr><th>Datum</th><th>Broj</th><th>Kupac</th><th>Vrsta</th><th>Boca</th><th>Iznos</th><th>Status</th></tr></thead><tbody>' +
      list.map(function(o){
        return '<tr class="row" data-id="'+o.id+'"><td data-l="Datum" class="sm">'+dshort(o.created_at)+'</td><td data-l="Broj" class="num">'+esc(o.order_number)+'</td><td data-l="Kupac">'+esc(name(o))+'<div class="sm">'+esc(o.email)+'</div></td>' +
          '<td data-l="Vrsta">'+(o.customer_type === 'company' ? 'Pravna' : 'Fizička')+'</td><td data-l="Boca">'+bottles(o)+'</td><td data-l="Iznos">'+eur(o.total_amount)+'</td><td>'+badge(o.status)+'</td></tr>';
      }).join('') + '</tbody></table>';
  }
  function renderRecent(){ $('recent').innerHTML = rowsTable(S.orders.slice(0,8)); }
  function renderList(){
    var q = $('fSearch').value.trim().toLowerCase(), st = $('fStatus').value, from = $('fFrom').value, to = $('fTo').value, asc = $('fSort').value === 'asc';
    var l = S.orders.filter(function(o){
      if (st && o.status !== st) return false;
      var d = o.created_at.slice(0,10);
      if (from && d < from) return false; if (to && d > to) return false;
      if (q){ var hay = [o.order_number,name(o),contact(o),o.email,o.phone,o.oib].join(' ').toLowerCase(); if (hay.indexOf(q) === -1) return false; }
      return true;
    });
    if (asc) l = l.slice().reverse();
    $('list').innerHTML = rowsTable(l);
  }
  ['fSearch','fStatus','fFrom','fTo','fSort'].forEach(function(i){ $(i).addEventListener('input', renderList); });
  document.addEventListener('click', function(e){
    var r = e.target.closest('tr.row'); if (r) openOrder(r.dataset.id);
  });

  /* ---------- cijene vina ---------- */
  function renderProducts(){
    $('products').innerHTML = S.products.map(function(p){
      return '<div class="prod-row" data-id="'+esc(p.id)+'"><div><b>'+esc(p.name)+'</b><div class="id">'+esc(p.id)+'</div></div>' +
        '<input type="text" inputmode="decimal" placeholder="npr. 12,50" value="'+(p.price == null ? '' : String(p.price).replace('.',','))+'" aria-label="Cijena '+esc(p.name)+' (EUR)">' +
        '<label style="display:flex;align-items:center;gap:8px;margin:0"><input type="checkbox" style="width:auto" '+(p.active ? 'checked' : '')+'> aktivno</label>' +
        '<button class="btn sm" type="button">Spremi</button></div>';
    }).join('') || '<div class="empty">Nema vina u tablici products. Pokrenite 002_proizvodi.sql.</div>';
  }
  $('products').addEventListener('click', function(e){
    var b = e.target.closest('button'); if (!b) return;
    var row = b.closest('.prod-row'), raw = row.querySelector('input[type=text]').value.trim().replace(',','.'), price = raw === '' ? null : Number(raw);
    if (price !== null && (isNaN(price) || price < 0)){ toast('Neispravna cijena.', true); return; }
    b.disabled = true;
    sb.from('products').update({ price: price, active: row.querySelector('input[type=checkbox]').checked }).eq('id', row.dataset.id).then(function(r){
      b.disabled = false;
      if (r.error) toast('Spremanje nije uspjelo: ' + r.error.message, true); else { toast('Spremljeno.'); loadProducts(); }
    });
  });

  /* ================= DETALJI NARUDŽBE ================= */
  var cur = null;
  function openOrder(id){
    var o = S.orders.filter(function(x){ return x.id === id; })[0]; if (!o) return;
    cur = o; $('drawer').hidden = false; document.body.style.overflow = 'hidden';
    $('dBody').innerHTML = '<div class="loading">Učitavanje…</div>';
    history.replaceState(null,'','#order=' + id);
    Promise.all([
      sb.from('order_status_history').select('*').eq('order_id', id).order('created_at'),
      sb.from('email_log').select('*').eq('order_id', id).order('created_at')
    ]).then(function(r){ if (cur && cur.id === id) renderDetail(o, r[0].data || [], r[1].data || []); });
  }
  function closeDrawer(){ $('drawer').hidden = true; document.body.style.overflow = ''; cur = null; history.replaceState(null,'',location.pathname); }
  $('drawer').addEventListener('click', function(e){ if (e.target.closest('[data-close]')) closeDrawer(); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape'){ if (!$('modal').hidden) closeModal(); else if (!$('drawer').hidden) closeDrawer(); } });

  function kv(k, v){ return '<span>'+k+'</span><div>'+v+'</div>'; }
  function renderDetail(o, hist, logs){
    var items = o.order_items || [], priced = o.total_amount != null;
    var acts = '';
    if (o.status === 'pending') acts += '<button class="btn ghost" data-a="contacted">Označi kao kontaktirano</button>';
    if (o.status === 'pending' || o.status === 'contacted') acts += '<button class="btn" data-a="confirm">Potvrdi narudžbu</button><button class="btn danger" data-a="reject">Odbij narudžbu</button>';
    if (o.status === 'confirmed') acts += '<button class="btn" data-a="complete">Označi kao izvršenu</button>';
    var cust = o.customer_type === 'company'
      ? kv('Vrsta','Pravna osoba') + kv('Tvrtka', esc(o.company_name)) + kv('OIB', esc(o.oib)) + kv('Sjedište', esc(o.street_address)+', '+esc(o.postal_code)+' '+esc(o.city)) + kv('Kontakt osoba', esc(contact(o)))
      : kv('Vrsta','Fizička osoba') + kv('Ime i prezime', esc(name(o)));
    $('dBody').innerHTML =
      '<div class="d-head"><div><div class="d-title" id="dTitle">'+esc(o.order_number)+'</div></div>'+badge(o.status)+'</div>' +
      '<div class="d-sub">Zaprimljeno '+esc(dt(o.created_at))+(o.confirmed_at ? ' · potvrđeno '+esc(dt(o.confirmed_at)) : '')+(o.fulfilled_at ? ' · izvršeno '+esc(dt(o.fulfilled_at)) : '')+'</div>' +
      '<div class="kv">'+cust+
        kv('E-mail','<a href="mailto:'+esc(o.email)+'">'+esc(o.email)+'</a>') + kv('Mobitel','<a href="tel:'+esc(tel(o.phone))+'">'+esc(o.phone)+'</a>') +
        kv('Preuzimanje', esc(PICK[o.pickup_method])) + (o.customer_note ? kv('Napomena kupca', esc(o.customer_note).replace(/\n/g,'<br>')) : '') + '</div>' +
      '<div class="d-actions"><a class="btn ghost" href="tel:'+esc(tel(o.phone))+'" style="display:inline-flex;align-items:center;text-decoration:none">Nazovi kupca</a>' +
        '<a class="btn ghost" href="mailto:'+esc(o.email)+'?subject='+encodeURIComponent('Vaša narudžba '+o.order_number+' – Vinum Academicum')+'" style="display:inline-flex;align-items:center;text-decoration:none">Pošalji e-mail</a>'+acts+'</div>' +
      '<div class="sec"><h3>Vina i količine</h3><table class="t"><thead><tr><th>Vino</th><th>Količina</th>'+(priced ? '<th>Cijena / boca</th><th>Iznos s PDV-om</th>' : '')+'</tr></thead><tbody>' +
        items.map(function(i){ return '<tr><td>'+esc(i.product_name)+'</td><td>'+i.quantity+' boca'+(priced ? '<div class="sm">'+eur(i.line_total)+' s PDV-om</div>' : '')+'</td>'+(priced ? '<td>'+eur(i.unit_price)+'</td><td>'+eur(i.line_total)+'</td>' : '')+'</tr>'; }).join('') +
        '</tbody></table><p style="margin-top:12px"><b>Ukupno: '+bottles(o)+' boca</b>'+(priced ? ' · <b>'+eur(o.total_amount)+' s PDV-om</b>' : ' · cijena prema ponudi')+'</p></div>' +
      (o.final_message ? '<div class="sec"><h3>Poruka kupcu uz potvrdu</h3><div class="note-box">'+esc(o.final_message)+'</div></div>' : '') +
      (o.rejection_reason ? '<div class="sec"><h3>Razlog odbijanja</h3><div class="note-box">'+esc(o.rejection_reason)+'</div></div>' : '') +
      '<div class="sec"><h3>Interna napomena (kupac je ne vidi)</h3><textarea id="adminNote" maxlength="2000">'+esc(o.admin_note || '')+'</textarea><div class="modal-actions" style="margin-top:10px"><button class="btn sm" data-a="save_note">Spremi napomenu</button></div></div>' +
      '<div class="sec"><h3>Povijest statusa</h3><ul class="tl">'+hist.map(function(h){
        return '<li><b>'+esc(h.from_status ? ST[h.from_status] + ' → ' + ST[h.to_status] : ST[h.to_status])+'</b><small>'+esc(dt(h.created_at))+(h.changed_by_email ? ' · '+esc(h.changed_by_email) : '')+'</small>'+(h.note ? '<div>'+esc(h.note)+'</div>' : '')+'</li>';
      }).join('')+'</ul></div>' +
      '<div class="sec"><h3>E-mailovi</h3>'+(logs.length ? '<table class="t"><tbody>'+logs.map(function(l){
        return '<tr><td>'+esc(KIND[l.kind]||l.kind)+'<div class="sm">'+esc(l.recipient)+'</div></td><td class="sm">'+esc(dt(l.created_at))+'</td><td>'+(l.status === 'sent' ? 'Poslano' : '<span style="color:#b3261e">Nije poslano</span><div class="sm">'+esc(l.error||'')+'</div>')+'</td><td><button class="btn ghost sm" data-resend="'+esc(l.kind)+'">Pošalji ponovno</button></td></tr>';
      }).join('')+'</tbody></table>' : '<div class="empty" style="padding:20px 0">Nema zapisa o slanju e-mailova.</div>')+'</div>';
  }
  $('dBody').addEventListener('click', function(e){
    var b = e.target.closest('button'); if (!b || !cur) return;
    if (b.dataset.resend){ b.disabled = true; callAdmin({ action:'resend_email', order_id:cur.id, kind:b.dataset.resend }).then(function(r){ toast(r.ok ? 'E-mail je poslan.' : 'Slanje nije uspjelo: ' + ((r.email && r.email.error) || r.error || ''), !r.ok); refreshCurrent(); }); return; }
    var a = b.dataset.a; if (!a) return;
    if (a === 'save_note'){ b.disabled = true; callAdmin({ action:'save_note', order_id:cur.id, note:$('adminNote').value }).then(function(r){ b.disabled = false; toast(r.ok ? 'Napomena spremljena.' : (r.error || 'Greška'), !r.ok); if (r.ok) refreshCurrent(); }); return; }
    if (a === 'confirm') return confirmModal(); if (a === 'reject') return rejectModal();
    if (a === 'contacted') return simpleModal('Označiti kao kontaktirano?', 'Status narudžbe '+cur.order_number+' postat će „Kontaktiran“.', 'contacted', 'Označi');
    if (a === 'complete') return simpleModal('Označiti kao izvršenu?', 'Narudžba '+cur.order_number+' bit će označena kao izvršena.', 'complete', 'Označi kao izvršenu');
  });

  function callAdmin(body){
    return sb.auth.getSession().then(function(r){
      var tok = r.data.session && r.data.session.access_token; if (!tok) return { ok:false, error:'Sesija je istekla. Prijavite se ponovno.' };
      return fetch(SUPABASE_URL + '/functions/v1/admin-order-action', { method:'POST', headers:{ 'Content-Type':'application/json', apikey:SUPABASE_ANON_KEY, Authorization:'Bearer '+tok }, body: JSON.stringify(body) })
        .then(function(res){ return res.json().catch(function(){ return {}; }).then(function(j){ if (!res.ok && !j.error) j.error = 'Greška ' + res.status; if (!res.ok) j.ok = false; return j; }); })
        .catch(function(){ return { ok:false, error:'Nema veze s poslužiteljem.' }; });
    });
  }
  function refreshCurrent(){ var id = cur && cur.id; return loadOrders().then(function(){ renderAll(); if (id) openOrder(id); }); }

  /* ---------- modali ---------- */
  function openModal(html){ $('mBody').innerHTML = html; $('modal').hidden = false; }
  function closeModal(){ $('modal').hidden = true; $('mBody').innerHTML = ''; }
  $('modal').addEventListener('click', function(e){ if (e.target.closest('[data-mclose]')) closeModal(); });

  function afterAction(r, okMsg){
    if (!r.ok){ toast(r.error || 'Radnja nije uspjela.', true); return false; }
    if (r.already) toast('Narudžba je već u tom statusu – ništa nije promijenjeno.');
    else if (r.email && !r.email.ok) toast(okMsg + ' E-mail kupcu NIJE poslan (' + (r.email.error||'greška') + ') – pokušajte ponovno u detaljima narudžbe.', true);
    else toast(okMsg + (r.email ? ' E-mail kupcu je poslan.' : ''));
    closeModal(); refreshCurrent(); return true;
  }
  function simpleModal(title, text, action, label){
    openModal('<h3>'+esc(title)+'</h3><p class="sub">'+esc(text)+'</p><div class="modal-actions"><button class="btn ghost" data-mclose>Odustani</button><button class="btn" id="mgo">'+esc(label)+'</button></div>');
    $('mgo').onclick = function(){ this.disabled = true; callAdmin({ action:action, order_id:cur.id }).then(function(r){ if (!afterAction(r, 'Status je promijenjen.')) $('mgo') && ($('mgo').disabled = false); }); };
  }
  function rejectModal(){
    openModal('<h3>Odbij narudžbu</h3><p class="sub">Narudžba '+esc(cur.order_number)+' · kupac će primiti e-mail na <b>'+esc(cur.email)+'</b>.</p><div class="fgap"><label>Razlog / poruka kupcu*<textarea id="rReason" maxlength="2000" placeholder="npr. Trenutno nemamo traženu količinu na zalihama."></textarea></label><div class="msg" id="rMsg"></div></div><div class="modal-actions"><button class="btn ghost" data-mclose>Odustani</button><button class="btn danger" id="mgo">Odbij i obavijesti kupca</button></div>');
    $('mgo').onclick = function(){
      var v = $('rReason').value.trim(); if (!v){ $('rMsg').textContent = 'Unesite razlog odbijanja.'; return; }
      this.disabled = true; callAdmin({ action:'reject', order_id:cur.id, note:v }).then(function(r){ if (!afterAction(r, 'Narudžba je odbijena.')) $('mgo') && ($('mgo').disabled = false); });
    };
  }

  function confirmModal(){
    var o = cur, orig = (o.order_items || []).map(function(i){ return { product_id:i.product_id, product_name:i.product_name, quantity:i.quantity, unit_price:i.unit_price }; });
    var rows = orig.map(function(i){ return { product_id:i.product_id, product_name:i.product_name, quantity:i.quantity, unit_price:i.unit_price }; });
    var pickup = o.pickup_method;
    function totalTxt(){ var t = 0; for (var k = 0; k < rows.length; k++){ if (rows[k].unit_price == null || rows[k].unit_price === '') return 'cijena prema ponudi'; t += rows[k].quantity * Number(rows[k].unit_price); } return eur(t) + ' s PDV-om'; }
    function draw(){
      $('mBody').querySelector('#eiBody').innerHTML = rows.map(function(i, idx){
        return '<tr data-i="'+idx+'"><td class="nm">'+esc(i.product_name)+'</td><td style="width:90px"><input type="number" min="1" max="1200" value="'+i.quantity+'" data-f="quantity" aria-label="Količina"></td><td style="width:110px"><input type="text" inputmode="decimal" value="'+(i.unit_price == null ? '' : String(i.unit_price).replace('.',','))+'" placeholder="cijena €" data-f="unit_price" aria-label="Cijena"></td><td style="width:34px"><button type="button" class="rm" data-rm aria-label="Ukloni">×</button></td></tr>';
      }).join('');
      $('eiTotal').textContent = totalTxt();
    }
    var opts = S.products.filter(function(p){ return p.active; }).map(function(p){ return '<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>'; }).join('');
    openModal('<h3>Potvrdi narudžbu</h3><p class="sub">Narudžba <b>'+esc(o.order_number)+'</b> · potvrda se šalje kupcu na <b>'+esc(o.email)+'</b>. Ako se tijekom dogovora nešto promijenilo, uredite stavke prije potvrde – promjene se spremaju i evidentiraju.</p>' +
      '<div class="fgap"><div><table class="edit-items"><tbody id="eiBody"></tbody></table><div class="addrow"><select id="eiSel">'+opts+'</select><button type="button" class="btn ghost sm" id="eiAdd">Dodaj vino</button></div><div style="text-align:right;font-size:13px">Ukupno: <b id="eiTotal"></b></div></div>' +
      '<label>Način preuzimanja<select id="cPickup"><option value="ftrr">'+esc(PICK.ftrr)+'</option><option value="delivery">'+esc(PICK.delivery)+'</option></select></label>' +
      '<label>Završna poruka kupcu (neobavezno)<textarea id="cMsg" maxlength="2000" placeholder="npr. Vina će biti spremna u petak od 14 h."></textarea></label><div class="msg" id="cErr"></div></div>' +
      '<div class="modal-actions"><button class="btn ghost" data-mclose>Odustani</button><button class="btn" id="mgo">Potvrdi i pošalji e-mail kupcu</button></div>');
    $('cPickup').value = pickup; draw();
    $('eiBody').addEventListener('input', function(e){
      var tr = e.target.closest('tr'), f = e.target.dataset.f, i = rows[+tr.dataset.i];
      if (f === 'quantity') i.quantity = Math.floor(Number(e.target.value)) || 0;
      if (f === 'unit_price'){ var v = e.target.value.trim().replace(',','.'); i.unit_price = v === '' ? null : Number(v); }
      $('eiTotal').textContent = totalTxt();
    });
    $('eiBody').addEventListener('click', function(e){ if (e.target.closest('[data-rm]')){ rows.splice(+e.target.closest('tr').dataset.i, 1); draw(); } });
    $('eiAdd').onclick = function(){
      var p = S.products.filter(function(x){ return x.id === $('eiSel').value; })[0]; if (!p) return;
      var ex = rows.filter(function(r){ return r.product_id === p.id; })[0];
      if (ex) ex.quantity += 1; else rows.push({ product_id:p.id, product_name:p.name, quantity:1, unit_price:p.price });
      draw();
    };
    $('mgo').onclick = function(){
      var err = $('cErr'); err.textContent = '';
      if (!rows.length){ err.textContent = 'Narudžba mora imati barem jedno vino.'; return; }
      for (var k = 0; k < rows.length; k++){
        if (!(rows[k].quantity >= 1 && rows[k].quantity <= 1200)){ err.textContent = 'Količina mora biti između 1 i 1200.'; return; }
        if (rows[k].unit_price != null && (isNaN(rows[k].unit_price) || rows[k].unit_price < 0)){ err.textContent = 'Neispravna cijena.'; return; }
      }
      var body = { action:'confirm', order_id:o.id, message:$('cMsg').value, pickup_method:$('cPickup').value };
      var changed = JSON.stringify(rows.map(function(r){ return [r.product_id, r.product_name, r.quantity, r.unit_price == null ? null : Number(r.unit_price)]; })) !==
                    JSON.stringify(orig.map(function(r){ return [r.product_id, r.product_name, r.quantity, r.unit_price == null ? null : Number(r.unit_price)]; }));
      if (changed) body.items = rows;
      this.disabled = true;
      callAdmin(body).then(function(r){ if (!afterAction(r, 'Narudžba je potvrđena.')) $('mgo') && ($('mgo').disabled = false); });
    };
  }

  /* ================= usmjeravanje (#order=ID iz e-maila) ================= */
  function route(){
    var m = /order=([0-9a-f-]{36})/.exec(location.hash);
    if (m){ goTab('narudzbe'); openOrder(m[1]); }
  }
  window.addEventListener('hashchange', function(){ if (S.user && $('vApp') && !$('vApp').hidden) route(); });

  boot();
})();
