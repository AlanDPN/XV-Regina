/**
 * Google Apps Script backend para "XV de Regina"
 * 1) Crea una carpeta en Drive y copia su ID en FOLDER_ID.
 * 2) Crea una hoja en Google Sheets y copia su ID en SHEET_ID.
 * 3) Publica este script como Web App (acceso: Anyone).
 * 4) Pega la URL en DRIVE_WEB_APP_URL dentro de app.js.
 */

const FOLDER_ID = "14KNPO4zHFgP_0mVdQIwEdcEplcMDRNFu?hl";
const SHEET_ID = "1QExLRjC5hAeR7pZVi6iTkzEo7NmToBt0PSCKyZcPVig";
const SHEET_NAME = "photos";

function doPost(e) {
  const guestName = (e.parameter.guestName || "Anonimo").trim();
  const fileBlob = e.parameter.photo;

  if (!fileBlob) {
    return jsonResponse({ ok: false, message: "No se recibio archivo" });
  }

  const folder = DriveApp.getFolderById(FOLDER_ID);
  const savedFile = folder.createFile(fileBlob);
  savedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = savedFile.getId();
  const fileUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

  const sheet = getSheet_();
  sheet.appendRow([new Date(), guestName, fileId, fileUrl]);

  return jsonResponse({ ok: true, fileId, fileUrl });
}

function doGet(e) {
  const action = (e.parameter.action || "").trim();
  if (action !== "list") {
    return jsonResponse({ ok: false, message: "Action invalida" });
  }

  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();

  const rows = values.slice(1); // header
  const grouped = {};

  rows.forEach((row) => {
    const guestName = row[1];
    const fileUrl = row[3];
    if (!guestName || !fileUrl) return;

    if (!grouped[guestName]) grouped[guestName] = [];
    grouped[guestName].push({ url: fileUrl });
  });

  const groups = Object.keys(grouped).map((guestName) => ({
    guestName,
    photos: grouped[guestName],
  }));

  return jsonResponse({ ok: true, groups });
}

function getSheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["timestamp", "guestName", "fileId", "fileUrl"]);
  }

  return sheet;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
