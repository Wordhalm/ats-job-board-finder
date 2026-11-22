(() => {
  'use strict';

  const ATS = {
    g: 'greenhouse', l: 'lever', a: 'ashby', s: 'smartrecruiters',
  };
  const LABEL = {
    greenhouse: 'Greenhouse', lever: 'Lever', ashby: 'Ashby', smartrecruiters: 'SmartRecruiters',
  };
  const POPULAR = [
    ['greenhouse', 'Stripe', 'stripe'], ['ashby', 'OpenAI', 'openai'], ['greenhouse', 'Anthropic', 'anthropic'],
    ['greenhouse', 'Airbnb', 'airbnb'], ['greenhouse', 'Datadog', 'datadog'], ['greenhouse', 'Databricks', 'databricks'],
    ['ashby', 'Linear', 'linear'], ['greenhouse', 'Vercel', 'vercel'], ['ashby', 'Notion', 'notion'],
    ['greenhouse', 'Figma', 'figma'], ['greenhouse', 'Coinbase', 'coinbase'], ['ashby', 'Plaid', 'plaid'],
    ['greenhouse', 'Cloudflare', 'cloudflare'], ['greenhouse', 'Discord', 'discord'], ['greenhouse', 'Reddit', 'reddit'],
    ['lever', 'Palantir', 'palantir'], ['ashby', 'Perplexity', 'perplexity'], ['ashby', 'Cursor', 'cursor'],
    ['ashby', 'Deel', 'deel'], ['greenhouse', 'Monzo', 'monzo'], ['lever', 'Spotify', 'spotify'],
    ['greenhouse', 'GitLab', 'gitlab'], ['ashby', 'Supabase', 'supabase'], ['ashby', 'ElevenLabs', 'elevenlabs'],
    ['ashby', 'Cohere', 'cohere'], ['greenhouse', 'Adyen', 'adyen'], ['ashby', 'n8n', 'n8n'],
    ['smartrecruiters', 'Bosch Group', 'BoschGroup'], ['smartrecruiters', 'Canva', 'canva'],
  ];
  const MAX_RESULTS = 60;
  const JOBS_PAGE = 100;

  const $ = (id) => document.getElementById(id);
  const els = {
    q: $('q'), status: $('status'), results: $('results'), count: $('index-count'),
    board: $('board'), boardName: $('board-name'), boardAts: $('board-ats'), boardUrl: $('board-url'),
    back: $('back'), jq: $('jq'), remote: $('remote'), jobStatus: $('job-status'), jobs: $('jobs'),
    more: $('more'), copy: $('copy-input'), inputJson: $('input-json'),
    popular: $('popular'), popularSection: $('popular-section'), faq: $('faq'),
    searchSection: document.querySelector('.search'), intro: document.querySelector('.intro'),
  };

  let index = [];          // { ats, name, slug, norm, slugLc }
  let atsFilter = 'all';
  let current = null;      // { ats, name, slug }
  let allJobs = [];
  let shown = JOBS_PAGE;
  let fetchSeq = 0;

  const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const fmt = (n) => n.toLocaleString('en-US');

  function boardUrl(ats, slug) {
    const s = encodeURIComponent(slug);
    switch (ats) {
      case 'greenhouse': return `https://job-boards.greenhouse.io/${s}`;
      case 'lever': return `https://jobs.lever.co/${s}`;
      case 'ashby': return `https://jobs.ashbyhq.com/${s}`;
      default: return `https://careers.smartrecruiters.com/${s}`;
    }
  }
  const routeOf = (b) => `#/${b.ats}/${encodeURIComponent(b.slug)}`;

  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v);
    }
    for (const k of kids) if (k != null) n.append(k);
    return n;
  }
  const tag = (ats) => el('span', { class: `tag ${ats}`, text: LABEL[ats] });

  // ---------- Index & search ----------

  async function loadIndex() {
    try {
      const res = await fetch('data/ats-index.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      index = data.entries
        .filter((e) => ATS[e[0]] && e[2])
        .map(([c, name, slug]) => ({ ats: ATS[c], name: name || slug, slug, norm: norm(name || slug), slugLc: slug.toLowerCase() }));
      els.count.textContent = fmt(index.length);
      els.status.textContent = `${fmt(index.length)} companies indexed. Start typing.`;
      if (els.q.value) runSearch();
    } catch (err) {
      els.status.textContent = `Could not load the company index (${err.message}). Reload the page to retry.`;
    }
  }

  function parseBoardUrl(raw) {
    const pats = [
      ['greenhouse', /greenhouse\.io\/(?:embed\/job_board\?for=)?([A-Za-z0-9_-]+)/i],
      ['lever', /jobs\.lever\.co\/([A-Za-z0-9_.-]+)/i],
      ['ashby', /jobs\.ashbyhq\.com\/([A-Za-z0-9_.-]+)/i],
      ['smartrecruiters', /(?:jobs|careers)\.smartrecruiters\.com\/([A-Za-z0-9_.-]+)/i],
    ];
    for (const [ats, re] of pats) {
      const m = raw.match(re);
      if (m) {
        const hit = index.find((e) => e.ats === ats && e.slugLc === m[1].toLowerCase());
        return hit || { ats, name: m[1], slug: m[1] };
      }
    }
    return null;
  }

  function search(qRaw) {
    const q = norm(qRaw);
    if (!q) return [];
    const qSlug = qRaw.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    const words = ` ${q}`;
    const scored = [];
    for (const e of index) {
      if (atsFilter !== 'all' && e.ats !== atsFilter) continue;
      let s = 0;
      if (e.norm === q || e.slugLc === qSlug) s = 100;
      else if (e.norm.startsWith(q)) s = 80 - Math.min(e.norm.length - q.length, 30) / 2;
      else if ((` ${e.norm}`).includes(words)) s = 50;
      else if (e.norm.includes(q)) s = 30;
      else if (qSlug.length >= 3 && e.slugLc.includes(qSlug)) s = 20;
      if (s) scored.push([s, e]);
    }
    scored.sort((a, b) => b[0] - a[0] || a[1].name.length - b[1].name.length || a[1].name.localeCompare(b[1].name));
    return scored;
  }

  function runSearch() {
    const raw = els.q.value.trim();
    els.results.replaceChildren();
    if (!index.length) return;
    if (!raw) {
      els.status.textContent = `${fmt(index.length)} companies indexed. Start typing.`;
      return;
    }
    const direct = parseBoardUrl(raw);
    if (direct) {
      els.status.textContent = 'Job board URL recognised.';
      els.results.append(resultRow(direct));
      return;
    }
    const scored = search(raw);
    if (!scored.length) {
      els.status.textContent = 'No company found. Try a shorter name, or paste the job board URL.';
      return;
    }
    els.status.textContent = scored.length > MAX_RESULTS
      ? `${fmt(scored.length)} matches, showing the first ${MAX_RESULTS}.`
      : `${fmt(scored.length)} match${scored.length > 1 ? 'es' : ''}.`;
    const frag = document.createDocumentFragment();
    for (const [, e] of scored.slice(0, MAX_RESULTS)) frag.append(resultRow(e));
    els.results.append(frag);
  }

  function resultRow(e) {
    return el('li', null,
      el('a', { href: routeOf(e) },
        el('span', null, el('span', { class: 'r-name', text: e.name }), el('span', { class: 'r-slug', text: e.slug })),
        tag(e.ats)));
  }

  // ---------- Live jobs ----------

  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');
  const day = (v) => {
    if (v == null || v === '') return '';
    const d = new Date(typeof v === 'number' ? v : String(v));
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  };
  const isRemote = (...vals) => vals.some((v) => v === true || (typeof v === 'string' && /remote/i.test(v)));

  async function getJson(url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function fetchJobs(b) {
    const s = encodeURIComponent(b.slug);
    if (b.ats === 'greenhouse') {
      const d = await getJson(`https://boards-api.greenhouse.io/v1/boards/${s}/jobs?content=false`);
      return { total: d?.jobs?.length || 0, jobs: (d?.jobs || []).map((j) => ({
        title: str(j.title), url: str(j.absolute_url), location: str(j.location?.name),
        team: str(j.departments?.[0]?.name), date: day(j.first_published || j.updated_at),
        remote: isRemote(j.location?.name, j.title),
      })) };
    }
    if (b.ats === 'lever') {
      const d = await getJson(`https://api.lever.co/v0/postings/${s}?mode=json`);
      const arr = Array.isArray(d) ? d : [];
      return { total: arr.length, jobs: arr.map((j) => ({
        title: str(j.text), url: str(j.hostedUrl) || str(j.applyUrl), location: str(j.categories?.location),
        team: str(j.categories?.team) || str(j.categories?.department), date: day(j.createdAt),
        remote: isRemote(j.categories?.location, j.workplaceType),
      })) };
    }
    if (b.ats === 'ashby') {
      const d = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${s}`);
      return { total: d?.jobs?.length || 0, jobs: (d?.jobs || []).map((j) => ({
        title: str(j.title), url: str(j.jobUrl) || `https://jobs.ashbyhq.com/${s}/${j.id}`, location: str(j.location),
        team: str(j.team) || str(j.department), date: day(j.publishedAt),
        // Ashby sets isRemote=true on hybrid roles: trust workplaceType when present.
        remote: j.workplaceType ? j.workplaceType === 'Remote' : isRemote(j.isRemote, j.location),
      })) };
    }
    const d = await getJson(`https://api.smartrecruiters.com/v1/companies/${s}/postings?limit=100`);
    const arr = d?.content || [];
    return { total: d?.totalFound ?? arr.length, jobs: arr.map((j) => {
      const loc = j.location || {};
      const where = str(loc.fullLocation) || [loc.city, loc.region, loc.country].filter((x) => str(x)).join(', ');
      return {
        title: str(j.name), url: `https://jobs.smartrecruiters.com/${s}/${encodeURIComponent(j.id)}`, location: where,
        team: str(j.department?.label), date: day(j.releasedDate), remote: isRemote(loc.remote, where, j.name),
      };
    }) };
  }

  async function openBoard(b) {
    current = b;
    allJobs = [];
    shown = JOBS_PAGE;
    const seq = ++fetchSeq;
    showView('board');
    document.title = `${b.name} jobs on ${LABEL[b.ats]} | ATS Job Board Finder`;
    els.boardName.textContent = b.name;
    els.boardAts.className = `tag ${b.ats}`;
    els.boardAts.textContent = LABEL[b.ats];
    const url = boardUrl(b.ats, b.slug);
    els.boardUrl.href = url;
    els.boardUrl.textContent = url.replace('https://', '');
    els.jq.value = '';
    els.remote.checked = false;
    delete els.jobStatus.dataset.base;
    els.jobs.replaceChildren();
    els.more.hidden = true;
    els.inputJson.hidden = true;
    els.copy.textContent = 'Copy input for this company';
    els.jobStatus.textContent = `Reading the ${LABEL[b.ats]} board…`;
    window.scrollTo(0, 0);
    try {
      const { total, jobs } = await fetchJobs(b);
      if (seq !== fetchSeq) return;
      allJobs = jobs.filter((j) => j.title && j.url);
      if (!allJobs.length) {
        els.jobStatus.textContent = 'No open roles on this board right now. The company may have moved to another ATS.';
        return;
      }
      const n = b.ats === 'smartrecruiters' ? Math.max(total, allJobs.length) : allJobs.length;
      const capped = n > allJobs.length
        ? ` Showing the first ${fmt(allJobs.length)}: SmartRecruiters returns 100 roles per request.`
        : '';
      els.jobStatus.dataset.base = `${fmt(n)} open role${n > 1 ? 's' : ''}.${capped}`;
      renderJobs();
    } catch (err) {
      if (seq !== fetchSeq) return;
      els.jobStatus.textContent = `Could not read this board (${err.message}). Open it directly with the link above.`;
    }
  }

  function filteredJobs() {
    const f = norm(els.jq.value);
    const remoteOnly = els.remote.checked;
    return allJobs.filter((j) => (!remoteOnly || j.remote)
      && (!f || norm(`${j.title} ${j.team} ${j.location}`).includes(f)));
  }

  function renderJobs() {
    if (!allJobs.length) return;
    const list = filteredJobs();
    const base = els.jobStatus.dataset.base || '';
    const filtering = els.jq.value.trim() || els.remote.checked;
    els.jobStatus.textContent = filtering ? `${base} ${fmt(list.length)} match your filter.` : base;
    const frag = document.createDocumentFragment();
    for (const j of list.slice(0, shown)) {
      const meta = [j.location, j.team, j.date].filter(Boolean).join(' · ');
      frag.append(el('li', null,
        el('a', { href: j.url, target: '_blank', rel: 'noopener', text: j.title }),
        meta ? el('div', { class: 'j-meta', text: meta }) : null));
    }
    els.jobs.replaceChildren(frag);
    els.more.hidden = list.length <= shown;
    if (!els.more.hidden) els.more.textContent = `Show more (${fmt(list.length - shown)} left)`;
  }

  // ---------- Views & routing ----------

  function showView(v) {
    const board = v === 'board';
    els.board.hidden = !board;
    els.intro.hidden = board;
    els.searchSection.hidden = board;
    els.popularSection.hidden = board;
  }

  function route() {
    const m = location.hash.match(/^#\/(greenhouse|lever|ashby|smartrecruiters)\/(.+)$/);
    if (!m) {
      fetchSeq++;
      current = null;
      showView('search');
      document.title = 'ATS Job Board Finder: which ATS does a company use?';
      return;
    }
    const ats = m[1];
    const slug = decodeURIComponent(m[2]);
    const hit = index.find((e) => e.ats === ats && e.slugLc === slug.toLowerCase());
    openBoard(hit || { ats, name: slug, slug });
  }

  function actorInput(b) {
    return JSON.stringify({
      companies: [`${b.ats}:${b.slug}`],
      keywords: [],
      location: '',
      remoteOnly: false,
      maxJobsTotal: 1000,
      onlyNewSinceLastRun: true,
      monitorStateName: b.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    }, null, 2);
  }

  // ---------- Wiring ----------

  let t;
  els.q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(runSearch, 70); });
  els.q.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      const first = els.results.querySelector('a');
      if (first) location.hash = first.getAttribute('href');
    }
  });
  document.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === c));
    atsFilter = c.dataset.ats;
    runSearch();
    els.q.focus();
  }));
  els.back.addEventListener('click', (ev) => {
    ev.preventDefault();
    location.hash = '';
  });
  els.jq.addEventListener('input', () => { shown = JOBS_PAGE; renderJobs(); });
  els.remote.addEventListener('change', () => { shown = JOBS_PAGE; renderJobs(); });
  els.more.addEventListener('click', () => { shown += JOBS_PAGE; renderJobs(); });
  els.copy.addEventListener('click', async () => {
    if (!current) return;
    const json = actorInput(current);
    els.inputJson.textContent = json;
    els.inputJson.hidden = false;
    try {
      await navigator.clipboard.writeText(json);
      els.copy.textContent = 'Copied. Paste it in the Actor\'s JSON input tab';
    } catch {
      els.copy.textContent = 'Select and copy the JSON below';
    }
  });
  $('to-cta').addEventListener('click', () => $('cta').scrollIntoView());
  window.addEventListener('hashchange', route);

  for (const [ats, name, slug] of POPULAR) {
    els.popular.append(el('li', null, el('a', { href: routeOf({ ats, slug }), text: name })));
  }

  loadIndex().then(route);
})();
