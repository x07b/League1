import base64
import json
import re
import shutil
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

from config import FLASHSCORE_URL, TEAMS_FILE, LOGOS_DIR


def clean_text(text: str) -> str:
    return ' '.join((text or '').split()).strip()


def extract_number(text):
    if not text:
        return None
    # Flashscore can contain NBSP / hidden whitespace around numbers.
    m = re.search(r'\d+', text.replace('\xa0', ' '))
    return int(m.group()) if m else None


def normalize(name: str) -> str:
    import unicodedata
    value = clean_text(name).lower()
    value = ''.join(
        c for c in unicodedata.normalize('NFKD', value)
        if not unicodedata.combining(c)
    )
    value = value.replace('&', ' and ')
    return re.sub(r'[^a-z0-9]+', ' ', value).strip()


def load_teams():
    with open(TEAMS_FILE, encoding='utf-8') as f:
        return json.load(f)


def match_team(flashscore_name, teams):
    target = normalize(flashscore_name)

    # 1) Exact aliases.
    for key, data in teams.items():
        aliases = [key] + data.get('flashscore', [])
        for alias in aliases:
            if normalize(alias) == target:
                return key, data

    # 2) Safe containment, longest alias first.
    candidates = []
    for key, data in teams.items():
        aliases = [key] + data.get('flashscore', [])
        for alias in aliases:
            alias_n = normalize(alias)
            if alias_n and (alias_n in target or target in alias_n):
                candidates.append((len(alias_n), key, data))
    if candidates:
        _, key, data = max(candidates, key=lambda x: x[0])
        return key, data

    return None, None


def extract_team_name(row):
    # Current Flashscore class, then older/alternate variants.
    selectors = [
        'a.tableCellParticipant__name',
        '[class*="tableCellParticipant__name"]',
        'a[href*="/equipe/"]',
        'a[href*="/equipe"]',
        '[class*="Participant__name"]',
        '[class*="participant__name"]',
    ]

    for selector in selectors:
        try:
            loc = row.locator(selector)
            if loc.count():
                for i in range(min(loc.count(), 5)):
                    text = clean_text(loc.nth(i).inner_text())
                    if text and len(text) < 100:
                        return text
        except Exception:
            pass

    # Fallback to the participant container, but only keep the first line.
    for selector in ['[class*="Participant"]', '[class*="participant"]']:
        try:
            loc = row.locator(selector)
            if loc.count():
                text = clean_text(loc.first.inner_text())
                if text:
                    return text.split('\n')[0].strip()
        except Exception:
            pass

    return ''


def extract_value_cells(row):
    selectors = [
        '[class*="tableCell--value"]',
        '[class*="table__cell--value"]',
        '[class*="cell--value"]',
        '[class*="Cell--value"]',
    ]

    for selector in selectors:
        try:
            loc = row.locator(selector)
            count = loc.count()
            if count >= 2:
                return [clean_text(loc.nth(i).inner_text()) for i in range(count)]
        except Exception:
            pass
    return []


def extract_logo_src(row, page):
    """Extract a real logo URL from Flashscore, including lazy/background images."""
    # Prefer the participant/name area, then inspect all images in the row.
    locators = [
        row.locator('[class*="Participant"] img'),
        row.locator('[class*="participant"] img'),
        row.locator('img'),
    ]

    for loc in locators:
        try:
            for i in range(min(loc.count(), 8)):
                el = loc.nth(i)
                attrs = [
                    el.get_attribute('src'),
                    el.get_attribute('data-src'),
                    el.get_attribute('data-lazy-src'),
                    el.get_attribute('data-original'),
                    el.get_attribute('data-image'),
                ]
                srcset = el.get_attribute('srcset')
                if srcset:
                    attrs.append(srcset.split(',')[0].strip().split(' ')[0])

                for src in attrs:
                    if not src:
                        continue
                    src = src.strip()
                    if src.startswith('//'):
                        src = 'https:' + src
                    if src.startswith(('http://', 'https://')):
                        return src
        except Exception:
            pass

    # Some Flashscore versions render the team crest as a CSS background-image.
    try:
        elements = row.locator('[style*="background-image"], [class*="Participant"], [class*="participant"]')
        for i in range(min(elements.count(), 12)):
            style = elements.nth(i).get_attribute('style') or ''
            m = re.search(r'url\\(["\']?(.*?)["\']?\\)', style)
            if m:
                src = m.group(1)
                if src.startswith('//'):
                    src = 'https:' + src
                if src.startswith(('http://', 'https://')):
                    return src
    except Exception:
        pass

    return None


def save_logo_from_page(page, src, filename):
    if not src or not filename:
        return False

    destination = LOGOS_DIR / filename
    destination.parent.mkdir(parents=True, exist_ok=True)

    if destination.exists() and destination.stat().st_size > 0:
        return True

    try:
        result = page.evaluate(
            '''async ({url}) => {
                try {
                    const r = await fetch(url, {credentials: 'include'});
                    if (!r.ok) return null;
                    const b = await r.arrayBuffer();
                    const bytes = new Uint8Array(b);
                    let binary = '';
                    const chunk = 0x8000;
                    for (let i = 0; i < bytes.length; i += chunk) {
                        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
                    }
                    return btoa(binary);
                } catch (e) {
                    return null;
                }
            }''',
            {'url': src},
        )
        if result:
            destination.write_bytes(base64.b64decode(result))
            return True
    except Exception as exc:
        print(f'WARNING: could not save logo {filename}: {exc}')

    return False


def get_standings():
    teams = load_teams()
    warnings = []
    standings = []

    print('Opening Flashscore...')

    with sync_playwright() as p:
        chromium_path = shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
        launch_kwargs = {'headless': True}
        if chromium_path:
            launch_kwargs['executable_path'] = chromium_path
            print(f'Using Chromium: {chromium_path}')
        browser = p.chromium.launch(**launch_kwargs)
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            locale='fr-FR',
            user_agent=(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/143.0.0.0 Safari/537.36'
            ),
        )
        page = context.new_page()

        try:
            page.goto(FLASHSCORE_URL, wait_until='domcontentloaded', timeout=60000)
            page.wait_for_timeout(7000)

            # Accept common cookie banners.
            for selector in [
                '#onetrust-accept-btn-handler',
                'button[id*="accept"]',
                'button:has-text("Accept")',
                'button:has-text("Accepter")',
            ]:
                try:
                    loc = page.locator(selector)
                    if loc.count():
                        loc.first.click(timeout=2000)
                        page.wait_for_timeout(700)
                        break
                except Exception:
                    pass

            # Current + legacy Flashscore row selectors.
            selectors = [
                'div.ui-table__row',
                'div[class*="table__row"]',
                'div[class*="tableRow"]',
                '[data-testid*="table-row"]',
            ]

            rows = []
            for selector in selectors:
                try:
                    candidates = page.locator(selector).all()
                    if len(candidates) >= 16:
                        rows = candidates
                        print(f'Found {len(rows)} standings rows with: {selector}')
                        break
                except Exception:
                    continue

            if not rows:
                raise RuntimeError('Impossible de trouver le classement Flashscore.')

            for row in rows:
                if len(standings) >= 16:
                    break

                try:
                    flashscore_name = extract_team_name(row)
                    if not flashscore_name:
                        continue

                    values = extract_value_cells(row)
                    played = extract_number(values[0]) if values else None
                    points = extract_number(values[-1]) if values else None

                    if played is None or points is None:
                        warnings.append(f'Could not read MJ/PTS for {flashscore_name}: {values}')
                        continue

                    rank = len(standings) + 1
                    key, team_data = match_team(flashscore_name, teams)

                    if team_data:
                        arabic = team_data['arabic']
                        logo_name = team_data.get('logo')
                    else:
                        arabic = flashscore_name
                        logo_name = None
                        warnings.append(f'No teams.json match for: {flashscore_name} (rank {rank})')

                    logo_src = extract_logo_src(row, page)
                    logo_saved = False
                    if logo_name and logo_src:
                        logo_saved = save_logo_from_page(page, logo_src, logo_name)

                    standings.append({
                        'rank': rank,
                        'team': flashscore_name,
                        'arabic': arabic,
                        'logo': logo_name if logo_saved else None,
                        'logo_src': logo_src,
                        'played': played,
                        'points': points,
                    })

                except Exception as exc:
                    warnings.append(f'Skipped row: {exc}')

        except PlaywrightTimeoutError:
            raise RuntimeError('Flashscore a mis trop de temps à répondre.')
        finally:
            context.close()
            browser.close()

    if warnings:
        print('\nWARNINGS:')
        for item in warnings:
            print(' -', item)

    return standings
