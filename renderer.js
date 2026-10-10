const fs = require("fs");
const path = require("path");

const {
  BASE_DIR,
  INDEX_FILE,
  MOBILE_INDEX_FILE,
  ROW_Y,
  RIGHT,
  LEFT,
} = require("./config");


function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function rankClass(rank) {

  if (rank === 1 || rank === 2) {
    return "rank gold";
  }

  if (rank === 3) {
    return "rank grey";
  }

  if (rank >= 14) {
    return "rank danger";
  }

  return "rank";
}


function localLogo(filename) {

  if (!filename) {
    return null;
  }

  const logoPath = path.join(
    BASE_DIR,
    "assets",
    "logos",
    filename
  );

  try {

    if (
      fs.existsSync(logoPath) &&
      fs.statSync(logoPath).size > 0
    ) {
      return `assets/logos/${filename}`;
    }

  } catch (_) {}

  return null;
}


function logoMarkup(team) {

  const logoSrc =
    localLogo(team.logo) ||
    team.logo_src ||
    "";

  if (!logoSrc) {
    return "";
  }

  return `
    <img
      src="${escapeHtml(logoSrc)}"
      alt=""
      class="team-logo"
      loading="eager"
      decoding="async"
    >
  `;
}


function rowRight(team, y) {

  return `
    <div
      class="dynamic-row row-right"
      style="top:${y}px;"
    >

      <div
        class="cell played"
        style="left:${RIGHT.played_x}px;"
      >
        ${escapeHtml(team.played)}
      </div>

      <div
        class="cell points"
        style="left:${RIGHT.points_x}px;"
      >
        ${escapeHtml(team.points)}
      </div>

      <div
        class="cell team-name"
        style="
          left:${RIGHT.team_x}px;
          width:${RIGHT.team_width}px;
        "
      >
        ${escapeHtml(team.arabic)}
      </div>

      <div class="cell logo">
        ${logoMarkup(team)}
      </div>

      <div
        class="cell ${rankClass(Number(team.rank))}"
        style="left:${RIGHT.rank_x}px;"
      >
        ${Number(team.rank)}
      </div>

    </div>
  `;
}


function rowLeft(team, y) {

  return `
    <div
      class="dynamic-row row-left"
      style="top:${y}px;"
    >

      <div
        class="cell played"
        style="left:${LEFT.played_x}px;"
      >
        ${escapeHtml(team.played)}
      </div>

      <div
        class="cell points"
        style="left:${LEFT.points_x}px;"
      >
        ${escapeHtml(team.points)}
      </div>

      <div
        class="cell team-name"
        style="
          left:${LEFT.team_x}px;
          width:${LEFT.team_width}px;
        "
      >
        ${escapeHtml(team.arabic)}
      </div>

      <div class="cell logo">
        ${logoMarkup(team)}
      </div>

      <div
        class="cell ${rankClass(Number(team.rank))}"
        style="left:${LEFT.rank_x}px;"
      >
        ${Number(team.rank)}
      </div>

    </div>
  `;
}


function rowsHtml(standings) {

  return standings
    .map((team) => {

      const rank = Number(team.rank);

      const position =
        rank <= 8
          ? rank
          : rank - 8;

      const y = ROW_Y[position];

      if (rank <= 8) {
        return rowRight(team, y);
      }

      return rowLeft(team, y);

    })
    .join("");
}


function mobileRowsHtml(standings) {

  return standings
    .map((team) => {

      return `
        <div class="mobile-row">

          <div
            class="mobile-rank ${rankClass(
              Number(team.rank)
            )}"
          >
            ${Number(team.rank)}
          </div>

          <div class="mobile-logo">
            ${logoMarkup(team)}
          </div>

          <div class="mobile-team">
            ${escapeHtml(team.arabic)}
          </div>

          <div class="mobile-stat">
            ${escapeHtml(team.points)}
          </div>

          <div class="mobile-stat">
            ${escapeHtml(team.played)}
          </div>

        </div>
      `;

    })
    .join("");
}


function buildPayload(standings) {

  return {

    rows: rowsHtml(standings),

    mobileRows:
      mobileRowsHtml(standings),

  };
}


function writeIndex(standings) {

  console.log(
    `Compatibility writeIndex requested for ${INDEX_FILE}`
  );

  console.log(
    `Mobile index: ${MOBILE_INDEX_FILE}`
  );
}


module.exports = {

  escapeHtml,

  rankClass,

  rowsHtml,

  mobileRowsHtml,

  buildPayload,

  writeIndex,

};