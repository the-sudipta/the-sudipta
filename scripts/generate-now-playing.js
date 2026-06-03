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

function largestTrackImage(track) {
  const images = Array.isArray(track?.image) ? track.image : [];
  const image = [...images]
    .reverse()
    .find((item) => item?.["#text"] && /^https?:\/\//.test(item["#text"]));

  return image?.["#text"] || "";
}

async function imageToDataUri(url) {
  if (!url) {
    return "";
  }

  try {
    const response = await fetch(url);
    const contentType = response.headers.get("content-type") || "";

    if (!response.ok || !contentType.startsWith("image/")) {
      return "";
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${contentType.split(";")[0]};base64,${bytes.toString("base64")}`;
  } catch (error) {
    return "";
  }
}

function renderAlbumArt({ albumArt, accent }) {
  if (albumArt) {
    return `
  <clipPath id="coverClip">
    <rect x="24" y="27" width="142" height="142" rx="24"/>
  </clipPath>
  <image href="${escapeSvg(albumArt)}" x="24" y="27" width="142" height="142" preserveAspectRatio="xMidYMid slice" clip-path="url(#coverClip)"/>
  <rect x="24" y="27" width="142" height="142" rx="24" fill="none" stroke="${accent}" stroke-opacity=".58"/>`;
  }

  return `
  <rect x="24" y="27" width="142" height="142" rx="24" fill="#0F172A" stroke="${accent}" stroke-opacity=".58"/>
  <circle cx="95" cy="98" r="48" fill="${accent}" fill-opacity=".13" stroke="${accent}" stroke-opacity=".62"/>
  <circle cx="95" cy="98" r="13" fill="#020617" stroke="${accent}" stroke-opacity=".65"/>
  <path d="M64 84c22-8 45-6 65 6" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>
  <path d="M69 101c16-5 32-4 46 4" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>
  <path d="M75 116c9-3 18-2 27 3" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>`;
}

function spectrumBars(isLive, accent) {
  const bars = [28, 50, 72, 42, 92, 64, 36, 78, 54, 88, 46, 68];
  const colors = ["#22D3EE", "#1DB954", "#A78BFA", "#F59E0B"];

  return bars.map((height, index) => {
    const x = 626 + index * 12;
    const y = 138 - height;
    const color = colors[index % colors.length];
    const delay = `${(index * 0.11).toFixed(2)}s`;
    const animation = isLive
      ? `<animate attributeName="height" values="${height};${Math.max(18, height - 28)};${height + 10};${height}" dur="1.45s" begin="${delay}" repeatCount="indefinite"/>
         <animate attributeName="y" values="${y};${138 - Math.max(18, height - 28)};${138 - (height + 10)};${y}" dur="1.45s" begin="${delay}" repeatCount="indefinite"/>`
      : "";

    return `<rect x="${x}" y="${y}" width="7" height="${height}" rx="3.5" fill="${color}" opacity=".9">${animation}</rect>`;
  }).join("\n  ");
}

function renderCard({ title, artist, album, status, profileUrl, albumArt }) {
  const isLive = status === "NOW PLAYING";
  const accent = isLive ? "#1DB954" : "#22D3EE";
  const safeTitle = escapeSvg(trimText(title || "Waiting for the next track", 34));
  const safeArtist = escapeSvg(trimText(artist || "Last.fm + AirScrobble signal", 40));
  const safeDescription = escapeSvg(trimText(`${artist || "Last.fm + AirScrobble"}${album ? ` - ${album}` : " - profile music signal"}`, 54));
  const safeStatus = escapeSvg(status || "READY");
  const liveDot = isLive ? '<animate attributeName="opacity" values="1;.28;1" dur="1.35s" repeatCount="indefinite"/>' : "";

  return `<svg width="860" height="196" viewBox="0 0 860 196" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${safeStatus}: ${safeTitle} by ${safeArtist}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="860" y2="196" gradientUnits="userSpaceOnUse">
      <stop stop-color="#020617"/>
      <stop offset=".58" stop-color="#0B1120"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="860" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="#22D3EE"/>
      <stop offset=".48" stop-color="#A78BFA"/>
      <stop offset="1" stop-color="#1DB954"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect x="1" y="1" width="858" height="194" rx="26" fill="url(#bg)" stroke="${accent}" stroke-opacity=".62"/>
  <rect x="18" y="20" width="824" height="156" rx="24" fill="#0F172A" fill-opacity=".66" stroke="#334155" stroke-opacity=".48"/>
  <path d="M204 162h384" stroke="url(#shine)" stroke-width="3" stroke-linecap="round" opacity=".74" filter="url(#glow)">
    ${isLive ? '<animate attributeName="stroke-dashoffset" from="160" to="0" dur="2.6s" repeatCount="indefinite"/>' : ""}
  </path>${renderAlbumArt({ albumArt, accent })}
  <rect x="198" y="36" width="150" height="28" rx="14" fill="${accent}" fill-opacity=".14" stroke="${accent}" stroke-opacity=".34"/>
  <circle cx="219" cy="50" r="5" fill="${accent}">${liveDot}</circle>
  <text x="233" y="55" fill="${accent}" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="12" font-weight="800" letter-spacing="1.2">TYPE: ${safeStatus}</text>
  <text x="198" y="82" fill="#64748B" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="10" font-weight="900" letter-spacing="1.5">TITLE</text>
  <text x="198" y="111" fill="#F8FAFC" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="30" font-weight="850">${safeTitle}</text>
  <text x="198" y="136" fill="#64748B" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="10" font-weight="900" letter-spacing="1.5">DESCRIPTION</text>
  <text x="198" y="157" fill="#CBD5E1" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="15" font-weight="700">${safeDescription}</text>
  <rect x="606" y="36" width="192" height="116" rx="22" fill="#020617" fill-opacity=".45" stroke="#334155" stroke-opacity=".5"/>
  <text x="626" y="58" fill="#94A3B8" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="10" font-weight="800" letter-spacing="1.5">AUDIO SPECTRUM</text>
  ${spectrumBars(isLive, accent)}
  <text x="626" y="168" fill="#64748B" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="10" font-weight="800" letter-spacing="1.4">LAST.FM + AIRSCROBBLE</text>
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
      albumArt: "",
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
      albumArt: "",
    };
  }

  const albumArt = await imageToDataUri(largestTrackImage(track));

  return {
    title: track.name,
    artist: track.artist?.["#text"],
    album: track.album?.["#text"],
    status: track["@attr"]?.nowplaying === "true" ? "NOW PLAYING" : "RECENTLY PLAYED",
    profileUrl: track.url || `https://www.last.fm/user/${encodeURIComponent(user)}`,
    albumArt,
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
