// Paste this into Extensions > Apps Script of your Google Sheet, then deploy it as a web app.
// Each "yes" RSVP from the invite adds one row.
function doPost(e) {
  var d = JSON.parse(e.postData.contents);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Time", "Name", "Attending", "Dua", "Name on invite link"]);
  }
  sheet.appendRow([new Date(), clean(d.name), clean(d.attending), clean(d.dua), clean(d.guest)]);
  return ContentService.createTextOutput("ok");
}

// Keeps guest text as plain text so it can never run as a spreadsheet formula.
function clean(v) {
  v = String(v == null ? "" : v).slice(0, 500);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}
