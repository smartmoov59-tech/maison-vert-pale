/* ==========================================================================
   Maison Vert Pâle — réservation en ligne SANS back-end
   Le visiteur choisit (envie → jour/heure → coordonnées), le site compose
   un message prêt à envoyer. Canaux : SMS pré-rempli (si un mobile est
   renseigné dans config.js), Instagram (message copié), e-mail (si renseigné),
   appel, fichier agenda .ics. Aucune donnée n'est stockée ni envoyée à un
   serveur : rien à payer, rien à maintenir.
   ========================================================================== */
(function () {
  'use strict';

  var C = window.MVP;
  var form = document.getElementById('bookForm');
  if (!form || !C) return;

  var R = C.resa;
  var TABLE_MIN = 75;   // durée d'une table
  var RETRAIT_MIN = 15; // durée « agenda » d'un retrait

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function pad(n) { return String(n).padStart(2, '0'); }
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var el = {
    steps: $$('.step', form),
    dots: $$('#steps li'),
    days: $('#days'),
    slots: $('#slots'),
    slotHint: $('#slotHint'),
    people: $('#peopleField'),
    pVal: $('#pVal'),
    pMinus: $('#pMinus'),
    pPlus: $('#pPlus'),
    name: $('#fName'),
    phone: $('#fPhone'),
    phoneErr: $('#phoneErr'),
    notes: $('#fNotes'),
    back: $('#bBack'),
    next: $('#bNext'),
    recapList: $('#recapList'),
    recapActions: $('#recapActions'),
    toast: $('#recapToast')
  };

  var state = { step: 1, type: null, dayKey: null, time: null, people: 2 };
  var days = [];

  /* ---------- Jours & créneaux (calendrier Europe/Paris) ---------- */
  function buildDays() {
    var n = C.parisParts();
    var base = Date.UTC(n.y, n.m - 1, n.d);
    days = [];
    for (var i = 0; i < R.jours; i++) {
      var dt = new Date(base + i * 86400000);
      var y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate(), dow = dt.getUTCDay();
      days.push({ i: i, key: y + '-' + pad(m) + '-' + pad(d), y: y, m: m, d: d, dow: dow, date: dt, ranges: C.horaires[dow] || [] });
    }
  }

  function slotsFor(day, type) {
    var out = [];
    var n = C.parisParts();
    var nowMin = n.h * 60 + n.min;
    var before = type === 'table' ? R.tableDernierAvantFermeture : R.retraitDernierAvantFermeture;
    day.ranges.forEach(function (rg) {
      var a = C.toMin(rg[0]);
      var b = C.toMin(rg[1]) - before;
      for (var t = a; t <= b; t += R.pasMinutes) {
        if (day.i === 0 && t < nowMin + R.delaiMinMinutes) continue;
        out.push(t);
      }
    });
    return out;
  }

  function dayById(key) { return days.filter(function (d) { return d.key === key; })[0]; }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function dateLong(day) {
    return day.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  function renderDays() {
    buildDays();
    el.days.innerHTML = '';
    var firstOk = null;
    days.forEach(function (day) {
      var slots = slotsFor(day, state.type);
      var disabled = slots.length === 0;
      var wd = day.date.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
      var mo = day.date.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' }).replace('.', '');
      var tag = disabled ? (day.ranges.length ? 'Passé' : 'Fermé') : (day.i === 0 ? 'Auj.' : day.i === 1 ? 'Demain' : mo);
      var label = document.createElement('label');
      label.className = 'day';
      label.innerHTML = '<input type="radio" name="day" value="' + day.key + '"' + (disabled ? ' disabled' : '') + '>' +
        '<span class="day__body"><small>' + wd + '</small><b>' + day.d + '</b><em>' + tag + '</em></span>';
      el.days.appendChild(label);
      if (!disabled && !firstOk) firstOk = day.key;
    });
    var keep = state.dayKey && dayById(state.dayKey) && slotsFor(dayById(state.dayKey), state.type).length;
    if (!keep) { state.dayKey = null; state.time = null; }
    if (state.dayKey) {
      var inp = $('input[value="' + state.dayKey + '"]', el.days);
      if (inp) inp.checked = true;
    }
    renderSlots();
  }

  function renderSlots() {
    el.slots.innerHTML = '';
    var day = state.dayKey ? dayById(state.dayKey) : null;
    if (!day) { el.slotHint.textContent = 'Choisissez d’abord un jour.'; return; }
    var slots = slotsFor(day, state.type);
    if (state.time && slots.indexOf(state.time) === -1) state.time = null;
    slots.forEach(function (t) {
      var l = document.createElement('label');
      l.className = 'slot';
      l.innerHTML = '<input type="radio" name="time" value="' + t + '"' + (t === state.time ? ' checked' : '') + '><span>' + C.fmtHeure(t) + '</span>';
      el.slots.appendChild(l);
    });
    el.slotHint.textContent = state.type === 'table'
      ? 'Une table dure environ 1 h 15. Dernière table 1 h avant la fermeture.'
      : 'Heure de retrait souhaitée, dans les horaires d’ouverture de la boutique.';
  }

  /* ---------- Validation ---------- */
  function validPhone(v) { return /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.\-]*\d{2}){4}$/.test(String(v).trim()); }

  function isValid(step) {
    if (step === 1) return !!state.type;
    if (step === 2) return !!(state.dayKey && state.time !== null && (state.type !== 'table' || state.people >= 1));
    if (step === 3) return el.name.value.trim().length >= 2 && validPhone(el.phone.value);
    return true;
  }

  function updateNav() {
    el.next.disabled = !isValid(state.step);
    el.back.hidden = state.step === 1;
    el.next.hidden = state.step === 4;
    var span = $('span', el.next);
    span.textContent = state.step === 3 ? 'Voir le récapitulatif' : 'Continuer';
  }

  /* ---------- Navigation entre étapes ---------- */
  function goStep(n, silent) {
    state.step = n;
    el.steps.forEach(function (s) { s.hidden = Number(s.getAttribute('data-step')) !== n; });
    el.dots.forEach(function (li, i) {
      li.classList.toggle('is-active', i + 1 === n);
      li.classList.toggle('is-done', i + 1 < n || n === 4);
    });
    if (n === 2) {
      renderDays();
      var isTable = state.type === 'table';
      el.people.hidden = !isTable;
      el.pVal.textContent = state.people;
      $('#slotLegend').textContent = isTable ? 'À quelle heure ?' : 'Pour quelle heure de retrait ?';
    }
    if (n === 3) {
      var ph = { table: 'Allergies, occasion, poussette…', retrait: 'Couleurs, budget, destinataire…', ceremonie: 'Type de composition, message sur le ruban, budget…' };
      el.notes.placeholder = ph[state.type] || '';
    }
    if (n === 4) buildRecap();
    updateNav();
    var cur = $('.step[data-step="' + n + '"]', form);
    if (cur && !silent) {
      if (window.gsap && !reduce) window.gsap.fromTo(cur, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .7, ease: 'expo.out', clearProps: 'transform' });
      cur.setAttribute('tabindex', '-1');
      cur.focus({ preventScroll: true });
    }
    if (window.ScrollTrigger) setTimeout(function () { window.ScrollTrigger.refresh(); }, 60);
  }

  /* ---------- Récapitulatif & message ---------- */
  function typeLabel(t) {
    return { table: 'Table au salon de thé', retrait: 'Bouquet à retirer en boutique', ceremonie: 'Composition pour une cérémonie' }[t];
  }

  function buildMessage() {
    var day = dayById(state.dayKey);
    var when = dateLong(day) + ' à ' + C.fmtHeure(state.time);
    var lines = ['Bonjour Maison Vert Pâle,', ''];
    if (state.type === 'table') {
      lines.push('Je souhaite réserver une table au salon de thé pour ' + state.people + (state.people > 1 ? ' personnes' : ' personne') + ', le ' + when + '.');
    } else if (state.type === 'retrait') {
      lines.push('Je souhaite commander un bouquet à retirer en boutique le ' + when + '.');
    } else {
      lines.push('Je souhaite commander une composition pour une cérémonie, à retirer le ' + when + '.');
    }
    var notes = el.notes.value.trim();
    if (notes) lines.push('Précisions : ' + notes);
    lines.push('', 'Nom : ' + el.name.value.trim(), 'Téléphone : ' + el.phone.value.trim(), '', 'Merci de me confirmer la disponibilité. À bientôt !');
    return lines.join('\n');
  }

  function row(dt, dd) {
    return '<div><dt>' + dt + '</dt><dd>' + dd.replace(/</g, '&lt;') + '</dd></div>';
  }

  function icon(id) { return '<svg class="ico" aria-hidden="true"><use href="#' + id + '"/></svg>'; }

  function buildRecap() {
    var day = dayById(state.dayKey);
    var html = row('Envie', typeLabel(state.type)) +
      row('Quand', cap(dateLong(day)) + ' · ' + C.fmtHeure(state.time));
    if (state.type === 'table') html += row('Personnes', String(state.people));
    html += row('Nom', el.name.value.trim()) + row('Téléphone', el.phone.value.trim());
    var notes = el.notes.value.trim();
    if (notes) html += row('Précisions', notes);
    el.recapList.innerHTML = html;

    var msg = buildMessage();
    var a = [];
    var primaryDone = false;
    function klass() { if (!primaryDone) { primaryDone = true; return 'btn btn--primary'; } return 'btn btn--outline'; }

    if (C.sms) {
      a.push('<a class="' + klass() + '" href="sms:' + C.sms + '?&body=' + encodeURIComponent(msg) + '">' + icon('i-chat') + '<span>Envoyer par SMS</span></a>');
    }
    a.push('<button type="button" class="' + klass() + '" data-act="ig">' + icon('i-insta') + '<span>Écrire sur Instagram</span></button>');
    if (C.email) {
      a.push('<a class="' + klass() + '" href="mailto:' + C.email + '?subject=' + encodeURIComponent('Demande de réservation — ' + typeLabel(state.type)) + '&body=' + encodeURIComponent(msg) + '">' + icon('i-mail') + '<span>Envoyer par e-mail</span></a>');
    }
    a.push('<a class="btn btn--dark" href="tel:' + C.telIntl + '">' + icon('i-phone') + '<span>Appeler le ' + C.tel + '</span></a>');
    a.push('<button type="button" class="btn btn--outline" data-act="ics">' + icon('i-cal') + '<span>Ajouter à mon agenda</span></button>');
    a.push('<button type="button" class="btn btn--ghost-dark" data-act="copy">' + icon('i-copy') + '<span>Copier le message</span></button>');
    el.recapActions.innerHTML = a.join('');
    el.toast.textContent = '';
  }

  /* ---------- Actions : copie, Instagram, agenda ---------- */
  function fallbackCopy(t) {
    var ta = document.createElement('textarea');
    ta.value = t; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(t).then(function () { return true; }, function () { return fallbackCopy(t); });
    }
    return Promise.resolve(fallbackCopy(t));
  }

  function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function icsFold(line) {
    var out = [];
    while (line.length > 74) { out.push(line.slice(0, 74)); line = ' ' + line.slice(74); }
    out.push(line);
    return out.join('\r\n');
  }
  function stamp(d) {
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z';
  }
  function downloadICS() {
    var day = dayById(state.dayKey);
    var start = C.parisToDate(day.y, day.m, day.d, Math.floor(state.time / 60), state.time % 60);
    var end = new Date(start.getTime() + (state.type === 'table' ? TABLE_MIN : RETRAIT_MIN) * 60000);
    var title = (state.type === 'table' ? 'Table au salon de thé' : state.type === 'retrait' ? 'Retrait de bouquet' : 'Retrait de composition') + ' — Maison Vert Pâle';
    var desc = 'Demande à faire confirmer par la boutique : ' + C.tel + '.\n\n' + buildMessage();
    var lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Maison Vert Pale//Reservation//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + Date.now() + '@maison-vert-pale',
      'DTSTAMP:' + stamp(new Date()),
      'DTSTART:' + stamp(start),
      'DTEND:' + stamp(end),
      'SUMMARY:' + icsEscape(title),
      'LOCATION:' + icsEscape('Maison Vert Pâle, 22 Rue Principale, 13540 Puyricard'),
      'DESCRIPTION:' + icsEscape(desc),
      'BEGIN:VALARM', 'TRIGGER:-PT60M', 'ACTION:DISPLAY', 'DESCRIPTION:Rappel — Maison Vert Pâle', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ].map(icsFold).join('\r\n');
    var blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url; link.download = 'reservation-maison-vert-pale.ics';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  el.recapActions.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act');
    var msg = buildMessage();
    if (act === 'copy') {
      copyText(msg).then(function (ok) { el.toast.textContent = ok ? 'Message copié. Vous pouvez le coller où vous voulez.' : 'Copie impossible : sélectionnez le texte et copiez-le à la main.'; });
    } else if (act === 'ig') {
      copyText(msg).then(function (ok) {
        el.toast.textContent = ok ? 'Message copié : collez-le dans la conversation Instagram qui vient de s’ouvrir.' : 'Conversation Instagram ouverte : écrivez-nous votre demande.';
      });
      window.open('https://ig.me/m/' + C.instagram, '_blank', 'noopener');
    } else if (act === 'ics') {
      downloadICS();
      el.toast.textContent = 'Fichier agenda téléchargé. Pensez à appeler pour confirmer.';
    }
  });

  /* ---------- Événements du formulaire ---------- */
  form.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'type') {
      var changed = state.type !== t.value;
      state.type = t.value;
      if (changed) { state.time = null; }
    } else if (t.name === 'day') {
      state.dayKey = t.value; state.time = null; renderSlots();
    } else if (t.name === 'time') {
      state.time = Number(t.value);
    }
    updateNav();
  });

  form.addEventListener('input', function (e) {
    if (e.target === el.phone) {
      var bad = el.phone.value.trim() !== '' && !validPhone(el.phone.value);
      el.phoneErr.hidden = !bad || document.activeElement === el.phone;
      el.phone.setAttribute('aria-invalid', bad ? 'true' : 'false');
    }
    updateNav();
  });
  el.phone.addEventListener('blur', function () {
    var bad = el.phone.value.trim() !== '' && !validPhone(el.phone.value);
    el.phoneErr.hidden = !bad;
    el.phone.setAttribute('aria-invalid', bad ? 'true' : 'false');
  });

  el.pMinus.addEventListener('click', function () { state.people = Math.max(1, state.people - 1); sync(); });
  el.pPlus.addEventListener('click', function () { state.people = Math.min(R.personnesMax, state.people + 1); sync(); });
  function sync() {
    el.pVal.textContent = state.people;
    el.pMinus.disabled = state.people <= 1;
    el.pPlus.disabled = state.people >= R.personnesMax;
    if (state.people >= R.personnesMax) el.slotHint.textContent = 'Au-delà de ' + R.personnesMax + ' personnes, appelez-nous : nous organisons ça.';
    updateNav();
  }

  el.next.addEventListener('click', function () {
    if (!isValid(state.step)) return;
    goStep(state.step + 1);
  });
  el.back.addEventListener('click', function () { goStep(Math.max(1, state.step - 1)); });
  form.addEventListener('submit', function (e) { e.preventDefault(); if (state.step < 4) el.next.click(); });

  /* ---------- Préselection depuis les cartes (« Commander », « Réserver ») ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-book]');
    if (!a) return;
    var type = a.getAttribute('data-book');
    var radio = $('input[name="type"][value="' + type + '"]', form);
    if (!radio) return;
    radio.checked = true;
    var changed = state.type !== type;
    state.type = type;
    if (changed) state.time = null;
    goStep(2, true);
  });

  /* ---------- Init ---------- */
  sync();
  goStep(1, true);
})();
