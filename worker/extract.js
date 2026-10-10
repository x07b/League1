// Runs inside the worker's browser or a fixture page; no Node dependencies.
function extractStandings() {
  const rows = [...document.querySelectorAll(".ui-table__row")].filter(
    (row) => row.getClientRects().length,
  );
  if (rows.length !== 16)
    throw new Error(
      `Expected one complete 16-team table; found ${rows.length} rows.`,
    );
  const number = (value) => {
    const text = (value || "").trim().replace(/\.$/, "");
    if (!/^-?\d+$/.test(text)) throw new Error(`Invalid numeric cell: ${text}`);
    return Number(text);
  };
  return rows.map((row) => {
    const team = row
      .querySelector(".tableCellParticipant__name")
      ?.textContent?.trim();
    const rank = number(row.querySelector(".tableCellRank")?.textContent);
    const values = [
      ...row.querySelectorAll(
        '.table__cell--value, [class*="tableCell--value"]',
      ),
    ];
    if (!team || values.length < 2)
      throw new Error(
        "Standings markup changed: missing team or statistic cells.",
      );
    const pointsCell = row.querySelector(
      ".table__cell--points, .tableCellPoints",
    );
    if (!pointsCell)
      throw new Error("Standings markup changed: points column missing.");
    return {
      team,
      rank,
      played: number(values[0].textContent),
      points: number(pointsCell.textContent),
    };
  });
}
module.exports = { extractStandings };
