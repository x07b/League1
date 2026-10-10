const ROOT_FOLDER_ID = "1kB7B0pts5QkFlljAdtcP-geXgobsUk-f";

function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    if (!request.folder || !request.filename || !request.data) {
      throw new Error("Missing folder, filename, or data.");
    }

    const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
    const folder = getOrCreatePath(root, request.folder);
    const existingFiles = folder.getFilesByName(request.filename);
    if (existingFiles.hasNext() && !request.forceUpload) {
      const existing = existingFiles.next();
      return jsonResponse({
        ok: true,
        existing: true,
        id: existing.getId(),
        name: existing.getName(),
        url: "https://drive.google.com/thumbnail?id=" + existing.getId() + "&sz=w1920",
        folder: request.folder
      });
    }
    const bytes = Utilities.base64Decode(request.data);
    const blob = Utilities.newBlob(
      bytes,
      request.mimeType || "application/octet-stream",
      request.filename
    );
    const file = folder.createFile(blob);
    file.setDescription(JSON.stringify(request.metadata || {}));

    return jsonResponse({
      ok: true,
      id: file.getId(),
      name: file.getName(),
      url: file.getUrl(),
      folder: request.folder
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error.message || error) });
  }
}

function doGet(e) {
  var callback = e.parameter.callback || "callback";
  var result = { ok: false, error: "Asset not found." };
  try {
    if (e.parameter.action !== "find" || !e.parameter.folder || !e.parameter.filename) {
      throw new Error("Missing search parameters.");
    }
    var root = DriveApp.getFolderById(ROOT_FOLDER_ID);
    var folder = getOrCreatePath(root, e.parameter.folder);
    var files = folder.getFilesByName(e.parameter.filename);
    if (files.hasNext()) {
      var file = files.next();
      result = {
        ok: true,
        id: file.getId(),
        name: file.getName(),
        url: "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1920"
      };
    }
  } catch (error) {
    result = { ok: false, error: String(error.message || error) };
  }
  return ContentService
    .createTextOutput(callback + "(" + JSON.stringify(result) + ")")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function getOrCreatePath(root, path) {
  return path.split("/").reduce(function(parent, name) {
    const matches = parent.getFoldersByName(name);
    return matches.hasNext() ? matches.next() : parent.createFolder(name);
  }, root);
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
