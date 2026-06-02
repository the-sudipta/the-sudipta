const LASTFM_ENDPOINT = "https://ws.audioscrobbler.com/2.0/";

function escapeSvg(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function trimText(value, maxLength) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function card({ title, artist, album, isNowPlaying, profileUrl }) {
  const status = isNowPlaying ? "NOW PLAYING" : "RECENTLY PLAYED";
  const accent = isNowPlaying ? "#1DB954" : "#22D3EE";
  const safeTitle = escapeSvg(trimText(title || "No track found", 44));
  const safeArtist = escapeSvg(trimText(artist || "Spotify via Last.fm", 48));
  const safeAlbum = escapeSvg(trimText(album || "Listening signal", 54));
  const safeUrl = escapeSvg(profileUrl || "https://www.last.fm");

  return `<svg width="560" height="132" viewBox="0 0 560 132" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Spotify ${escapeSvg(status)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="560" y2="132">
      <stop stop-color="#020617"/>
      <stop offset=".56" stop-color="#0D1117"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-30%" width="140%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity=".28"/>
    </filter>
  </defs>
  <a href="${safeUrl}" target="_blank">
    <rect width="560" height="132" rx="22" fill="url(#bg)"/>
    <rect x="1" y="1" width="558" height="130" rx="22" stroke="${accent}" stroke-opacity=".55"/>
    <g filter="url(#shadow)">
      <circle cx="58" cy="66" r="34" fill="${accent}" fill-opacity=".14" stroke="${accent}" stroke-width="2"/>
      <path d="M42 58c15-5 29-4 43 4" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>
      <path d="M45 69c12-4 23-3 34 3" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
      <path d="M48 79c8-2 16-2 23 2" stroke="${accent}" stroke-width="2.6" stroke-linecap="round"/>
    </g>
    <text x="112" y="35" fill="${accent}" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="13" font-weight="800" letter-spacing="1.4">${escapeSvg(status)}</text>
    <text x="112" y="68" fill="#F8FAFC" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="23" font-weight="800">${safeTitle}</text>
    <text x="112" y="94" fill="#CBD5E1" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="16" font-weight="600">${safeArtist}</text>
    <text x="112" y="116" fill="#94A3B8" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="13" font-weight="600">${safeAlbum}</text>
  </a>
</svg>`;
}

function errorCard(message) {
  return card({
    title: "Spotify signal unavailable",
    artist: message,
    album: "Check Last.fm username and API key",
    isNowPlaying: false,
    profileUrl: "https://www.last.fm",
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const user = process.env.LASTFM_USERNAME;
  const apiKey = process.env.LASTFM_API_KEY;

  if (!user || !apiKey) {
    res.status(200).send(errorCard("Missing Last.fm environment variables"));
    return;
  }

  const params = new URLSearchParams({
    method: "user.getrecenttracks",
    user,
    api_key: apiKey,
    format: "json",
    limit: "1",
  });

  try {
    const response = await fetch(`${LASTFM_ENDPOINT}?${params.toString()}`);
    const payload = await response.json();
    const tracks = payload?.recenttracks?.track;
    const track = Array.isArray(tracks) ? tracks[0] : tracks;

    if (!response.ok || !track) {
      res.status(200).send(errorCard("No Last.fm track found"));
      return;
    }

    res.status(200).send(card({
      title: track.name,
      artist: track.artist?.["#text"],
      album: track.album?.["#text"],
      isNowPlaying: track["@attr"]?.nowplaying === "true",
      profileUrl: track.url || `https://www.last.fm/user/${encodeURIComponent(user)}`,
    }));
  } catch (error) {
    res.status(200).send(errorCard("Unable to reach Last.fm right now"));
  }
};
