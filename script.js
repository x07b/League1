import { uploadToDrive } from "./drive-api.js";
const $ = (id) => document.getElementById(id);
const mobile = !!document.querySelector(".mobile-board");
const board = document.querySelector(mobile ? ".mobile-board" : ".board");
const container = mobile
  ? $("mobileRows")
  : document.querySelector(".dynamic-data");
const rowSelector = mobile ? ".mobile-row" : ".dynamic-row";
const nameSelector = mobile ? ".mobile-team" : ".team-name";
const hashtag = board.querySelector(mobile ? ".mobile-hashtag" : ".hashtag");
const templates = [...container.querySelectorAll(rowSelector)].map((el) =>
  el.cloneNode(true),
);
const defaultUrl =
  "https://www.flashscore.fr/classement/6RacM8Ea/G4Jhegue/#/G4Jhegue/classements/global/";
let teams,
  current,
  settings = { url: defaultUrl, drive: false },
  token = "",
  exporting = false,
  updating = false;
let objectUrls = [];
const notices = new Map();
function toast(message, type = "success", id = "operation") {
  notices.get(id)?.remove();
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.setAttribute("role", type === "error" ? "alert" : "status");
  const icon = document.createElement("b");
  icon.textContent = { success: "✓", error: "!", warning: "△", loading: "◌" }[
    type
  ];
  icon.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.dir = "auto";
  text.textContent = message;
  const dismiss = document.createElement("button");
  dismiss.textContent = "×";
  dismiss.setAttribute("aria-label", "Dismiss notification");
  dismiss.onclick = () => node.remove();
  node.append(icon, text, dismiss);
  (document.querySelector("dialog[open]") || $("notices")).append(node);
  notices.set(id, node);
  if (type !== "loading")
    setTimeout(
      () => {
        node.remove();
        if (notices.get(id) === node) notices.delete(id);
      },
      type === "success" ? 4500 : 16000,
    );
}
function resize() {
  const stage = $("boardStage");
  const reserve = 88;
  stage.style.height = `${Math.max(240, innerHeight - document.querySelector(".app-header").offsetHeight - reserve)}px`;
  const scale = Math.min(
    stage.clientWidth / (mobile ? 1080 : 1920),
    stage.clientHeight / (mobile ? 1350 : 1080),
  );
  board.style.setProperty(mobile ? "--mobile-scale" : "--board-scale", scale);
}
new ResizeObserver(resize).observe(document.querySelector(".app-header"));
addEventListener("resize", resize);
resize();
function openDialog(id) {
  $(id).showModal();
}
for (const button of document.querySelectorAll("[data-close]"))
  button.onclick = () => button.closest("dialog").close();
function openSettings() {
  $("sourceUrl").value = settings.url;
  $("editorToken").value = token;
  $("driveEnabled").checked = settings.drive;
  $("openSource").href = settings.url;
  openDialog("settingsDialog");
}
$("settingsBtn").onclick = openSettings;
$("flashscoreBtn").onclick = () => {
  window.open(settings.url, "_blank", "noopener,noreferrer");
};
$("settingsForm").onsubmit = async (event) => {
  event.preventDefault();
  try {
    const url = Standings.sourceUrl($("sourceUrl").value);
    const changed = url !== settings.url;
    settings = { url, drive: $("driveEnabled").checked };
    token = $("editorToken").value;
    localStorage.setItem("la-ant-settings", JSON.stringify(settings));
    sessionStorage.setItem("la-ant-token", token);
    $("settingsDialog").close();
    toast("Settings saved successfully.");
    if (changed) {
      toast(
        "Source changed. Current board is kept until a valid update succeeds.",
        "warning",
        "source",
      );
      await loadSnapshot();
    }
  } catch (error) {
    toast(error.message, "error");
  }
};
const dbPromise = new Promise((resolve, reject) => {
  const req = indexedDB.open("la-ant-match-assets", 1);
  req.onupgradeneeded = () => req.result.createObjectStore("images");
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
async function asset(key, value) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      "images",
      value === undefined ? "readonly" : "readwrite",
    );
    const store = tx.objectStore("images");
    const req = value === undefined ? store.get(key) : store.put(value, key);
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || new Error("Storage transaction aborted."));
  });
}
const assetSelectors = mobile
  ? {
      background: ".mobile-background",
      branding: ".mobile-live-brand",
      competition: ".mobile-title",
      cup: ".mobile-cup",
      banner: ".mobile-banner",
    }
  : {
      background: ".background",
      branding: ".laant-logo",
      competition: ".competition-logo",
      cup: ".cup",
    };
const assetKey = (kind) =>
  ["branding", "banner"].includes(kind) && mobile ? `mobile-${kind}` : kind;
async function restoreAssets(root = board, rows = current?.standings) {
  const nextUrls = [];
  const apply = (img, value) => {
    if (!img || !value) return;
    if (value instanceof Blob) {
      const url = URL.createObjectURL(value);
      nextUrls.push(url);
      img.src = url;
    } else if (typeof value === "string" && /^https:\/\//.test(value)) {
      img.crossOrigin = "anonymous";
      img.src = value;
    }
  };
  try {
    for (const [kind, selector] of Object.entries(assetSelectors))
      apply(root.querySelector(selector), await asset(assetKey(kind)));
    const images = root.querySelectorAll(`${rowSelector} .team-logo`);
    for (let i = 0; i < images.length; i++)
      if (rows?.[i]) apply(images[i], await asset(`team:${rows[i].key}`));
    const text = await asset(mobile ? "mobile-hashtag" : "hashtag");
    if (typeof text === "string")
      root.querySelector(mobile ? ".mobile-hashtag" : ".hashtag").textContent =
        text;
  } catch {
    toast(
      "Browser storage is unavailable. Changes may not survive refresh.",
      "warning",
      "storage",
    );
  }
  return nextUrls;
}
async function waitImages(root) {
  await Promise.all(
    [...root.querySelectorAll("img")].map(async (img) => {
      if (!img.complete)
        await new Promise((resolve, reject) => {
          const done = () => {
            clearTimeout(timer);
            img.removeEventListener("load", loaded);
            img.removeEventListener("error", failed);
          };
          const loaded = () => {
            done();
            resolve();
          };
          const failed = () => {
            done();
            reject(
              new Error(
                "An image could not load. Export cancelled to avoid missing artwork.",
              ),
            );
          };
          const timer = setTimeout(failed, 15000);
          img.addEventListener("load", loaded, { once: true });
          img.addEventListener("error", failed, { once: true });
        });
      if (!img.naturalWidth)
        throw new Error("An image is missing. The previous board is kept.");
      await img.decode();
    }),
  );
}
function timestamp() {
  $("lastUpdated").textContent = current?.manual
    ? "Manual edits · saved on this browser"
    : current?.updatedAt
      ? `Updated ${new Date(current.updatedAt).toLocaleString()}`
      : "Saved board · date unknown";
}
function snapshotKey() {
  return `la-ant-snapshot:${settings.url}`;
}
async function applySnapshot(payload, persist = true) {
  const standings = Standings.validate(payload.standings, teams);
  const fragment = document.createDocumentFragment();
  standings.forEach((team, i) => {
    const row = templates[i].cloneNode(true);
    row.dataset.team = team.key;
    row.querySelector(nameSelector).textContent = team.arabic;
    row.querySelector(".team-logo").src = `assets/logos/${team.logo}`;
    if (mobile) {
      const stats = row.querySelectorAll(".mobile-stat");
      stats[0].textContent = team.points;
      stats[1].textContent = team.played;
    } else {
      row.querySelector(".played").textContent = team.played;
      row.querySelector(".points").textContent = team.points;
    }
    fragment.append(row);
  });
  // Validate resources before replacing any visible rows.
  await waitImages(fragment);
  const next = { ...payload, standings };
  if (persist) {
    try {
      localStorage.setItem(snapshotKey(), JSON.stringify(next));
    } catch {
      toast(
        "Standings loaded, but browser storage is full.",
        "warning",
        "storage",
      );
    }
  }
  container.replaceChildren(fragment);
  current = next;
  const old = objectUrls;
  objectUrls = await restoreAssets();
  old.forEach(URL.revokeObjectURL);
  timestamp();
}
async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    signal: AbortSignal.timeout(55000),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Server returned an invalid response.");
  }
  if (!response.ok) throw new Error(result.error || "Server request failed.");
  return result;
}
async function loadSnapshot() {
  let local;
  try {
    local = JSON.parse(localStorage.getItem(snapshotKey()) || "null");
    if (local) await applySnapshot(local, false);
  } catch {
    toast("Could not restore the saved standings.", "warning", "storage");
  }
  try {
    const saved = await request(
      `/api/standings?url=${encodeURIComponent(settings.url)}`,
    );
    if (
      !saved.seed &&
      (!local ||
        (!local.manual &&
          Date.parse(saved.updatedAt) > Date.parse(local.updatedAt || 0)))
    )
      await applySnapshot(saved);
    if (
      !current.updatedAt ||
      Date.now() - Date.parse(current.updatedAt) > 86400000
    )
      toast(
        saved.updateMode === "local"
          ? "Saved standings may be outdated. Click UPDATE to fetch Flashscore."
          : "Data may be outdated. Use UPDATE when the live source is configured.",
        "warning",
        "stale",
      );
  } catch (error) {
    toast(error.message, "warning", "connection");
  }
}
$("updateBtn").onclick = async () => {
  if (updating || !teams) return;
  updating = true;
  $("updateBtn").disabled = true;
  $("updateBtn").setAttribute("aria-busy", "true");
  toast("Fetching Flashscore standings…", "loading", "update");
  try {
    const payload = await request("/api/update", {
      method: "POST",
      body: JSON.stringify({ url: settings.url }),
    });
    toast("Processing team data…", "loading", "update");
    await applySnapshot(payload);
    notices.get("stale")?.remove();
    notices.delete("stale");
    toast("Standings updated successfully.", "success", "update");
  } catch (error) {
    toast(
      error.name === "TimeoutError"
        ? "Update timed out. Previous standings kept."
        : error.message,
      "error",
      "update",
    );
  } finally {
    updating = false;
    $("updateBtn").disabled = false;
    $("updateBtn").removeAttribute("aria-busy");
  }
};
$("editBtn").onclick = () => {
  if (!current) return;
  $("hashtagText").value = hashtag.textContent;
  $("teamTarget").replaceChildren();
  $("editRows").replaceChildren();
  current.standings.forEach((team) => {
    const option = new Option(team.arabic, team.key);
    $("teamTarget").add(option);
    const tr = document.createElement("tr");
    tr.dataset.key = team.key;
    const name = document.createElement("td");
    name.textContent = team.arabic;
    tr.append(name);
    for (const field of ["rank", "played", "points"]) {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number";
      input.required = true;
      input.value = team[field];
      input.name = field;
      input.step = 1;
      input.setAttribute("aria-label", `${team.arabic} ${field}`);
      td.append(input);
      tr.append(td);
    }
    $("editRows").append(tr);
  });
  openDialog("editDialog");
};
$("standingsForm").onsubmit = async (event) => {
  event.preventDefault();
  try {
    const standings = [...$("editRows").children].map((tr) => ({
      key: tr.dataset.key,
      ...Object.fromEntries(
        [...tr.querySelectorAll("input")].map((input) => [
          input.name,
          Number(input.value),
        ]),
      ),
    }));
    await applySnapshot({
      ...current,
      standings,
      manual: true,
      editedAt: new Date().toISOString(),
    });
    $("editDialog").close();
    toast("Standings saved successfully on this browser.");
  } catch (error) {
    toast(error.message, "error");
  }
};
let hashtagTimer;
$("hashtagText").oninput = () => {
  clearTimeout(hashtagTimer);
  const text = $("hashtagText").value;
  hashtag.textContent = text;
  hashtagTimer = setTimeout(
    () =>
      asset(mobile ? "mobile-hashtag" : "hashtag", text).catch(() =>
        toast("Hashtag could not be saved.", "error"),
      ),
    300,
  );
};
$("assetFolder").onchange = () => {
  $("teamTargetLabel").hidden = $("assetFolder").value !== "team";
};
async function driveUpload(blob, name, folder, metadata) {
  if (!settings.drive) return;
  toast("Uploading to Google Drive…", "loading", "drive");
  try {
    await uploadToDrive(blob, name, folder, metadata, token);
    toast("Google Drive upload confirmed.", "success", "drive");
  } catch (error) {
    toast(`${error.message} Local copy kept.`, "warning", "drive");
  }
}
$("assetForm").onsubmit = async (event) => {
  event.preventDefault();
  const file = $("assetFile").files[0];
  if (!file) {
    toast("Select an image first.", "error");
    return;
  }
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 12000000) {
    toast("Choose PNG, JPEG, WebP or GIF up to 12 MB.", "error");
    return;
  }
  $("saveAsset").disabled = true;
  try {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.width * image.height > 40000000)
        throw new Error("Image exceeds 40 megapixels.");
    } finally {
      URL.revokeObjectURL(url);
    }
    const kind = $("assetFolder").value;
    const key =
      kind === "team" ? `team:${$("teamTarget").value}` : assetKey(kind);
    await asset(key, file);
    const old = objectUrls;
    objectUrls = await restoreAssets();
    old.forEach(URL.revokeObjectURL);
    $("assetFile").value = "";
    toast("Image saved successfully on this browser.");
    await driveUpload(
      file,
      file.name,
      `assets/${kind === "team" ? "teams" : ["banner", "branding"].includes(kind) ? "branding" : kind}`,
      { team: kind === "team" ? $("teamTarget").value : undefined },
    );
  } catch (error) {
    toast(error.message, "error");
  } finally {
    $("saveAsset").disabled = false;
  }
};
let canvasLibrary;
function loadCanvas() {
  if (!canvasLibrary)
    canvasLibrary = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "vendor/html2canvas.min.js";
      script.onload = resolve;
      script.onerror = () => {
        canvasLibrary = null;
        script.remove();
        reject(new Error("Export library could not load."));
      };
      document.head.append(script);
    });
  return canvasLibrary;
}
$("exportBtn").onclick = () => openDialog("exportDialog");
$("exportFull").onclick = () => exportBoard();
$("exportCustom").onclick = () => exportBoard(Number($("exportCount").value));
async function exportBoard(count = 16) {
  if (exporting) return;
  if (!Number.isInteger(count) || count < 1 || count > 16) {
    toast("Enter a row count from 1 to 16.", "error");
    return;
  }
  exporting = true;
  $("exportBtn").disabled = true;
  $("exportDialog").close();
  toast("Generating image…", "loading", "export");
  let clone;
  try {
    await loadCanvas();
    await document.fonts.ready;
    await waitImages(board);
    clone = board.cloneNode(true);
    clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
    Object.assign(clone.style, {
      position: "absolute",
      left: "0",
      top: "0",
      transform: "none",
      margin: "0",
      zIndex: "-1",
    });
    // Freeze viewport-relative typography at the original 1920px design width.
    if (!mobile) clone.querySelector(".hashtag").style.fontSize = "19.2px";
    [...clone.querySelectorAll(rowSelector)]
      .slice(count)
      .forEach((row) => row.remove());
    if (!mobile && count <= 8) {
      clone.querySelector(".table-left")?.remove();
      clone.querySelector(".divider")?.remove();
    }
    document.body.append(clone);
    await waitImages(clone);
    const width = mobile ? 1080 : 1920,
      height = mobile ? 1350 : 1080;
    const canvas = await window.html2canvas(clone, {
      width,
      height,
      windowWidth: 1920,
      windowHeight: 1350,
      scrollX: 0,
      scrollY: 0,
      scale: 1,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#031a3a",
      logging: false,
      imageTimeout: 15000,
    });
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("PNG generation failed.");
    const filename = `LA_ANT_MATCH_${mobile ? "mobile_" : ""}${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    const link = document.createElement("a");
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 30000);
    toast("Image exported successfully.", "success", "export");
    await driveUpload(blob, filename, "exports", {
      width,
      height,
      board: mobile ? "mobile" : "desktop",
    });
  } catch (error) {
    toast(`Export failed: ${error.message}`, "error", "export");
  } finally {
    clone?.remove();
    exporting = false;
    $("exportBtn").disabled = false;
  }
}
async function init() {
  $("updateBtn").disabled = true;
  $("editBtn").disabled = true;
  try {
    try {
      settings = {
        ...settings,
        ...JSON.parse(localStorage.getItem("la-ant-settings") || "{}"),
      };
      settings.url = Standings.sourceUrl(settings.url);
      token = sessionStorage.getItem("la-ant-token") || "";
    } catch {
      settings = { url: defaultUrl, drive: false };
    }
    const responses = await Promise.all([
      fetch("teams.json"),
      fetch("data/standings.json"),
    ]);
    if (responses.some((r) => !r.ok))
      throw new Error("Could not load team configuration.");
    [teams, current] = await Promise.all(responses.map((r) => r.json()));
    current.standings = Standings.validate(current.standings, teams);
    // Migrate old rank-indexed uploads once to stable team identities.
    try {
      if (!(await asset("identity-migration-v2"))) {
        for (let i = 0; i < current.standings.length; i++) {
          const value = await asset(`teams-${i}`);
          if (value && !(await asset(`team:${current.standings[i].key}`)))
            await asset(`team:${current.standings[i].key}`, value);
        }
        await asset("identity-migration-v2", true);
      }
    } catch {
      toast("Legacy uploads could not be restored.", "warning", "storage");
    }
    objectUrls = await restoreAssets();
    await loadSnapshot();
    timestamp();
  } catch (error) {
    toast(error.message, "error", "init");
  } finally {
    $("updateBtn").disabled = !teams;
    $("editBtn").disabled = !teams;
  }
}
init();
