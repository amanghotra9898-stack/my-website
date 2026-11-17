/* =====================================================================
   SDX PLAYS — SITE DATA  (edit this file to update the website)
   ---------------------------------------------------------------------
   Every empty string ("") is a PLACEHOLDER that still needs real info.
   Download buttons stay HIDDEN until a real download URL is filled in —
   the site never shows a broken or fake download link.

   Only add a game to GAMES when it is ready to be PUBLIC.
   (Unreleased projects must NOT be listed here at all.)
   ===================================================================== */
window.SDX = {
  site: {
    name: "SDX PLAYS",
    tagline: "Play • Explore • Enjoy",
    // Contact info — placeholders, fill in when ready
    email: "",            // e.g. "contact@yourdomain.com"
    businessEmail: "",    // optional
  },

  // Social media — only https links filled in here become clickable.
  social: {
    youtube: "",
    instagram: "",
    discord: "",
    telegram: ""
  },

  games: [
    {
      id: "medieval-life",
      title: "Medieval Life",
      page: "medieval-life.html",
      cover: "assets/img/games/medieval-life/cover-960.webp",   // official key art (contains the game logo)
      short: "A first-person medieval survival game: gather resources, build your own village, hunt, ride and explore an open world through day and night.",
      tags: ["Survival", "Village Building", "Open World"],

      // Download links — paste the final URLs when available.
      // https:// links only (e.g. a GitHub Releases asset URL or Google Play link).
      // While empty, every download button for this game stays hidden.
      downloads: {
        android: "https://github.com/amanghotra9898-stack/my-website/releases/download/medieval-life-v1.2.3/Game.apk",   // GitHub Releases asset (SHA-256 283d8828e8d5e80915289191c5d033e7a3c3317c7fcc7fef45c5258113a68a28)
        web: ""        // Playgama / browser-playable link
      },
      // Shown next to the DOWNLOAD GAME button — use the REAL values of the uploaded APK.
      apk: {
        version: "1.2.3",
        size: "202 MB"
      },

      // Real in-game screenshots (full image + small thumbnail + description)
      screenshots: [
        { src: "assets/img/games/medieval-life/screenshot-1-village.webp", thumb: "assets/img/games/medieval-life/screenshot-1-village-thumb.webp", alt: "Villagers walking through the village square on a summer morning" },
        { src: "assets/img/games/medieval-life/screenshot-2-night.webp",   thumb: "assets/img/games/medieval-life/screenshot-2-night-thumb.webp",   alt: "The village at night under a starry sky, lit by lanterns" },
        { src: "assets/img/games/medieval-life/screenshot-3-build.webp",   thumb: "assets/img/games/medieval-life/screenshot-3-build-thumb.webp",   alt: "Placing a wooden house blueprint in first person with the hammer" }
      ]
    }
  ]
};
