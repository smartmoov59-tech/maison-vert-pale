/* ==========================================================================
   Maison Vert Pâle — configuration du site
   Tout ce qui est « donnée de la boutique » est ici : on modifie ce fichier,
   pas le HTML. Aucun service externe, aucun abonnement.
   ========================================================================== */
window.MVP = {
  nom: 'Maison Vert Pâle',
  tel: '09 86 70 44 87',
  telIntl: '+33986704487',

  /* Canaux de réservation (en plus de l'appel) ------------------------------
     sms   : numéro de MOBILE de la boutique, ex. '+33612345678'.
             Laisser vide tant qu'il n'y en a pas : le numéro actuel (09 86…)
             est une ligne fixe/box qui ne reçoit généralement pas les SMS.
     email : adresse e-mail de la boutique (laisser vide si aucune).
     instagram : le message est copié, puis la conversation Instagram s'ouvre. */
  sms: '',
  email: '',
  instagram: 'maisonvertpale',
  facebook: 'https://www.facebook.com/p/Maison-Vert-P%C3%A2le-61567334937593/',

  adresseLigne1: '22 Rue Principale',
  adresseLigne2: '13540 Puyricard (Aix-en-Provence)',
  lat: 43.5826715,
  lng: 5.4196017,
  mapsUrl: 'https://www.google.com/maps/place/Maison+Vert+P%C3%A2le/@43.5826715,5.4196017,17z/data=!4m6!3m5!1s0x12c98d356efae02f:0x6072a1d7e55cdcfa!8m2!3d43.5826715!4d5.4196017!16s%2Fg%2F11wtc3bgxz',
  itineraireUrl: 'https://www.google.com/maps/dir/?api=1&destination=43.5826715,5.4196017',

  /* Horaires : 0 = dimanche … 6 = samedi (relevés sur Google Maps le 08/11/2026) */
  horaires: {
    0: [['09:00', '13:00']],
    1: [],
    2: [['09:00', '13:00'], ['15:00', '19:00']],
    3: [['09:00', '13:00'], ['15:00', '19:00']],
    4: [['09:00', '13:00'], ['15:00', '19:00']],
    5: [['09:00', '19:00']],
    6: [['09:00', '19:00']]
  },

  /* Règles de la réservation en ligne */
  resa: {
    pasMinutes: 30,          // un créneau toutes les 30 min
    delaiMinMinutes: 60,     // pas de demande pour dans moins d'1 h
    jours: 14,               // fenêtre de réservation
    tableDernierAvantFermeture: 60,   // dernière table : 1 h avant la fermeture
    retraitDernierAvantFermeture: 15, // dernier retrait : 15 min avant
    personnesMax: 8          // au-delà : « appelez-nous »
  },

  /* Prix : aucun tarif public n'a été trouvé (Instagram, Facebook, Google).
     Pour afficher un prix sur une carte, remplacer null par un texte,
     ex. bouquets: 'à partir de 25 €'. null = « Sur mesure ». */
  prix: {
    bouquets: null,
    coupees: null,
    compositions: null,
    plantes: null,
    deuil: null,
    the: null
  }
};

/* --------------------------------------------------------------------------
   Utilitaires horaires (fuseau Europe/Paris, quel que soit le visiteur)
   -------------------------------------------------------------------------- */
(function (C) {
  var TZ = 'Europe/Paris';
  var fmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit'
  });

  C.parisParts = function (date) {
    var o = {};
    fmt.formatToParts(date || new Date()).forEach(function (p) { o[p.type] = p.value; });
    var y = +o.year, m = +o.month, d = +o.day;
    return {
      y: y, m: m, d: d, h: +o.hour, min: +o.minute,
      dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay()
    };
  };

  C.toMin = function (hhmm) { var p = hhmm.split(':'); return (+p[0]) * 60 + (+p[1]); };

  C.fmtHeure = function (min) {
    var h = Math.floor(min / 60), m = min % 60;
    return h + 'h' + (m ? String(m).padStart(2, '0') : '');
  };

  /* Retourne le décalage Paris→UTC (en minutes) pour une date locale donnée */
  C.parisToDate = function (y, m, d, hh, mm) {
    var guess = Date.UTC(y, m - 1, d, hh, mm);
    for (var i = 0; i < 2; i++) {
      var p = C.parisParts(new Date(guess));
      var asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
      var off = (asUtc - guess) / 60000;
      guess = Date.UTC(y, m - 1, d, hh, mm) - off * 60000;
    }
    return new Date(guess);
  };

  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  C.JOURS = JOURS;

  C.openStatus = function () {
    var n = C.parisParts();
    var now = n.h * 60 + n.min;
    var today = C.horaires[n.dow] || [];
    for (var i = 0; i < today.length; i++) {
      var a = C.toMin(today[i][0]), b = C.toMin(today[i][1]);
      if (now >= a && now < b) {
        return { open: true, label: 'Ouvert · jusqu’à ' + C.fmtHeure(b) };
      }
    }
    for (var j = 0; j < today.length; j++) {
      var s = C.toMin(today[j][0]);
      if (now < s) return { open: false, label: 'Fermé · ouvre à ' + C.fmtHeure(s) };
    }
    for (var k = 1; k <= 7; k++) {
      var dow = (n.dow + k) % 7;
      var r = C.horaires[dow] || [];
      if (r.length) {
        var when = k === 1 ? 'demain' : JOURS[dow];
        return { open: false, label: 'Fermé · ouvre ' + when + ' à ' + C.fmtHeure(C.toMin(r[0][0])) };
      }
    }
    return { open: false, label: 'Fermé' };
  };
})(window.MVP);
