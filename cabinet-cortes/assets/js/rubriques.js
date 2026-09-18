/* Cabinet Corinne Cortes — rendu des pages documentaires.
 *
 * Trois pages partagent ce fichier : les chiffres utiles et l'échéancier, qui
 * lisent un JSON, et la page questions-réponses, dont le contenu est écrit en
 * dur dans le HTML (il doit être indexable) et qui n'a besoin que du pliage.
 *
 * Parti pris sur les données manquantes : une valeur absente s'affiche comme
 * « à compléter », visiblement. Un chiffre faux sur le site d'un
 * expert-comptable coûte plus cher qu'une case vide assumée.
 */
(function () {
  'use strict';

  function echapper(texte) {
    var d = document.createElement('div');
    d.textContent = texte == null ? '' : texte;
    return d.innerHTML;
  }

  function dateLisible(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d.valueOf())) return null;
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric'
    }).format(d);
  }

  /** Bandeau d'état commun aux pages alimentées par un fichier de données. */
  function banniereVerification(cible, verifieLe, nbManquants) {
    if (!cible) return;
    var quand = dateLisible(verifieLe);

    if (quand && !nbManquants) {
      cible.className = 'note-source';
      cible.innerHTML = '<p>Valeurs vérifiées par le cabinet le <strong>' +
        echapper(quand) + '</strong>.</p>';
      return;
    }

    cible.className = 'note-source note-source--attention';
    cible.innerHTML =
      '<p><strong>Page en cours de renseignement.</strong></p>' +
      '<p>' + (nbManquants
        ? echapper(String(nbManquants)) + ' valeur' + (nbManquants > 1 ? 's restent' : ' reste') +
          ' à renseigner par le cabinet. '
        : '') +
      'Les montants revalorisés chaque année ne sont pas pré-remplis&nbsp;: un chiffre ' +
      'erroné sur le site d’un expert-comptable est plus coûteux qu’une case vide.</p>';
  }

  /* --- Chiffres utiles --------------------------------------------------- */
  var zoneChiffres = document.querySelector('[data-chiffres]');

  if (zoneChiffres) {
    fetch(zoneChiffres.getAttribute('data-source'), { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        var manquants = 0;

        var html = (d.sections || []).map(function (section) {
          var lignes = section.lignes.map(function (l) {
            var vide = !l.valeur;
            if (vide) manquants++;
            return '<div class="chiffre">' +
                     '<div class="chiffre__libelle">' + echapper(l.libelle) +
                       (l.precision ? '<span class="chiffre__precision">' +
                          echapper(l.precision) + '</span>' : '') +
                     '</div>' +
                     '<div class="chiffre__valeur' + (vide ? ' chiffre__valeur--vide' : '') + '">' +
                       (vide ? '<span class="a-completer">à compléter</span>' : echapper(l.valeur)) +
                     '</div>' +
                   '</div>';
          }).join('');

          return '<section class="bloc-chiffres">' +
                   '<h2>' + echapper(section.titre) + '</h2>' +
                   (section.intro ? '<p class="chapeau">' + echapper(section.intro) + '</p>' : '') +
                   '<div class="chiffres">' + lignes + '</div>' +
                 '</section>';
        }).join('');

        zoneChiffres.innerHTML = html;
        banniereVerification(document.querySelector('[data-etat]'), d.verifieLe, manquants);
      })
      .catch(function () {
        zoneChiffres.innerHTML = '<p class="etat-vide">Les chiffres n’ont pas pu être chargés.</p>';
      });
  }

  /* --- Échéancier -------------------------------------------------------- */
  var zoneEcheances = document.querySelector('[data-echeances]');

  if (zoneEcheances) {
    fetch(zoneEcheances.getAttribute('data-source'), { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        var aConfirmer = 0;

        function ligne(e, avecMois) {
          if (!e.dateVerifiee) aConfirmer++;
          return '<li class="echeance">' +
                   (avecMois ? '<span class="echeance__mois">' + echapper(e.mois) + '</span>' : '') +
                   '<div>' +
                     '<h3>' + echapper(e.intitule) + '</h3>' +
                     (e.quand ? '<p class="echeance__quand">' + echapper(e.quand) + '</p>' : '') +
                     (e.precision ? '<p class="echeance__precision">' + echapper(e.precision) + '</p>' : '') +
                     '<p class="echeance__meta">' +
                       '<span class="etiquette">' + echapper(e.categorie) + '</span>' +
                       '<span class="etiquette etiquette--source">' + echapper(e.concerne) + '</span>' +
                       (e.dateVerifiee ? '' :
                         '<span class="a-completer">date à confirmer</span>') +
                     '</p>' +
                   '</div>' +
                 '</li>';
        }

        // Le mois courant se répète en tête : c'est ce qu'on vient chercher.
        var moisNoms = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet',
                        'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        var moisCourant = moisNoms[new Date().getMonth()];
        var duMois = (d.annuelles || []).filter(function (e) { return e.mois === moisCourant; });

        var html = '';

        if (duMois.length) {
          html += '<section class="bloc-echeances bloc-echeances--courant">' +
                    '<h2>Ce mois-ci — ' + echapper(moisCourant) + '</h2>' +
                    '<ul class="echeances">' + duMois.map(function (e) { return ligne(e, false); }).join('') + '</ul>' +
                  '</section>';
        }

        html += '<section class="bloc-echeances">' +
                  '<h2>Toute l’année</h2>' +
                  '<ul class="echeances">' +
                    (d.annuelles || []).map(function (e) { return ligne(e, true); }).join('') +
                  '</ul>' +
                '</section>';

        html += '<section class="bloc-echeances">' +
                  '<h2>Échéances récurrentes</h2>' +
                  '<ul class="echeances">' +
                    (d.recurrentes || []).map(function (e) { return ligne(e, false); }).join('') +
                  '</ul>' +
                '</section>';

        zoneEcheances.innerHTML = html;
        banniereVerification(document.querySelector('[data-etat]'), d.verifieLe, aConfirmer);
      })
      .catch(function () {
        zoneEcheances.innerHTML = '<p class="etat-vide">L’échéancier n’a pas pu être chargé.</p>';
      });
  }

  /* --- Questions-réponses : pliage --------------------------------------- */
  document.querySelectorAll('.qr__question').forEach(function (bouton) {
    bouton.addEventListener('click', function () {
      var ouvert = bouton.getAttribute('aria-expanded') === 'true';
      bouton.setAttribute('aria-expanded', String(!ouvert));
      document.getElementById(bouton.getAttribute('aria-controls')).hidden = ouvert;
    });
  });
})();
