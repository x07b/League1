// Set ROOT_FOLDER_ID and DRIVE_SHARED_SECRET in Project Settings > Script properties.
function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    const properties = PropertiesService.getScriptProperties();
    const secret = properties.getProperty('DRIVE_SHARED_SECRET');
    if (!secret || request.secret !== secret) throw new Error('Unauthorized');
    if (!/^(exports|assets\/(background|branding|competition|cup|teams))$/.test(request.folder || '')) throw new Error('Invalid folder');
    if (!/^image\/(png|jpeg|webp|gif)$/.test(request.mimeType || '')) throw new Error('Invalid image type');
    const root = DriveApp.getFolderById(properties.getProperty('ROOT_FOLDER_ID'));
    const folder = request.folder.split('/').reduce(function(parent,name) {
      const matches = parent.getFoldersByName(name);
      return matches.hasNext() ? matches.next() : parent.createFolder(name);
    },root);
    const existing = folder.getFilesByName(request.filename);
    if (existing.hasNext() && !request.forceUpload) {
      const file = existing.next();
      return jsonResponse({ok:true,existing:true,id:file.getId(),url:file.getUrl()});
    }
    const blob = Utilities.newBlob(Utilities.base64Decode(request.data),request.mimeType,request.filename);
    const file = folder.createFile(blob);
    file.setDescription(JSON.stringify(request.metadata || {}));
    return jsonResponse({ok:true,id:file.getId(),url:file.getUrl()});
  } catch(error) {return jsonResponse({ok:false,error:String(error.message || error)});}
}
function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
