# Site du Cabinet Corinne Cortes — C3C

Refonte du site `cabinetcortes-c3c.fr`. Site statique : sept pages HTML, une
feuille de style, deux scripts, aucune dépendance à installer et aucun serveur
à administrer.

```
cabinet-cortes/
├── index.html              Accueil
├── cabinet.html            Le cabinet
├── missions.html           Nos missions (six sections ancrées)
├── actualites.html         Fil d'actualités (filtres + recherche)
├── blog.html               Index du blog du cabinet
├── blog/                   Un fichier HTML par article
├── newsletter.html         Inscription à la lettre mensuelle
├── simulateurs.html        Neuf calculateurs
├── dossiers.html           Guides du cabinet + ressources officielles
├── chiffres-utiles.html    Taux, plafonds et indices
├── echeancier.html         Calendrier des échéances
├── questions-reponses.html FAQ (avec données structurées)
├── contact.html            Coordonnées + formulaire
├── mentions-legales.html   Mentions légales et RGPD
├── plan-du-site.html       Plan du site
├── 404.html                Page d'erreur
├── assets/
│   ├── css/style.css       Toute la mise en forme
│   ├── js/site.js          Menu, thème clair/sombre, formulaire
│   ├── js/actualites.js    Rendu du fil
│   ├── js/blog.js          Liste des articles
│   ├── js/simulateurs.js   Les neuf calculs
│   └── img/                Logo (clair + variante fonds sombres), favicon
├── data/
│   ├── sources.json        Flux RSS agrégés (éditable)
│   ├── blog.json           Index des articles (éditable)
│   ├── dossiers.json       Index des dossiers (éditable)
│   ├── chiffres-utiles.json   Taux et indices — À COMPLÉTER
│   ├── echeances.json      Échéances — DATES À CONFIRMER
│   └── actualites.json     Fil généré — ne pas modifier à la main
├── scripts/
│   └── fetch-actualites.mjs
├── robots.txt
└── sitemap.xml
```

## Voir le site en local

```bash
cd cabinet-cortes
python3 -m http.server 8000
# puis http://localhost:8000
```

Ouvrir les fichiers directement (`file://`) ne fonctionne pas : le fil
d'actualités charge un JSON, ce que les navigateurs bloquent hors serveur.

---

## Le fil d'actualités

C'est l'équivalent de la rubrique « Actualités » de l'ancien site, reconstruit
sur des sources publiques.

### Comment il fonctionne

1. `scripts/fetch-actualites.mjs` interroge les flux RSS déclarés dans
   `data/sources.json`, normalise les articles (titre, résumé, date, source),
   leur attribue une thématique et écrit `data/actualites.json`.
2. Le workflow GitHub Actions `.github/workflows/actualites-cabinet-cortes.yml`
   relance ce script chaque matin et publie le résultat s'il a changé.
3. `actualites.html` lit ce JSON et l'affiche avec filtres et recherche.

La récupération se fait au moment de la génération, pas dans le navigateur du
visiteur : les sites publics ne renvoient pas d'en-tête CORS (un appel direct
depuis la page serait bloqué), et cela évite d'exposer les visiteurs à des
requêtes vers des tiers.

### Sources actuelles

| Source | Éditeur | Flux |
|---|---|---|
| Service Public Entreprendre | DILA (Premier ministre) | `service-public.fr/abonnements/rss/actu-actu-pro.rss` |
| economie.gouv.fr | Ministère de l'Économie | `economie.gouv.fr/rss/toutesactualites` |
| BOFiP-Impôts | DGFiP | `bofip.impots.gouv.fr/bofip/ext/rss/last-rss.xml` |

Seuls les titres, résumés et liens sont repris, avec mention de la source et
renvoi vers l'article d'origine — l'usage prévu d'un flux de syndication.

### Sources testées et gardées en réserve

Trois autres flux officiels répondent correctement mais sont déclarés
`"actif": false` dans `data/sources.json`, avec la raison dans leur champ
`note` :

| Source | Pourquoi elle n'est pas activée |
|---|---|
| DGCCRF | À jour, mais surtout des annonces de condamnations d'entreprises nommées |
| CNIL | Quelques sujets utiles noyés dans les ordres du jour de séances plénières |
| INPI | Plusieurs mois de retard, dominé par les bulletins BOPI brevets |

Passer `"actif": true` suffit à en activer une. Inutile de refaire la
recherche : les flux d'Urssaf, Légifrance, impots.gouv.fr, Bpifrance et
service-public « particuliers » ont aussi été testés et ne sont pas
exploitables (404, 403 ou absence de flux public).

### Lancer une mise à jour à la main

```bash
node cabinet-cortes/scripts/fetch-actualites.mjs
```

Le script affiche le bilan par source. Si un flux tombe, les autres continuent
d'alimenter le fil ; si tous tombent, le fichier précédent est conservé plutôt
qu'écrasé par un fil vide.

### Ajouter ou retirer une source

Éditer `data/sources.json` :

```json
{
  "id": "identifiant-court",
  "nom": "Nom affiché sur chaque actualité",
  "editeur": "Organisme éditeur",
  "url": "https://…/flux.rss",
  "site": "https://…/",
  "theme": null,
  "actif": true
}
```

`theme` à `null` laisse le script déduire la thématique du texte ; le forcer
(`"Fiscalité"`, par exemple) est utile pour une source mono-sujet. `"actif":
false` désactive une source sans la supprimer.

### Ajuster le classement par thème

Les mots-clés sont regroupés dans la constante `THEMES` du script. Deux points
à garder en tête si vous y touchez :

- les mots-clés s'écrivent **sans accent** — le texte est désaccentué avant
  analyse, faute de quoi `\b` de JavaScript place une frontière de mot devant
  chaque lettre accentuée et « déplacements » déclenche le mot-clé
  « placement » ;
- le thème retenu est celui qui totalise le plus de correspondances, le titre
  comptant triple. Ajouter un mot-clé très courant à un thème le fait donc
  grossir au détriment des autres.

---

## Le formulaire de contact

Un site statique n'a pas de serveur pour traiter un envoi. Deux modes, réglés
par l'attribut `data-endpoint` du `<form>` dans `contact.html` :

**Mode actuel — `data-endpoint=""`.** Le bouton ouvre le logiciel de messagerie
du visiteur avec un message pré-rempli vers `cabinet.cortes@gmail.com`. Aucun
prestataire, aucune donnée transmise à un tiers. En contrepartie, le visiteur
doit cliquer une seconde fois pour envoyer, et cela suppose une messagerie
configurée sur son appareil.

**Mode envoi direct.** Créer un formulaire chez un service dédié (Formspree,
Web3Forms, Netlify Forms…) et coller l'URL fournie :

```html
<form class="formulaire" data-formulaire-contact
      data-endpoint="https://formspree.io/f/xxxxxxxx"
      data-courriel="cabinet.cortes@gmail.com">
```

Le message part alors sans quitter la page. Ce service devient un
sous-traitant au sens du RGPD : il faut le mentionner dans les mentions
légales, section « Protection des données », et vérifier que les données
restent hébergées dans l'Union européenne.

Un champ piège invisible (`.pot-de-miel`) bloque les robots spammeurs dans les
deux modes.

---

## Mise en ligne

Le dossier `cabinet-cortes/` est la racine du site : il n'y a rien à compiler.

### Sur GitHub Pages

1. Placer le contenu de `cabinet-cortes/` à la racine d'un dépôt dédié
   (ou activer Pages sur ce dépôt en pointant le dossier).
2. Ajouter un fichier `CNAME` contenant `www.cabinetcortes-c3c.fr`.
3. Chez le bureau d'enregistrement du domaine, faire pointer `www` vers
   GitHub Pages (enregistrement CNAME), puis activer HTTPS dans les réglages
   Pages.
4. Déplacer `.github/workflows/actualites-cabinet-cortes.yml` dans le nouveau
   dépôt et corriger le chemin du script (plus de préfixe `cabinet-cortes/`).

### Sur un hébergement classique

Copier le contenu de `cabinet-cortes/` dans le répertoire public. Le fil
d'actualités devra alors être régénéré autrement : tâche cron exécutant le
script Node, ou workflow GitHub qui dépose le JSON par FTP.

### Avant de basculer le domaine

L'ancien site a des adresses indexées (`/blog`, `/actualites-ec`,
`/mentions-legales-rgpd`, `/inscription-newsletter`, `/plan-du-site`).
Prévoir des redirections 301 vers les pages correspondantes pour ne pas perdre
le référencement acquis, et vérifier que les pages de la nouvelle arborescence
répondent bien avant de couper l'abonnement au site actuel.

---

## À compléter avant la mise en ligne

Les mentions surlignées en jaune dans `mentions-legales.html` (classe
`.a-completer`) sont des informations que seul le cabinet peut fournir :

- forme juridique et capital social ;
- numéro SIRET et numéro de TVA intracommunautaire ;
- assureur de responsabilité civile professionnelle et numéro de police ;
- médiateur de la consommation compétent ;
- coordonnées de l'hébergeur retenu ;
- date de mise à jour des mentions légales.

À vérifier également :

- **Horaires d'ouverture.** La page contact indique « sur rendez-vous », sans
  plage horaire : aucune n'a été inventée. Si le cabinet a des horaires fixes,
  les ajouter dans `contact.html` et dans le bloc `AccountingService` de
  `index.html` (propriété `openingHoursSpecification`).
- **Région administrative.** Les anciennes mentions légales situaient le
  cabinet en Provence-Alpes-Côte d'Azur ; Perpignan est en Occitanie. C'est
  Occitanie qui figure dans le nouveau site et dans les données structurées.
- **Photos.** Aucune photo n'a été reprise de l'ancien site : les visuels y
  étaient fournis sous licence par le prestataire précédent. Les illustrations
  actuelles sont des dessins vectoriels intégrés à la page. Des photos du
  cabinet ou de Corinne Cortes s'inséreraient naturellement dans la bannière
  d'accueil et en tête de `cabinet.html`.

---

## Choix techniques, et pourquoi

**Pas de Google Fonts, pas de CDN, pas de carte intégrée.** Tout est servi
depuis le domaine du cabinet. Une police chargée depuis un serveur tiers
transmet l'adresse IP du visiteur à ce tiers avant tout consentement, ce que la
CNIL considère comme un traitement à part entière. En restant local, le site
n'a besoin d'aucun bandeau de consentement — et se charge plus vite.

**Pas de bandeau de cookies au premier affichage.** Le site ne dépose aucun
traceur : la seule donnée conservée est la préférence d'affichage clair/sombre,
dans le stockage local du navigateur. Ce stockage est strictement nécessaire au
service demandé et ne requiert pas de consentement. Le panneau d'information
reste accessible via « Gestion des cookies » dans le pied de page.

Si une mesure d'audience est ajoutée plus tard, le mécanisme est déjà prêt :
poser l'attribut `data-consentement-requis` sur `<aside class="bandeau-cookies">`
et définir `window.c3cActiverMesureAudience`, qui ne sera appelée qu'après
acceptation.

**En-tête et pied de page répétés dans chaque fichier.** Il n'y a pas d'étape
de build : ce que vous lisez dans le dépôt est exactement ce qui est servi.
Sur sept pages c'est tenable, mais une modification du menu ou du pied de page
doit être reportée dans les sept fichiers.

**Mode sombre.** Suit la préférence du système, avec un bouton pour forcer
l'un ou l'autre. Le choix est mémorisé sur l'appareil du visiteur.

**Accessibilité.** Lien d'évitement, navigation au clavier, contrastes vérifiés
(le rose du logo est trop clair pour du texte sur fond blanc : une version
assombrie, `--accent`, est utilisée pour les liens et les libellés, le rose
d'origine restant réservé aux aplats et aux fonds sombres), et respect de
`prefers-reduced-motion`.


---

## Publier un article de blog

Les articles sont des pages HTML autonomes dans `blog/` — c'est elles que
Google indexe, avec leur contenu complet et leur propre adresse.
`data/blog.json` ne sert qu'à construire la liste affichée sur `blog.html`,
ce qui évite d'avoir à regénérer une page d'index à chaque publication.

1. Dupliquer `blog/modele-article.html` sous un nom parlant
   (`blog/facturation-electronique-2026.html` : le nom du fichier devient
   l'adresse de la page, autant qu'il contienne les mots-clés du sujet).
2. Remplacer le titre, la date, la catégorie et le contenu. Trois balises
   sont à corriger en haut du fichier : `<title>`, `<meta name="description">`
   et `<link rel="canonical">`.
3. Ajouter une entrée **en tête** du tableau `articles` de `data/blog.json` :

```json
{
  "fichier": "blog/facturation-electronique-2026.html",
  "titre": "Facturation électronique : ce qui change pour votre entreprise",
  "date": "2026-10-02",
  "categorie": "Fiscalité",
  "resume": "Deux ou trois phrases qui posent la question à laquelle l'article répond."
}
```

4. Ajouter la page à `sitemap.xml`.

Les catégories sont libres : les filtres de `blog.html` se construisent tout
seuls à partir de celles qui existent. **Avant la mise en ligne, retirer
`blog/modele-article.html` du JSON** — sinon le gabarit apparaît dans la liste.

## Newsletter

`newsletter.html` utilise la même mécanique que le formulaire de contact :
`data-endpoint` vide ouvre la messagerie du visiteur, une URL de service
d'emailing envoie directement.

Pour un envoi réel, il faut un prestataire capable de gérer les
désinscriptions — c'est une obligation légale, pas un confort. Brevo
(ex-Sendinblue, données hébergées en France) propose un palier gratuit
largement suffisant au volume d'un cabinet. Le prestataire retenu devient un
sous-traitant au sens du RGPD : il doit être mentionné dans les mentions
légales, section « Protection des données ».

## Les simulateurs

Les neuf calculateurs de `simulateurs.html` sont du JavaScript autonome : rien
n'est transmis, tout est calculé dans le navigateur du visiteur. Les formules
vivent dans `assets/js/simulateurs.js`, les formulaires dans la page.

Conventions retenues : taux saisis en pourcentage annuel, mensualités à terme
échu (usage du crédit amortissable français), hors assurance emprunteur et
frais de dossier. Les taux d'une suite de versements n'ayant pas de forme
analytique, ils sont résolus par dichotomie.

Les résultats ont été vérifiés : 10 000 € à 3 % sur 10 ans donnent 13 439,16 € ;
150 000 € à 3,5 % sur 15 ans donnent une mensualité de 1 072,32 €.

**Ce qui n'est pas repris de l'ancien site** : les calculateurs de frais
kilométriques et de versement mobilité dépendent de barèmes officiels revus
chaque année. Le moteur serait identique, mais publier un barème erroné sur le
site d'un expert-comptable coûte plus cher que de ne pas le publier. Ils
pourront être ajoutés dès que le cabinet fournit les valeurs en vigueur.


---

## Les rubriques documentaires

Sept rubriques partagent une barre de navigation interne (`barre_rubriques`
dans les pages générées), sur le principe de la bande de boutons du site
actuel : le menu principal reste court, la section se parcourt de l'intérieur.

| Rubrique | Source des données | État |
|---|---|---|
| Fil d'actualités | `data/actualites.json`, automatique | ✅ opérationnel |
| Dossiers | `data/dossiers.json` + liens officiels | vide, à écrire |
| Chiffres utiles | `data/chiffres-utiles.json` | **14 valeurs à renseigner** |
| Échéancier | `data/echeances.json` | **16 dates à confirmer** |
| Questions-réponses | écrit dans la page | ✅ 11 questions |
| En bref | `data/blog.json`, catégorie « En bref » | 1 article d'amorce |
| Simulateurs | aucune | ✅ 9 calculateurs |

### Compléter les chiffres utiles

Ouvrir `data/chiffres-utiles.json`, renseigner les `valeur` laissées à `null`,
puis mettre `verifieLe` à la date du jour au format `AAAA-MM-JJ`. Le bandeau
d'avertissement disparaît de lui-même une fois toutes les valeurs renseignées
et la date posée.

Les taux de TVA et d'impôt sur les sociétés sont pré-remplis : ils sont stables
depuis plusieurs années. Le SMIC, les plafonds de Sécurité sociale, les indices
et les barèmes ne le sont pas — ils sont revalorisés chaque année et doivent
être saisis par le cabinet. C'est vingt minutes de travail, une fois par an.

### Confirmer l'échéancier

Même principe dans `data/echeances.json` : passer `dateVerifiee` à `true` pour
chaque échéance dont la date a été contrôlée. Les intitulés et la périodicité
sont posés ; les dates exactes dépendent du régime d'imposition, de la forme
juridique, de l'effectif et parfois du département.

### Deux rubriques du site actuel non reprises

**La Bourse.** Le site actuel affiche des cours. Pour une clientèle d'artisans,
de commerçants et de TPE, un cours du CAC 40 ne sert à rien, et l'afficher
supposerait d'appeler un service financier tiers à chaque visite — ce qui
romprait la promesse « aucune ressource externe ». Le créneau est occupé par la
section « Indices et taux » des chiffres utiles : l'ILC révise un bail
commercial, le taux d'intérêt légal chiffre une pénalité de retard. Ces
indices-là, eux, servent.

**La minute de l'expert.** C'est de la vidéo produite par l'éditeur actuel. Le
format est repris sous la forme d'une catégorie « En bref » du blog, alimentée
par le cabinet. Si des vidéos sont tournées un jour, elles s'intégreront à ces
articles.


---

## Remplacer les illustrations par de vraies photos

Les six visuels du fil d'actualités sont des fichiers comme les autres :
`assets/img/themes/social.svg`, `fiscalite.svg`, `juridique.svg`,
`gestion.svg`, `patrimoine.svg`, `creation.svg`.

Pour passer à la photographie :

1. Préparer six images en 16/9, **1200 × 675 px** suffit largement, compressées
   en JPEG de qualité 80 (viser moins de 150 Ko chacune).
2. Les déposer dans `assets/img/themes/` sous les mêmes noms, avec l'extension
   `.jpg`.
3. Ouvrir `assets/js/actualites.js` et corriger les six champs `visuel` de la
   constante `THEMES` — `'social.svg'` devient `'social.jpg'`, etc. Rien d'autre
   ne change.

Six images suffisent pour illustrer cent cinquante actualités qui se
renouvellent seules : c'est le seul modèle qui tienne avec un fil automatique.
Associer une photo différente à chaque article supposerait de les choisir à la
main chaque matin.

**Ce qu'il ne faut pas faire** : reprendre les photos du site actuel. Elles
appartiennent à son éditeur, pas au cabinet.

## Mise en ligne, pas à pas

Le dossier `cabinet-cortes/` est la racine du site. Il n'y a rien à compiler.

### 1. Un dépôt dédié

Le site vit pour l'instant dans un dépôt qui sert à autre chose. Il lui faut le
sien : créer un dépôt GitHub (public — Pages est gratuit sur les dépôts
publics ; un dépôt privé demande un abonnement) et y placer le **contenu** de
`cabinet-cortes/`, pas le dossier lui-même. `index.html` doit se trouver à la
racine du dépôt.

### 2. Activer GitHub Pages

Dans le dépôt : **Settings → Pages → Source : Deploy from a branch**, branche
`main`, dossier `/ (root)`. Le site est en ligne quelques minutes plus tard sur
une adresse en `github.io`. C'est cette adresse qui sert à tout vérifier avant
de toucher au vrai domaine.

### 3. Remettre le workflow des actualités

Copier `.github/workflows/actualites-cabinet-cortes.yml` dans le nouveau dépôt
et retirer le préfixe `cabinet-cortes/` du chemin du script, qui devient
`node scripts/fetch-actualites.mjs`. La mise à jour quotidienne démarre au
prochain déclenchement — GitHub n'exécute les tâches planifiées que depuis la
branche par défaut.

### 4. Le domaine, en dernier

**Ne pas basculer `cabinetcortes-c3c.fr` avant d'avoir réglé le contrat en
cours.** Tant que l'abonnement court, le domaine reste pointé sur le site
actuel.

Quand le moment vient : ajouter un fichier `CNAME` à la racine du dépôt
contenant `www.cabinetcortes-c3c.fr`, puis créer chez le registrar un
enregistrement CNAME `www` vers `<compte>.github.io`. Cocher ensuite
« Enforce HTTPS » dans les réglages Pages.

Prévoir aussi les redirections 301 depuis les anciennes adresses (`/blog`,
`/actualites-ec`, `/mentions-legales-rgpd`) pour ne pas perdre le référencement
acquis.

### Hébergement classique

Un hébergeur mutualisé fait aussi l'affaire : copier le contenu du dossier dans
le répertoire public. Il faudra alors une autre mécanique pour le fil
quotidien — une tâche cron exécutant le script, ou un workflow GitHub qui
dépose le JSON par FTP.
