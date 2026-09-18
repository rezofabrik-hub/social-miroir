/* Cabinet Corinne Cortes — calculateurs financiers.
 *
 * Les formulaires sont dans la page (HTML réel, lisible par les moteurs de
 * recherche et sans JavaScript) ; ce fichier ne porte que les calculs.
 * Chaque simulateur du HTML expose `data-simu="<clé>"` et retrouve ici sa
 * fonction. Aucune donnée n'est envoyée nulle part : tout est calculé dans
 * le navigateur du visiteur.
 *
 * Conventions communes :
 *   - les taux sont saisis en pourcentage annuel et ramenés en décimal ;
 *   - les mensualités sont calculées à terme échu (fin de période), usage
 *     courant du crédit amortissable en France ;
 *   - une hypothèse impossible renvoie un message plutôt qu'un NaN.
 */
(function () {
  'use strict';

  var euro = new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 2
  });
  var nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
  var pourcent = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

  var eur = function (v) { return euro.format(v); };
  var pct = function (v) { return pourcent.format(v * 100) + ' %'; };
  var nb = function (v, unite) { return nombre.format(v) + (unite ? ' ' + unite : ''); };

  /** Erreur « métier » : le calcul est impossible avec ces hypothèses. */
  function Impossible(message) { this.message = message; }

  /**
   * Résout f(x) = 0 par dichotomie. Utilisé pour les taux, qui n'ont pas de
   * forme analytique dès qu'il y a une suite de versements.
   */
  function dichotomie(f, bas, haut) {
    var fBas = f(bas);
    if (fBas * f(haut) > 0) return null;      // pas de racine dans l'intervalle
    for (var k = 0; k < 200; k++) {
      var milieu = (bas + haut) / 2;
      var fMilieu = f(milieu);
      if (Math.abs(fMilieu) < 1e-9) return milieu;
      if (fBas * fMilieu < 0) { haut = milieu; } else { bas = milieu; fBas = fMilieu; }
    }
    return (bas + haut) / 2;
  }

  var CALCULS = {

    /* --- Épargne et placement ------------------------------------------ */

    'interets-composes': function (v) {
      var i = v.taux / 100;
      var acquise = v.capital * Math.pow(1 + i, v.duree);
      return [
        ['Valeur acquise', eur(acquise), true],
        ['Intérêts cumulés', eur(acquise - v.capital)],
        ['Capital de départ', eur(v.capital)]
      ];
    },

    'versements-constants': function (v) {
      var i = v.taux / 100;
      // Versements de fin de période : VA = V × ((1+i)^n − 1) / i
      var acquise = i === 0
        ? v.versement * v.duree
        : v.versement * (Math.pow(1 + i, v.duree) - 1) / i;
      var verse = v.versement * v.duree;
      return [
        ['Valeur acquise', eur(acquise), true],
        ['Total des versements', eur(verse)],
        ['Intérêts cumulés', eur(acquise - verse)]
      ];
    },

    'taux-rendement-capital': function (v) {
      if (v.capital <= 0) throw new Impossible('Le capital de départ doit être supérieur à zéro.');
      if (v.acquise <= 0) throw new Impossible('La valeur acquise doit être supérieure à zéro.');
      var i = Math.pow(v.acquise / v.capital, 1 / v.duree) - 1;
      return [
        ['Taux de rendement annuel', pct(i), true],
        ['Gain total', eur(v.acquise - v.capital)],
        ['Multiple du capital', nb(v.acquise / v.capital, 'fois')]
      ];
    },

    'taux-rendement-versements': function (v) {
      var verse = v.versement * v.duree;
      if (v.acquise <= 0) throw new Impossible('La valeur acquise doit être supérieure à zéro.');
      if (v.acquise < verse) {
        throw new Impossible(
          'La valeur acquise (' + eur(v.acquise) + ') est inférieure au total versé (' +
          eur(verse) + ') : le rendement serait négatif, ce calculateur ne le couvre pas.');
      }
      var i = dichotomie(function (t) {
        var va = t === 0 ? v.versement * v.duree
                         : v.versement * (Math.pow(1 + t, v.duree) - 1) / t;
        return va - v.acquise;
      }, 0, 1);
      if (i === null) throw new Impossible('Aucun taux ne permet d’atteindre cette valeur acquise.');
      return [
        ['Taux de rendement annuel', pct(i), true],
        ['Total des versements', eur(verse)],
        ['Intérêts cumulés', eur(v.acquise - verse)]
      ];
    },

    /* --- Emprunt -------------------------------------------------------- */

    'mensualite-emprunt': function (v) {
      var i = v.taux / 100 / 12;
      var n = v.duree * 12;
      if (n <= 0) throw new Impossible('La durée doit être supérieure à zéro.');
      var m = i === 0 ? v.capital / n : v.capital * i / (1 - Math.pow(1 + i, -n));
      return [
        ['Mensualité', eur(m), true],
        ['Coût total du crédit', eur(m * n - v.capital)],
        ['Total remboursé', eur(m * n)],
        ['Nombre de mensualités', nb(n)]
      ];
    },

    'capacite-emprunt': function (v) {
      var i = v.taux / 100 / 12;
      var n = v.duree * 12;
      if (n <= 0) throw new Impossible('La durée doit être supérieure à zéro.');
      var c = i === 0 ? v.mensualite * n : v.mensualite * (1 - Math.pow(1 + i, -n)) / i;
      return [
        ['Capital empruntable', eur(c), true],
        ['Total remboursé', eur(v.mensualite * n)],
        ['Coût total du crédit', eur(v.mensualite * n - c)]
      ];
    },

    'duree-emprunt': function (v) {
      var i = v.taux / 100 / 12;
      if (i === 0) {
        var mois0 = v.capital / v.mensualite;
        return [['Durée de remboursement', nb(Math.ceil(mois0), 'mois'), true]];
      }
      var interetsPremierMois = v.capital * i;
      if (v.mensualite <= interetsPremierMois) {
        throw new Impossible(
          'Avec ' + eur(v.mensualite) + ' par mois, le remboursement ne couvre même pas les ' +
          eur(interetsPremierMois) + ' d’intérêts du premier mois : la dette ne diminue jamais.');
      }
      var n = -Math.log(1 - v.capital * i / v.mensualite) / Math.log(1 + i);
      var mois = Math.ceil(n);
      return [
        ['Durée de remboursement', nb(mois, 'mois'), true],
        ['Soit', nb(Math.floor(mois / 12), 'ans') + ' et ' + nb(mois % 12, 'mois')],
        ['Coût total du crédit', eur(v.mensualite * n - v.capital)]
      ];
    },

    /* --- Gestion -------------------------------------------------------- */

    'seuil-rentabilite': function (v) {
      if (v.ca <= 0) throw new Impossible('Le chiffre d’affaires doit être supérieur à zéro.');
      if (v.variables >= v.ca) {
        throw new Impossible(
          'Les charges variables (' + eur(v.variables) + ') atteignent ou dépassent le chiffre ' +
          'd’affaires : la marge sur coûts variables est nulle ou négative, il n’existe pas de seuil.');
      }
      var marge = v.ca - v.variables;
      var tauxMarge = marge / v.ca;
      var seuil = v.fixes / tauxMarge;
      var pointMort = seuil / v.ca * 365;
      return [
        ['Seuil de rentabilité', eur(seuil), true],
        ['Taux de marge sur coûts variables', pct(tauxMarge)],
        ['Point mort', nb(Math.ceil(pointMort), 'jours d’activité')],
        ['Résultat au niveau actuel', eur(marge - v.fixes)]
      ];
    },

    'jours-ouvres': function (v) {
      // Équivalence légale des congés payés : 30 jours ouvrables = 25 jours ouvrés.
      var ouvres = v.ouvrables * 25 / 30;
      return [
        ['Jours ouvrés correspondants', nb(ouvres, 'jours'), true],
        ['Semaines complètes', nb(v.ouvrables / 6, 'semaines')],
        ['Rappel', '30 jours ouvrables = 25 jours ouvrés = 5 semaines']
      ];
    }
  };

  /* --- Branchement des formulaires ------------------------------------- */

  document.querySelectorAll('[data-simu]').forEach(function (bloc) {
    var cle = bloc.getAttribute('data-simu');
    var calcul = CALCULS[cle];
    if (!calcul) return;

    var formulaire = bloc.querySelector('form');
    var sortie = bloc.querySelector('[data-sortie]');

    function calculer() {
      var valeurs = {};
      var incomplet = false;

      formulaire.querySelectorAll('input[type="number"]').forEach(function (champ) {
        var v = parseFloat(String(champ.value).replace(',', '.'));
        if (!isFinite(v)) { incomplet = true; return; }
        valeurs[champ.getAttribute('data-champ')] = v;
      });

      if (incomplet) {
        sortie.innerHTML = '<p class="simu__attente">Renseignez tous les champs pour voir le résultat.</p>';
        return;
      }

      var lignes;
      try {
        lignes = calcul(valeurs);
      } catch (e) {
        if (e instanceof Impossible) {
          sortie.innerHTML = '<p class="simu__alerte">' + e.message + '</p>';
          return;
        }
        sortie.innerHTML = '<p class="simu__alerte">Ce calcul n’aboutit pas avec ces valeurs.</p>';
        return;
      }

      sortie.innerHTML = lignes.map(function (l) {
        return '<div class="simu__ligne' + (l[2] ? ' simu__ligne--cle' : '') + '">' +
                 '<span class="simu__cle">' + l[0] + '</span>' +
                 '<span class="simu__val">' + l[1] + '</span>' +
               '</div>';
      }).join('');
    }

    formulaire.addEventListener('input', calculer);
    formulaire.addEventListener('submit', function (e) { e.preventDefault(); calculer(); });
    calculer();   // un simulateur s'ouvre sur un exemple chiffré, pas sur du vide
  });
})();
