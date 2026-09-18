/* Cabinet Corinne Cortes — comportements communs à toutes les pages.
   Vanilla JS, aucune dépendance, chargé en `defer`. */
(function () {
  'use strict';

  /* --- Thème clair / sombre --------------------------------------------
     La préférence système fait foi tant que le visiteur n'a pas choisi.
     Son choix est mémorisé localement (aucune donnée n'est envoyée). */
  var CLE_THEME = 'c3c-theme';

  function appliquerTheme(theme) {
    if (theme === 'dark' || theme === 'light') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  function themeActuel() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark' : 'light';
  }

  try {
    appliquerTheme(localStorage.getItem(CLE_THEME));
  } catch (e) { /* navigation privée, cookies bloqués : on garde le thème système */ }

  var bascule = document.querySelector('.bascule-theme');
  if (bascule) {
    bascule.addEventListener('click', function () {
      var suivant = themeActuel() === 'dark' ? 'light' : 'dark';
      appliquerTheme(suivant);
      bascule.setAttribute('aria-label',
        suivant === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre');
      try { localStorage.setItem(CLE_THEME, suivant); } catch (e) {}
    });
  }

  /* --- Menu mobile ------------------------------------------------------ */
  var burger = document.querySelector('.burger');
  var nav = document.querySelector('.nav');

  function majHauteurEntete() {
    var entete = document.querySelector('.entete');
    if (entete) {
      document.documentElement.style.setProperty(
        '--hauteur-entete', entete.getBoundingClientRect().height + 'px');
    }
  }
  majHauteurEntete();
  window.addEventListener('resize', majHauteurEntete);

  function fermerMenu() {
    if (!burger || !nav) return;
    burger.setAttribute('aria-expanded', 'false');
    nav.setAttribute('data-ouvert', 'false');
  }

  if (burger && nav) {
    burger.addEventListener('click', function () {
      var ouvert = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!ouvert));
      nav.setAttribute('data-ouvert', String(!ouvert));
      majHauteurEntete();
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) fermerMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') fermerMenu();
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1080) fermerMenu();
    });
  }

  /* --- Panneau « vie privée » ------------------------------------------
     Le site ne dépose aucun traceur : pas de mesure d'audience, pas de
     police distante, pas de carte ni de vidéo tierce. Dans ce cas la CNIL
     n'impose pas de bandeau de consentement, et en afficher un serait à la
     fois inutile et pénible. Le panneau reste donc masqué et ne s'ouvre que
     depuis le lien « Gestion des cookies » du pied de page.

     Si une mesure d'audience est ajoutée un jour (voir README), il suffit de
     poser l'attribut `data-consentement-requis` sur le bandeau : il
     s'affichera alors tant que le visiteur n'a pas répondu, et la fonction
     `window.c3cActiverMesureAudience` ne sera appelée qu'après acceptation. */
  var CLE_CONSENT = 'c3c-consentement';
  var bandeau = document.querySelector('.bandeau-cookies');

  if (bandeau) {
    var reponse = null;
    try { reponse = localStorage.getItem(CLE_CONSENT); } catch (e) {}

    var consentementRequis = bandeau.hasAttribute('data-consentement-requis');

    if (consentementRequis && !reponse) {
      bandeau.hidden = false;
    } else if (consentementRequis && reponse === 'accepte' &&
               typeof window.c3cActiverMesureAudience === 'function') {
      window.c3cActiverMesureAudience();
    }

    bandeau.addEventListener('click', function (e) {
      var bouton = e.target.closest('[data-consentement]');
      if (!bouton) return;
      var valeur = bouton.getAttribute('data-consentement');
      try { localStorage.setItem(CLE_CONSENT, valeur); } catch (e2) {}
      bandeau.hidden = true;
      if (valeur === 'accepte' && typeof window.c3cActiverMesureAudience === 'function') {
        window.c3cActiverMesureAudience();
      }
    });
  }

  document.querySelectorAll('[data-rouvrir-cookies]').forEach(function (lien) {
    lien.addEventListener('click', function (e) {
      if (!bandeau) return;          // sans panneau, le lien mène aux mentions légales
      e.preventDefault();
      bandeau.hidden = false;
      bandeau.scrollIntoView({ block: 'nearest' });
    });
  });

  /* --- Année courante dans le pied de page ------------------------------ */
  document.querySelectorAll('[data-annee]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* --- Formulaire de contact -------------------------------------------
     Le site est statique : il n'y a pas de serveur pour traiter l'envoi.
     Deux modes sont prévus (voir README) :
       1. `data-endpoint` renseigné  -> envoi AJAX vers un service de
          formulaire (Formspree, Web3Forms, Netlify Forms…).
       2. `data-endpoint` vide       -> ouverture du logiciel de messagerie
          du visiteur avec le message pré-rempli. Fonctionne sans aucun
          prestataire, donc sans transfert de données à un tiers. */
  var formulaire = document.querySelector('[data-formulaire-contact]');

  if (formulaire) {
    var retour = formulaire.querySelector('[data-retour]');
    var envoi = formulaire.querySelector('button[type="submit"]');

    function afficherRetour(message, type) {
      if (!retour) return;
      retour.textContent = message;
      retour.style.color = type === 'erreur' ? '#b3261e' : 'var(--accent)';
      retour.hidden = false;
    }

    formulaire.addEventListener('submit', function (e) {
      // Le piège à robots doit rester vide : s'il est rempli, on ignore.
      if (formulaire.querySelector('.pot-de-miel input').value !== '') {
        e.preventDefault();
        return;
      }

      var endpoint = formulaire.getAttribute('data-endpoint');
      var donnees = new FormData(formulaire);

      if (!endpoint) {
        e.preventDefault();
        var destinataire = formulaire.getAttribute('data-courriel') || '';
        var corps = [
          'Nom : ' + (donnees.get('civilite') || '') + ' ' +
            (donnees.get('prenom') || '') + ' ' + (donnees.get('nom') || ''),
          'Courriel : ' + (donnees.get('courriel') || ''),
          'Téléphone : ' + (donnees.get('telephone') || ''),
          'Sujet : ' + (donnees.get('sujet') || ''),
          '',
          donnees.get('message') || ''
        ].join('\n');

        window.location.href = 'mailto:' + destinataire +
          '?subject=' + encodeURIComponent('Demande depuis le site — ' +
            (donnees.get('sujet') || 'Contact')) +
          '&body=' + encodeURIComponent(corps);

        afficherRetour('Votre logiciel de messagerie va s’ouvrir avec le message pré-rempli. ' +
          'Il ne vous reste qu’à l’envoyer.', 'ok');
        return;
      }

      e.preventDefault();
      if (envoi) { envoi.disabled = true; envoi.textContent = 'Envoi en cours…'; }

      fetch(endpoint, {
        method: 'POST',
        body: donnees,
        headers: { Accept: 'application/json' }
      }).then(function (r) {
        if (!r.ok) throw new Error('Réponse ' + r.status);
        formulaire.reset();
        afficherRetour('Merci, votre message est bien parti. Le cabinet vous répond sous 48 h ouvrées.', 'ok');
      }).catch(function () {
        afficherRetour('L’envoi a échoué. Vous pouvez nous écrire directement à ' +
          (formulaire.getAttribute('data-courriel') || '') + ' ou appeler le 04 68 50 41 10.', 'erreur');
      }).then(function () {
        if (envoi) { envoi.disabled = false; envoi.textContent = 'Envoyer ma demande'; }
      });
    });
  }
})();
