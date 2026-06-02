const fs = require("fs");
const path = require("path");

const LASTFM_ENDPOINT = "https://ws.audioscrobbler.com/2.0/";
const OUTPUT_FILE = path.join(__dirname, "..", "Resources", "generated", "now-playing.svg");
const LOCAL_ENV_FILE = path.join(__dirname, "..", ".env");

function loadLocalEnv() {
  if (!fs.existsSync(LOCAL_ENV_FILE)) {
    return;
  }

  const lines = fs.readFileSync(LOCAL_ENV_FILE, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

function escapeSvg(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function trimText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function renderCard({ title, artist, album, status, profileUrl }) {
  const isLive = status === "NOW PLAYING";
  const accent = isLive ? "#1DB954" : "#22D3EE";
  const softAccent = isLive ? "#052E16" : "#083344";
  const safeTitle = escapeSvg(trimText(title || "Waiting for the next track", 42));
  const safeArtist = escapeSvg(trimText(artist || "Last.fm + AirScrobble signal", 48));
  const safeAlbum = escapeSvg(trimText(album || "Your listening card updates from GitHub Actions", 56));
  const safeStatus = escapeSvg(status || "READY");
  const liveDot = isLive ? '<animate attributeName="opacity" values="1;.28;1" dur="1.35s" repeatCount="indefinite"/>' : "";
  const liveWave = isLive ? '<animate attributeName="stroke-dashoffset" from="90" to="0" dur="2.8s" repeatCount="indefinite"/>' : "";

  return `<svg width="760" height="158" viewBox="0 0 760 158" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${safeStatus}: ${safeTitle} by ${safeArtist}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="760" y2="158" gradientUnits="userSpaceOnUse">
      <stop stop-color="#020617"/>
      <stop offset=".58" stop-color="#0B1120"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="pulse" x1="526" y1="106" x2="700" y2="106" gradientUnits="userSpaceOnUse">
      <stop stop-color="#22D3EE"/>
      <stop offset=".5" stop-color="#1DB954"/>
      <stop offset="1" stop-color="#A78BFA"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="7" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect x="1" y="1" width="758" height="156" rx="22" fill="url(#bg)" stroke="${accent}" stroke-opacity=".62"/>
  <rect x="22" y="24" width="112" height="112" rx="24" fill="${softAccent}" stroke="${accent}" stroke-opacity=".42"/>
  <circle cx="78" cy="80" r="34" fill="${accent}" fill-opacity=".12"/>
  <path d="M58 69c17-6 35-4 51 5" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>
  <path d="M62 83c12-4 25-3 36 4" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>
  <path d="M66 96c8-2 17-1 24 3" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
  <rect x="156" y="28" width="142" height="26" rx="13" fill="${accent}" fill-opacity=".14" stroke="${accent}" stroke-opacity=".34"/>
  <circle cx="176" cy="41" r="5" fill="${accent}">${liveDot}</circle>
  <text x="190" y="46" fill="${accent}" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="12" font-weight="800" letter-spacing="1.2">${safeStatus}</text>
  <text x="156" y="84" fill="#F8FAFC" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="28" font-weight="850">${safeTitle}</text>
  <text x="156" y="111" fill="#CBD5E1" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="17" font-weight="650">${safeArtist}</text>
  <text x="156" y="132" fill="#94A3B8" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="13" font-weight="650">${safeAlbum}</text>
  <path d="M526 106c20-18 38 18 58 0s39 18 58 0 38 18 58 0" stroke="url(#pulse)" stroke-width="4" stroke-linecap="round" opacity=".92" filter="url(#glow)" stroke-dasharray="18 10">${liveWave}</path>
  <text x="526" y="132" fill="#64748B" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="10" font-weight="800" letter-spacing="1.4">LAST.FM + AIRSCROBBLE</text>
</svg>`;
}

function writeSvg(svg) {
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${svg}\n`, "utf8");
}

async function fetchRecentTrack() {
  const user = process.env.LASTFM_USERNAME || "sudipta_kumar";
  const apiKey = process.env.LASTFM_API_KEY;

  if (!apiKey) {
    return {
      title: "Listening signal connected",
      artist: "Last.fm + AirScrobble",
      album: "Now-playing card for the profile music layer",
      status: "READY",
      profileUrl: `https://www.last.fm/user/${encodeURIComponent(user)}`,
    };
  }

  const params = new URLSearchParams({
    method: "user.getrecenttracks",
    user,
    api_key: apiKey,
    format: "json",
    limit: "1",
  });

  const response = await fetch(`${LASTFM_ENDPOINT}?${params.toString()}`);
  const payload = await response.json();
  const tracks = payload?.recenttracks?.track;
  const track = Array.isArray(tracks) ? tracks[0] : tracks;

  if (!response.ok || !track) {
    return {
      title: "No scrobble found yet",
      artist: "Play a song through AirScrobble",
      album: "Last.fm will feed this profile card",
      status: "READY",
      profileUrl: `https://www.last.fm/user/${encodeURIComponent(user)}`,
    };
  }

  return {
    title: track.name,
    artist: track.artist?.["#text"],
    album: track.album?.["#text"],
    status: track["@attr"]?.nowplaying === "true" ? "NOW PLAYING" : "RECENTLY PLAYED",
    profileUrl: track.url || `https://www.last.fm/user/${encodeURIComponent(user)}`,
  };
}

async function main() {
  try {
    writeSvg(renderCard(await fetchRecentTrack()));
  } catch (error) {
    writeSvg(renderCard({
      title: "Listening signal unavailable",
      artist: "Last.fm did not respond",
      album: "The next workflow run will try again",
      status: "READY",
      profileUrl: "https://www.last.fm/user/sudipta_kumar",
    }));
  }
}

main();
