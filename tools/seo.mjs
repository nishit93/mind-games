// Writes the search-engine and AI-assistant friendly parts of the site from the game list and each game's own text.
// Run after adding or editing a game:   node tools/seo.mjs
// It is safe to run again: everything it writes sits between "seo:start" and "seo:end" markers, or in generated files.
//
// For every game page it adds: a page title and description built from the game's blurb, origin and history; a canonical
// address; social-preview tags; and structured data (VideoGame, BreadcrumbList, FAQPage) whose answers are the visible text.
// The history is moved out of the folded "How to play" box into its own always-visible section, because that text is
// what answers "where does this game come from?" for people, search engines and AI assistants.
// It also writes sitemap.xml, robots.txt and llms.txt, and a plain list of games inside <noscript> on the home page.
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const SITE = 'https://nishit93.github.io/quiet-board/';
const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8').replace(/\r\n/g, '\n');
const write = (p, s) => writeFileSync(new URL(p, root), s);

const ctx = {};
vm.createContext(ctx);
vm.runInContext(read('games.js') + '\nthis.SECTIONS = SECTIONS; this.GAMES = GAMES;', ctx);
const { SECTIONS, GAMES } = ctx;

const text = html => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const section = (html, name) => {
  const m = html.match(new RegExp(`<h3>${name}</h3>\\s*([\\s\\S]*?)(?=<h3>|</details>)`));
  return m ? m[1].trim() : '';
};
const firstSentence = s => (s.match(/^.*?[.!?](?=\s|$)/) || [s])[0];
const trim = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)).replace(/[,;:.\s]+$/, '') + '…');

const urls = [SITE];
const summary = [];

for (const g of GAMES) {
  const file = `games/${g.id}/index.html`;
  let html = read(file);
  const sec = SECTIONS.find(s => s.id === g.sec);
  const url = `${SITE}games/${g.id}/`;

  // History: pull it out of the folded box into its own visible section (once; later runs find it already there).
  let historyHtml = section(html, 'A little history');
  if (historyHtml) {
    html = html.replace(/\s*<h3>A little history<\/h3>\s*[\s\S]*?(?=<\/details>)/, '\n    ');
    html = html.replace(/(<\/details>)(?!\s*<section class="history">)/, `$1\n    <section class="history" id="history"><h2>The history of ${g.name}</h2>\n      ${historyHtml}\n    </section>`);
  } else {
    const m = html.match(/<section class="history"[^>]*>[\s\S]*?<\/h2>\s*([\s\S]*?)\s*<\/section>/);
    historyHtml = m ? m[1].trim() : '';
  }
  const history = text(historyHtml);
  if (!history) throw new Error(`${g.id}: no history text found`);
  const goal = text(section(html, 'Goal'));
  const rules = text(section(html, 'Rules') || section(html, 'The rules') || section(html, 'The two rules') || '');
  const howItWorks = text(section(html, 'How it works'));

  const title = `${g.name}: free to play, rules and history · Quiet Board`;
  const base = `${g.name} (${g.origin}): ${g.blurb} Free to play online, no sign-up, with rules and history.`;
  const description = base.length + firstSentence(history).length < 158 ? `${base} ${firstSentence(history)}` : base;

  const faq = [
    [`How do you play ${g.name}?`, trim(`${goal} ${rules} ${howItWorks}`.replace(/\s+/g, ' ').trim(), 600)],
    [`Where does ${g.name} come from?`, history],
    [`Is ${g.name} free to play?`, `Yes. ${g.name} on Quiet Board is free, works in any browser on a phone or computer, needs no account and keeps your best scores on your device.`],
  ];
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'VideoGame', name: g.name, url, description: `${g.blurb} ${firstSentence(history)}`,
        genre: ['Puzzle', sec.name], applicationCategory: 'Game', gamePlatform: 'Web browser', operatingSystem: 'Any',
        playMode: 'SinglePlayer', inLanguage: 'en', isAccessibleForFree: true, image: `${SITE}icon-512.png`,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        publisher: { '@type': 'Organization', name: 'Quiet Board', url: SITE },
        ...(g.kids ? { audience: { '@type': 'PeopleAudience', suggestedMinAge: 6 } } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Quiet Board', item: SITE },
          { '@type': 'ListItem', position: 2, name: sec.name, item: `${SITE}#${sec.id}` },
          { '@type': 'ListItem', position: 3, name: g.name, item: url },
        ],
      },
      { '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    ],
  };

  const block = `  <!-- seo:start -->
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Quiet Board">
  <meta property="og:title" content="${esc(`${g.name} · Quiet Board`)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${SITE}icon-512.png">
  <meta name="twitter:card" content="summary">
  <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
  <!-- seo:end -->
`;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  // A description written by hand outside the generated block would be a duplicate: drop it.
  html = html.replace(/ *<meta name="description"[^>]*>\n/g, (m, off, str) => (str.lastIndexOf('<!-- seo:start -->', off) > str.lastIndexOf('<!-- seo:end -->', off) ? m : ''));
  html = /<!-- seo:start -->/.test(html)
    ? html.replace(/  <!-- seo:start -->[\s\S]*?<!-- seo:end -->\n/, () => block)
    : html.replace(/(<meta name="theme-color"[^>]*>\n)/, (m) => m + block);
  write(file, html);
  urls.push(url);
  summary.push({ g, sec, description, history });
}

// Home page: description, social tags, structured data, and a plain list of games for visitors and crawlers without scripts.
{
  let html = read('index.html');
  const description = `Quiet Board is a calm collection of ${GAMES.length} free single-player puzzle and mind games from around the world: Sudoku, Tower of Hanoi, Nonogram, solitaire and more. No sign-up, plays in your browser.`;
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: 'Quiet Board', url: SITE, description, inLanguage: 'en' },
      {
        '@type': 'ItemList', name: 'Quiet Board', numberOfItems: GAMES.length,
        itemListElement: GAMES.map((g, i) => ({ '@type': 'ListItem', position: i + 1, name: g.name, url: `${SITE}games/${g.id}/` })),
      },
    ],
  };
  const block = `  <!-- seo:start -->
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${SITE}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Quiet Board">
  <meta property="og:title" content="Quiet Board: free puzzle and mind games from around the world">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${SITE}">
  <meta property="og:image" content="${SITE}icon-512.png">
  <meta name="twitter:card" content="summary">
  <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
  <!-- seo:end -->
`;
  // A description written by hand outside the generated block would be a duplicate: drop it.
  html = html.replace(/ *<meta name="description"[^>]*>\n/g, (m, off, str) => (str.lastIndexOf('<!-- seo:start -->', off) > str.lastIndexOf('<!-- seo:end -->', off) ? m : ''));
  html = /<!-- seo:start -->/.test(html)
    ? html.replace(/  <!-- seo:start -->[\s\S]*?<!-- seo:end -->\n/, () => block)
    : html.replace(/(<meta name="theme-color"[^>]*>\n)/, m => m + block);
  const list = `<!-- seo-list:start -->
    <noscript>
      <h2>All games</h2>
      ${SECTIONS.map(s => `<h3>${s.name}</h3>\n      <ul>\n${summary.filter(x => x.sec === s).map(x => `        <li><a href="games/${x.g.id}/">${x.g.name}</a> (${x.g.origin}): ${x.g.blurb}</li>`).join('\n')}\n      </ul>`).join('\n      ')}
    </noscript>
    <!-- seo-list:end -->`;
  html = /<!-- seo-list:start -->/.test(html)
    ? html.replace(/<!-- seo-list:start -->[\s\S]*?<!-- seo-list:end -->/, () => list)
    : html.replace(/(<main class="wrap[^"]*"[^>]*>)/, (m) => `${m}\n    ${list}`);
  write('index.html', html);
}

const today = new Date().toISOString().slice(0, 10);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u, i) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod><priority>${i === 0 ? '1.0' : '0.7'}</priority></url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`);
write('llms.txt', `# Quiet Board

> A calm collection of ${GAMES.length} free single-player puzzle and mind games from around the world. No sign-up; each game has a How to play guide and a short history of where it comes from. Works in any browser on phones and computers.

${SECTIONS.map(s => `## ${s.name}\n\n${summary.filter(x => x.sec === s).map(x => `- [${x.g.name}](${SITE}games/${x.g.id}/): ${x.g.blurb} Origin: ${x.g.origin}. ${firstSentence(x.history)}`).join('\n')}`).join('\n\n')}
`);

console.log(`SEO written for ${GAMES.length} games.`);
