(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Standings = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function normalize(value) {
    return String(value || "")
      .normalize("NFKD")
      .toLowerCase()
      .replace(/\p{M}/gu, "")
      .replace(/ـ/g, "")
      .replace(/[إأآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  }
  function matchTeam(name, teams) {
    const target = normalize(name);
    if (!target) throw new Error("Missing team name.");
    const matches = Object.entries(teams).filter(([key, t]) =>
      [key, t.arabic, ...t.flashscore].some(
        (alias) => normalize(alias) === target,
      ),
    );
    if (matches.length !== 1)
      throw new Error(
        `Unmatched or ambiguous team: ${name}. Add an alias in teams.json; the previous board is kept.`,
      );
    return matches[0][0];
  }
  function validate(rows, teams) {
    if (!Array.isArray(rows) || rows.length !== 16)
      throw new Error(
        "Invalid or incomplete standings: exactly 16 teams are required.",
      );
    const ranks = new Set(),
      keys = new Set();
    const result = rows.map((row) => {
      const key =
        row.key && teams[row.key]
          ? row.key
          : matchTeam(row.team || row.arabic, teams);
      for (const field of ["rank", "played", "points"])
        if (!Number.isInteger(row[field]))
          throw new Error(`Invalid ${field} for ${key}.`);
      if (
        row.rank < 1 ||
        row.rank > 16 ||
        row.played < 0 ||
        row.played > 100 ||
        row.points < -100 ||
        row.points > row.played * 3 ||
        ranks.has(row.rank) ||
        keys.has(key)
      )
        throw new Error(
          "Invalid standings: duplicate team/rank or impossible statistics.",
        );
      ranks.add(row.rank);
      keys.add(key);
      return {
        key,
        rank: row.rank,
        played: row.played,
        points: row.points,
        arabic: teams[key].arabic,
        logo: teams[key].logo,
      };
    });
    return result.sort((a, b) => a.rank - b.rank);
  }
  function sourceUrl(value) {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      ![
        "www.flashscore.fr",
        "www.flashscore.com",
        "www.flashscore.tn",
      ].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    )
      throw new Error(
        "Use an HTTPS competition URL on www.flashscore.fr, .com or .tn.",
      );
    return url.href;
  }
  return { normalize, matchTeam, validate, sourceUrl };
});
