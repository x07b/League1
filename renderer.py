from html import escape
from config import BASE_DIR, INDEX_FILE, MOBILE_INDEX_FILE, ROW_Y, RIGHT, LEFT


def rank_class(rank):
    if rank in (1, 2):
        return 'rank gold'
    if rank == 3:
        return 'rank grey'
    if rank >= 14:
        return 'rank danger'
    return 'rank'


def local_logo(filename):
    if not filename:
        return None
    path = BASE_DIR / 'assets' / 'logos' / filename
    if path.exists() and path.stat().st_size > 0:
        return 'assets/logos/' + filename
    return None


def logo_markup(team):
    # Prefer the downloaded local logo; otherwise use Flashscore's URL.
    logo_src = local_logo(team.get('logo')) or team.get('logo_src') or ''
    if not logo_src:
        return ''
    return (
        f'<img src="{escape(logo_src, quote=True)}" '
        f'alt="" class="team-logo" loading="eager" decoding="async">'
    )


def row_right(team, y):
    """Ranks 1-8. Visual order: MJ | PTS | ÉQUIPE | LOGO | RANG."""
    return f'''
      <div class="dynamic-row row-right" style="top:{y}px;">
        <div class="cell played" style="left:{RIGHT['played_x']}px;">{escape(str(team['played']))}</div>
        <div class="cell points" style="left:{RIGHT['points_x']}px;">{escape(str(team['points']))}</div>
        <div class="cell team-name" style="left:{RIGHT['team_x']}px;width:{RIGHT['team_width']}px;">{escape(team['arabic'])}</div>
        <div class="cell leftforlogo logo">{logo_markup(team)}</div>
        <div class="cell {rank_class(int(team['rank']))}" style="left:{RIGHT['rank_x']}px;">{int(team['rank'])}</div>
      </div>'''


def row_left(team, y):
    """Ranks 9-16. EXACT same visual order as the right table: MJ | PTS | ÉQUIPE | LOGO | RANG."""
    return f'''
      <div class="dynamic-row row-left" style="top:{y}px;">
        <div class="cell played" style="left:{LEFT['played_x']}px;">{escape(str(team['played']))}</div>
        <div class="cell points" style="left:{LEFT['points_x']}px;">{escape(str(team['points']))}</div>
        <div class="cell team-name" style="left:{LEFT['team_x']}px;width:{LEFT['team_width']}px;">{escape(team['arabic'])}</div>
        <div class="cell rightforlogo logo">{logo_markup(team)}</div>
        <div class="cell {rank_class(int(team['rank']))}" style="left:{LEFT['rank_x']}px;">{int(team['rank'])}</div>
      </div>'''


def rows_html(standings):
    parts = []
    for team in standings:
        rank = int(team['rank'])
        pos = rank if rank <= 8 else rank - 8
        y = ROW_Y[pos]
        parts.append(row_right(team, y) if rank <= 8 else row_left(team, y))
    return ''.join(parts)


def mobile_rows_html(standings):
    parts = []
    for team in standings:
        logo = logo_markup(team)
        parts.append(f'''
      <div class="mobile-row">
        <div class="mobile-rank {rank_class(int(team['rank']))}">{int(team['rank'])}</div>
        <div class="mobile-logo">{logo}</div>
        <div class="mobile-team">{escape(team['arabic'])}</div>
        <div class="mobile-stat">{escape(str(team['points']))}</div>
        <div class="mobile-stat">{escape(str(team['played']))}</div>
      </div>''')
    return ''.join(parts)


def build_index(standings):
    dynamic = rows_html(standings)
    return f'''<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LA ANT MATCH — ترتيب</title>
  <link rel="stylesheet" href="style.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@100..900&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
  <script src="drive-api.js"></script>
</head>
<body>
<button id="updateBtn" class="export-btn update-btn" type="button">
    <span class="export-icon">↻</span>
    <span>UPDATE</span>
</button>
<button id="exportBtn" class="export-btn" type="button">
    <span class="export-icon">↓</span>
    <span>EXPORT</span>
</button>
<button id="flashscoreBtn" class="export-btn flashscore-btn" type="button">
    <span class="export-icon">↗</span>
    <span>FLASHSCORE</span>
</button>
<button id="editAssetsBtn" class="export-btn edit-assets-btn" type="button">
    <span class="export-icon">✎</span>
    <span>EDIT</span>
</button>
<button id="mobileBtn" class="export-btn mobile-btn" type="button">
    <span class="export-icon">▣</span>
    <span>MOBILE</span>
</button>
<div id="updateNotice" class="update-notice" role="status" aria-live="polite"></div>
<section id="exportOptions" class="export-options" hidden>
  <button id="closeExportOptions" class="export-options-close" type="button">×</button>
  <strong>EXPORT OPTIONS</strong>
  <button id="exportFullBtn" type="button">FULL TABLE</button>
  <label for="exportRowCount">NUMBER OF ROWS</label>
  <input id="exportRowCount" type="number" min="1" max="16" value="4">
  <button id="exportCustomBtn" type="button">EXPORT ROWS</button>
</section>
<section id="assetPanel" class="asset-panel" hidden>
  <button id="closeAssetPanel" class="asset-panel-close" type="button">×</button>
  <strong>UPLOAD ASSET</strong>
  <label for="hashtagText">Hashtag</label>
  <input id="hashtagText" type="text" value="#الرابطة_المحترفة_الأولى" dir="rtl">
  <label for="assetFolder">Folder</label>
  <select id="assetFolder">
    <option value="background">background</option>
    <option value="branding">branding</option>
    <option value="competition">competition</option>
    <option value="cup">cup</option>
    <option value="teams">teams</option>
  </select>
  <select id="teamTarget" hidden></select>
  <input id="assetFile" type="file" accept="image/*">
  <button id="uploadAssetBtn" type="button">UPLOAD</button>
</section>
  <main class="board">
    <img class="background" src="assets/background.png" alt="">
    <img class="cup" src="assets/cup.png" alt="">
    <img class="shadow-overlay" src="assets/shadow.png" alt="" aria-hidden="true">
    <img class="laant-logo" src="assets/logo.png" alt="LA ANT MATCH">
    <img class="ligue-live" src="assets/ligue live DS.png" alt="">

    <section class="competition">
      <div class="hashtag">#الرابطة_المحترفة_الأولى</div>
      <img src="./assets/tartib.png" alt="ترتيب" class="competition-logo">
    </section>

    <!-- BOTH tables use EXACTLY the same left-to-right order:
         MJ | PTS | NOM ÉQUIPE | LOGO | RANG. -->
    <section class="table table-left">
      <div class="headers headers-left">
        <span>لعب</span><span>نقاط</span>
      </div>
    </section>

    <section class="table table-right">
      <div class="headers headers-right">
        <span>لعب</span><span>نقاط</span>
      </div>
    </section>

    <div class="divider"></div>
    <section class="dynamic-data">{dynamic}
    </section>
  </main>
  <script type="module" src="script.js?v=mobile-navigation"></script>
</body>
</html>
'''


def write_index(standings):
    INDEX_FILE.write_text(build_index(standings), encoding='utf-8')
    print(f'index.html generated: {INDEX_FILE}')
    MOBILE_INDEX_FILE.write_text(build_mobile_index(standings), encoding='utf-8')
    print(f'mobile-index.html generated: {MOBILE_INDEX_FILE}')


def build_mobile_index(standings):
    return f'''<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LA ANT MATCH — ترتيب</title>
  <link rel="stylesheet" href="mobile-style.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@100..900&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
</head>
<body>
  <nav class="mobile-controls" aria-label="Board controls">
    <button id="mobileUpdateBtn" type="button"><span>↻</span><strong>UPDATE</strong></button>
    <button id="mobileExportBtn" type="button"><span>↓</span><strong>EXPORT</strong></button>
    <button id="desktopBtn" type="button"><span>▣</span><strong>DESKTOP</strong></button>
    <button id="mobileFlashscoreBtn" type="button"><span>↗</span><strong>FLASHSCORE</strong></button>
    <button id="mobileEditBtn" type="button"><span>✎</span><strong>EDIT</strong></button>
  </nav>
  <section id="mobileAssetPanel" class="mobile-asset-panel" hidden>
    <button id="mobileAssetClose" type="button" aria-label="Close">×</button>
    <strong>EDIT MOBILE ASSETS</strong>
    <label for="mobileHashtagText">Hashtag</label>
    <input id="mobileHashtagText" type="text" value="#الرابطة_المحترفة_الأولى" dir="rtl">
    <label for="mobileAssetFolder">Asset</label>
    <select id="mobileAssetFolder">
      <option value="background">background</option>
      <option value="mobile-branding">Ligue 1 logo</option>
      <option value="competition">competition</option>
      <option value="cup">cup</option>
      <option value="mobile-banner">Bottom banner</option>
      <option value="teams">teams</option>
    </select>
    <select id="mobileTeamTarget" hidden></select>
    <input id="mobileAssetFile" type="file" accept="image/*">
    <button id="mobileAssetUpload" type="button">UPLOAD</button>
    <span id="mobileAssetStatus" role="status"></span>
  </section>
  <main class="mobile-board">
    <img class="mobile-background" src="assets/background.png" alt="">
    <img class="mobile-shadow" src="assets/shadow.png" alt="" aria-hidden="true">
    <img class="mobile-cup" src="assets/cup.png" alt="" aria-hidden="true">
    <img class="mobile-banner" src="assets/mobile-banner.png" alt="" aria-hidden="true">
    <header class="mobile-header">
      <img class="mobile-live-brand" src="assets/ligue live DS.png" alt="Ligue 1 Diwan Sport">
      <div class="mobile-heading">
        <div class="mobile-hashtag">#الرابطة_المحترفة_الأولى</div>
        <img src="assets/tartib.png" alt="ترتيب" class="mobile-title">
      </div>
    </header>
    <section class="mobile-ranking">
      <div class="mobile-columns">
        <span></span><span></span><span></span><span>نقاط</span><span>لعب</span>
      </div>
      <div id="mobileRows">{mobile_rows_html(standings)}</div>
    </section>
  </main>
  <div id="mobileNotice" role="status" aria-live="polite"></div>
  <script>
    (() => {{
      const rows = document.getElementById("mobileRows");
      const notice = document.getElementById("mobileNotice");
      const flashscoreUrl = "https://www.flashscore.fr/classement/6RacM8Ea/G4Jhegue/#/G4Jhegue/classements/global/";
      const updateUrl = location.port === "8000" ? "/api/update" : "http://127.0.0.1:8000/api/update";
      const assetDatabase = "la-ant-match-assets";
      const assetStore = "images";
      const board = document.querySelector(".mobile-board");
      const assetPanel = document.getElementById("mobileAssetPanel");
      const assetFolder = document.getElementById("mobileAssetFolder");
      const teamTarget = document.getElementById("mobileTeamTarget");
      const assetFile = document.getElementById("mobileAssetFile");
      const assetUpload = document.getElementById("mobileAssetUpload");
      const assetStatus = document.getElementById("mobileAssetStatus");
      const mobileHashtag = document.querySelector(".mobile-hashtag");
      const mobileHashtagText = document.getElementById("mobileHashtagText");
      document.addEventListener("wheel", event => {{
        if (event.ctrlKey || event.metaKey) event.preventDefault();
      }}, {{ passive: false }});
      ["gesturestart", "gesturechange", "gestureend"].forEach(type =>
        document.addEventListener(type, event => event.preventDefault(), {{ passive: false }})
      );
      document.addEventListener("keydown", event => {{
        if ((event.ctrlKey || event.metaKey) && ["+", "=", "-", "_", "0"].includes(event.key)) {{
          event.preventDefault();
        }}
      }});
      document.addEventListener("contextmenu", event => {{
        if (event.target.closest(".mobile-board, .mobile-board img")) event.preventDefault();
      }});
      document.querySelectorAll(".mobile-board img").forEach(image =>
        image.addEventListener("dragstart", event => event.preventDefault())
      );
      function resize() {{
        const scale = Math.min(window.innerWidth / 1080, window.innerHeight / 1350);
        document.documentElement.style.setProperty("--mobile-scale", Math.max(scale, 0.1));
      }}
      function showNotice(message, isError = false) {{
        notice.textContent = message;
        notice.classList.toggle("error", isError);
        notice.classList.add("visible");
        window.clearTimeout(showNotice.timer);
        showNotice.timer = window.setTimeout(() => {{
          notice.classList.remove("visible");
          notice.classList.remove("error");
        }}, 2600);
      }}
      async function update() {{
        const button = document.getElementById("mobileUpdateBtn");
        button.disabled = true;
        try {{
          if (window.opener && !window.opener.closed && typeof window.opener.updateDesktopRanking === "function") {{
            window.opener.updateDesktopRanking();
          }}
          const controller = new AbortController();
          const timeout = window.setTimeout(() => controller.abort(), 90000);
          let response;
          try {{
            response = await fetch(updateUrl, {{ method: "POST", signal: controller.signal }});
          }} finally {{
            window.clearTimeout(timeout);
          }}
          const payload = await response.json();
          if (!response.ok || !payload.mobileRows) throw new Error(payload.error || "Update payload is missing mobile rows");
          rows.innerHTML = payload.mobileRows;
          await restoreAssets();
          showNotice("UPDATED");
        }} catch (error) {{
          console.error(error);
          showNotice("UPDATE SERVER OFFLINE", true);
        }} finally {{
          button.disabled = false;
        }}
      }}
      async function exportBoard() {{
        const button = document.getElementById("mobileExportBtn");
        button.disabled = true;
        showNotice("EXPORTING...");
        await new Promise(resolve => requestAnimationFrame(resolve));
        let clone;
        try {{
          if (!window.html2canvas) throw new Error("Export library unavailable");
          await waitForImages(board);
          await waitForFonts();
          clone = board.cloneNode(true);
          clone.classList.add("mobile-export-clone");
          Object.assign(clone.style, {{
            width: "1080px", height: "1350px", position: "absolute",
            left: "0", top: "0", margin: "0", transform: "none",
            zIndex: "-9999"
          }});
          document.body.appendChild(clone);
          await waitForImages(clone);
          const canvas = await window.html2canvas(clone, {{
            width: 1080,
            height: 1350,
            scale: 1,
            backgroundColor: "#031a3a",
            useCORS: true,
            logging: false
          }});
          const link = document.createElement("a");
          link.download = "la-ant-match-mobile-1080x1350.png";
          link.href = canvas.toDataURL("image/png");
          link.click();
          const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
          if (!blob) throw new Error("Could not create PNG blob");
          window.driveStorageApi?.uploadExport(blob, link.download, 1080, 1350, "mobile").catch(error =>
            console.error("Mobile Drive export upload failed:", error)
          );
          showNotice("EXPORTED");
        }} catch (error) {{
          console.error("Mobile export failed:", error);
          showNotice("EXPORT FAILED", true);
        }} finally {{
          if (clone) clone.remove();
          button.disabled = false;
        }}
      }}
      function openDatabase() {{
        return new Promise((resolve, reject) => {{
          const request = indexedDB.open(assetDatabase, 1);
          request.onupgradeneeded = () => request.result.createObjectStore(assetStore);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        }});
      }}
      async function saveAsset(key, value) {{
        const db = await openDatabase();
        await new Promise((resolve, reject) => {{
          const tx = db.transaction(assetStore, "readwrite");
          tx.objectStore(assetStore).put(value, key);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        }});
        db.close();
      }}
      async function loadAsset(key) {{
        const db = await openDatabase();
        const value = await new Promise((resolve, reject) => {{
          const request = db.transaction(assetStore, "readonly").objectStore(assetStore).get(key);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        }});
        db.close();
        return value;
      }}
      async function restoreMobileHashtag() {{
        const value = await loadAsset("mobile-hashtag");
        if (typeof value === "string") {{
          mobileHashtag.textContent = value;
          mobileHashtagText.value = value;
        }}
      }}
      function mobileImageFor(key) {{
        if (key.startsWith("teams-")) return rows.querySelectorAll(".mobile-row")[Number(key.slice(6))]?.querySelector(".team-logo");
        return document.querySelector({{background: ".mobile-background", "mobile-branding": ".mobile-live-brand",
          competition: ".mobile-title", cup: ".mobile-cup", "mobile-banner": ".mobile-banner"}}[key]);
      }}
      async function restoreAssets() {{
        for (const key of ["background", "mobile-branding", "competition", "cup", "mobile-banner"]) {{
          const value = await loadAsset(key);
          const image = mobileImageFor(key);
          if (value && image) image.src = typeof value === "string" ? value : URL.createObjectURL(value);
        }}
        const teamImages = rows.querySelectorAll(".mobile-row .team-logo");
        for (let index = 0; index < teamImages.length; index += 1) {{
          const value = await loadAsset(`teams-${{index}}`);
          if (value) teamImages[index].src = typeof value === "string"
            ? value
            : URL.createObjectURL(value);
        }}
      }}
      function refreshTeamTargets() {{
        teamTarget.innerHTML = [...rows.querySelectorAll(".mobile-row")].map((row, index) =>
          `<option value="${{index}}">Line ${{index + 1}} — ${{row.querySelector(".mobile-team")?.textContent.trim() || "Team"}}</option>`
        ).join("");
      }}
      assetFolder.addEventListener("change", () => {{
        teamTarget.hidden = assetFolder.value !== "teams";
        if (assetFolder.value === "teams") refreshTeamTargets();
      }});
      mobileHashtagText.addEventListener("input", () => {{
        mobileHashtag.textContent = mobileHashtagText.value;
        saveAsset("mobile-hashtag", mobileHashtagText.value).catch(error =>
          console.error("Could not save mobile hashtag:", error)
        );
      }});
      assetUpload.addEventListener("click", async () => {{
        const file = assetFile.files[0];
        if (!file) {{ assetStatus.textContent = "SELECT AN IMAGE"; showNotice("SELECT AN IMAGE", true); return; }}
        const key = assetFolder.value === "teams" ? `teams-${{Number(teamTarget.value)}}` : assetFolder.value;
        const image = mobileImageFor(key);
        assetUpload.disabled = true;
        try {{
          if (image) image.src = URL.createObjectURL(file);
          await saveAsset(key, file);
          const driveFolder = ["mobile-branding", "mobile-banner"].includes(assetFolder.value)
            ? "branding"
            : assetFolder.value;
          if (window.driveStorageApi) await window.driveStorageApi.uploadAsset(file, driveFolder, {{mobile: true}});
          assetStatus.textContent = "IMAGE SAVED";
          showNotice("IMAGE SAVED");
          assetFile.value = "";
        }} catch (error) {{
          console.error("Mobile asset update failed:", error);
          assetStatus.textContent = "UPLOAD FAILED";
          showNotice("UPLOAD FAILED", true);
        }} finally {{ assetUpload.disabled = false; }}
      }});
      document.getElementById("mobileUpdateBtn").addEventListener("click", update);
      document.getElementById("mobileExportBtn").addEventListener("click", exportBoard);
      document.getElementById("desktopBtn").addEventListener("click", () => window.location.href = "index.html");
      document.getElementById("mobileFlashscoreBtn").addEventListener("click", () => window.open(flashscoreUrl, "_blank", "noopener,noreferrer"));
      document.getElementById("mobileEditBtn").addEventListener("click", () => {{
        assetPanel.hidden = false;
        mobileHashtagText.value = mobileHashtag.textContent.trim();
        teamTarget.hidden = assetFolder.value !== "teams";
        if (assetFolder.value === "teams") refreshTeamTargets();
      }});
      document.getElementById("mobileAssetClose").addEventListener("click", () => assetPanel.hidden = true);
      function waitForImages(root) {{
        return Promise.all([...root.querySelectorAll("img")].map(image => image.complete
          ? Promise.resolve() : new Promise(resolve => {{
            image.addEventListener("load", resolve, {{ once: true }});
            image.addEventListener("error", resolve, {{ once: true }});
          }})));
      }}
      async function waitForFonts() {{
        if (document.fonts?.ready) await document.fonts.ready;
      }}
      restoreAssets().catch(error => console.error("Could not restore mobile assets:", error));
      restoreMobileHashtag().catch(error => console.error("Could not restore mobile hashtag:", error));
      resize();
      window.addEventListener("resize", resize);
      window.updateMobileRanking = update;
    }})();
  </script>
</body>
</html>
'''
