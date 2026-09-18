#!/usr/bin/env node
/**
 * Agrégateur du fil d'actualités du cabinet.
 *
 * Lit les flux RSS publics déclarés dans `data/sources.json`, les normalise
 * et écrit `data/actualites.json`, consommé par `actualites.html`.
 *
 * Pourquoi un script de build plutôt qu'un appel depuis le navigateur :
 * les sites publics ne renvoient pas d'en-tête CORS, un `fetch()` depuis la
 * page serait donc bloqué. La récupération se fait ici (GitHub Actions, une
 * fois par jour) et la page ne lit plus qu'un fichier JSON du même domaine :
 * rapide, hors ligne-compatible, et sans requête vers un tiers côté visiteur.
 *
 * Aucune dépendance : Node 18+ suffit (fetch natif).
 *
 *   node cabinet-cortes/scripts/fetch-actualites.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const FICHIER_SOURCES = join(ICI, '..', 'data', 'sources.json');
const FICHIER_SORTIE = join(ICI, '..', 'data', 'actualites.json');

const MAX_ARTICLES = 150;
const DELAI_MS = 20000;

/* ------------------------------------------------------------------ outils */

const decoder = (txt) =>
  String(txt)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');

const sansBalises = (html) =>
  decoder(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const baliseTexte = (bloc, nom) => {
  // `dc:date` et `date` doivent être distingués : on ancre sur le nom complet.
  const re = new RegExp(`<${nom}(?:\\s[^>]*)?>([\\s\\S]*?)</${nom}>`, 'i');
  const m = bloc.match(re);
  return m ? decoder(m[1]).trim() : '';
};

const tronquer = (texte, max = 230) => {
  if (texte.length <= max) return texte;
  const coupe = texte.slice(0, max);
  const espace = coupe.lastIndexOf(' ');
  return (espace > max * 0.6 ? coupe.slice(0, espace) : coupe).trimEnd() + '…';
};

/** Les flux publics mélangent RFC 822, ISO 8601 et « AAAA-MM-JJ hh:mm:ss ». */
function analyserDate(brut) {
  if (!brut) return null;
  const texte = brut.trim();

  const sansT = texte.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (sansT) {
    const d = new Date(`${sansT[1]}-${sansT[2]}-${sansT[3]}T${sansT[4]}:${sansT[5]}:${sansT[6]}Z`);
    if (!Number.isNaN(d.valueOf())) return d;
  }

  const jourSeul = texte.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (jourSeul) return new Date(`${texte}T00:00:00Z`);

  const d = new Date(texte);
  return Number.isNaN(d.valueOf()) ? null : d;
}

/**
 * Certains flux officiels ne portent aucune balise de date — le BOFiP, par
 * exemple, ne la met que dans le résumé (« publié le 09/09/2026 ») et dans le
 * suffixe de l'URL (« …-20260909 »). On la récupère là plutôt que d'écarter
 * l'article.
 */
function dateDeSecours(bloc) {
  const texte = decoder(bloc);

  const francaise = texte.match(/publi[ée]\s+le\s+(\d{2})\/(\d{2})\/(\d{4})/i);
  if (francaise) {
    return new Date(`${francaise[3]}-${francaise[2]}-${francaise[1]}T00:00:00Z`);
  }

  const dansLien = texte.match(/-(\d{4})(\d{2})(\d{2})(?:["'\s<]|$)/);
  if (dansLien) {
    const d = new Date(`${dansLien[1]}-${dansLien[2]}-${dansLien[3]}T00:00:00Z`);
    if (!Number.isNaN(d.valueOf())) return d;
  }

  return null;
}

/* ------------------------------------------------------- classement par thème
   Les thématiques attendues d'un cabinet d'expertise comptable.

   Deux précautions apprises à l'usage :
   - le texte est désaccentué avant analyse, sinon `\b` de JavaScript place une
     frontière de mot devant chaque lettre accentuée et « déplacements » finit
     par déclencher le mot-clé « placement » ;
   - on additionne les correspondances au lieu de retenir la première : un
     article sur l'assurance-vie qui cite « préparer votre retraite » doit
     rester dans Patrimoine, pas basculer dans Social. Le titre pèse plus
     lourd que le résumé.                                                     */

const sansAccent = (texte) =>
  texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const THEMES = [
  ['Social', ['salarie', 'salaries', 'paie', 'bulletin de paie', 'bulletin de salaire',
    'cotisation', 'cotisations', 'urssaf', 'smic', 'employeur', 'employeurs', 'embauche',
    'contrat de travail', 'licenciement', 'apprenti', 'apprentissage', 'alternance',
    'temps de travail', 'conges', 'arret de travail', 'prud.hommes', 'convention collective',
    'retraite', 'chomage', 'mutuelle', 'prevoyance', 'travail dissimule', 'inspection du travail',
    'interessement', 'epargne salariale', 'teletravail', 'accident du travail', 'dsn']],

  ['Fiscalité', ['impot', 'impots', 'fiscal', 'fiscale', 'fiscalite', 'tva', 'bofip', 'cgi',
    'liasse fiscale', 'declaration de resultat', 'credit d.impot', 'cfe', 'cvae', 'taxe',
    'taxes', 'controle fiscal', 'amortissement', 'bareme kilometrique', 'franchise en base',
    'exoneration', 'redevance', 'droits de mutation']],

  ['Juridique', ['juridique', 'statuts', 'assemblee generale', 'greffe', 'registre du commerce',
    'bail commercial', 'clause', 'litige', 'tribunal', 'decret', 'ordonnance',
    'code de commerce', 'procedure collective', 'liquidation', 'redressement judiciaire',
    'facturation electronique', 'conditions generales', 'contentieux', 'sanction',
    'mise en demeure', 'rgpd']],

  ['Création d’entreprise', ['creation d.entreprise', 'creer son entreprise',
    'creer une entreprise', 'immatriculation', 'auto-entrepreneur', 'autoentrepreneur',
    'micro-entreprise', 'microentreprise', 'guichet unique', 'business plan',
    'reprise d.entreprise', 'jeune entreprise', 'formalites de creation']],

  ['Patrimoine', ['patrimoine', 'succession', 'donation', 'assurance-vie', 'assurance vie',
    'epargne', 'placement', 'placements', 'immobilier', 'scpi', 'plan d.epargne retraite',
    'dividende', 'dividendes', 'transmission', 'plus-value', 'plus-values', 'usufruit',
    'livret a', 'pea']],

  ['Gestion', ['tresorerie', 'financement', 'pret', 'subvention', 'aide aux entreprises',
    'facture', 'factures', 'delai de paiement', 'comptabilite', 'comptable', 'bilan',
    'marge', 'rentabilite', 'investissement', 'numerique', 'cybersecurite',
    'intelligence artificielle', 'tableau de bord', 'fonds propres', 'exportation']]
];

// Les motifs sont compilés une fois : le script traite plusieurs centaines
// d'articles à chaque exécution.
const MOTIFS = THEMES.map(([nom, motsCles]) => [
  nom,
  motsCles.map((mot) => new RegExp(`\\b${mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\./g, '.')}\\b`, 'g'))
]);

function deduireTheme(titre, resume) {
  const t = sansAccent(titre);
  const r = sansAccent(resume);

  let meilleur = null;
  let meilleurScore = 0;

  for (const [nom, motifs] of MOTIFS) {
    let score = 0;
    for (const motif of motifs) {
      motif.lastIndex = 0;
      score += (t.match(motif) || []).length * 3;
      motif.lastIndex = 0;
      score += (r.match(motif) || []).length;
    }
    if (score > meilleurScore) { meilleurScore = score; meilleur = nom; }
  }

  return meilleur || 'Gestion';
}

/**
 * Le BOFiP recopie le titre entier dans la description, suivi du seul
 * complément utile (« identifiant juridique…, publié le… »). Afficher les deux
 * donne un doublon dans la liste : on ne garde que ce qui apporte quelque
 * chose, et rien du tout si le résumé n'est que le titre.
 */
function nettoyerResume(resume, titre) {
  if (!resume) return '';

  const r = sansAccent(resume);
  const t = sansAccent(titre);

  if (r.startsWith(t)) {
    const reste = resume.slice(titre.length).replace(/^[\s.,;:–—-]+/, '').trim();
    // Un reliquat trop court (« … ») n'apporte rien de plus que le titre.
    return reste.length > 15 ? tronquer(reste) : '';
  }

  return tronquer(resume);
}

/* ------------------------------------------------------------- récupération */

async function lireFlux(source) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);

  try {
    const reponse = await fetch(source.url, {
      signal: controleur.signal,
      redirect: 'follow',
      headers: {
        // Certains sites publics refusent les requêtes sans User-Agent.
        'User-Agent': 'Cabinet-C3C-Veille/1.0 (+https://www.cabinetcortes-c3c.fr/)',
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
      }
    });

    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);

    const xml = await reponse.text();
    const blocs = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
    if (!blocs.length) throw new Error('aucun <item> trouvé');

    const articles = [];

    for (const bloc of blocs) {
      const titre = sansBalises(baliseTexte(bloc, 'title'));
      const lien = baliseTexte(bloc, 'link');
      if (!titre || !lien) continue;

      const resume = nettoyerResume(sansBalises(baliseTexte(bloc, 'description')), titre);
      const date =
        analyserDate(baliseTexte(bloc, 'pubDate')) ||
        analyserDate(baliseTexte(bloc, 'dc:date')) ||
        analyserDate(baliseTexte(bloc, 'published')) ||
        analyserDate(baliseTexte(bloc, 'updated')) ||
        dateDeSecours(bloc);

      // Sans date fiable, impossible de présenter « les dernières actualités ».
      if (!date) continue;

      articles.push({
        titre,
        resume,
        lien: lien.trim(),
        date: date.toISOString(),
        theme: source.theme || deduireTheme(titre, resume),
        source: source.nom,
        sourceId: source.id,
        editeur: source.editeur
      });
    }

    return { ok: true, articles };
  } catch (erreur) {
    return { ok: false, erreur: erreur.message, articles: [] };
  } finally {
    clearTimeout(minuteur);
  }
}

/* -------------------------------------------------------------------- main */

async function principal() {
  const config = JSON.parse(await readFile(FICHIER_SOURCES, 'utf8'));
  const sources = config.sources.filter((s) => s.actif !== false);

  const resultats = await Promise.all(sources.map(lireFlux));

  const articles = [];
  const vus = new Set();
  const rapport = [];

  resultats.forEach((resultat, i) => {
    const source = sources[i];
    rapport.push({
      id: source.id,
      nom: source.nom,
      url: source.url,
      site: source.site,
      ok: resultat.ok,
      articles: resultat.articles.length,
      erreur: resultat.erreur || null
    });

    for (const article of resultat.articles) {
      const cle = article.lien.split('?')[0];
      if (vus.has(cle)) continue;
      vus.add(cle);
      articles.push(article);
    }
  });

  const reussites = rapport.filter((r) => r.ok).length;

  // Un flux temporairement en panne ne doit pas vider le site : on refuse
  // d'écrire un fichier vide si un fichier exploitable existe déjà.
  if (!articles.length) {
    try {
      const existant = JSON.parse(await readFile(FICHIER_SORTIE, 'utf8'));
      if (existant.articles?.length) {
        console.error('Aucun article récupéré — fichier précédent conservé.');
        rapport.forEach((r) => console.error(`  ${r.nom} : ${r.erreur}`));
        process.exit(1);
      }
    } catch { /* pas de fichier précédent */ }
  }

  articles.sort((a, b) => b.date.localeCompare(a.date));
  const retenus = articles.slice(0, MAX_ARTICLES);

  const themes = [...new Set(retenus.map((a) => a.theme))].sort((a, b) =>
    a.localeCompare(b, 'fr'));

  const sortie = {
    genereLe: new Date().toISOString(),
    nombre: retenus.length,
    themes,
    sources: rapport,
    articles: retenus
  };

  await writeFile(FICHIER_SORTIE, JSON.stringify(sortie, null, 2) + '\n', 'utf8');

  console.log(`${retenus.length} actualités écrites dans data/actualites.json`);
  rapport.forEach((r) =>
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.nom} — ${r.ok ? r.articles + ' articles' : r.erreur}`));

  if (reussites === 0) process.exit(1);
}

principal().catch((erreur) => {
  console.error('Échec de la génération du fil :', erreur);
  process.exit(1);
});
