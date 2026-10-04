/** Cite API operator console — HTML for GET / */

export type ConsoleStats = {
  ok: boolean;
  asOf: string;
  rules: number;
  addresses: number;
  changes: number;
  aliases: number;
  port: number;
};

function esc(s: string | number): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ENDPOINTS: ReadonlyArray<{
  method: "GET" | "POST";
  path: string;
  note: string;
  try?: string;
}> = [
  { method: "GET", path: "/health", note: "Liveness + default as-of" },
  {
    method: "GET",
    path: "/lookup/:addressId",
    note: "Rules that apply at an address",
    try: "/lookup/A0005?as_of=2026-10-01",
  },
  {
    method: "GET",
    path: "/addresses",
    note: "Search sample addresses",
    try: "/addresses?q=A0005&limit=5",
  },
  { method: "GET", path: "/rules", note: "Full extracted rule catalog" },
  { method: "GET", path: "/changes", note: "Change tests T1-T6" },
  { method: "GET", path: "/corpus/docs", note: "Capturable corpus for Pipeline" },
  {
    method: "POST",
    path: "/extract/doc/:docId",
    note: "Run extract on one document",
  },
  {
    method: "GET",
    path: "/rules/:id/versions",
    note: "Version history for a rule",
    try: "/rules/r-0050/versions",
  },
  { method: "GET", path: "/audit", note: "Recent pipeline audit events" },
  {
    method: "GET",
    path: "/submission/:file",
    note: "rules.json · lookups.json · changes.json",
    try: "/submission/rules.json",
  },
];

export function renderConsolePage(stats: ConsoleStats): string {
  const base = `http://localhost:${stats.port}`;
  const rows = ENDPOINTS.map((e) => {
    const href = e.try ? `${base}${e.try}` : "";
    const pathCell = e.try
      ? `<a class="path" href="${esc(href)}" target="_blank" rel="noreferrer">${esc(e.path)}</a>`
      : `<span class="path">${esc(e.path)}</span>`;
    return `<tr>
      <td><span class="method method-${e.method.toLowerCase()}">${e.method}</span></td>
      <td>${pathCell}</td>
      <td class="note">${esc(e.note)}</td>
    </tr>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cite API · regulatory intelligence</title>
  <meta name="description" content="Cite Hono API: extract, geocode, lookup, and change tests with verbatim citations." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=Source+Serif+4:ital,opsz,wght@0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: oklch(0.975 0.006 95);
      --paper: oklch(0.992 0.003 95);
      --ink: oklch(0.18 0.035 240);
      --muted: oklch(0.48 0.02 240);
      --line: oklch(0.88 0.01 95);
      --primary: oklch(0.4 0.08 205);
      --primary-soft: oklch(0.94 0.025 205);
      --ok: oklch(0.45 0.1 160);
      --ok-soft: oklch(0.95 0.03 160);
      --get: oklch(0.42 0.08 205);
      --post: oklch(0.48 0.12 70);
      --ease: cubic-bezier(0.16, 1, 0.3, 1);
      --shadow: 0 8px 28px -10px oklch(0.22 0.03 230 / 0.12), 0 1px 0 oklch(0.22 0.03 230 / 0.04);
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      font-family: "IBM Plex Sans", system-ui, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(ellipse 90% 60% at 8% -8%, oklch(0.78 0.07 205 / 0.38), transparent 58%),
        radial-gradient(ellipse 55% 40% at 96% 4%, oklch(0.9 0.04 160 / 0.22), transparent 52%),
        var(--bg);
      -webkit-font-smoothing: antialiased;
      line-height: 1.5;
    }
    ::selection { background: oklch(0.88 0.04 205); color: var(--ink); }
    a { color: var(--primary); text-decoration: none; }
    a:hover { text-decoration: underline; text-underline-offset: 3px; }
    .wrap { max-width: 920px; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
    .island {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      padding: 0.7rem 1rem; border: 1px solid oklch(0.86 0.012 95 / 0.9);
      border-radius: 1rem; background: oklch(0.995 0.002 95 / 0.86);
      box-shadow: var(--shadow); backdrop-filter: blur(10px);
      animation: rise 0.55s var(--ease) both;
    }
    .brand { display: flex; align-items: baseline; gap: 0.35rem; color: var(--ink); text-decoration: none; }
    .brand:hover { text-decoration: none; }
    .brand strong {
      font-family: "Source Serif 4", Georgia, serif;
      font-size: 1.55rem; font-weight: 650; letter-spacing: -0.03em;
    }
    .brand sup { font-family: "IBM Plex Mono", monospace; font-size: 0.65rem; color: var(--primary); }
    .pill {
      display: inline-flex; align-items: center; gap: 0.4rem;
      font-family: "IBM Plex Mono", monospace; font-size: 0.68rem;
      text-transform: uppercase; letter-spacing: 0.08em;
      padding: 0.35rem 0.7rem; border-radius: 999px;
      background: var(--ok-soft); color: var(--ok); border: 1px solid oklch(0.45 0.1 160 / 0.2);
    }
    .pill::before {
      content: ""; width: 0.4rem; height: 0.4rem; border-radius: 999px; background: currentColor;
      box-shadow: 0 0 0 3px oklch(0.45 0.1 160 / 0.15);
    }
    .pill.down { background: oklch(0.96 0.03 40); color: oklch(0.5 0.14 35); border-color: oklch(0.5 0.14 35 / 0.25); }
    .hero { margin-top: 3rem; animation: rise 0.55s var(--ease) 0.06s both; }
    .hero h1 {
      margin: 0; font-family: "Source Serif 4", Georgia, serif;
      font-size: clamp(2.4rem, 6vw, 3.6rem); font-weight: 650;
      letter-spacing: -0.035em; line-height: 1.05; text-wrap: balance;
    }
    .hero p {
      margin: 1rem 0 0; max-width: 34rem;
      font-family: "Source Serif 4", Georgia, serif;
      font-size: 1.2rem; font-style: italic; color: var(--muted); line-height: 1.45;
    }
    .stats {
      display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.75rem;
      margin-top: 2rem; animation: rise 0.55s var(--ease) 0.12s both;
    }
    @media (max-width: 720px) { .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .stat {
      padding: 1rem 1.05rem; border-radius: 0.9rem; border: 1px solid var(--line);
      background: oklch(0.995 0.002 95 / 0.9); box-shadow: var(--shadow);
    }
    .stat b {
      display: block; font-family: "IBM Plex Mono", monospace;
      font-size: 1.45rem; font-weight: 600; font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
    }
    .stat span {
      display: block; margin-top: 0.2rem;
      font-family: "IBM Plex Mono", monospace; font-size: 0.65rem;
      text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted);
    }
    .panel {
      margin-top: 2.25rem; border: 1px solid var(--line); border-radius: 1.1rem;
      background: oklch(0.995 0.002 95 / 0.92); box-shadow: var(--shadow);
      overflow: hidden; animation: rise 0.55s var(--ease) 0.18s both;
    }
    .panel-head {
      padding: 1.1rem 1.25rem; border-bottom: 1px solid var(--line);
    }
    .panel-head h2 {
      margin: 0; font-family: "Source Serif 4", Georgia, serif;
      font-size: 1.35rem; font-weight: 600; letter-spacing: -0.02em;
    }
    .panel-head .meta {
      display: block; margin-top: 0.35rem;
      font-family: "IBM Plex Mono", monospace; font-size: 0.68rem;
      color: var(--muted); letter-spacing: 0.04em;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.85rem 1.15rem; text-align: left; vertical-align: middle; }
    th {
      font-family: "IBM Plex Mono", monospace; font-size: 0.65rem; font-weight: 500;
      text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted);
      border-bottom: 1px solid var(--line); background: oklch(0.97 0.006 95);
    }
    tr + tr td { border-top: 1px solid oklch(0.92 0.008 95); }
    tr:hover td { background: oklch(0.98 0.01 205 / 0.35); }
    .method {
      display: inline-block; min-width: 3.2rem; text-align: center;
      font-family: "IBM Plex Mono", monospace; font-size: 0.65rem; font-weight: 600;
      letter-spacing: 0.04em; padding: 0.22rem 0.45rem; border-radius: 0.35rem;
    }
    .method-get { background: var(--primary-soft); color: var(--get); }
    .method-post { background: oklch(0.96 0.04 85); color: var(--post); }
    .path {
      font-family: "IBM Plex Mono", ui-monospace, monospace;
      font-size: 0.84rem; font-weight: 500; letter-spacing: -0.01em;
      color: var(--ink); text-decoration: none;
    }
    a.path:hover { color: var(--primary); text-decoration: underline; text-underline-offset: 3px; }
    .note { color: var(--muted); font-size: 0.9rem; }
    .try {
      margin-top: 2rem; display: grid; gap: 0.75rem;
      animation: rise 0.55s var(--ease) 0.22s both;
    }
    .try a {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      padding: 1rem 1.15rem; border-radius: 0.9rem; border: 1px solid var(--line);
      background: oklch(0.995 0.002 95 / 0.9); color: var(--ink); text-decoration: none;
      box-shadow: var(--shadow); transition: transform 0.25s var(--ease), border-color 0.25s var(--ease);
    }
    .try a:hover { transform: translateY(-2px); border-color: oklch(0.4 0.08 205 / 0.35); text-decoration: none; }
    .try strong { display: block; font-family: "IBM Plex Mono", monospace; font-size: 0.78rem; color: var(--primary); }
    .try em { display: block; margin-top: 0.2rem; font-family: "Source Serif 4", Georgia, serif; font-style: italic; font-size: 0.95rem; }
    .try span {
      flex-shrink: 0; width: 2rem; height: 2rem; border-radius: 999px;
      display: grid; place-items: center; background: var(--primary-soft); color: var(--primary);
      font-family: "IBM Plex Mono", monospace; font-size: 0.9rem;
    }
    .curl {
      margin-top: 1.5rem; padding: 1rem 1.15rem; border-radius: 0.9rem;
      background: oklch(0.2 0.03 240); color: oklch(0.93 0.01 95);
      font-family: "IBM Plex Mono", monospace; font-size: 0.78rem; line-height: 1.55;
      overflow-x: auto; animation: rise 0.55s var(--ease) 0.26s both;
    }
    .curl b { color: oklch(0.78 0.06 205); font-weight: 500; }
    footer {
      margin-top: 2.5rem; padding: 0.85rem 1.1rem; border-radius: 999px;
      border: 1px solid var(--line); background: oklch(0.995 0.002 95 / 0.9);
      box-shadow: var(--shadow); color: var(--muted); font-size: 0.8rem;
      display: flex; align-items: center; gap: 0.55rem; animation: rise 0.55s var(--ease) 0.3s both;
    }
    footer svg { flex-shrink: 0; opacity: 0.7; }
    @keyframes rise {
      from { opacity: 0; transform: translateY(10px); filter: blur(2px); }
      to { opacity: 1; transform: none; filter: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      * { animation: none !important; transition: none !important; }
    }
  </style>
</head>
<body>
  <!--
    THESIS: Cite API console proves the product is a live regulatory engine, not a slide deck.
    OWN-WORLD: paper + ink + teal; serif brand; mono for paths and metrics.
    STORY: Dev/judge opens :4000, sees health + endpoints + demo lookups in one screen.
    FIRST VIEWPORT: brand island, Cite headline, live stats, endpoint table start.
    FORM: operator console / Stripe-docs hybrid · seed: cite-api-console
    FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
  -->
  <div class="wrap">
    <header class="island">
      <a class="brand" href="/"><strong>Cite</strong><sup>[1]</sup></a>
      <div class="pill${stats.ok ? "" : " down"}">${stats.ok ? "Live" : "Down"} · :${esc(stats.port)}</div>
    </header>

    <section class="hero">
      <h1>Regulatory intelligence, as an API.</h1>
      <p>Extract → geocode → coverage → change tests. Every answer cites the corpus. Not legal advice.</p>
    </section>

    <div class="stats">
      <div class="stat"><b>${esc(stats.rules)}</b><span>Rules</span></div>
      <div class="stat"><b>${esc(stats.addresses)}</b><span>Addresses</span></div>
      <div class="stat"><b>${esc(stats.changes)}</b><span>Change tests</span></div>
      <div class="stat"><b>${esc(stats.asOf)}</b><span>Default as-of</span></div>
    </div>

    <section class="panel">
      <div class="panel-head">
        <h2>Endpoints</h2>
        <span class="meta">${esc(stats.aliases)} change-test aliases wired</span>
      </div>
      <table>
        <thead>
          <tr><th>Method</th><th>Path</th><th>Purpose</th></tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </section>

    <div class="try">
      <a href="${esc(base)}/lookup/A0005?as_of=${esc(stats.asOf)}" target="_blank" rel="noreferrer">
        <div><strong>A0005</strong><em>Unknown over guessing: missing year / units</em></div>
        <span>→</span>
      </a>
      <a href="${esc(base)}/lookup/A0065?as_of=${esc(stats.asOf)}" target="_blank" rel="noreferrer">
        <div><strong>A0065</strong><em>Postal Dorchester → legal Boston</em></div>
        <span>→</span>
      </a>
      <a href="${esc(base)}/lookup/SA0001?as_of=${esc(stats.asOf)}" target="_blank" rel="noreferrer">
        <div><strong>SA0001</strong><em>Santa Ana, CA</em></div>
        <span>→</span>
      </a>
    </div>

    <pre class="curl"><b>curl</b> ${esc(base)}/lookup/A0005?as_of=${esc(stats.asOf)} | jq '.results | length'</pre>

    <footer>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
        <path d="M12 3v18"/><path d="M5 8h14"/><path d="M5 16h14"/><path d="M7 8c0 2.5 1.5 4 5 4s5-1.5 5-4"/><path d="M7 16c0-2.5 1.5-4 5-4s5 1.5 5 4"/>
      </svg>
      Not legal advice and not a compliance certification. Verify important decisions with qualified counsel.
    </footer>
  </div>
</body>
</html>`;
}
