const path = require("path");

const BASE_DIR = __dirname;

const ASSETS_DIR = path.join(BASE_DIR, "assets");
const LOGOS_DIR = path.join(ASSETS_DIR, "logos");
const OUTPUT_DIR = path.join(BASE_DIR, "output");

const INDEX_FILE = path.join(BASE_DIR, "index.html");
const MOBILE_INDEX_FILE = path.join(BASE_DIR, "mobile-index.html");

const FLASHSCORE_URL =
  "https://www.flashscore.fr/classement/6RacM8Ea/G4Jhegue/#/G4Jhegue/classements/global/";

const TEAMS_FILE = path.join(BASE_DIR, "teams.json");

const WIDTH = 1920;
const HEIGHT = 1080;

const ROW_Y = {
  1: 354,
  2: 414,
  3: 475,
  4: 535,
  5: 596,
  6: 656,
  7: 717,
  8: 777,
};

const TABLE_WIDTH = 557;

const LEFT_X = 433;
const RIGHT_X = 1027;

const COL_PLAYED = 54;
const COL_POINTS = 54;
const COL_LOGO = 54;
const COL_RANK = 54;

const GAP = 3;

const TEAM_WIDTH =
  TABLE_WIDTH -
  (COL_PLAYED +
    COL_POINTS +
    COL_LOGO +
    COL_RANK) -
  GAP * 4;

const RIGHT = {
  played_x: RIGHT_X,

  points_x:
    RIGHT_X +
    COL_PLAYED +
    GAP,

  team_x:
    RIGHT_X +
    (COL_PLAYED + GAP) * 2,

  team_width: TEAM_WIDTH,

  logo_x:
    RIGHT_X +
    (COL_PLAYED + GAP) * 2 +
    TEAM_WIDTH +
    GAP,

  rank_x:
    RIGHT_X +
    TABLE_WIDTH -
    COL_RANK,
};

const LEFT = {
  played_x: LEFT_X,

  points_x:
    LEFT_X +
    COL_PLAYED +
    GAP,

  team_x:
    LEFT_X +
    (COL_PLAYED + GAP) * 2,

  team_width: TEAM_WIDTH,

  logo_x:
    LEFT_X +
    (COL_PLAYED + GAP) * 2 +
    TEAM_WIDTH +
    GAP,

  rank_x:
    LEFT_X +
    TABLE_WIDTH -
    COL_RANK,
};

module.exports = {
  BASE_DIR,
  ASSETS_DIR,
  LOGOS_DIR,
  OUTPUT_DIR,

  INDEX_FILE,
  MOBILE_INDEX_FILE,

  FLASHSCORE_URL,
  TEAMS_FILE,

  WIDTH,
  HEIGHT,

  ROW_Y,

  RIGHT,
  LEFT,
};