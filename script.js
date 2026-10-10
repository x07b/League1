import "./drive-api.js";

(() => {
  const btn = document.getElementById("exportBtn");
  const updateBtn = document.getElementById("updateBtn");
  const flashscoreBtn = document.getElementById("flashscoreBtn");
  const exportOptions = document.getElementById("exportOptions");
  const closeExportOptions = document.getElementById("closeExportOptions");
  const exportFullBtn = document.getElementById("exportFullBtn");
  const exportRowsBtn = document.getElementById("exportCustomBtn");
  const exportRowCount = document.getElementById("exportRowCount");
  const updateNotice = document.getElementById("updateNotice");
  const editAssetsBtn = document.getElementById("editAssetsBtn");
  const mobileBtn = document.getElementById("mobileBtn");
  const assetPanel = document.getElementById("assetPanel");
  const closeAssetPanel = document.getElementById("closeAssetPanel");
  const uploadAssetBtn = document.getElementById("uploadAssetBtn");
  const assetFile = document.getElementById("assetFile");
  const assetFolder = document.getElementById("assetFolder");
  const teamTarget = document.getElementById("teamTarget");
  const hashtag = document.querySelector(".hashtag");
  const hashtagText = document.getElementById("hashtagText");
  const assetDatabase = "la-ant-match-assets";
  const assetStore = "images";
  const board = document.querySelector(".board");
  const dynamicData = document.querySelector(".dynamic-data");
  const updateUrl = location.port === "8000"
    ? "/api/update"
    : "http://127.0.0.1:8000/api/update";
  const flashscoreUrl = "https://www.flashscore.fr/classement/6RacM8Ea/G4Jhegue/#/G4Jhegue/classements/global/";

  function resizeBoard() {
    const menuSpace = 110;
    const availableWidth = Math.max(window.innerWidth - menuSpace, 320);
    const scale = Math.min(availableWidth / 1920, window.innerHeight / 1080);
    board.style.setProperty("--board-scale", String(Math.max(scale, 0.1)));
  }

  resizeBoard();
  window.addEventListener("resize", resizeBoard);
  // Prevent browser zoom with Ctrl/Cmd + wheel, pinch and keyboard shortcuts.
  document.addEventListener("wheel", e => {
    if (e.ctrlKey || e.metaKey) e.preventDefault();
  }, { passive: false });

  ["gesturestart", "gesturechange", "gestureend"].forEach(type => {
    document.addEventListener(type, e => e.preventDefault(), { passive: false });
  });

  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && ["+", "=", "-", "_", "0"].includes(e.key)) {
      e.preventDefault();
    }
  });

  document.addEventListener("contextmenu", e => {
    if (e.target.closest(".board, .board img")) e.preventDefault();
  });

  document.querySelectorAll(".board img").forEach(image => {
    image.addEventListener("dragstart", e => e.preventDefault());
  });

  function waitForImages(root) {
    return Promise.all([...root.querySelectorAll("img")].map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    }));
  }

  async function waitForFonts() {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  }

  function openAssetDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(assetDatabase, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(assetStore);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveLocalAsset(key, file) {
    const db = await openAssetDatabase();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(assetStore, "readwrite");
      transaction.objectStore(assetStore).put(file, key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }

  async function loadLocalAsset(key) {
    const db = await openAssetDatabase();
    const file = await new Promise((resolve, reject) => {
      const transaction = db.transaction(assetStore, "readonly");
      const request = transaction.objectStore(assetStore).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return file;
  }

  async function restoreLocalAssets() {
    const savedHashtag = await loadLocalAsset("hashtag");
    if (savedHashtag) {
      hashtag.textContent = savedHashtag;
      hashtagText.value = savedHashtag;
    }
    const mappings = [
      ["background", ".background"],
      ["branding", ".laant-logo"],
      ["competition", ".competition-logo"],
      ["cup", ".cup"]
    ];
    for (const [key, selector] of mappings) {
      const file = await loadLocalAsset(key);
      if (file) document.querySelector(selector).src = typeof file === "string"
        ? file
        : URL.createObjectURL(file);
    }
    const rows = [...dynamicData.querySelectorAll(".dynamic-row")];
    for (let i = 0; i < rows.length; i += 1) {
      const file = await loadLocalAsset(`teams-${i}`);
      // Keep generated local logo paths; only persisted Drive URLs should
      // replace them during restoration.
      if (typeof file === "string") {
        rows[i].querySelector(".team-logo").src = file;
      }
    }
  }

  function showUpdateNotice(message, isError = false) {
    updateNotice.textContent = message;
    updateNotice.classList.toggle("error", isError);
    updateNotice.classList.add("visible");
    window.clearTimeout(showUpdateNotice.timer);
    showUpdateNotice.timer = window.setTimeout(() => {
      updateNotice.classList.remove("visible");
    }, 3000);
  }

  flashscoreBtn.addEventListener("click", () => {
    window.open(flashscoreUrl, "_blank", "noopener,noreferrer");
  });

  mobileBtn.addEventListener("click", () => {
    window.location.assign(new URL("mobile-index.html", window.location.href).href);
  });

  restoreLocalAssets().catch(err => console.error("Could not restore assets:", err));

  editAssetsBtn.addEventListener("click", () => {
    assetPanel.hidden = false;
    hashtagText.value = hashtag.textContent.trim();
    if (assetFolder.value === "teams") refreshTeamTargets();
  });

  closeAssetPanel.addEventListener("click", () => {
    assetPanel.hidden = true;
  });

  exportFullBtn.addEventListener("click", () => {
    exportOptions.hidden = true;
    exportBoard();
  });

  closeExportOptions.addEventListener("click", () => {
    exportOptions.hidden = true;
  });

  exportRowsBtn.addEventListener("click", () => {
    const total = dynamicData.querySelectorAll(".dynamic-row").length;
    const count = Number(exportRowCount.value);
    if (!Number.isInteger(count) || count < 1 || count > total) {
      showUpdateNotice(`ENTER 1-${total} ROWS`, true);
      return;
    }
    exportOptions.hidden = true;
    exportBoard(count);
  });

  hashtagText.addEventListener("input", () => {
    const value = hashtagText.value;
    hashtag.textContent = value;
    saveLocalAsset("hashtag", value).catch(err => {
      console.error("Could not save hashtag:", err);
      showUpdateNotice("HASHTAG SAVE FAILED", true);
    });
  });

  function refreshTeamTargets() {
    const rows = [...dynamicData.querySelectorAll(".dynamic-row")];
    teamTarget.innerHTML = rows.map((row, index) => {
      const rank = row.querySelector(".rank")?.textContent.trim() || String(index + 1);
      const name = row.querySelector(".team-name")?.textContent.trim() || "Team";
      return `<option value="${index}">Line ${rank} — ${name}</option>`;
    }).join("");
  }

  function previewAsset(file) {
    const url = URL.createObjectURL(file);
    const folder = assetFolder.value;
    if (folder === "teams") {
      const row = dynamicData.querySelectorAll(".dynamic-row")[Number(teamTarget.value)];
      const image = row?.querySelector(".team-logo");
      if (image) image.src = url;
    } else {
      const selectors = {
        background: ".background",
        branding: ".laant-logo",
        competition: ".competition-logo",
        cup: ".cup"
      };
      const image = document.querySelector(selectors[folder]);
      if (image) image.src = url;
    }
  }

  async function applyDriveAsset(url, localKey, fallbackFile) {
    const image = localKey.startsWith("teams-")
      ? dynamicData.querySelectorAll(".dynamic-row")[Number(localKey.slice(6))]?.querySelector(".team-logo")
      : document.querySelector({
        background: ".background",
        branding: ".laant-logo",
        competition: ".competition-logo",
        cup: ".cup"
      }[localKey]);
    if (!image) return;
    const previousSrc = image.src;
    image.src = url;
    try {
      await new Promise((resolve, reject) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", reject, { once: true });
      });
      await saveLocalAsset(localKey, url);
    } catch (error) {
      image.src = fallbackFile ? URL.createObjectURL(fallbackFile) : previousSrc;
      throw new Error("The existing Drive image could not be displayed.");
    }
  }

  assetFolder.addEventListener("change", () => {
    teamTarget.hidden = assetFolder.value !== "teams";
    if (assetFolder.value === "teams") refreshTeamTargets();
  });

  uploadAssetBtn.addEventListener("click", async () => {
    const file = assetFile.files[0];
    if (!file) {
      showUpdateNotice("SELECT AN IMAGE", true);
      return;
    }
    uploadAssetBtn.disabled = true;
    showUpdateNotice("UPLOADING...");
    previewAsset(file);
    const localKey = assetFolder.value === "teams"
      ? `teams-${Number(teamTarget.value)}`
      : assetFolder.value;
    const targetRow = assetFolder.value === "teams"
      ? dynamicData.querySelectorAll(".dynamic-row")[Number(teamTarget.value)]
      : null;
    const metadata = targetRow ? {
      rank: targetRow.querySelector(".rank")?.textContent.trim(),
      team: targetRow.querySelector(".team-name")?.textContent.trim()
    } : {};

    try {
      await saveLocalAsset(localKey, file);
      assetFile.value = "";
      uploadAssetBtn.disabled = false;
      showUpdateNotice("IMAGE UPDATED");

      let existing = { ok: false };
      let forceUpload = false;
      try {
        existing = await window.driveStorageApi.findExistingAsset(file, `assets/${assetFolder.value}`);
      } catch (searchError) {
        showUpdateNotice("DRIVE SEARCH UNAVAILABLE - UPLOADING");
      }
      if (existing.ok && existing.url && window.confirm(
        `${file.name} already exists in Drive.\n\nPress OK to embed the existing file, or Cancel to upload again.`
      )) {
        try {
          await applyDriveAsset(existing.url, localKey, file);
          showUpdateNotice("EXISTING IMAGE EMBEDDED");
        } catch (embedError) {
          console.error("Drive image embed failed:", embedError);
          await saveLocalAsset(localKey, file);
          showUpdateNotice("DRIVE IMAGE UNAVAILABLE - LOCAL IMAGE KEPT", true);
        }
        return;
      }
      forceUpload = Boolean(existing.ok && existing.url);
      await window.driveStorageApi.uploadAsset(file, assetFolder.value, metadata, forceUpload);
      showUpdateNotice("UPLOAD SENT TO DRIVE");
    } catch (err) {
      console.error(err);
      const message = err && err.code === "storage/unauthorized"
        ? "STORAGE RULES DENIED"
        : "CORS / STORAGE SETUP REQUIRED";
      showUpdateNotice(message, true);
    } finally {
      uploadAssetBtn.disabled = false;
    }
  });

  updateBtn.addEventListener("click", async () => {
    updateBtn.disabled = true;
    const label = updateBtn.querySelector("span:last-child");
    const oldLabel = label.textContent;
    label.textContent = "UPDATING...";
    showUpdateNotice("UPDATING...");

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 90000);
      let response;
      try {
        response = await fetch(updateUrl, {
          method: "POST",
          signal: controller.signal
        });

        window.updateDesktopRanking = () => updateBtn.click();
      } finally {
        window.clearTimeout(timeout);
      }
      const payload = await response.json();
      if (!response.ok || !payload.rows) {
        throw new Error(payload.error || "Update failed.");
      }
      dynamicData.innerHTML = payload.rows;
      await waitForImages(dynamicData);
      await waitForFonts();
      refreshTeamTargets();
      await restoreLocalAssets();
      showUpdateNotice("DONE");
    } catch (err) {
      console.error(err);
      const message = err && err.name === "AbortError"
        ? "UPDATE TIMEOUT - CHECK PYTHON SERVER"
        : err instanceof TypeError
          ? "UPDATE SERVER OFFLINE - RUN: python main.py --serve"
          : "UPDATE FAILED - CHECK PYTHON SERVER";
      showUpdateNotice(message, true);
    } finally {
      updateBtn.disabled = false;
      label.textContent = oldLabel;
    }
  });

  async function exportBoard(customRows = null) {
    btn.disabled = true;
    const label = btn.querySelector("span:last-child");
    const oldLabel = label.textContent;
    label.textContent = "EXPORT...";
    showUpdateNotice("EXPORTING...");
    await new Promise(resolve => requestAnimationFrame(resolve));

    let clone;

    try {
      await waitForImages(board);
      await waitForFonts();

      // Export a native 1920x1080 copy of the design.
      // Because the button is outside .board, it cannot appear in the PNG.
      clone = board.cloneNode(true);
      clone.classList.add("export-clone");
      Object.assign(clone.style, {
        width: "1920px",
        height: "1080px",
        position: "absolute",
        left: "0",
        top: "0",
        margin: "0",
        transform: "none",
        zIndex: "-9999"
      });

      document.body.appendChild(clone);
      if (Number.isInteger(customRows)) {
        [...clone.querySelectorAll(".dynamic-row")].forEach(row => {
          const rank = Number(row.querySelector(".rank")?.textContent.trim());
          if (rank > customRows) row.remove();
        });
        if (customRows <= 8) {
          clone.querySelector(".table-left")?.remove();
          clone.querySelector(".divider")?.remove();
        }
      }
      await waitForImages(clone);

      await new Promise(r => requestAnimationFrame(() =>
        requestAnimationFrame(r)
      ));

      const canvas = await html2canvas(clone, {
        width: 1920,
        height: 1080,
        scale: 1,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#031a3a",
        logging: false,
        imageTimeout: 15000
      });

      const link = document.createElement("a");
      const d = new Date();
      const stamp =
        d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0") + "_" +
        String(d.getHours()).padStart(2, "0") + "-" +
        String(d.getMinutes()).padStart(2, "0");

      link.download = "LA_ANT_MATCH_" + stamp + ".png";
      const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      if (!pngBlob) throw new Error("Could not create PNG blob.");
      link.href = URL.createObjectURL(pngBlob);
      link.click();
      window.driveStorageApi.uploadExport(pngBlob, link.download, 1920, 1080, "desktop").catch(err => {
        console.error("Google Drive export upload failed:", err);
      });
      showUpdateNotice("EXPORTED");
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error(err);
      showUpdateNotice("EXPORT FAILED", true);
    } finally {
      if (clone) clone.remove();
      document.querySelectorAll(".export-clone").forEach(x => x.remove());
      btn.disabled = false;
      label.textContent = oldLabel;
    }
  }

  btn.addEventListener("click", () => exportBoard());
})();
