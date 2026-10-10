from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
ASSETS_DIR = BASE_DIR / 'assets'
LOGOS_DIR = ASSETS_DIR / 'logos'
OUTPUT_DIR = BASE_DIR / 'output'
INDEX_FILE = BASE_DIR / 'index.html'
MOBILE_INDEX_FILE = BASE_DIR / 'mobile-index.html'

FLASHSCORE_URL = (
    'https://www.flashscore.fr/classement/6RacM8Ea/'
    'G4Jhegue/#/G4Jhegue/classements/global/'
)

TEAMS_FILE = BASE_DIR / 'teams.json'

WIDTH = 1920
HEIGHT = 1080

ROW_Y = {
    1: 354,
    2: 414,
    3: 475,
    4: 535,
    5: 596,
    6: 656,
    7: 717,
    8: 777,
}

# Master table geometry, 1920x1080.
# Visual layout follows the draft:
# LEFT (9-16), from left to right: rank | logo | team | points | played
# RIGHT (1-8), from left to right: played | points | team | logo | rank
# In both cases, reading from the OUTSIDE edge toward the center:
# rank | logo | team | points | played
TABLE_WIDTH = 557
LEFT_X = 433
RIGHT_X = 1027

COL_PLAYED = 54
COL_POINTS = 54
COL_LOGO = 54
COL_RANK = 54
GAP = 3
TEAM_WIDTH = TABLE_WIDTH - (COL_PLAYED + COL_POINTS + COL_LOGO + COL_RANK) - (GAP * 4)

RIGHT = {
    'played_x': RIGHT_X,
    'points_x': RIGHT_X + COL_PLAYED + GAP,
    'team_x': RIGHT_X + (COL_PLAYED + GAP) * 2,
    'team_width': TEAM_WIDTH,
    'logo_x': RIGHT_X + (COL_PLAYED + GAP) * 2 + TEAM_WIDTH + GAP,
    'rank_x': RIGHT_X + TABLE_WIDTH - COL_RANK,
}

LEFT = {
    # EXACT same visual order as the right table, left -> right:
    # MJ | PTS | NOM ÉQUIPE | LOGO | RANG
    'played_x': LEFT_X,
    'points_x': LEFT_X + COL_PLAYED + GAP,
    'team_x': LEFT_X + (COL_PLAYED + GAP) * 2,
    'team_width': TEAM_WIDTH,
    'logo_x': LEFT_X + (COL_PLAYED + GAP) * 2 + TEAM_WIDTH + GAP,
    'rank_x': LEFT_X + TABLE_WIDTH - COL_RANK,
}
