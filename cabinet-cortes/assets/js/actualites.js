/* Cabinet Corinne Cortes — rendu du fil d'actualités.
 *
 * Les données viennent de `data/actualites.json`, régénéré chaque jour par
 * `scripts/fetch-actualites.mjs` (GitHub Actions). La page ne contacte donc
 * aucun service tiers : un seul fichier, servi depuis le domaine du cabinet.
 *
 * Deux modes, choisis par attribut sur le conteneur :
 *   data-fil="apercu"  -> les N dernières, sans filtres (page d'accueil)
 *   data-fil="complet" -> filtres par thème, recherche et pagination
 */
(function () {
  'use strict';

  var conteneur = document.querySelector('[data-fil]');
  if (!conteneur) return;

  var mode = conteneur.getAttribute('data-fil');
  var apercu = mode === 'apercu';
  var parPage = parseInt(conteneur.getAttribute('data-limite'), 10) || (apercu ? 4 : 15);

  var liste = conteneur.querySelector('[data-liste]');
  var zoneFiltres = document.querySelector('[data-filtres]');
  var champRecherche = document.querySelector('[data-recherche]');
  var boutonPlus = document.querySelector('[data-plus]');
  var compteur = document.querySelector('[data-compteur]');
  var majPied = document.querySelector('[data-maj]');

  var tous = [];
  var themeActif = 'tous';
  var requete = '';
  var affiches = 0;

  var formatDate = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  function echapper(texte) {
    var div = document.createElement('div');
    div.textContent = texte;
    return div.innerHTML;
  }

  function sansAccent(texte) {
    return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function filtres() {
    var q = sansAccent(requete.trim());
    return tous.filter(function (a) {
      if (themeActif !== 'tous' && a.theme !== themeActif) return false;
      if (!q) return true;
      return sansAccent(a.titre + ' ' + a.resume + ' ' + a.theme).indexOf(q) !== -1;
    });
  }

  function gabarit(a) {
    var date = new Date(a.date);
    return '' +
      '<li class="actu">' +
        '<div class="actu__date"><time datetime="' + a.date.slice(0, 10) + '">' +
          formatDate.format(date) +
        '</time></div>' +
        '<div>' +
          '<h3 class="actu__titre">' +
            '<a href="' + encodeURI(a.lien) + '" target="_blank" rel="noopener noreferrer">' +
              echapper(a.titre) +
            '</a>' +
          '</h3>' +
          (a.resume ? '<p class="actu__resume">' + echapper(a.resume) + '</p>' : '') +
          '<p class="actu__meta">' +
            '<span class="etiquette">' + echapper(a.theme) + '</span>' +
            '<span class="etiquette etiquette--source">' + echapper(a.source) + '</span>' +
          '</p>' +
        '</div>' +
      '</li>';
  }

  function rendre(reinitialiser) {
    var resultats = filtres();

    if (reinitialiser) {
      affiches = 0;
      liste.innerHTML = '';
    }

    if (!resultats.length) {
      liste.innerHTML = '<li class="etat-vide">Aucune actualité ne correspond à votre recherche.</li>';
      if (boutonPlus) boutonPlus.hidden = true;
      if (compteur) compteur.textContent = '0 actualité';
      return;
    }

    var lot = resultats.slice(affiches, affiches + parPage);
    liste.insertAdjacentHTML('beforeend', lot.map(gabarit).join(''));
    affiches += lot.length;

    if (boutonPlus) boutonPlus.hidden = affiches >= resultats.length;
    if (compteur) {
      compteur.textContent = resultats.length === 1
        ? '1 actualité'
        : resultats.length + ' actualités';
    }
  }

  function construireFiltres(themes) {
    if (!zoneFiltres) return;

    var boutons = ['tous'].concat(themes).map(function (t) {
      return '<button type="button" class="filtre" data-theme="' + echapper(t) + '"' +
        ' aria-pressed="' + (t === 'tous') + '">' +
        (t === 'tous' ? 'Toutes' : echapper(t)) + '</button>';
    });

    zoneFiltres.innerHTML = boutons.join('');

    zoneFiltres.addEventListener('click', function (e) {
      var bouton = e.target.closest('.filtre');
      if (!bouton) return;
      themeActif = bouton.getAttribute('data-theme');
      zoneFiltres.querySelectorAll('.filtre').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b === bouton));
      });
      rendre(true);
    });
  }

  function brancherRecherche() {
    if (!champRecherche) return;
    var minuteur;
    champRecherche.addEventListener('input', function () {
      clearTimeout(minuteur);
      minuteur = setTimeout(function () {
        requete = champRecherche.value;
        rendre(true);
      }, 180);
    });
  }

  function erreur(message) {
    liste.innerHTML = '<li class="etat-vide">' + message + '</li>';
    if (boutonPlus) boutonPlus.hidden = true;
  }

  fetch(conteneur.getAttribute('data-source') || 'data/actualites.json', { cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (donnees) {
      tous = donnees.articles || [];

      if (!tous.length) return erreur('Le fil d’actualités est momentanément indisponible.');

      if (majPied && donnees.genereLe) {
        majPied.textContent = new Intl.DateTimeFormat('fr-FR', {
          day: 'numeric', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        }).format(new Date(donnees.genereLe));
      }

      if (!apercu) {
        construireFiltres(donnees.themes || []);
        brancherRecherche();
      }

      rendre(true);

      if (boutonPlus) {
        boutonPlus.addEventListener('click', function () { rendre(false); });
      }
    })
    .catch(function () {
      erreur('Le fil d’actualités n’a pas pu être chargé. ' +
        'Réessayez dans quelques instants ou appelez le cabinet au 04 68 50 41 10.');
    });
})();
