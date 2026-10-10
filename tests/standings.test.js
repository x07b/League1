const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  normalize,
  matchTeam,
  validate,
  sourceUrl,
} = require("../shared/standings");
const teams = require("../teams.json");
const seed = require("../data/standings.json");
test("seed has 16 unique teams, ranks and bundled logos", () => {
  const result = validate(seed.standings, teams);
  assert.equal(result.length, 16);
  for (const team of result)
    assert.ok(fs.statSync(`assets/logos/${team.logo}`).size > 0);
});
test("French accents and Arabic diacritics normalize without dropping Arabic", () => {
  assert.equal(normalize("Étoile Sahel"), "etoile sahel");
  assert.equal(matchTeam("النَّادِي الإفريقي", teams), "club_africain");
  assert.equal(matchTeam("Espérance Tunis", teams), "esperance");
  assert.throws(() => matchTeam("", teams));
  assert.throws(() => matchTeam("Tunis", teams));
});
test("source URL rejects arbitrary hosts, credentials, ports and non-HTTPS", () => {
  assert.ok(sourceUrl("https://www.flashscore.fr/classement/abc/"));
  for (const url of [
    "http://www.flashscore.fr",
    "https://evil.test",
    "https://www.flashscore.fr.evil.test",
    "https://user@www.flashscore.fr",
    "https://www.flashscore.fr:444",
  ])
    assert.throws(() => sourceUrl(url));
});
test("validation rejects partial data, duplicate identities and ranks, invalid points", () => {
  assert.throws(() => validate(seed.standings.slice(1), teams));
  for (const change of [
    { rank: 2 },
    { key: seed.standings[1].key },
    { points: 999 },
    { played: null },
    { points: "9" },
    { rank: 0 },
  ]) {
    const rows = structuredClone(seed.standings);
    Object.assign(rows[0], change);
    assert.throws(() => validate(rows, teams));
  }
});
test("valid source names map to local logos; upstream presentation is ignored", () => {
  const rows = seed.standings.map((t) => ({
    team: teams[t.key].flashscore[0],
    rank: t.rank,
    played: t.played,
    points: t.points,
    logo: "wrong.png",
  }));
  assert.deepEqual(validate(rows, teams), validate(seed.standings, teams));
});
