const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const STATE_FILE = path.join(ROOT, "Resources", "game-state", "wumpus.json");
const SVG_FILE = path.join(ROOT, "Resources", "generated", "wumpus-protocol.svg");
const README_FILE = path.join(ROOT, "README.md");
const CAVE_SIZE = 4;
const START_ROOM = "B2";
const DIRECTIONS = {
  north: [-1, 0],
  south: [1, 0],
  west: [0, -1],
  east: [0, 1],
};
const ARTIFACTS = [
  "Algorithm Relic",
  "Security Key",
  "Blockchain Ledger",
  "Bioinformatics Sample",
  "Quantum Fragment",
  "Chemistry Formula",
  "Teaching Scroll",
  "System Blueprint",
];

function todayDhaka() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function weekKey(dateText) {
  const date = new Date(`${dateText}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function hashSeed(text) {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rng(seedText) {
  let seed = hashSeed(seedText);
  return () => {
    seed += 0x6D2B79F5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function escapeSvg(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function trim(value, length) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

function roomToPoint(room) {
  const row = room.charCodeAt(0) - 65;
  const col = Number(room.slice(1)) - 1;
  return [row, col];
}

function pointToRoom(row, col) {
  if (row < 0 || row >= CAVE_SIZE || col < 0 || col >= CAVE_SIZE) {
    return null;
  }
  return `${String.fromCharCode(65 + row)}${col + 1}`;
}

function allRooms() {
  const rooms = [];
  for (let row = 0; row < CAVE_SIZE; row += 1) {
    for (let col = 0; col < CAVE_SIZE; col += 1) {
      rooms.push(pointToRoom(row, col));
    }
  }
  return rooms;
}

function neighbors(room) {
  const [row, col] = roomToPoint(room);
  return Object.values(DIRECTIONS)
    .map(([dr, dc]) => pointToRoom(row + dr, col + dc))
    .filter(Boolean);
}

function directionalNeighbors(room) {
  const [row, col] = roomToPoint(room);
  return Object.entries(DIRECTIONS)
    .map(([direction, [dr, dc]]) => [direction, pointToRoom(row + dr, col + dc)])
    .filter(([, target]) => Boolean(target));
}

function shuffle(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function createCave(seedKey, resetCounter = 0) {
  const random = rng(`${seedKey}:${resetCounter}:wumpus-protocol`);
  const protectedRooms = new Set([START_ROOM, ...neighbors(START_ROOM)]);
  const candidates = shuffle(allRooms().filter((room) => !protectedRooms.has(room)), random);
  const fallback = shuffle(allRooms().filter((room) => room !== START_ROOM), random);
  const take = () => candidates.shift() || fallback.shift();
  const wumpus = take();
  const pits = [take(), take()];
  const bats = [take()];
  const used = new Set([wumpus, ...pits, ...bats, START_ROOM]);
  const artifactRooms = shuffle(allRooms().filter((room) => !used.has(room)), random).slice(0, 5);
  const artifacts = {};

  artifactRooms.forEach((room, index) => {
    artifacts[room] = ARTIFACTS[index % ARTIFACTS.length];
  });

  return {
    size: CAVE_SIZE,
    mission: missionFor(seedKey, resetCounter),
    wumpus,
    pits,
    bats,
    artifacts,
  };
}

function missionFor(seedKey, resetCounter) {
  const missions = [
    "Decode the Algorithm Gate",
    "Trace the Blockchain Ledger",
    "Map the Quantum Chamber",
    "Stabilize the Security Core",
    "Scan the Bioinformatics Wing",
    "Recover the Chemistry Formula",
    "Repair the System Blueprint",
  ];
  const index = hashSeed(`${seedKey}:${resetCounter}`) % missions.length;
  return missions[index];
}

function defaultPlayer() {
  return {
    room: START_ROOM,
    arrows: 2,
    status: "exploring",
    score: 0,
    artifacts: 0,
    moves: 0,
  };
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function ensureState(state) {
  const date = todayDhaka();
  const week = weekKey(date);
  const activeIssueNumber = Number(process.env.WUMPUS_ACTIVE_ISSUE_NUMBER || state.activeIssueNumber || 1);
  const activeIssueUrl = process.env.WUMPUS_ACTIVE_ISSUE_URL || state.activeIssueUrl || issueUrl(activeIssueNumber);

  if (state.week !== week || !state.layout || !state.player) {
    return freshState(
      state,
      date,
      week,
      (state.resetCounter || 0) + 1,
      "github",
      "/weekly-reset",
      `A new weekly cave has opened for ${week}.`,
      activeIssueNumber,
      activeIssueUrl
    );
  }

  state.date = date;
  state.activeIssueNumber = activeIssueNumber;
  state.activeIssueUrl = activeIssueUrl;

  return state;
}

function issueUrl(issueNumber) {
  return `https://github.com/the-sudipta/the-sudipta/issues/${issueNumber}`;
}

function freshState(previous, date, week, resetCounter, actor, command, message, activeIssueNumber, activeIssueUrl) {
  return {
    version: 1,
    date,
    week,
    resetCounter,
    activeIssueNumber,
    activeIssueUrl,
    layout: createCave(week, resetCounter),
    player: defaultPlayer(),
    revealed: [START_ROOM],
    collected: [],
    history: [
      {
        actor,
        command,
        message,
        at: new Date().toISOString(),
      },
      ...(previous.history || []),
    ].slice(0, 8),
    latest: { actor, command, message },
    dailyLeaderboard: {},
    weeklyLeaderboard: {},
    allTimeLeaderboard: previous.allTimeLeaderboard || {},
    allTime: previous.allTime || { huntsWon: 0, artifacts: 0, moves: 0 },
  };
}

function readEventCommand() {
  const fallback = {
    actor: process.env.GITHUB_ACTOR || "github",
    command: process.env.WUMPUS_COMMAND || "/render",
    issueNumber: null,
  };
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!eventPath || !fs.existsSync(eventPath)) {
    return fallback;
  }

  const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  const body = event.comment?.body || event.issue?.body || "";
  const actor = event.comment?.user?.login || event.issue?.user?.login || fallback.actor;
  const match = body.match(/^\/(?:move|shoot|sense|grab|reset|help|render)(?:\s+[a-z]+)?/im);

  return {
    actor,
    command: match ? match[0].trim().toLowerCase() : "/render",
    issueNumber: event.issue?.number || null,
  };
}

function addScore(state, actor, points) {
  if (!actor || actor === "github" || points <= 0) {
    return;
  }
  state.dailyLeaderboard[actor] = (state.dailyLeaderboard[actor] || 0) + points;
  state.weeklyLeaderboard[actor] = (state.weeklyLeaderboard[actor] || 0) + points;
  state.allTimeLeaderboard[actor] = (state.allTimeLeaderboard[actor] || 0) + points;
}

function record(state, actor, command, message, points = 0) {
  state.latest = { actor, command, message };
  state.history = [
    { actor, command, message, at: new Date().toISOString() },
    ...(state.history || []),
  ].slice(0, 8);
  addScore(state, actor, points);
}

function senseMessage(state, room = state.player.room) {
  const clues = senseClues(state, room);
  const warnings = [];
  for (const [direction, items] of Object.entries(clues)) {
    if (items.length) warnings.push(`${capitalize(direction)}: ${items.join(", ")}.`);
  }
  return warnings.length ? warnings.join(" ") : "The room is quiet. Choose a direction carefully.";
}

function senseClues(state, room = state.player.room) {
  const clues = { north: [], east: [], south: [], west: [] };
  for (const [direction, target] of directionalNeighbors(room)) {
    if (target === state.layout.wumpus) clues[direction].push("Unsolved Problem");
    if (state.layout.pits.includes(target)) clues[direction].push("Broken Build");
    if (state.layout.bats.includes(target)) clues[direction].push("Context Switch");
    if (state.layout.artifacts[target] && !state.collected.includes(target)) {
      clues[direction].push(state.layout.artifacts[target]);
    }
  }
  return clues;
}

function capitalize(value) {
  const text = String(value || "");
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : text;
}

function movePlayer(state, actor, command) {
  const direction = command.split(/\s+/)[1];
  if (!DIRECTIONS[direction]) {
    record(state, actor, command, "Unknown direction. Try /move north, south, east, or west.");
    return;
  }
  if (state.player.status !== "exploring") {
    record(state, actor, command, "This cave is finished. Use /reset to open a new cave.");
    return;
  }

  const [row, col] = roomToPoint(state.player.room);
  const [dr, dc] = DIRECTIONS[direction];
  const next = pointToRoom(row + dr, col + dc);

  if (!next) {
    record(state, actor, command, "A cave wall blocks that direction.");
    return;
  }

  state.player.room = next;
  state.player.moves += 1;
  state.allTime.moves = (state.allTime.moves || 0) + 1;
  if (!state.revealed.includes(next)) state.revealed.push(next);

  if (next === state.layout.wumpus) {
    state.player.status = "lost";
    record(state, actor, command, "The Unsolved Problem found you first. Cave run lost. Use /reset to try again.", 1);
    return;
  }

  if (state.layout.pits.includes(next)) {
    state.player.status = "lost";
    record(state, actor, command, "You fell into a Broken Build. Cave run lost. Use /reset to try again.", 1);
    return;
  }

  if (state.layout.bats.includes(next)) {
    const safeRooms = allRooms().filter((room) => room !== state.layout.wumpus && !state.layout.pits.includes(room));
    const target = safeRooms[hashSeed(`${state.date}:${actor}:${state.player.moves}`) % safeRooms.length];
    state.player.room = target;
    if (!state.revealed.includes(target)) state.revealed.push(target);
    record(state, actor, command, `A Context Switch carried you to ${target}. ${senseMessage(state, target)}`, 2);
    return;
  }

  record(state, actor, command, `Moved to ${next}. ${senseMessage(state, next)}`, 2);
}

function grabArtifact(state, actor, command) {
  if (state.player.status !== "exploring") {
    record(state, actor, command, "This cave is finished. Use /reset to open a new cave.");
    return;
  }
  const room = state.player.room;
  const artifact = state.layout.artifacts[room];
  if (!artifact || state.collected.includes(room)) {
    record(state, actor, command, "No artifact is available in this room.");
    return;
  }
  state.collected.push(room);
  state.player.artifacts += 1;
  state.player.score += 8;
  state.allTime.artifacts = (state.allTime.artifacts || 0) + 1;
  record(state, actor, command, `${artifact} collected from ${room}.`, 8);
}

function shootArrow(state, actor, command) {
  const direction = command.split(/\s+/)[1];
  if (!DIRECTIONS[direction]) {
    record(state, actor, command, "Unknown direction. Try /shoot north, south, east, or west.");
    return;
  }
  if (state.player.status !== "exploring") {
    record(state, actor, command, "This cave is finished. Use /reset to open a new cave.");
    return;
  }
  if (state.player.arrows <= 0) {
    record(state, actor, command, "No arrows remain. Use /move and /sense carefully.");
    return;
  }

  state.player.arrows -= 1;
  const [dr, dc] = DIRECTIONS[direction];
  let [row, col] = roomToPoint(state.player.room);

  while (true) {
    row += dr;
    col += dc;
    const room = pointToRoom(row, col);
    if (!room) break;
    if (room === state.layout.wumpus) {
      state.player.status = "won";
      state.player.score += 40;
      state.allTime.huntsWon = (state.allTime.huntsWon || 0) + 1;
      if (!state.revealed.includes(room)) state.revealed.push(room);
      record(state, actor, command, "Direct hit. The Unsolved Problem is solved. Cave won.", 40);
      return;
    }
  }

  record(state, actor, command, `Arrow missed toward ${direction}. ${senseMessage(state)}`, 1);
}

function applyCommand(state, actor, command) {
  if (command.startsWith("/reset")) {
    record(state, actor, command, "This cave resets automatically every week. Keep playing in the active weekly issue.");
    return state;
  }

  if (command.startsWith("/move")) movePlayer(state, actor, command);
  else if (command.startsWith("/shoot")) shootArrow(state, actor, command);
  else if (command.startsWith("/grab")) grabArtifact(state, actor, command);
  else if (command.startsWith("/sense")) record(state, actor, command, senseMessage(state), 1);
  else if (command.startsWith("/help")) record(state, actor, command, "Commands: /move north, /move south, /move east, /move west, /sense, /grab, /shoot east, /reset.");
  else record(state, actor, command, "Rendered the current cave state.");

  return state;
}

function topEntries(board, count = 5) {
  return Object.entries(board || {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, count);
}

function cellKind(state, room) {
  if (room === state.player.room) return ["AGENT", "#22d3ee"];
  if (!state.revealed.includes(room)) return ["?", "#111827"];
  if (state.player.status !== "exploring" && room === state.layout.wumpus) return ["WMP", "#ef4444"];
  if (state.layout.pits.includes(room)) return ["PIT", "#f97316"];
  if (state.layout.bats.includes(room)) return ["CTX", "#a78bfa"];
  if (state.layout.artifacts[room] && !state.collected.includes(room)) return ["ART", "#10b981"];
  return ["SAFE", "#334155"];
}

function wrapSvgText(text, maxChars, maxLines = 2) {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = next;
    }
  }

  if (line && lines.length < maxLines) lines.push(line);
  if (words.join(" ").length > lines.join(" ").length && lines.length) {
    lines[lines.length - 1] = trim(lines[lines.length - 1], Math.max(4, maxChars - 3));
  }
  return lines;
}

function renderAgentIcon(cx, cy, scale = 1) {
  const s = scale;
  return `
  <g transform="translate(${cx} ${cy}) scale(${s})" filter="url(#tinyGlow)">
    <ellipse cx="0" cy="0" rx="28" ry="24" fill="#f8fafc" stroke="#020617" stroke-width="4"/>
    <path d="M4 -16 L26 -4 L4 8 Z" fill="#020617"/>
    <path d="M-4 23 L36 2 L22 47 Z" fill="#f8fafc" stroke="#020617" stroke-width="4" stroke-linejoin="round"/>
    <path d="M-7 25 L-13 55 L1 55 L8 30 Z" fill="#f8fafc" stroke="#020617" stroke-width="4" stroke-linejoin="round"/>
    <path d="M16 35 L25 58 L39 58 L31 27 Z" fill="#f8fafc" stroke="#020617" stroke-width="4" stroke-linejoin="round"/>
  </g>`;
}

function renderWumpusIcon(cx, cy, scale = 1) {
  const s = scale;
  return `
  <g transform="translate(${cx} ${cy}) scale(${s})" filter="url(#dangerGlow)">
    <path d="M-32 20 C-34 -20 -8 -42 20 -32 C46 -22 48 18 22 34 C2 46 -25 40 -32 20Z" fill="#7f1d1d" stroke="#fecaca" stroke-width="3"/>
    <path d="M-18 -24 L-28 -48 L-4 -34 Z" fill="#ef4444" stroke="#fecaca" stroke-width="3"/>
    <path d="M18 -28 L24 -52 L36 -28 Z" fill="#ef4444" stroke="#fecaca" stroke-width="3"/>
    <circle cx="-8" cy="-4" r="5" fill="#fef2f2"/>
    <circle cx="20" cy="-2" r="5" fill="#fef2f2"/>
    <path d="M-10 20 C0 28 18 28 30 15" stroke="#fca5a5" stroke-width="4" stroke-linecap="round"/>
  </g>`;
}

function artifactTheme(name) {
  if (/Algorithm/i.test(name)) return { color: "#f59e0b", label: "ALG", shape: "hex" };
  if (/Security/i.test(name)) return { color: "#22d3ee", label: "KEY", shape: "key" };
  if (/Blockchain/i.test(name)) return { color: "#8b5cf6", label: "BLK", shape: "chain" };
  if (/Bioinformatics/i.test(name)) return { color: "#10b981", label: "BIO", shape: "dna" };
  if (/Quantum/i.test(name)) return { color: "#60a5fa", label: "QNT", shape: "orbit" };
  if (/Chemistry/i.test(name)) return { color: "#f472b6", label: "CHM", shape: "flask" };
  if (/Teaching/i.test(name)) return { color: "#f97316", label: "EDU", shape: "book" };
  return { color: "#14b8a6", label: "SYS", shape: "grid" };
}

function roomDirectionFromPlayer(state, room) {
  const [playerRow, playerCol] = roomToPoint(state.player.room);
  const [roomRow, roomCol] = roomToPoint(room);
  const deltaRow = roomRow - playerRow;
  const deltaCol = roomCol - playerCol;

  return Object.entries(DIRECTIONS).find(([, [dr, dc]]) => dr === deltaRow && dc === deltaCol)?.[0] || null;
}

function roomClues(state, room) {
  const direction = roomDirectionFromPlayer(state, room);
  if (!direction) return null;

  const clues = [];
  if (room === state.layout.wumpus) clues.push({ type: "danger", label: "WMP", text: "Unsolved Problem", color: "#ef4444" });
  if (state.layout.pits.includes(room)) clues.push({ type: "pit", label: "PIT", text: "Broken Build", color: "#f97316" });
  if (state.layout.bats.includes(room)) clues.push({ type: "context", label: "CTX", text: "Context Switch", color: "#a78bfa" });
  if (state.layout.artifacts[room] && !state.collected.includes(room)) {
    const artifact = state.layout.artifacts[room];
    const theme = artifactTheme(artifact);
    clues.push({ type: "artifact", label: theme.label, text: artifact, color: theme.color, artifact });
  }

  return clues.length ? { direction, clues } : null;
}

function renderClueMarker(state, room, x, y, size) {
  const clueSet = roomClues(state, room);
  if (!clueSet) return "";

  const primary = clueSet.clues[0];
  const cx = x + size / 2;

  return `
  <g filter="url(#tinyGlow)">
    <circle cx="${cx}" cy="${y + 84}" r="24" fill="${primary.color}" fill-opacity=".12" stroke="${primary.color}" stroke-opacity=".62"/>
    ${renderClueIcon(primary, cx, y + 84)}
  </g>`;
}

function renderClueIcon(clue, cx, cy) {
  if (clue.type === "artifact") return renderArtifactIcon(clue.artifact, cx, cy, 0.42, false);
  if (clue.type === "danger") return renderWumpusIcon(cx, cy - 4, 0.32);
  if (clue.type === "pit") return renderPitIcon(cx, cy - 5, 0.35);
  if (clue.type === "context") return renderContextIcon(cx, cy - 4, 0.35);
  return "";
}

function renderArtifactIcon(name, cx, cy, scale = 1, showLabel = true) {
  const theme = artifactTheme(name);
  const s = scale;
  const commonText = showLabel
    ? `<text x="0" y="29" fill="#f8fafc" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="10" font-weight="900">${theme.label}</text>`
    : "";
  const shapes = {
    hex: `<path d="M0 -28 L24 -14 L24 14 L0 28 L-24 14 L-24 -14 Z" fill="${theme.color}" fill-opacity=".9"/><path d="M-12 1 H12 M-6 -9 L6 11" stroke="#020617" stroke-width="4" stroke-linecap="round"/>`,
    key: `<circle cx="-8" cy="-6" r="12" fill="${theme.color}"/><path d="M3 -6 H28 M20 -6 V5 M27 -6 V2" stroke="${theme.color}" stroke-width="7" stroke-linecap="round"/>`,
    chain: `<path d="M-21 4 C-31 -6 -31 -18 -21 -25 C-12 -32 0 -26 6 -17" stroke="${theme.color}" stroke-width="9" stroke-linecap="round"/><path d="M21 -4 C31 6 31 18 21 25 C12 32 0 26 -6 17" stroke="${theme.color}" stroke-width="9" stroke-linecap="round"/><path d="M-8 9 L8 -9" stroke="#f8fafc" stroke-width="5" stroke-linecap="round"/>`,
    dna: `<path d="M-18 -24 C18 -12 -18 12 18 24 M18 -24 C-18 -12 18 12 -18 24" stroke="${theme.color}" stroke-width="5" stroke-linecap="round"/><path d="M-11 -13 H11 M-12 0 H12 M-11 13 H11" stroke="#d1fae5" stroke-width="3"/>`,
    orbit: `<circle cx="0" cy="0" r="6" fill="${theme.color}"/><ellipse cx="0" cy="0" rx="30" ry="10" stroke="${theme.color}" stroke-width="4"/><ellipse cx="0" cy="0" rx="30" ry="10" stroke="${theme.color}" stroke-width="4" transform="rotate(62)"/><ellipse cx="0" cy="0" rx="30" ry="10" stroke="${theme.color}" stroke-width="4" transform="rotate(-62)"/>`,
    flask: `<path d="M-8 -28 H8 M-5 -28 V-8 L-24 24 H24 L5 -8 V-28" fill="${theme.color}" fill-opacity=".88" stroke="#fce7f3" stroke-width="3" stroke-linejoin="round"/><path d="M-13 12 H13" stroke="#020617" stroke-width="4" stroke-linecap="round"/>`,
    book: `<path d="M-26 -22 H-5 C3 -22 5 -15 5 -9 V25 C3 19 -2 17 -8 17 H-26 Z" fill="${theme.color}"/><path d="M26 -22 H5 C-3 -22 -5 -15 -5 -9 V25 C-3 19 2 17 8 17 H26 Z" fill="#fb923c"/><path d="M0 -17 V24" stroke="#020617" stroke-width="4"/>`,
    grid: `<rect x="-24" y="-24" width="48" height="48" rx="10" fill="${theme.color}" fill-opacity=".9"/><path d="M-8 -24 V24 M8 -24 V24 M-24 -8 H24 M-24 8 H24" stroke="#020617" stroke-width="3"/>`,
  };
  return `
  <g transform="translate(${cx} ${cy}) scale(${s})" filter="url(#tinyGlow)">
    ${shapes[theme.shape]}
    ${commonText}
  </g>`;
}

function renderPitIcon(cx, cy, scale = 1) {
  return `
  <g transform="translate(${cx} ${cy}) scale(${scale})">
    <ellipse cx="0" cy="18" rx="34" ry="13" fill="#431407"/>
    <path d="M-28 13 C-16 -4 12 -9 29 12 C13 4 -10 3 -28 13Z" fill="#fb923c"/>
    <path d="M-18 16 L-8 4 L-2 17 L10 1 L18 18" stroke="#fed7aa" stroke-width="4" stroke-linecap="round"/>
  </g>`;
}

function renderContextIcon(cx, cy, scale = 1) {
  return `
  <g transform="translate(${cx} ${cy}) scale(${scale})" filter="url(#tinyGlow)">
    <path d="M-31 5 C-10 -22 12 -22 33 5 C14 27 -12 27 -31 5Z" fill="#6d28d9"/>
    <path d="M-20 1 C-5 14 12 14 25 1" stroke="#ddd6fe" stroke-width="4" stroke-linecap="round"/>
    <circle cx="-8" cy="-1" r="4" fill="#f8fafc"/>
    <circle cx="14" cy="-1" r="4" fill="#f8fafc"/>
  </g>`;
}

function renderCellContent(state, room, label, x, y, size) {
  const cx = x + size / 2;
  const cy = y + 44;
  const clueSet = roomClues(state, room);
  const roomY = clueSet && label === "?" ? y + 64 : y + 88;
  const roomLabel = `<text x="${cx}" y="${roomY}" fill="#94a3b8" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="900">${room}</text>`;
  const clueMarker = renderClueMarker(state, room, x, y, size);

  if (label === "AGENT") {
    return `${renderAgentIcon(cx - 10, y + 26, 0.62)}${roomLabel}`;
  }
  if (label === "WMP") {
    return `${renderWumpusIcon(cx, cy, 0.72)}${roomLabel}`;
  }
  if (label === "PIT") {
    return `${renderPitIcon(cx, cy, 0.78)}${roomLabel}`;
  }
  if (label === "CTX") {
    return `${renderContextIcon(cx, cy, 0.78)}${roomLabel}`;
  }
  if (label === "ART") {
    const artifact = state.layout.artifacts[room];
    return `${renderArtifactIcon(artifact, cx, cy - 2, 0.75, false)}${roomLabel}`;
  }
  if (label === "SAFE") {
    return `
  <circle cx="${cx}" cy="${cy - 4}" r="19" fill="#334155"/>
  <path d="M${cx - 12} ${cy - 4} L${cx - 3} ${cy + 7} L${cx + 15} ${cy - 12}" stroke="#67e8f9" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  ${roomLabel}`;
  }
  return `
  ${clueMarker}
  <text x="${cx}" y="${y + 50}" fill="#f8fafc" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="900">?</text>
  ${roomLabel}`;
}

function renderCommandPanel() {
  return `
  <rect x="602" y="494" width="340" height="156" rx="22" fill="#0f172a" fill-opacity=".78" stroke="#334155"/>
  <text x="626" y="526" fill="#67e8f9" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="900" letter-spacing="1.4">CAVE CONTROLS</text>
  <rect x="626" y="546" width="126" height="30" rx="15" fill="#22d3ee" fill-opacity=".13" stroke="#22d3ee" stroke-opacity=".42"/>
  <text x="689" y="566" fill="#f8fafc" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="900">/SENSE</text>
  <rect x="764" y="546" width="132" height="30" rx="15" fill="#8b5cf6" fill-opacity=".16" stroke="#8b5cf6" stroke-opacity=".5"/>
  <text x="830" y="566" fill="#f8fafc" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="900">/GRAB</text>
  <rect x="626" y="586" width="126" height="30" rx="15" fill="#10b981" fill-opacity=".13" stroke="#10b981" stroke-opacity=".42"/>
  <text x="689" y="606" fill="#f8fafc" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="900">/MOVE</text>
  <rect x="764" y="586" width="132" height="30" rx="15" fill="#f97316" fill-opacity=".14" stroke="#f97316" stroke-opacity=".45"/>
  <text x="830" y="606" fill="#f8fafc" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="900">/SHOOT</text>
  <text x="626" y="637" fill="#94a3b8" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="750">Clue tags appear directly on nearby cave rooms.</text>`;
}

function renderSvg(state) {
  const latest = state.latest || {};
  const leaderboard = topEntries(state.weeklyLeaderboard);
  const statusColor = state.player.status === "won" ? "#10b981" : state.player.status === "lost" ? "#ef4444" : "#22d3ee";
  const latestLines = wrapSvgText(latest.message || "Open the cave and play.", 46, 3);
  const cells = [];
  const startX = 56;
  const startY = 184;
  const size = 106;
  const gap = 12;

  for (let row = 0; row < CAVE_SIZE; row += 1) {
    for (let col = 0; col < CAVE_SIZE; col += 1) {
      const room = pointToRoom(row, col);
      const [label, color] = cellKind(state, room);
      const x = startX + col * (size + gap);
      const y = startY + row * (size + gap);
      cells.push(`
  <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="18" fill="${color}" fill-opacity="${label === "?" ? ".58" : ".28"}" stroke="${color}" stroke-opacity=".82"/>
  ${renderCellContent(state, room, label, x, y, size)}`);
    }
  }

  const leaderboardRows = leaderboard.length
    ? leaderboard.map(([name, score], index) => `<text x="650" y="${346 + index * 28}" fill="#e2e8f0" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="750">${index + 1}. @${escapeSvg(trim(name, 16))} - ${score}</text>`).join("\n  ")
    : `<text x="650" y="346" fill="#94a3b8" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="750">No hunters yet. Be first.</text>`;

  return `<svg width="1000" height="720" viewBox="0 0 1000 720" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wumpus Protocol GitHub game board">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1000" y2="720">
      <stop stop-color="#020617"/>
      <stop offset=".55" stop-color="#0b1120"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="line" x1="40" y1="0" x2="960" y2="0">
      <stop stop-color="#22d3ee"/>
      <stop offset=".5" stop-color="#8b5cf6"/>
      <stop offset="1" stop-color="#10b981"/>
    </linearGradient>
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="tinyGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="2.2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="dangerGlow" x="-35%" y="-35%" width="170%" height="170%">
      <feGaussianBlur stdDeviation="3.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="1000" height="720" rx="28" fill="url(#bg)"/>
  <rect x="18" y="18" width="964" height="684" rx="24" fill="#020617" fill-opacity=".48" stroke="#22d3ee" stroke-opacity=".44"/>
  <path d="M44 102h912" stroke="url(#line)" stroke-width="3" stroke-linecap="round" filter="url(#softGlow)"/>
  <text x="52" y="62" fill="#f8fafc" font-family="Segoe UI, Arial, sans-serif" font-size="38" font-weight="900">Wumpus Protocol</text>
  <text x="54" y="88" fill="#67e8f9" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="800">A GitHub-native research cave game powered by Issues and Actions</text>
  <rect x="650" y="44" width="278" height="36" rx="18" fill="${statusColor}" fill-opacity=".14" stroke="${statusColor}" stroke-opacity=".55"/>
  <text x="789" y="68" fill="${statusColor}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="900" letter-spacing="1.4">${state.player.status.toUpperCase()}</text>

  <text x="56" y="142" fill="#e2e8f0" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="900">Today's Cave: ${escapeSvg(state.layout.mission)}</text>
  <text x="56" y="166" fill="#94a3b8" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="750">Room ${state.player.room} - arrows ${state.player.arrows} - artifacts ${state.player.artifacts} - score ${state.player.score} - date ${state.date}</text>
  ${cells.join("\n")}

  <rect x="602" y="126" width="340" height="142" rx="22" fill="#0f172a" fill-opacity=".78" stroke="#334155"/>
  <text x="626" y="158" fill="#67e8f9" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="900" letter-spacing="1.4">LATEST MOVE</text>
  <text x="626" y="190" fill="#f8fafc" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="900">@${escapeSvg(trim(latest.actor || "github", 18))}</text>
  <text x="626" y="216" fill="#a78bfa" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="850">${escapeSvg(trim(latest.command || "/help", 32))}</text>
  ${latestLines.map((line, index) => `<text x="626" y="${244 + index * 16}" fill="#cbd5e1" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="700">${escapeSvg(line)}</text>`).join("\n  ")}

  <rect x="602" y="292" width="340" height="178" rx="22" fill="#0f172a" fill-opacity=".78" stroke="#334155"/>
  <text x="626" y="324" fill="#67e8f9" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="900" letter-spacing="1.4">WEEKLY HUNTERS</text>
  ${leaderboardRows}

  ${renderCommandPanel()}

  <text x="56" y="674" fill="#64748b" font-family="Segoe UI, Arial, sans-serif" font-size="11" font-weight="900" letter-spacing="1.4">AUTO-GENERATED BY GITHUB ACTIONS - COMMANDS: /MOVE, /SENSE, /GRAB, /SHOOT</text>
</svg>`;
}

function writeSvg(svg) {
  fs.mkdirSync(path.dirname(SVG_FILE), { recursive: true });
  fs.writeFileSync(SVG_FILE, `${svg.replace(/[ \t]+$/gm, "")}\n`, "utf8");
}

function writeReadmeIssueLinks(state) {
  if (!state.activeIssueUrl || !fs.existsSync(README_FILE)) return;
  const readme = fs.readFileSync(README_FILE, "utf8");
  const next = readme.replace(
    /https:\/\/github\.com\/the-sudipta\/the-sudipta\/issues\/(?:new\?[^"]*|\d+)/g,
    state.activeIssueUrl
  );
  if (next !== readme) fs.writeFileSync(README_FILE, next, "utf8");
}

function main() {
  const { actor, command, issueNumber } = readEventCommand();
  let state = ensureState(loadState());
  if (issueNumber && state.activeIssueNumber && Number(issueNumber) !== Number(state.activeIssueNumber)) {
    writeReadmeIssueLinks(state);
    writeSvg(renderSvg(state));
    return;
  }
  if (process.env.WUMPUS_RENDER_ONLY === "1") {
    writeSvg(renderSvg(state));
    writeReadmeIssueLinks(state);
    return;
  }
  state = applyCommand(state, actor, command);
  saveState(state);
  writeSvg(renderSvg(state));
  writeReadmeIssueLinks(state);
}

main();
