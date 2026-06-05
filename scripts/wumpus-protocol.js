const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const STATE_FILE = path.join(ROOT, "Resources", "game-state", "wumpus.json");
const SVG_FILE = path.join(ROOT, "Resources", "generated", "wumpus-protocol.svg");
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
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const day = Math.floor((date - start) / 86400000) + 1;
  return `${date.getUTCFullYear()}-W${String(Math.ceil(day / 7)).padStart(2, "0")}`;
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

function shuffle(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function createCave(date, resetCounter = 0) {
  const random = rng(`${date}:${resetCounter}:wumpus-protocol`);
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
    mission: missionFor(date, resetCounter),
    wumpus,
    pits,
    bats,
    artifacts,
  };
}

function missionFor(date, resetCounter) {
  const missions = [
    "Decode the Algorithm Gate",
    "Trace the Blockchain Ledger",
    "Map the Quantum Chamber",
    "Stabilize the Security Core",
    "Scan the Bioinformatics Wing",
    "Recover the Chemistry Formula",
    "Repair the System Blueprint",
  ];
  const index = hashSeed(`${date}:${resetCounter}`) % missions.length;
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

  if (state.date !== date || !state.layout || !state.player) {
    return freshState(state, date, week, state.resetCounter || 0, "github", "/daily-reset", "A new daily cave has opened.");
  }

  if (state.week !== week) {
    state.week = week;
    state.weeklyLeaderboard = {};
  }

  return state;
}

function freshState(previous, date, week, resetCounter, actor, command, message) {
  return {
    version: 1,
    date,
    week,
    resetCounter,
    layout: createCave(date, resetCounter),
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
    weeklyLeaderboard: previous.week === week ? previous.weeklyLeaderboard || {} : {},
    allTimeLeaderboard: previous.allTimeLeaderboard || {},
    allTime: previous.allTime || { huntsWon: 0, artifacts: 0, moves: 0 },
  };
}

function readEventCommand() {
  const fallback = {
    actor: process.env.GITHUB_ACTOR || "github",
    command: process.env.WUMPUS_COMMAND || "/render",
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
  const around = neighbors(room);
  const warnings = [];
  if (around.includes(state.layout.wumpus)) warnings.push("You smell the Unsolved Problem nearby.");
  if (around.some((item) => state.layout.pits.includes(item))) warnings.push("You feel a draft from a Broken Build.");
  if (around.some((item) => state.layout.bats.includes(item))) warnings.push("You hear Context Switch wings.");
  if (around.some((item) => state.layout.artifacts[item] && !state.collected.includes(item))) warnings.push("A research artifact glows close by.");
  return warnings.length ? warnings.join(" ") : "The room is quiet. Choose a direction carefully.";
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
    const date = todayDhaka();
    const week = weekKey(date);
    const resetCounter = (state.resetCounter || 0) + 1;
    return freshState(state, date, week, resetCounter, actor, command, "A new cave was opened. Start from B2.");
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

function renderSvg(state) {
  const latest = state.latest || {};
  const leaderboard = topEntries(state.weeklyLeaderboard);
  const statusColor = state.player.status === "won" ? "#10b981" : state.player.status === "lost" ? "#ef4444" : "#22d3ee";
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
      const artifact = state.layout.artifacts[room] && state.revealed.includes(room) && !state.collected.includes(room)
        ? escapeSvg(trim(state.layout.artifacts[room], 18))
        : "";
      cells.push(`
  <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="18" fill="${color}" fill-opacity="${label === "?" ? ".58" : ".28"}" stroke="${color}" stroke-opacity=".82"/>
  <text x="${x + 53}" y="${y + 46}" fill="#f8fafc" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${label === "AGENT" ? 20 : 18}" font-weight="900">${label}</text>
  <text x="${x + 53}" y="${y + 74}" fill="#94a3b8" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="800">${room}</text>
  ${artifact ? `<text x="${x + 53}" y="${y + 93}" fill="#6ee7b7" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="9" font-weight="800">${artifact}</text>` : ""}`);
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
  <text x="626" y="244" fill="#cbd5e1" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="700">${escapeSvg(trim(latest.message || "Open the cave and play.", 48))}</text>

  <rect x="602" y="292" width="340" height="178" rx="22" fill="#0f172a" fill-opacity=".78" stroke="#334155"/>
  <text x="626" y="324" fill="#67e8f9" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="900" letter-spacing="1.4">WEEKLY HUNTERS</text>
  ${leaderboardRows}

  <rect x="602" y="494" width="340" height="150" rx="22" fill="#0f172a" fill-opacity=".78" stroke="#334155"/>
  <text x="626" y="526" fill="#67e8f9" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="900" letter-spacing="1.4">COMMANDS</text>
  <text x="626" y="558" fill="#f8fafc" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="800">/move north  /move east</text>
  <text x="626" y="584" fill="#f8fafc" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="800">/sense  /grab  /shoot west</text>
  <text x="626" y="610" fill="#94a3b8" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="750">WMP = unsolved problem, PIT = broken build, CTX = context switch</text>

  <text x="56" y="674" fill="#64748b" font-family="Segoe UI, Arial, sans-serif" font-size="11" font-weight="900" letter-spacing="1.4">AUTO-GENERATED BY GITHUB ACTIONS - PLAY THROUGH ISSUE COMMANDS</text>
</svg>`;
}

function writeSvg(svg) {
  fs.mkdirSync(path.dirname(SVG_FILE), { recursive: true });
  fs.writeFileSync(SVG_FILE, `${svg.replace(/[ \t]+$/gm, "")}\n`, "utf8");
}

function main() {
  const { actor, command } = readEventCommand();
  let state = ensureState(loadState());
  state = applyCommand(state, actor, command);
  saveState(state);
  writeSvg(renderSvg(state));
}

main();
