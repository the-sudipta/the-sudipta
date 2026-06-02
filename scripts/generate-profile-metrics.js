const fs = require("fs");
const path = require("path");
const https = require("https");

const USERNAME = process.env.GITHUB_USERNAME || "the-sudipta";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const OUT_DIR = path.join(__dirname, "..", "Resources", "generated");
const TODAY = new Date().toISOString().slice(0, 10);

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function requestGraphQL(query, variables) {
  return new Promise((resolve, reject) => {
    if (!TOKEN) {
      reject(new Error("No GitHub token available"));
      return;
    }

    const body = JSON.stringify({ query, variables });
    const req = https.request(
      {
        hostname: "api.github.com",
        path: "/graphql",
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "the-sudipta-profile-metrics",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`GitHub API returned ${res.statusCode}: ${data.slice(0, 160)}`));
            return;
          }
          const parsed = JSON.parse(data);
          if (parsed.errors) {
            reject(new Error(parsed.errors.map((error) => error.message).join("; ")));
            return;
          }
          resolve(parsed.data);
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function fallbackData() {
  return {
    generatedAt: TODAY,
    profile: {
      repositories: 0,
      followers: 0,
      stars: 0,
      totalContributions: 903,
      currentStreak: 5,
      longestStreak: 12,
    },
    languages: [
      ["PHP", 28],
      ["Java", 20],
      ["JavaScript", 16],
      ["Python", 14],
      ["C++", 12],
      ["C#", 10],
    ],
    weeks: [0, 0, 2, 0, 2, 0, 1, 0, 0, 0, 1, 1, 0, 0, 4, 0, 12, 2, 4, 0, 5],
  };
}

async function fetchData() {
  const query = `
    query ProfileMetrics($login: String!) {
      user(login: $login) {
        followers { totalCount }
        repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC, orderBy: {field: UPDATED_AT, direction: DESC}) {
          totalCount
          nodes {
            stargazerCount
            languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
              edges {
                size
                node { name }
              }
            }
          }
        }
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  const data = await requestGraphQL(query, { login: USERNAME });
  const user = data.user;
  const languageTotals = new Map();
  let stars = 0;

  for (const repo of user.repositories.nodes) {
    stars += repo.stargazerCount || 0;
    for (const edge of repo.languages.edges) {
      languageTotals.set(edge.node.name, (languageTotals.get(edge.node.name) || 0) + edge.size);
    }
  }

  const languagesRaw = [...languageTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const totalLanguageBytes = languagesRaw.reduce((sum, [, size]) => sum + size, 0) || 1;
  const languages = languagesRaw.length
    ? languagesRaw.map(([name, size]) => [name, Math.round((size / totalLanguageBytes) * 100)])
    : fallbackData().languages;

  const days = user.contributionsCollection.contributionCalendar.weeks
    .flatMap((week) => week.contributionDays)
    .slice(-147);
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7).reduce((sum, day) => sum + day.contributionCount, 0));
  }

  const streaks = computeStreaks(days);
  return {
    generatedAt: TODAY,
    profile: {
      repositories: user.repositories.totalCount,
      followers: user.followers.totalCount,
      stars,
      totalContributions: user.contributionsCollection.contributionCalendar.totalContributions,
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
    },
    languages,
    weeks: weeks.length ? weeks : fallbackData().weeks,
  };
}

function computeStreaks(days) {
  let longest = 0;
  let current = 0;
  let run = 0;
  for (const day of days) {
    if (day.contributionCount > 0) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  for (let i = days.length - 1; i >= 0; i -= 1) {
    if (days[i].contributionCount > 0) current += 1;
    else break;
  }
  return { current, longest };
}

function shell(title, subtitle, inner, height = 520) {
  return `<svg width="1200" height="${height}" viewBox="0 0 1200 ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="${height}">
      <stop stop-color="#020617"/>
      <stop offset=".58" stop-color="#07111F"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="aura" x1="76" y1="40" x2="1124" y2="${height - 30}">
      <stop stop-color="#22D3EE"/>
      <stop offset=".5" stop-color="#8B5CF6"/>
      <stop offset="1" stop-color="#F59E0B"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#000" flood-opacity=".30"/>
    </filter>
    <style>
      .title{font:800 42px Inter,Segoe UI,Arial,sans-serif;fill:#F8FAFC}
      .sub{font:600 18px Inter,Segoe UI,Arial,sans-serif;fill:#A5F3FC}
      .label{font:700 22px Inter,Segoe UI,Arial,sans-serif;fill:#E5E7EB}
      .small{font:500 17px Inter,Segoe UI,Arial,sans-serif;fill:#CBD5E1}
      .num{font:900 50px Inter,Segoe UI,Arial,sans-serif;fill:#F8FAFC}
      .micro{font:700 13px Inter,Segoe UI,Arial,sans-serif;fill:#94A3B8;letter-spacing:1.4px}
    </style>
  </defs>
  <rect width="1200" height="${height}" rx="30" fill="url(#bg)"/>
  <rect x="1" y="1" width="1198" height="${height - 2}" rx="30" stroke="url(#aura)" stroke-opacity=".48"/>
  <text x="70" y="72" class="title">${esc(title)}</text>
  <text x="70" y="104" class="sub">${esc(subtitle)}</text>
  ${inner}
  <text x="70" y="${height - 32}" class="micro">AUTO-GENERATED BY WORKFLOW - UPDATED ${esc(TODAY)}</text>
</svg>`;
}

function makeSummary(data) {
  const cards = [
    ["CONTRIBUTIONS", data.profile.totalContributions, "GitHub year"],
    ["REPOSITORIES", data.profile.repositories, "public repos"],
    ["STARS", data.profile.stars, "repository stars"],
    ["FOLLOWERS", data.profile.followers, "followers"],
    ["CURRENT STREAK", data.profile.currentStreak, "active days"],
    ["LONGEST STREAK", data.profile.longestStreak, "best run"],
  ];

  const cardSvg = cards.map(([label, number, caption], index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 70 + col * 354;
    const y = 145 + row * 126;
    return `<g filter="url(#shadow)">
      <rect x="${x}" y="${y}" width="316" height="100" rx="20" fill="#0F172A" stroke="#334155"/>
      <text x="${x + 24}" y="${y + 32}" class="micro">${esc(label)}</text>
      <text x="${x + 24}" y="${y + 78}" class="num">${esc(number)}</text>
      <text x="${x + 180}" y="${y + 74}" class="small">${esc(caption)}</text>
    </g>`;
  }).join("");

  return shell("GitHub Metrics", "High-level repository and contribution indicators.", cardSvg, 500);
}

function makeLanguageChart(data) {
  const colors = ["#22D3EE", "#8B5CF6", "#F59E0B", "#10B981", "#60A5FA", "#F472B6"];
  let y = 150;
  const rows = data.languages.map(([name, percentage], index) => {
    const barWidth = Math.max(22, Math.round(percentage * 8.4));
    const color = colors[index % colors.length];
    const out = `<g>
      <text x="90" y="${y + 22}" class="label">${esc(name)}</text>
      <rect x="310" y="${y}" width="790" height="32" rx="16" fill="#1E293B"/>
      <rect x="310" y="${y}" width="${barWidth}" height="32" rx="16" fill="${color}"/>
      <text x="1120" y="${y + 23}" text-anchor="end" class="label">${percentage}%</text>
    </g>`;
    y += 62;
    return out;
  }).join("");

  return shell("Repository Language Distribution", "Largest language shares from public repositories.", rows, 560);
}

function makeContributionChart(data) {
  const weeks = data.weeks.slice(-20);
  const max = Math.max(1, ...weeks);
  const bars = weeks.map((value, index) => {
    const x = 92 + index * 52;
    const height = Math.max(2, (value / max) * 250);
    const y = 405 - height;
    return `<rect x="${x}" y="${y.toFixed(1)}" width="30" height="${height.toFixed(1)}" rx="8" fill="#22D3EE" opacity=".72"/>
    <text x="${x + 15}" y="440" text-anchor="middle" class="micro">${value}</text>`;
  }).join("");

  return shell(
    "Contribution Rhythm",
    "Weekly contribution totals across the most recent activity window.",
    `<g opacity=".45">
      <path d="M70 405H1130M70 322H1130M70 239H1130M70 156H1130" stroke="#334155"/>
    </g>
    ${bars}
    <text x="90" y="478" class="small">Numbers below each bar are weekly contribution totals.</text>`,
    540
  );
}

function makeCapabilityMatrix(data) {
  const rows = [
    ["Backend Engineering", 92, "PHP, Symfony, Spring Boot, APIs"],
    ["Database Systems", 86, "MySQL, PostgreSQL, Microsoft SQL"],
    ["Frontend Delivery", 74, "JavaScript, TypeScript, React, UI"],
    ["Research Implementation", 82, "Security, algorithms, reproducible experiments"],
    ["Teaching and Mentoring", 88, "CS instruction, OOP, documentation"],
    ["Technical Writing", 80, "LaTeX, reports, reproducible notes"],
  ];
  let y = 145;
  const items = rows.map(([name, value, detail]) => {
    const width = Math.round(value * 8.2);
    const out = `<g>
      <text x="90" y="${y + 22}" class="label">${esc(name)}</text>
      <text x="90" y="${y + 48}" class="small">${esc(detail)}</text>
      <rect x="470" y="${y + 4}" width="560" height="30" rx="15" fill="#1E293B"/>
      <rect x="470" y="${y + 4}" width="${width}" height="30" rx="15" fill="url(#aura)"/>
      <text x="1085" y="${y + 27}" text-anchor="end" class="label">${value}</text>
    </g>`;
    y += 72;
    return out;
  }).join("");
  return shell("Capability Matrix", "Readable skill balance across engineering, research, and instruction.", items, 620);
}

function makeAcademicTimeline(data) {
  const cards = [
    ["MSCS", "AIUB", "Ongoing", "Graduate CS study"],
    ["MSCS / PMSCS", "Jahangirnagar University", "CGPA 3.944 / 4.00", "Advanced academic record"],
    ["BSc CSE", "AIUB", "CGPA 3.92 / 4.00", "Strong CS foundation"],
    ["Recognition", "Dean's List x4", "AIUB Scholarship", "Academic consistency"],
  ];
  const items = cards.map(([title, place, result, detail], index) => {
    const x = 70 + index * 282;
    return `<g filter="url(#shadow)">
      <rect x="${x}" y="150" width="250" height="245" rx="24" fill="#0F172A" stroke="#334155"/>
      <circle cx="${x + 125}" cy="128" r="16" fill="#22D3EE"/>
      <rect x="${x + 54}" y="428" width="142" height="34" rx="17" fill="#020617" stroke="#334155"/>
      <text x="${x + 125}" y="197" text-anchor="middle" class="label">${esc(title)}</text>
      <text x="${x + 125}" y="241" text-anchor="middle" class="small">${esc(place)}</text>
      <text x="${x + 125}" y="288" text-anchor="middle" class="label">${esc(result)}</text>
      <text x="${x + 125}" y="340" text-anchor="middle" class="small">${esc(detail)}</text>
      <text x="${x + 125}" y="451" text-anchor="middle" class="micro">ACADEMIC NODE</text>
    </g>`;
  }).join("");

  return shell(
    "Academic Progress Board",
    "Simple education and recognition snapshot for professors, APs, and admissions committees.",
    `${items}
    <path d="M195 128H1005" stroke="url(#aura)" stroke-width="5" stroke-linecap="round" opacity=".75"/>
    <rect x="238" y="490" width="724" height="44" rx="22" fill="#020617" stroke="#334155"/>
    <text x="600" y="519" text-anchor="middle" class="small">Publication base: image encryption and multi-key secure transformation</text>`,
    590
  );
}

function makeResearchEngineeringMap(data) {
  const rows = [
    ["Image Encryption / Decryption", "published", 1, "#22D3EE"],
    ["Cyber Security", "submitted", 0, "#8B5CF6"],
    ["Deep Learning", "research in progress", 0, "#F59E0B"],
    ["Signal Processing", "submitted, not accepted yet", 0, "#10B981"],
  ];
  let y = 150;
  const bars = rows.map(([name, status, value, color]) => {
    const max = 1;
    const width = value > 0 ? Math.round((value / max) * 640) : 0;
    const label = `${value} ${value === 1 ? "paper" : "papers"}`;
    const out = `<g>
      <text x="90" y="${y + 24}" class="label">${esc(name)}</text>
      <text x="90" y="${y + 50}" class="small">${esc(status)}</text>
      <rect x="420" y="${y + 6}" width="640" height="34" rx="17" fill="#1E293B"/>
      <rect x="420" y="${y + 6}" width="${width}" height="34" rx="17" fill="${color}"/>
      <text x="1100" y="${y + 31}" text-anchor="end" class="label">${esc(label)}</text>
    </g>`;
    y += 84;
    return out;
  }).join("");

  return shell(
    "Research Output Meter",
    "Publication and submission status by active research field.",
    `${bars}
    <rect x="90" y="510" width="1020" height="42" rx="21" fill="#020617" stroke="#334155"/>
    <text x="600" y="537" text-anchor="middle" class="small">Counts show accepted publications only; submitted and in-progress fields stay at 0 until accepted.</text>`,
    590
  );
}

function makeCraftStackBoard(data) {
  const groups = [
    ["Backend", ["PHP", "Symfony", "Java", "Spring Boot", ".NET", "NestJS"]],
    ["Frontend", ["JavaScript", "TypeScript", "React", "AngularJS", "Twig", "Tailwind"]],
    ["Data", ["MySQL", "PostgreSQL", "MS SQL", "Chart.js", "Analytics"]],
    ["Research", ["Python", "AI/ML", "LaTeX", "MATLAB", "Documentation"]],
  ];
  const cards = groups.map(([title, skills], index) => {
    const x = 70 + index * 282;
    const chips = skills.map((skill, i) => {
      const y = 205 + i * 48;
      return `<rect x="${x + 28}" y="${y}" width="210" height="32" rx="16" fill="#1E293B" stroke="#334155"/>
      <text x="${x + 133}" y="${y + 22}" text-anchor="middle" class="small">${esc(skill)}</text>`;
    }).join("");
    return `<g filter="url(#shadow)">
      <rect x="${x}" y="145" width="250" height="360" rx="24" fill="#0F172A" stroke="#334155"/>
      <text x="${x + 125}" y="185" text-anchor="middle" class="label">${esc(title)}</text>
      ${chips}
    </g>`;
  }).join("");
  return shell("Craft Stack", "Organized by how the tools are used in real work.", cards, 580);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let data;
  try {
    data = await fetchData();
  } catch (error) {
    console.warn(`Using fallback data: ${error.message}`);
    data = fallbackData();
  }

  fs.writeFileSync(path.join(OUT_DIR, "github-pulse.svg"), makeSummary(data));
  fs.writeFileSync(path.join(OUT_DIR, "language-aurora.svg"), makeLanguageChart(data));
  fs.writeFileSync(path.join(OUT_DIR, "contribution-current.svg"), makeContributionChart(data));
  fs.writeFileSync(path.join(OUT_DIR, "capability-matrix.svg"), makeCapabilityMatrix(data));
  fs.writeFileSync(path.join(OUT_DIR, "academic-timeline.svg"), makeAcademicTimeline(data));
  fs.writeFileSync(path.join(OUT_DIR, "research-engineering-map.svg"), makeResearchEngineeringMap(data));
  fs.writeFileSync(path.join(OUT_DIR, "craft-stack-board.svg"), makeCraftStackBoard(data));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
