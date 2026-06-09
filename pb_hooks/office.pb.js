// PocketBase hook: Euro-Office save callback
//
// SETUP REQUIRED: Create an "office_saves" collection in PocketBase with fields:
//   - file_id      (text)
//   - download_url (text)
//   - doc_key      (text)
// API rules: List/View require auth (@request.auth.id != "").
//
// The Euro-Office DocumentServer POSTs here after each save (status=2) or
// force-save (status=6). We log the pending save so the React app can later
// download the updated file and re-upload it to the `files` collection.
//
// For now, users can use "File → Download" inside the editor to save locally,
// then re-upload via the Dateien app.

routerAdd("POST", "/api/office/callback", (c) => {
  const body = $apis.requestInfo(c).data
  const fileId = c.queryParam("file_id")

  // Euro-Office sends:
  //   status 1 → document is being edited (no action needed)
  //   status 2 → document is ready for saving
  //   status 3 → document saving error
  //   status 4 → document is closed without changes
  //   status 6 → document is being edited but current document state is saved
  //   status 7 → error has occurred while force saving the document
  if (!body || (body.status !== 2 && body.status !== 6)) {
    return c.json(200, { "error": 0 })
  }

  if (!body.url || !fileId) {
    return c.json(200, { "error": 0 })
  }

  try {
    const collection = $app.dao().findCollectionByNameOrId("office_saves")
    const record = new Record(collection)
    record.set("file_id", fileId)
    record.set("download_url", body.url)
    record.set("doc_key", body.key || "")
    $app.dao().saveRecord(record)
  } catch(e) {
    // office_saves collection might not exist yet — log and continue
    console.log("office_saves error (collection may not exist):", e.message)
  }

  // Always return error:0 to acknowledge the callback to Euro-Office
  return c.json(200, { "error": 0 })
})
