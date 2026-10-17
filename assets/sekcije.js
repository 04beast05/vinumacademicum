/* Otkrivanje poglavlja "Naša priča" + beskonačni slider logotipa restorana */
(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) document.documentElement.classList.add('va-js');

  document.addEventListener('DOMContentLoaded', function(){
    var chapters = document.querySelectorAll('.about-chapter');
    if (!('IntersectionObserver' in window)){ chapters.forEach(function(c){ c.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if (e.isIntersecting){ e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    chapters.forEach(function(c){ io.observe(c); });
  });

  // Slider: dovoljno je urediti JEDNU listu logotipa u HTML-u; skripta je sama ponavlja i udvostručuje za bešavnu petlju.
  function initMarquee(){
    var wrap = document.getElementById('partnersMarquee'); if (!wrap) return;
    var track = wrap.querySelector('.partners-track'), list = track.querySelector('.partners-list');
    if (!list || list.dataset.ready) return; list.dataset.ready = '1';
    var items = Array.prototype.slice.call(list.children);
    if (!items.length) return;
    var guard = 0;
    while (list.scrollWidth < window.innerWidth * 1.2 && guard++ < 8){
      items.forEach(function(li){ var c = li.cloneNode(true); c.setAttribute('aria-hidden','true'); list.appendChild(c); });
    }
    var copy = list.cloneNode(true); copy.classList.add('is-clone'); copy.setAttribute('aria-hidden','true');
    track.appendChild(copy);
    track.style.setProperty('--dur', Math.max(20, Math.round(list.scrollWidth / 55)) + 's'); // ~55 px/s
  }
  window.addEventListener('load', initMarquee);
})();
