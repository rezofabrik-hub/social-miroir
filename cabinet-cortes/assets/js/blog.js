/* Cabinet Corinne Cortes — liste des articles du blog.
 *
 * Les articles sont des pages HTML autonomes dans blog/ : ce sont elles que
 * les moteurs indexent, avec leur contenu complet et leur propre adresse.
 * `data/blog.json` ne sert qu'à construire cette liste de navigation, ce qui
 * évite d'avoir à regénérer une page d'index à chaque publication.
 *
 * Publier un article : dupliquer un fichier de blog/, en remplacer le contenu,
 * puis ajouter une entrée en tête du tableau `articles` du JSON.
 */
(function () {
  'use strict';

  var conteneur = document.querySelector('[data-blog]');
  if (!conteneur) return;

  var liste = document.querySelector('[data-liste-blog]');
  var zoneFiltres = document.querySelector('[data-filtres-blog]');
  var compteur = document.querySelector('[data-compteur-blog]');

  var tous = [];
  // blog.html?categorie=En+bref ouvre directement la rubrique demandée : c'est
  // ainsi que la barre des rubriques pointe « En bref » sans page dédiée.
  var demandee = new URLSearchParams(location.search).get('categorie');
  var categorieActive = demandee || 'toutes';

  var formatDate = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  function echapper(texte) {
    var d = document.createElement('div');
    d.textContent = texte;
    return d.innerHTML;
  }

  function gabarit(a) {
    return '' +
      '<li class="actu">' +
        '<div class="actu__date"><time datetime="' + a.date + '">' +
          formatDate.format(new Date(a.date)) +
        '</time></div>' +
        '<div>' +
          '<h3 class="actu__titre"><a href="' + encodeURI(a.fichier) + '">' +
            echapper(a.titre) + '</a></h3>' +
          (a.resume ? '<p class="actu__resume">' + echapper(a.resume) + '</p>' : '') +
          '<p class="actu__meta">' +
            '<span class="etiquette">' + echapper(a.categorie) + '</span>' +
          '</p>' +
        '</div>' +
      '</li>';
  }

  function rendre() {
    var vus = categorieActive === 'toutes'
      ? tous
      : tous.filter(function (a) { return a.categorie === categorieActive; });

    liste.innerHTML = vus.length
      ? vus.map(gabarit).join('')
      : '<li class="etat-vide">Aucun article dans cette catégorie.</li>';

    if (compteur) {
      compteur.textContent = vus.length === 1 ? '1 article' : vus.length + ' articles';
    }
  }

  fetch(conteneur.getAttribute('data-source') || 'data/blog.json', { cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (donnees) {
      tous = (donnees.articles || []).slice().sort(function (a, b) {
        return b.date.localeCompare(a.date);
      });

      if (!tous.length) {
        liste.innerHTML = '<li class="etat-vide">Le premier article est en préparation.</li>';
        return;
      }

      if (zoneFiltres) {
        var categories = [];
        tous.forEach(function (a) {
          if (a.categorie && categories.indexOf(a.categorie) === -1) categories.push(a.categorie);
        });

        zoneFiltres.innerHTML = ['toutes'].concat(categories.sort(function (a, b) {
          return a.localeCompare(b, 'fr');
        })).map(function (c) {
          return '<button type="button" class="filtre" data-categorie="' + echapper(c) + '"' +
                 ' aria-pressed="' + (c === categorieActive) + '">' +
                 (c === 'toutes' ? 'Toutes' : echapper(c)) + '</button>';
        }).join('');

        zoneFiltres.addEventListener('click', function (e) {
          var b = e.target.closest('.filtre');
          if (!b) return;
          categorieActive = b.getAttribute('data-categorie');
          zoneFiltres.querySelectorAll('.filtre').forEach(function (autre) {
            autre.setAttribute('aria-pressed', String(autre === b));
          });
          rendre();
        });
      }

      rendre();
    })
    .catch(function () {
      liste.innerHTML = '<li class="etat-vide">La liste des articles n’a pas pu être chargée.</li>';
    });
})();
