routerAdd("POST", "/alamos/:orgId", (c) => {
  const orgId = c.pathParam("orgId")
  const body  = $apis.requestInfo(c).data

  if (!orgId) {
    return c.json(400, { message: "organization_id fehlt in der URL" })
  }

  const col    = $app.dao().findCollectionByNameOrId("einsaetze")
  const record = new Record(col)

  record.set("einsatz_nr",      body.unit    || "")
  record.set("stichwort",       body.keyword || "")
  record.set("adresse",         "")
  record.set("datum",           new Date().toISOString())
  record.set("status",          "aktiv")
  record.set("organization_id", orgId)

  $app.dao().saveRecord(record)

  return c.json(200, { id: record.id })
})
