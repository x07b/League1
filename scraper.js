const fs = require("fs");
const path = require("path");

const { chromium } = require("playwright");

const {
  FLASHSCORE_URL,
  TEAMS_FILE,
  LOGOS_DIR,
} = require("./config");


function cleanText(text) {

  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();

}


function extractNumber(text) {

  if (!text) {
    return null;
  }

  const match = String(text)
    .replace(/\u00a0/g, " ")
    .match(/\d+/);

  return match
    ? Number(match[0])
    : null;

}


function normalize(name) {

  let value = cleanText(name)
    .toLowerCase();

  value = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  value = value.replace(
    /&/g,
    " and "
  );

  return value
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

}


function loadTeams() {

  return JSON.parse(
    fs.readFileSync(
      TEAMS_FILE,
      "utf8"
    )
  );

}


function matchTeam(
  flashscoreName,
  teams
) {

  const target =
    normalize(flashscoreName);


  // Exact match
  for (
    const [key, data]
    of Object.entries(teams)
  ) {

    const aliases = [
      key,
      ...(data.flashscore || []),
    ];

    for (
      const alias
      of aliases
    ) {

      if (
        normalize(alias) === target
      ) {

        return {
          key,
          data,
        };

      }

    }

  }


  // Partial match
  const candidates = [];


  for (
    const [key, data]
    of Object.entries(teams)
  ) {

    const aliases = [
      key,
      ...(data.flashscore || []),
    ];


    for (
      const alias
      of aliases
    ) {

      const aliasNormalized =
        normalize(alias);


      if (
        aliasNormalized &&
        (
          aliasNormalized.includes(target) ||
          target.includes(aliasNormalized)
        )
      ) {

        candidates.push({

          length:
            aliasNormalized.length,

          key,

          data,

        });

      }

    }

  }


  if (candidates.length) {

    candidates.sort(
      (a, b) =>
        b.length - a.length
    );

    return {

      key:
        candidates[0].key,

      data:
        candidates[0].data,

    };

  }


  return {
    key: null,
    data: null,
  };

}


async function extractTeamName(row) {

  const selectors = [

    "a.tableCellParticipant__name",

    '[class*="tableCellParticipant__name"]',

    'a[href*="/equipe/"]',

    'a[href*="/equipe"]',

    '[class*="Participant__name"]',

    '[class*="participant__name"]',

  ];


  for (
    const selector
    of selectors
  ) {

    try {

      const loc =
        row.locator(selector);

      const count =
        await loc.count();


      if (count) {

        for (
          let i = 0;
          i < Math.min(count, 5);
          i++
        ) {

          const text =
            cleanText(
              await loc
                .nth(i)
                .innerText()
            );


          if (
            text &&
            text.length < 100
          ) {

            return text;

          }

        }

      }

    } catch (_) {}

  }


  for (
    const selector
    of [
      '[class*="Participant"]',
      '[class*="participant"]',
    ]
  ) {

    try {

      const loc =
        row.locator(selector);

      const count =
        await loc.count();


      if (count) {

        const text =
          cleanText(
            await loc
              .first()
              .innerText()
          );


        if (text) {

          return text
            .split("\n")[0]
            .trim();

        }

      }

    } catch (_) {}

  }


  return "";

}


async function extractValueCells(row) {

  const selectors = [

    '[class*="tableCell--value"]',

    '[class*="table__cell--value"]',

    '[class*="cell--value"]',

    '[class*="Cell--value"]',

  ];


  for (
    const selector
    of selectors
  ) {

    try {

      const loc =
        row.locator(selector);

      const count =
        await loc.count();


      if (count >= 2) {

        const values = [];


        for (
          let i = 0;
          i < count;
          i++
        ) {

          values.push(
            cleanText(
              await loc
                .nth(i)
                .innerText()
            )
          );

        }


        return values;

      }

    } catch (_) {}

  }


  return [];

}


async function extractLogoSrc(row) {

  const locators = [

    row.locator(
      '[class*="Participant"] img'
    ),

    row.locator(
      '[class*="participant"] img'
    ),

    row.locator("img"),

  ];


  for (
    const loc
    of locators
  ) {

    try {

      const count =
        await loc.count();


      for (
        let i = 0;
        i < Math.min(count, 8);
        i++
      ) {

        const el =
          loc.nth(i);


        const attrs = [

          await el.getAttribute("src"),

          await el.getAttribute(
            "data-src"
          ),

          await el.getAttribute(
            "data-lazy-src"
          ),

          await el.getAttribute(
            "data-original"
          ),

          await el.getAttribute(
            "data-image"
          ),

        ];


        const srcset =
          await el.getAttribute(
            "srcset"
          );


        if (srcset) {

          attrs.push(
            srcset
              .split(",")[0]
              .trim()
              .split(/\s+/)[0]
          );

        }


        for (
          let src
          of attrs
        ) {

          if (!src) {
            continue;
          }

          src = src.trim();


          if (
            src.startsWith("//")
          ) {

            src =
              "https:" + src;

          }


          if (
            src.startsWith("http://") ||
            src.startsWith("https://")
          ) {

            return src;

          }

        }

      }

    } catch (_) {}

  }


  // Background image
  try {

    const elements =
      row.locator(
        '[style*="background-image"], [class*="Participant"], [class*="participant"]'
      );


    const count =
      await elements.count();


    for (
      let i = 0;
      i < Math.min(count, 12);
      i++
    ) {

      const style =
        await elements
          .nth(i)
          .getAttribute("style") || "";


      const match =
        style.match(
          /url\(["']?(.*?)["']?\)/
        );


      if (match) {

        let src =
          match[1];


        if (
          src.startsWith("//")
        ) {

          src =
            "https:" + src;

        }


        if (
          src.startsWith("http://") ||
          src.startsWith("https://")
        ) {

          return src;

        }

      }

    }

  } catch (_) {}


  return null;

}


async function saveLogoFromPage(
  page,
  src,
  filename
) {

  if (
    !src ||
    !filename
  ) {

    return false;

  }


  fs.mkdirSync(
    LOGOS_DIR,
    {
      recursive: true,
    }
  );


  const destination =
    path.join(
      LOGOS_DIR,
      filename
    );


  try {

    if (
      fs.existsSync(destination) &&
      fs.statSync(destination).size > 0
    ) {

      return true;

    }

  } catch (_) {}


  try {

    const base64 =
      await page.evaluate(
        async (url) => {

          try {

            const response =
              await fetch(
                url,
                {
                  credentials:
                    "include",
                }
              );


            if (!response.ok) {
              return null;
            }


            const buffer =
              await response.arrayBuffer();


            const bytes =
              new Uint8Array(buffer);


            let binary = "";

            const chunk =
              0x8000;


            for (
              let i = 0;
              i < bytes.length;
              i += chunk
            ) {

              binary +=
                String.fromCharCode(
                  ...bytes.subarray(
                    i,
                    i + chunk
                  )
                );

            }


            return btoa(binary);

          } catch (_) {

            return null;

          }

        },
        src
      );


    if (!base64) {
      return false;
    }


    fs.writeFileSync(
      destination,
      Buffer.from(
        base64,
        "base64"
      )
    );


    return true;

  } catch (error) {

    console.warn(
      `WARNING: could not save logo ${filename}: ${error.message}`
    );

    return false;

  }

}


async function getStandings() {

  const teams =
    loadTeams();

  const warnings = [];

  const standings = [];


  console.log(
    "Opening Flashscore..."
  );


  const browser =
    await chromium.launch({

      headless: true,

    });


  const context =
    await browser.newContext({

      viewport: {
        width: 1920,
        height: 1080,
      },

      locale: "fr-FR",

      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/143.0.0.0 Safari/537.36",

    });


  const page =
    await context.newPage();


  try {

    await page.goto(
      FLASHSCORE_URL,
      {
        waitUntil:
          "domcontentloaded",

        timeout:
          60000,
      }
    );


    await page.waitForTimeout(
      7000
    );


    // Cookie banner
    for (
      const selector
      of [
        "#onetrust-accept-btn-handler",

        'button[id*="accept"]',

        'button:has-text("Accept")',

        'button:has-text("Accepter")',
      ]
    ) {

      try {

        const loc =
          page.locator(selector);


        if (
          await loc.count()
        ) {

          await loc
            .first()
            .click({
              timeout: 2000,
            });


          await page.waitForTimeout(
            700
          );

          break;

        }

      } catch (_) {}

    }


    const selectors = [

      "div.ui-table__row",

      'div[class*="table__row"]',

      'div[class*="tableRow"]',

      '[data-testid*="table-row"]',

    ];


    let rows = [];


    for (
      const selector
      of selectors
    ) {

      try {

        const candidates =
          page.locator(
            selector
          );


        const count =
          await candidates.count();


        if (count >= 16) {

          rows =
            candidates;


          console.log(
            `Found ${count} standings rows with: ${selector}`
          );


          break;

        }

      } catch (_) {}

    }


    if (
      !rows ||
      !(await rows.count())
    ) {

      throw new Error(
        "Impossible de trouver le classement Flashscore."
      );

    }


    const rowCount =
      await rows.count();


    for (
      let index = 0;
      index < rowCount;
      index++
    ) {

      if (
        standings.length >= 16
      ) {

        break;

      }


      const row =
        rows.nth(index);


      try {

        const flashscoreName =
          await extractTeamName(
            row
          );


        if (!flashscoreName) {
          continue;
        }


        const values =
          await extractValueCells(
            row
          );


        const played =
          values.length
            ? extractNumber(values[0])
            : null;


        const points =
          values.length
            ? extractNumber(
                values[
                  values.length - 1
                ]
              )
            : null;


        if (
          played === null ||
          points === null
        ) {

          warnings.push(
            `Could not read MJ/PTS for ${flashscoreName}: ${JSON.stringify(values)}`
          );

          continue;

        }


        const rank =
          standings.length + 1;


        const {
          data: teamData
        } =
          matchTeam(
            flashscoreName,
            teams
          );


        let arabic;
        let logoName;


        if (teamData) {

          arabic =
            teamData.arabic;

          logoName =
            teamData.logo ||
            null;

        } else {

          arabic =
            flashscoreName;

          logoName =
            null;


          warnings.push(
            `No teams.json match for: ${flashscoreName} (rank ${rank})`
          );

        }


        const logoSrc =
          await extractLogoSrc(
            row
          );


        let logoSaved =
          false;


        if (
          logoName &&
          logoSrc
        ) {

          logoSaved =
            await saveLogoFromPage(
              page,
              logoSrc,
              logoName
            );

        }


        standings.push({

          rank,

          team:
            flashscoreName,

          arabic,

          logo:
            logoSaved
              ? logoName
              : null,

          logo_src:
            logoSrc,

          played,

          points,

        });


      } catch (error) {

        warnings.push(
          `Skipped row: ${error.message}`
        );

      }

    }


  } finally {

    await context.close();

    await browser.close();

  }


  if (warnings.length) {

    console.log(
      "\nWARNINGS:"
    );


    for (
      const warning
      of warnings
    ) {

      console.log(
        " -",
        warning
      );

    }

  }


  return standings;

}


module.exports = {

  cleanText,

  extractNumber,

  normalize,

  loadTeams,

  matchTeam,

  getStandings,

};