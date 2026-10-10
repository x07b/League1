const DRIVE_API_URL = "https://script.google.com/macros/s/AKfycbw_p7q7Z0UOWTkUsyfWszUqQq8Fn3rrJYUbjRsO9wSHNJJf2HMSNOcaGL-6fhkFy2_vhA/exec";
const DRIVE_EXPORT_FOLDER = "exports";

async function uploadToDrive(file, folder, metadata = {}, forceUpload = false) {
  if (!DRIVE_API_URL.startsWith("https://script.google.com/")) {
    throw new Error("Google Drive API URL is not configured.");
  }

  const data = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(data);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  const response = await fetch(DRIVE_API_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      folder,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      data: btoa(binary),
      metadata,
      forceUpload
    })
  });
  if (response.type !== "opaque" && !response.ok) {
    throw new Error("Google Drive upload failed.");
  }
  return { ok: true, submitted: true };
}

async function uploadAsset(file, folder, metadata = {}, forceUpload = false) {
  return uploadToDrive(file, `assets/${folder}`, {
    type: "asset",
    folder,
    ...metadata
  }, forceUpload);
}

function findExistingAsset(file, folder) {
  return new Promise((resolve, reject) => {
    const callbackName = `driveSearch_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };
    window[callbackName] = result => {
      cleanup();
      resolve(result);
    };
    script.onerror = () => {
      cleanup();
      resolve({ ok: false, unavailable: true });
    };
    script.src = `${DRIVE_API_URL}?action=find&folder=${encodeURIComponent(folder)}&filename=${encodeURIComponent(file.name)}&callback=${callbackName}&t=${Date.now()}`;
    document.head.appendChild(script);
  });
}

async function uploadExport(blob, filename, width = 1920, height = 1080, board = "desktop") {
  const file = new File([blob], filename, { type: "image/png" });
  return uploadToDrive(file, DRIVE_EXPORT_FOLDER, {
    type: "export",
    board,
    width,
    height
  });
}

window.driveStorageApi = { uploadAsset, uploadExport, findExistingAsset };
