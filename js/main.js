/* ==========================================================================
   Maison Vert Pâle — mise en scène (GSAP + ScrollTrigger + Lenis)
   Règles : on n'anime que transform / opacity (hors masques demandés),
   courbes douces (expo / power3), prefers-reduced-motion respecté.
   ========================================================================== */
(function () {
  'use strict';

  var C = window.MVP;
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasGSAP = !!(window.gsap && window.ScrollTrigger);

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function safe(fn) { try { fn(); } catch (e) { if (window.console) console.error('[mvp]', e); } }

  if (reduce) root.classList.add('reduce');

  /* ======================================================================
     0. Contenu dynamique : prix, horaires, statut ouvert/fermé
     ====================================================================== */
  function fillStatic() {
    $$('[data-prix]').forEach(function (el) {
      var v = C.prix && C.prix[el.getAttribute('data-prix')];
      if (v) el.textContent = v;
    });

    var body = $('#hoursBody');
    if (body) {
      var today = C.parisParts().dow;
      body.innerHTML = '';
      [1, 2, 3, 4, 5, 6, 0].forEach(function (d) {
        var r = C.horaires[d] || [];
        var txt = r.length
          ? r.map(function (x) { return C.fmtHeure(C.toMin(x[0])) + ' – ' + C.fmtHeure(C.toMin(x[1])); }).join('  ·  ')
          : 'Fermé';
        var tr = document.createElement('tr');
        if (d === today) tr.className = 'is-today';
        tr.innerHTML = '<th scope="row">' + C.JOURS[d] + '</th><td class="' + (r.length ? '' : 'is-closed') + '">' + txt + '</td>';
        body.appendChild(tr);
      });
    }

    function paintStatus() {
      var s = C.openStatus();
      $$('[data-open-status]').forEach(function (el) {
        el.classList.toggle('is-closed', !s.open);
        var sp = $('span', el);
        if (sp) sp.textContent = s.label;
      });
    }
    paintStatus();
    setInterval(paintStatus, 60000);
  }

  /* ======================================================================
     Utilitaire : découpage du texte (mots / lettres) pour l'effet masque
     ====================================================================== */
  function splitText(rootEl, mode) {
    var parts = [];
    rootEl.setAttribute('aria-label', rootEl.textContent.replace(/\s+/g, ' ').trim());
    function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (tok) {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span');
            w.className = 'w'; w.setAttribute('aria-hidden', 'true');
            if (mode === 'chars') {
              Array.from(tok).forEach(function (ch) {
                var c = document.createElement('span');
                c.className = 'c'; c.textContent = ch; w.appendChild(c); parts.push(c);
              });
            } else {
              var c2 = document.createElement('span');
              c2.className = 'c'; c2.textContent = tok; w.appendChild(c2); parts.push(c2);
            }
            frag.appendChild(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) {
          walk(n);
        }
      });
    }
    walk(rootEl);
    return parts;
  }

  fillStatic();

  if (!hasGSAP) {
    var l = $('#loader'); if (l) l.remove();
    root.classList.remove('is-loading');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  gsap.config({ nullTargetWarn: false });
  ScrollTrigger.config({ ignoreMobileResize: true });
  gsap.defaults({ ease: 'expo.out' });

  /* ======================================================================
     1. Défilement fluide (Lenis) relié à ScrollTrigger
     ====================================================================== */
  var lenis = null;
  safe(function () {
    if (reduce || typeof Lenis === 'undefined') return;
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  });

  function scrollToTarget(t, immediate) {
    if (lenis) {
      lenis.scrollTo(t, { offset: 0, duration: immediate ? 0 : 1.7, easing: function (x) { return 1 - Math.pow(1 - x, 4); } });
    } else {
      t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    }
  }

  /* ======================================================================
     2. Menu mobile plein écran
     ====================================================================== */
  var menuOpen = false;
  var burger = $('#burger'), menu = $('#menu'), panel = $('.menu__panel');
  safe(function () {
    gsap.set(panel, { yPercent: -100 });
    function setMenu(v) {
      menuOpen = v;
      burger.setAttribute('aria-expanded', String(v));
      burger.setAttribute('aria-label', v ? 'Fermer le menu' : 'Ouvrir le menu');
      menu.inert = !v;
      if (v) {
        menu.classList.add('is-open');
        if (lenis) lenis.stop();
        gsap.to(panel, { yPercent: 0, duration: 1, ease: 'expo.inOut' });
        gsap.fromTo('.menu__links a span', { yPercent: 115 }, { yPercent: 0, duration: 1.1, stagger: 0.06, delay: 0.35 });
        gsap.fromTo('.menu__foot', { opacity: 0 }, { opacity: 1, duration: 1, delay: 0.7 });
      } else {
        gsap.to(panel, { yPercent: -100, duration: 0.8, ease: 'expo.inOut', onComplete: function () { menu.classList.remove('is-open'); } });
        if (lenis && !root.classList.contains('is-loading')) lenis.start();
      }
    }
    burger.addEventListener('click', function () { setMenu(!menuOpen); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuOpen) { setMenu(false); burger.focus(); } });
    window.__closeMenu = function () { if (menuOpen) setMenu(false); };
  });

  /* Ancres : défilement fluide */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (id.length < 2) return;
    var t = document.querySelector(id);
    if (!t) return;
    e.preventDefault();
    var wasOpen = menuOpen;
    if (window.__closeMenu) window.__closeMenu();
    setTimeout(function () { scrollToTarget(t); }, wasOpen ? 450 : 0);
    if (history.replaceState) history.replaceState(null, '', id);
  });
  var up = $('#toTop');
  if (up) up.addEventListener('click', function () { scrollToTarget($('#top')); });

  /* ======================================================================
     3. Préchargeur « damier » + intro du hero
     ====================================================================== */
  var heroTl = null;

  function buildHeroIntro() {
    $$('[data-chars]').forEach(function (el) { if (el.closest('.hero')) splitText(el, 'chars'); });
    var chars = $$('.hero__title .c');

    heroTl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
    if (reduce) {
      heroTl.fromTo('.hero__inner, .hero__meta, .nav', { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.out' });
      return;
    }
    heroTl
      .fromTo('.hero__video', { scale: 1.35 }, { scale: 1.04, duration: 2.8, ease: 'power3.out' }, 0)
      .from('.hero__eyebrow', { y: 24, opacity: 0, duration: 1.1 }, 0.15)
      .from(chars, { yPercent: 118, duration: 1.7, stagger: { each: 0.045 } }, 0.1)
      .from('.hero__lead', { y: 34, opacity: 0, duration: 1.2 }, 0.75)
      .from('.hero__cta > *', { y: 28, opacity: 0, duration: 1.1, stagger: 0.12 }, 0.9)
      .from('.hero__meta > *', { y: 18, opacity: 0, duration: 1.1, stagger: 0.1 }, 1.05)
      .from('.nav', { yPercent: -100, duration: 1.2 }, 0.9)
      .from('.hero__leaf', { scale: 0, opacity: 0, duration: 1.6, stagger: 0.09, ease: 'back.out(1.7)' }, 0.5)
      .from('.checker--hero', { yPercent: 100, duration: 1.2 }, 0.7);
  }

  function readyPromise() {
    var pFonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    var pLoad = new Promise(function (r) { if (document.readyState === 'complete') r(); else { window.addEventListener('load', r, { once: true }); setTimeout(r, 2600); } });
    var v = $('#heroVideo');
    var pVideo = new Promise(function (r) {
      if (!v || v.readyState >= 3) return r();
      v.addEventListener('canplay', r, { once: true });
      v.addEventListener('error', r, { once: true });
      setTimeout(r, 2400);
    });
    var cap = new Promise(function (r) { setTimeout(r, 4500); });
    return Promise.race([Promise.all([pFonts, pLoad, pVideo]), cap]);
  }

  function runLoader() {
    var loader = $('#loader');
    function finish() {
      if (loader) loader.remove();
      root.classList.remove('is-loading');
      if (lenis) lenis.start();
      ScrollTrigger.refresh();
    }
    if (!loader) { finish(); heroTl.play(0); return; }

    if (reduce) {
      readyPromise().then(function () {
        gsap.to(loader, { opacity: 0, duration: 0.5, onComplete: finish });
        heroTl.play(0);
        window.__mvpReady = true;
      });
      return;
    }

    /* grille de cases de damier */
    var tiles = $('#loaderTiles');
    var cols = window.innerWidth < 700 ? 6 : 14;
    var size = Math.ceil(window.innerWidth / cols);
    var rows = Math.ceil(window.innerHeight / size);
    tiles.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
    tiles.style.gridTemplateRows = 'repeat(' + rows + ', ' + size + 'px)';
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var t = document.createElement('i');
        if ((r + c) % 2) t.className = 'is-w';
        tiles.appendChild(t);
      }
    }
    var cells = $$('i', tiles);

    /* le sprig se dessine */
    var paths = $$('.loader__sprig path');
    paths.forEach(function (p) {
      var len = p.getTotalLength();
      p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
    });

    var counter = { v: 0 };
    var countEl = $('#loaderCount');
    var intro = gsap.timeline();
    intro
      .from(cells, { scale: 0, duration: 0.7, stagger: { each: 0.012, from: 'random' }, ease: 'power3.out' }, 0)
      .from('.loader__card', { y: 40, opacity: 0, duration: 1, ease: 'expo.out' }, 0.25)
      .to(paths, { strokeDashoffset: 0, duration: 1.1, stagger: 0.09, ease: 'power2.inOut' }, 0.4)
      .to(counter, { v: 100, duration: 1.6, ease: 'power2.inOut', onUpdate: function () { countEl.textContent = pad(Math.round(counter.v)); } }, 0.3);

    var introDone = new Promise(function (res) { intro.eventCallback('onComplete', res); });

    Promise.all([introDone, readyPromise()]).then(function () {
      window.__mvpReady = true;
      var out = gsap.timeline({ onComplete: finish });
      out
        .to('.loader__card', { scale: 0.92, opacity: 0, duration: 0.55, ease: 'power3.in' })
        .to(cells, { scale: 0, duration: 0.9, stagger: { amount: 0.95, grid: [rows, cols], from: 'center' }, ease: 'expo.inOut' }, '-=0.1')
        .add(function () { heroTl.play(0); }, '-=0.95');
    });
  }

  /* ======================================================================
     4. Hero : parallax multicouche, flottement, vidéo premium
     ====================================================================== */
  function initHero() {
    if (reduce) {
      var v = $('#heroVideo'); if (v) { v.removeAttribute('autoplay'); v.pause(); }
      return;
    }
    var st = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
    gsap.to('.hero__media', { yPercent: 14, ease: 'none', scrollTrigger: st });
    gsap.to('.hero__inner', { yPercent: -16, opacity: 0.1, ease: 'none', scrollTrigger: st });
    gsap.to('.hero__meta', { opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: '20% top', end: '60% top', scrub: true } });
    $$('.hero__leaf').forEach(function (leaf) {
      var d = parseFloat(leaf.getAttribute('data-depth')) || 1;
      gsap.to(leaf, { y: -170 * d, ease: 'none', scrollTrigger: st });
      gsap.to(leaf, { x: '+=' + gsap.utils.random(-22, 22), rotation: '+=' + gsap.utils.random(-24, 24), duration: gsap.utils.random(3, 5.5), repeat: -1, yoyo: true, ease: 'sine.inOut' });
    });
    if (fine) {
      var xTo = gsap.quickTo('.hero__inner', 'x', { duration: 1.2, ease: 'power3' });
      $('.hero').addEventListener('pointermove', function (e) { xTo((e.clientX / window.innerWidth - 0.5) * -26); });
    }
  }

  /* Vidéo UHD : on part sur la HD (6 Mo), puis on bascule en 2K sur grand écran.
     Le fichier 2K (19 Mo) est stocké en 2 morceaux, recollés ici dans le navigateur. */
  function upgradeHeroVideo() {
    var v = $('#heroVideo');
    if (!v || reduce || !window.fetch) return;
    var conn = navigator.connection || {};
    if (conn.saveData || /(^|-)2g|3g/.test(conn.effectiveType || '')) return;
    if (window.innerWidth < 1100 || (navigator.hardwareConcurrency || 4) < 4 || (navigator.deviceMemory || 8) < 4) return;
    Promise.all(['assets/video/hero-uhd.part1', 'assets/video/hero-uhd.part2'].map(function (u) {
      return fetch(u).then(function (r) { if (!r.ok) throw new Error(u); return r.blob(); });
    })).then(function (parts) {
      var u = document.createElement('video');
      u.className = v.className;
      u.muted = true; u.loop = true; u.playsInline = true; u.preload = 'auto';
      u.setAttribute('aria-hidden', 'true');
      u.style.cssText = 'position:absolute;inset:0;opacity:0';
      u.src = URL.createObjectURL(new Blob(parts, { type: 'video/mp4' }));
      u.addEventListener('canplaythrough', function () {
        try { u.currentTime = (v.currentTime || 0) % (u.duration || 26); } catch (e) { /* ignore */ }
        var p = u.play();
        (p && p.then ? p : Promise.resolve()).then(function () {
          gsap.to(u, { opacity: 1, duration: 1.4, ease: 'power2.inOut', onComplete: function () { v.pause(); v.remove(); } });
        }, function () { u.remove(); });
      }, { once: true });
      v.parentNode.insertBefore(u, v.nextSibling);
    }).catch(function () { /* on reste en HD */ });
  }
  /* ======================================================================
     5. Navigation, progression, bouton flottant
     ====================================================================== */
  function initChrome() {
    var nav = $('#nav');
    var hidden = false;
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: function (self) {
        var y = self.scroll();
        nav.classList.toggle('is-solid', y > 60);
        if (menuOpen) return;
        if (y > 500 && self.direction === 1 && !hidden) { hidden = true; gsap.to(nav, { yPercent: -110, duration: 0.7, ease: 'power3.out', overwrite: 'auto' }); }
        else if ((self.direction === -1 || y <= 500) && hidden) { hidden = false; gsap.to(nav, { yPercent: 0, duration: 0.7, ease: 'power3.out', overwrite: 'auto' }); }
      }
    });
    if (!reduce) gsap.to('#progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.2 } });

    var fab = $('#fab');
    var pastHero = false, inBook = false;
    function paintFab() { fab.classList.toggle('is-on', pastHero && !inBook); }
    ScrollTrigger.create({ trigger: '.hero', start: 'bottom 85%', end: 'max', onToggle: function (s) { pastHero = s.isActive; paintFab(); } });
    ScrollTrigger.create({ trigger: '#reserver', start: 'top 70%', end: 'bottom 30%', onToggle: function (s) { inBook = s.isActive; paintFab(); } });
  }

  /* ======================================================================
     6. Damier : dérive pilotée par le scroll
     ====================================================================== */
  function initChecker() {
    if (reduce) return;
    $$('.checker__run').forEach(function (run) {
      var drift = parseFloat(run.getAttribute('data-drift')) || 0.4;
      var period = 0;
      function measure() { period = 2 * (parseFloat(getComputedStyle(run).getPropertyValue('--s')) || 26); }
      measure();
      window.addEventListener('resize', measure);
      var set = gsap.quickSetter(run, 'x', 'px');
      ScrollTrigger.create({
        trigger: run.parentNode, start: 'top bottom', end: 'bottom top',
        onUpdate: function (self) {
          var v = (self.scroll() * drift) % period;
          if (v > 0) v -= period;
          set(v);
        }
      });
    });
  }

  /* ======================================================================
     7. Marquee : vitesse, sens et inclinaison réagissent au scroll
     ====================================================================== */
  function initMarquee() {
    var sec = $('[data-marquee]');
    if (!sec) return;
    var track = $('.marquee__track', sec), group = $('.marquee__group', track);
    if (reduce) { return; }
    function setup() {
      $$('.marquee__group', track).slice(1).forEach(function (n) { n.remove(); });
      var w = group.offsetWidth;
      var need = Math.ceil((window.innerWidth * 1.4) / w) + 1;
      for (var i = 0; i < need; i++) {
        var cl = group.cloneNode(true); cl.setAttribute('aria-hidden', 'true'); track.appendChild(cl);
      }
      return w;
    }
    var total = setup();
    var pos = 0, dir = -1, boost = 0, base = 1.1;
    var setX = gsap.quickSetter(track, 'x', 'px');
    var setSkew = gsap.quickSetter(track, 'skewX', 'deg');
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: function (self) {
        boost = Math.min(18, Math.abs(self.getVelocity()) / 240);
        dir = self.direction === 1 ? -1 : 1;
      }
    });
    gsap.ticker.add(function (time, dt) {
      var k = Math.min(dt, 60) / 16.67;
      boost *= Math.pow(0.93, k);
      pos += dir * (base + boost) * k;
      if (pos <= -total) pos += total;
      if (pos > 0) pos -= total;
      setX(pos);
      setSkew(-dir * Math.min(boost, 12) * 0.7);
    });
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { total = setup(); }, 200); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { total = setup(); });
  }

  /* ======================================================================
     8. Révélations génériques : titres, textes, rideaux, parallax d'images
     ====================================================================== */
  function initReveals() {
    /* titres découpés */
    $$('[data-split]').forEach(function (el) {
      var parts = splitText(el, 'words');
      if (reduce) return;
      gsap.from(parts, { yPercent: 118, duration: 1.3, stagger: 0.06, scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
    });
    if (reduce) return;

    $$('[data-reveal]').forEach(function (el) {
      gsap.from(el, { y: 70, opacity: 0, duration: 1.4, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });

    /* rideau */
    $$('[data-curtain]').forEach(function (el) {
      var veil = document.createElement('span');
      veil.className = 'curtain__veil';
      el.appendChild(veil);
      gsap.to(veil, { scaleY: 0, duration: 1.5, ease: 'expo.inOut', scrollTrigger: { trigger: el, start: 'top 80%', once: true } });
      gsap.from($('iframe', el), { scale: 1.25, duration: 2, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 80%', once: true } });
    });

    /* cercle qui s'agrandit */
    $$('[data-circle]').forEach(function (el) {
      gsap.fromTo(el, { clipPath: 'circle(0% at 50% 50%)' }, {
        clipPath: 'circle(76% at 50% 50%)', ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 88%', end: 'top 25%', scrub: true }
      });
    });
  }

  /* images qui bougent dans leur cadre */
  function initImageParallax() {
    if (reduce) return;
    $$('img[data-parallax]').forEach(function (img) {
      var box = img.closest('.px') || img.parentNode;
      gsap.fromTo(img, { yPercent: -7 }, { yPercent: 7, ease: 'none', scrollTrigger: { trigger: box, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  /* ======================================================================
     9. La maison : section pinnée, storytelling étape par étape
     ====================================================================== */
  function initStory() {
    var mm = gsap.matchMedia();
    mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', function () {
      var steps = $$('.story__step'), frames = $$('.story__frame'), n = steps.length;
      var count = $('[data-story-count]');
      gsap.set(steps.slice(1), { opacity: 0, y: 60 });
      gsap.set(frames.slice(1), { yPercent: 100 });
      frames.slice(1).forEach(function (f) { gsap.set($('img', f), { yPercent: -100, scale: 1.25 }); });
      gsap.set($('img', frames[0]), { scale: 1.2 });

      var tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: '.story', start: 'top top', end: '+=' + (n * 95) + '%',
          pin: '.story__pin', scrub: 0.7, anticipatePin: 1, invalidateOnRefresh: true,
          onUpdate: function () {
            var idx = Math.max(0, Math.min(n - 1, Math.floor(tl.time() + 0.5)));
            count.textContent = pad(idx + 1);
          }
        }
      });
      tl.to($('img', frames[0]), { scale: 1, duration: 1 }, 0);
      for (var i = 1; i < n; i++) {
        tl.to(steps[i - 1], { opacity: 0, y: -50, duration: 0.35 }, i - 0.5)
          .to(frames[i], { yPercent: 0, duration: 0.8, ease: 'power2.inOut' }, i - 0.55)
          .to($('img', frames[i]), { yPercent: 0, scale: 1, duration: 0.8, ease: 'power2.inOut' }, i - 0.55)
          .to(steps[i], { opacity: 1, y: 0, duration: 0.4 }, i - 0.15);
      }
      tl.to({}, { duration: 0.7 });
      tl.to('.story__fill', { scaleX: 1, duration: tl.duration() }, 0);
    });

    mm.add('(max-width: 899px), (prefers-reduced-motion: reduce)', function () {
      if (reduce) return;
      $$('.story__step').forEach(function (s) {
        gsap.from(s, { y: 60, opacity: 0, duration: 1.2, scrollTrigger: { trigger: s, start: 'top 85%', once: true } });
      });
    });
  }

  /* ======================================================================
     10. Créations : défilement horizontal piloté par le scroll vertical
     ====================================================================== */
  function initCreations() {
    var mm = gsap.matchMedia();
    mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', function () {
      var track = $('.creations__track');
      var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
      var tween = gsap.to(track, {
        x: function () { return -dist(); }, ease: 'none',
        scrollTrigger: {
          trigger: '.creations', start: 'top top', end: function () { return '+=' + dist(); },
          pin: '.creations__pin', scrub: 1, anticipatePin: 1, invalidateOnRefresh: true
        }
      });
      $$('.card').forEach(function (card) {
        gsap.fromTo($('.card__media img', card), { xPercent: -7 }, {
          xPercent: 7, ease: 'none',
          scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true }
        });
        gsap.from(card, {
          opacity: 0, y: 80, duration: 1.2,
          scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left 92%', toggleActions: 'play none none none' }
        });
      });
      gsap.to('.creations__bar i', {
        scaleX: 1, ease: 'none',
        scrollTrigger: { trigger: '.creations', start: 'top top', end: function () { return '+=' + dist(); }, scrub: true }
      });
    });
    mm.add('(max-width: 899px) and (prefers-reduced-motion: no-preference)', function () {
      gsap.from('.card', { opacity: 0, y: 50, duration: 1.1, stagger: 0.1, scrollTrigger: { trigger: '.creations__track', start: 'top 90%', once: true } });
    });
  }

  /* ======================================================================
     11. Chiffres clés animés
     ====================================================================== */
  function initCounters() {
    $$('[data-count]').forEach(function (el) {
      var end = parseFloat(el.getAttribute('data-count'));
      var dec = parseInt(el.getAttribute('data-dec') || '0', 10);
      function fmt(v) { return v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
      if (reduce) { el.textContent = fmt(end); return; }
      el.textContent = fmt(0);
      var o = { v: 0 };
      ScrollTrigger.create({
        trigger: el, start: 'top 88%', once: true,
        onEnter: function () { gsap.to(o, { v: end, duration: 2.6, ease: 'power3.out', onUpdate: function () { el.textContent = fmt(o.v); } }); }
      });
    });
    if (!reduce) {
      var ring = $('.badge__ring');
      var spin = gsap.to(ring, { rotation: 360, duration: 26, repeat: -1, ease: 'none' });
      ScrollTrigger.create({ start: 0, end: 'max', onUpdate: function (self) { spin.timeScale(1 + Math.min(10, Math.abs(self.getVelocity()) / 300) * self.direction); } });
      gsap.fromTo('.figures__list li', { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 1.3, stagger: 0.12, scrollTrigger: { trigger: '.figures__list', start: 'top 85%', once: true } });
    }
  }

  /* ======================================================================
     12. Salon de thé : image flottante qui suit le curseur
     ====================================================================== */
  function initTea() {
    var float = $('#teaFloat');
    var items = $$('.tea__list li[data-img]');
    if (!float || !items.length || !fine || reduce) return;
    var urls = [];
    items.forEach(function (li) { var u = li.getAttribute('data-img'); if (urls.indexOf(u) === -1) urls.push(u); });
    float.innerHTML = '';
    urls.forEach(function (u, i) {
      var im = document.createElement('img');
      im.src = u; im.alt = ''; im.width = 400; im.height = 500; im.decoding = 'async';
      im.style.cssText = 'position:absolute;inset:0;opacity:' + (i === 0 ? 1 : 0) + ';transition:opacity .45s';
      float.appendChild(im);
    });
    var imgs = $$('img', float);
    gsap.set(float, { xPercent: -50, yPercent: -50, scale: 0.8, opacity: 0, rotation: -4 });
    var xTo = gsap.quickTo(float, 'x', { duration: 0.6, ease: 'power3' });
    var yTo = gsap.quickTo(float, 'y', { duration: 0.6, ease: 'power3' });
    var rTo = gsap.quickTo(float, 'rotation', { duration: 0.8, ease: 'power3' });
    var lastX = 0;
    var list = $('.tea__list');
    list.addEventListener('pointermove', function (e) {
      xTo(e.clientX + 40); yTo(e.clientY);
      rTo(gsap.utils.clamp(-9, 9, (e.clientX - lastX) * 0.4)); lastX = e.clientX;
    });
    items.forEach(function (li) {
      function show() {
        var i = urls.indexOf(li.getAttribute('data-img'));
        imgs.forEach(function (im, k) { im.style.opacity = k === i ? 1 : 0; });
        gsap.to(float, { opacity: 1, scale: 1, duration: 0.6, overwrite: 'auto' });
      }
      function hide() { gsap.to(float, { opacity: 0, scale: 0.8, duration: 0.5, overwrite: 'auto' }); }
      li.addEventListener('pointerenter', show); li.addEventListener('pointerleave', hide);
      li.addEventListener('focus', show); li.addEventListener('blur', hide);
    });
    gsap.from('.tea__list li', { y: 40, opacity: 0, duration: 1.2, stagger: 0.1, scrollTrigger: { trigger: '.tea__list', start: 'top 88%', once: true } });
  }

  /* ======================================================================
     13. Galerie : colonnes parallax, inclinaison 3D, lightbox
     ====================================================================== */
  function initGallery() {
    var mm = gsap.matchMedia();
    mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', function () {
      var spans = [[40, -90], [110, -150], [0, -230]];
      $$('.gallery__col').forEach(function (col, i) {
        gsap.fromTo(col, { y: spans[i][0] }, { y: spans[i][1], ease: 'none', scrollTrigger: { trigger: '.gallery__cols', start: 'top bottom', end: 'bottom top', scrub: true } });
      });
    });
    if (!reduce) {
      $$('.gal').forEach(function (g) {
        gsap.from(g, { y: 80, opacity: 0, duration: 1.3, scrollTrigger: { trigger: g, start: 'top 94%', once: true } });
      });
    }

    var dlg = $('#lightbox');
    var items = $$('.gal button');
    var idx = 0;
    var lbImg = $('#lbImg'), lbCap = $('#lbCap');
    function show(i, animate) {
      idx = (i + items.length) % items.length;
      var b = items[idx], im = $('img', b), cap = $('.gal__cap', b);
      lbImg.src = im.currentSrc || im.src;
      lbImg.alt = im.alt;
      lbCap.textContent = cap ? cap.textContent : '';
      if (animate && !reduce) gsap.fromTo(lbImg, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.8 });
    }
    items.forEach(function (b, i) {
      b.addEventListener('click', function () {
        show(i, false);
        if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
        if (lenis) lenis.stop();
        if (!reduce) gsap.fromTo(lbImg, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.9 });
      });
    });
    function close() { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
    dlg.addEventListener('close', function () { if (lenis && !menuOpen) lenis.start(); });
    $('#lbClose').addEventListener('click', close);
    $('#lbPrev').addEventListener('click', function () { show(idx - 1, true); });
    $('#lbNext').addEventListener('click', function () { show(idx + 1, true); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(idx - 1, true);
      if (e.key === 'ArrowRight') show(idx + 1, true);
    });
  }

  /* ======================================================================
     14. Avis : carrousel, barres de notes, étoiles
     ====================================================================== */
  function initReviews() {
    var track = $('#revTrack');
    if (!track) return;
    function step() { var c = $('.rev', track); return c ? c.offsetWidth + 22 : 400; }
    $('#revPrev').addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }); });
    $('#revNext').addEventListener('click', function () { track.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' }); });

    /* glisser à la souris */
    var down = false, sx = 0, sl = 0, moved = false;
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.target.closest('a,summary,button')) return;
      down = true; moved = false; sx = e.clientX; sl = track.scrollLeft;
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx;
      if (Math.abs(dx) > 4) { moved = true; track.classList.add('is-drag'); }
      track.scrollLeft = sl - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!down) return;
      down = false; track.classList.remove('is-drag');
      if (moved) track.scrollTo({ left: Math.round(track.scrollLeft / step()) * step(), behavior: 'smooth' });
    });

    if (reduce) {
      $$('.bars b').forEach(function (b) { b.style.transform = 'scaleX(' + b.getAttribute('data-bar') + ')'; });
      return;
    }
    $$('.bars b').forEach(function (b) {
      gsap.to(b, { scaleX: parseFloat(b.getAttribute('data-bar')), duration: 1.8, delay: 0.1, scrollTrigger: { trigger: '.bars', start: 'top 92%', once: true } });
    });
    gsap.from('.score__stars .ico', { scale: 0, rotation: -50, duration: 1, stagger: 0.1, ease: 'back.out(2)', scrollTrigger: { trigger: '.score__stars', start: 'top 92%', once: true } });
    gsap.from('.rev', { x: 110, opacity: 0, duration: 1.4, stagger: 0.14, scrollTrigger: { trigger: '.reviews__track', start: 'top 88%', once: true } });
    $$('.rev__stars').forEach(function (s) {
      gsap.from($$('.ico', s), { scale: 0, duration: 0.8, stagger: 0.07, ease: 'back.out(2.2)', delay: 0.5, scrollTrigger: { trigger: s, start: 'top 95%', once: true } });
    });
  }

  /* ======================================================================
     15. Instagram (polaroïds), réservation, accès, footer
     ====================================================================== */
  function initSections() {
    if (!reduce) {
      gsap.from('.pola', {
        y: 170, opacity: 0, rotation: function () { return gsap.utils.random(-20, 20); },
        duration: 1.6, stagger: 0.12, clearProps: 'transform,opacity',
        scrollTrigger: { trigger: '.polas', start: 'top 88%', once: true }
      });
      gsap.from('.book__card', {
        y: 90, opacity: 0, rotationX: -9, transformPerspective: 1200, duration: 1.6, clearProps: 'transform,opacity',
        scrollTrigger: { trigger: '.book__card', start: 'top 88%', once: true }
      });
      gsap.from('.book__intro > *', { y: 40, opacity: 0, duration: 1.2, stagger: 0.1, scrollTrigger: { trigger: '.book__intro', start: 'top 85%', once: true } });
      gsap.from('.hours tr', { x: -30, opacity: 0, duration: 1.1, stagger: 0.07, scrollTrigger: { trigger: '.hours', start: 'top 88%', once: true } });
      gsap.from('.access__addr > *, .access__btns > *, .social li', { y: 30, opacity: 0, duration: 1.1, stagger: 0.08, scrollTrigger: { trigger: '.access__info', start: 'top 80%', once: true } });
    }

    /* vidéo d'ambiance : lecture seulement quand elle est visible */
    var bv = $('[data-lazyvideo]');
    if (bv && 'IntersectionObserver' in window && !reduce) {
      bv.preload = 'metadata';
      new IntersectionObserver(function (en) {
        en.forEach(function (x) {
          if (x.isIntersecting) { var p = bv.play(); if (p && p.catch) p.catch(function () {}); } else bv.pause();
        });
      }, { threshold: 0.05 }).observe(bv);
    }

    /* footer : nom géant + sol en damier en perspective */
    $$('.footer__name [data-chars]').forEach(function (el) {
      var parts = splitText(el, 'chars');
      if (reduce) return;
      gsap.from(parts, { yPercent: 115, duration: 1.6, stagger: 0.04, scrollTrigger: { trigger: '.footer__name', start: 'top 95%', once: true } });
    });
    if (!reduce) {
      var run = gsap.to('.floor__tiles', { y: -120, duration: 2.8, ease: 'none', repeat: -1, paused: true });
      ScrollTrigger.create({ trigger: '.floor', start: 'top bottom', end: 'bottom top', onToggle: function (s) { if (s.isActive) run.play(); else run.pause(); } });
      gsap.from('.footer__top > *', { y: 40, opacity: 0, duration: 1.2, stagger: 0.12, scrollTrigger: { trigger: '.footer__top', start: 'top 92%', once: true } });
    }
  }

  /* ======================================================================
     16. Micro-interactions : boutons magnétiques, inclinaison, curseur
     ====================================================================== */
  function initMicro() {
    if (!fine || reduce) return;

    $$('.magnetic').forEach(function (b) {
      var xTo = gsap.quickTo(b, 'x', { duration: 0.7, ease: 'elastic.out(1, 0.5)' });
      var yTo = gsap.quickTo(b, 'y', { duration: 0.7, ease: 'elastic.out(1, 0.5)' });
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.32);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.4);
      });
      b.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
    });

    $$('[data-tilt]').forEach(function (el) {
      var glare = $('.glare', el);
      gsap.set(el, { transformPerspective: 900, transformOrigin: '50% 50%' });
      var rx = gsap.quickTo(el, 'rotationX', { duration: 0.7, ease: 'power3' });
      var ry = gsap.quickTo(el, 'rotationY', { duration: 0.7, ease: 'power3' });
      var gx = glare && gsap.quickTo(glare, 'x', { duration: 0.5, ease: 'power3' });
      var gy = glare && gsap.quickTo(glare, 'y', { duration: 0.5, ease: 'power3' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        ry((px - 0.5) * 11); rx(-(py - 0.5) * 11);
        if (glare) { gx(px * r.width); gy(py * r.height); }
      });
      el.addEventListener('pointerleave', function () { rx(0); ry(0); });
    });

    /* curseur : un point qui suit, grossit sur les liens */
    var cur = $('#cursor');
    var cx = gsap.quickTo(cur, 'x', { duration: 0.4, ease: 'power3' });
    var cy = gsap.quickTo(cur, 'y', { duration: 0.4, ease: 'power3' });
    window.addEventListener('pointermove', function (e) { cx(e.clientX); cy(e.clientY); cur.classList.remove('is-hidden'); }, { passive: true });
    document.addEventListener('pointerleave', function () { cur.classList.add('is-hidden'); });
    document.addEventListener('pointerover', function (e) {
      var t = e.target.closest('a, button, label, summary, input, textarea, [data-cursor], .tea__list li');
      cur.classList.toggle('is-view', !!t && t.hasAttribute('data-cursor'));
      cur.classList.toggle('is-link', !!t && !t.hasAttribute('data-cursor'));
    });
  }

  /* ======================================================================
     Démarrage
     ====================================================================== */
  safe(buildHeroIntro);
  safe(initHero);
  safe(initChrome);
  safe(initChecker);
  safe(initMarquee);
  safe(initReveals);
  safe(initImageParallax);
  safe(initStory);
  safe(initCreations);
  safe(initCounters);
  safe(initTea);
  safe(initGallery);
  safe(initReviews);
  safe(initSections);
  safe(initMicro);
  safe(runLoader);

  /* filet de sécurité : le site ne doit jamais rester bloqué sous le préchargeur */
  setTimeout(function () {
    if (root.classList.contains('is-loading')) {
      root.classList.remove('is-loading');
      if (lenis) lenis.start();
      var l = $('#loader'); if (l) l.remove();
      if (heroTl) heroTl.progress(1);
    }
  }, 10500);

  window.addEventListener('load', function () {
    ScrollTrigger.refresh();
    setTimeout(upgradeHeroVideo, 2500);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
})();
