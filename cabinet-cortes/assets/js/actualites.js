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


  /* Repère visuel par thématique.
   *
   * Remplace l'image d'illustration : une liste de 150 actualités se parcourt
   * mieux avec un marqueur qui porte une information (le sujet) qu'avec des
   * photos de banque d'images qui n'en portent aucune. Chaque repère reste
   * doublé par l'étiquette écrite — la couleur n'est jamais seule à informer.
   */
  var THEMES = {
    'Social':                { cle: 'social',     icone: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>' },
    'Fiscalité':             { cle: 'fiscalite',  icone: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v4M8 19h4"/>' },
    'Juridique':             { cle: 'juridique',  icone: '<path d="M12 3v18M7 21h10M12 6l-6 1.5L3 14a3 3 0 0 0 6 0L6 7.5M12 6l6 1.5L21 14a3 3 0 0 1-6 0l3-6.5"/>' },
    'Gestion':               { cle: 'gestion',    icone: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 15l3.5-4 3 2.5L20 7"/>' },
    'Patrimoine':            { cle: 'patrimoine', icone: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>' },
    'Création d\u2019entreprise': { cle: 'creation', icone: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>' }
  };

  function repere(theme) {
    var t = THEMES[theme];
    if (!t) return { cle: 'gestion', icone: THEMES.Gestion.icone };
    return t;
  }

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
    var t = repere(a.theme);

    return '' +
      '<li class="actu actu--' + t.cle + '">' +
        '<div class="actu__repere">' +
          '<span class="actu__pastille" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
            'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + t.icone + '</svg>' +
          '</span>' +
          '<div class="actu__date"><time datetime="' + a.date.slice(0, 10) + '">' +
            formatDate.format(date) +
          '</time></div>' +
        '</div>' +
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
      var pastille = t === 'tous' ? ''
        : '<i class="filtre__point filtre__point--' + repere(t).cle + '"></i>';
      return '<button type="button" class="filtre filtre--' + (t === 'tous' ? 'tous' : repere(t).cle) +
        '" data-theme="' + echapper(t) + '" aria-pressed="' + (t === 'tous') + '">' +
        pastille + (t === 'tous' ? 'Toutes' : echapper(t)) + '</button>';
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
