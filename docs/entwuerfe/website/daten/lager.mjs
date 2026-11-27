// Bild „lager“: Schritt Material (10:20). Die Startseite des Lagers (/lager, Kacheln seit 20.11.2026) am Standort
// „HLF 20/1“ nach dem erfundenen Einsatz E-2026-0417: Auf dem Fahrzeug fehlt, was bei der Versorgung der Bewohnerin
// verbraucht wurde (Einmalhandschuhe, Rettungsdecken, eine Sauerstoffmaske — unter Soll), zwei Artikel laufen bald ab.
// Im roten Kopf Standort und Zahlen (in Ordnung, bald fällig, abgelaufen), darunter die Kacheln.
// Nur erfundene Daten: erfundene Feuerwehr, keine Markennamen.
//
// Die App fragt den Bestand je Standort ab (Filter location_id); die gemeinsame Antwort in daten.mjs kennt keine
// Filter, darum beantwortet routen diese eine Abfrage selbst. Artikel kommen sortiert wie mit sort: 'name'.

// ORG kommt aus '../daten.mjs', nachgeladen wie in eks.mjs (ein statischer Import hinge im Kreis fest).
const STANDORTE = []
const ARTIKEL = []
const BESTAND = []

const ORT = { haus: 'ortgeraetehaus1', hlf: 'orthlf201000001', lf: 'ortlf1020000001' }

// Ortszeit (MEZ, UTC+1) -> PocketBase-Zeit in UTC
const pb = (tag, hm = '10:00') => new Date(`${tag}T${hm}:00+01:00`).toISOString().replace('T', ' ')
// MHD wie PocketBase-Datumsfelder
const mhd = (tag) => (tag ? `${tag} 00:00:00.000Z` : '')

function aufbauen({ ORG }) {
  const satz = (collectionName, id, felder, created = pb('2025-03-02')) => ({
    id, collectionId: `pbc_${collectionName}`, collectionName, created, updated: created, organization_id: ORG.id, ...felder,
  })

  STANDORTE.push(
    satz('inventory_locations', ORT.haus, { name: 'Gerätehaus', icon: 'box', archiviert: false }, pb('2025-03-02', '10:00')),
    satz('inventory_locations', ORT.hlf, { name: 'HLF 20/1', icon: 'truck', archiviert: false }, pb('2025-03-02', '10:05')),
    satz('inventory_locations', ORT.lf, { name: 'LF 10/2', icon: 'truck', archiviert: false }, pb('2025-03-02', '10:06')),
  )

  // [id, Name, Einheit, Soll Gerätehaus, Soll HLF 20/1, Notiz]
  const artikel = [
    ['artaugenspuel01', 'Augenspülflasche 500 ml', 'Flasche', 6, 2, ''],
    ['artbrandwunde01', 'Brandwunden-Verbandtuch', 'Stück', 6, 2, ''],
    ['arteinmalhand01', 'Einmalhandschuhe Nitril, Gr. L', 'Paar', 200, 50, 'Spender im Mannschaftsraum'],
    ['artkaeltekomp01', 'Kältesofortkompresse', 'Stück', 10, 4, ''],
    ['artoelbinder001', 'Ölbindemittel, Sack 20 l', 'Sack', 10, 0, ''],
    ['artrettdecke001', 'Rettungsdecke 210 × 160 cm', 'Stück', 20, 6, 'Notfallrucksack und Fach G2'],
    ['artsauerstoff01', 'Sauerstoffmaske, Erw.', 'Stück', 6, 2, ''],
    ['artunibinder001', 'Universal-Bindemittel, Eimer 10 l', 'Eimer', 6, 1, ''],
    ['artverbandgr001', 'Verbandpäckchen DIN 13151 G', 'Stück', 20, 6, ''],
    ['artverbandmi001', 'Verbandpäckchen DIN 13151 M', 'Stück', 20, 6, ''],
    ['artwaermekomp01', 'Wärmekompresse', 'Stück', 10, 4, ''],
    ['artwundschnell1', 'Wundschnellverband 6 cm × 5 m', 'Rolle', 6, 2, ''],
  ]
  for (const [id, name, unit, sollHaus, sollHlf, notes] of artikel) {
    ARTIKEL.push(satz('inventory_items', id, {
      name, unit, min_stock: sollHaus, location_min_stocks: sollHlf ? { [ORT.hlf]: sollHlf } : {}, notes,
      barcode: '', barcodes: [], supplier: '', supplier_item_no: '', supplier_email: '', order_url: '',
      auto_order: false, bedarf: {}, nicht_bestellen: false, archiviert: false,
    }))
  }

  // [id, Artikel, Standort, Menge, MHD, Charge]
  const bestand = [
    // HLF 20/1: nach der Versorgung der Bewohnerin fehlen Handschuhe, Rettungsdecken und eine Sauerstoffmaske
    ['bstaugenhlf0001', 'artaugenspuel01', ORT.hlf, 2, '2026-12-04', 'L2311-07'],
    ['bstbrandhlf0001', 'artbrandwunde01', ORT.hlf, 2, '2026-12-11', 'B2312-14'],
    ['bsthandhlf00001', 'arteinmalhand01', ORT.hlf, 26, '2029-08-31', 'N2908-31'],
    ['bstkaeltehlf001', 'artkaeltekomp01', ORT.hlf, 4, '2028-05-31', 'K2805-02'],
    ['bstdeckehlf0001', 'artrettdecke001', ORT.hlf, 3, '', ''],
    ['bstsauerhlf0001', 'artsauerstoff01', ORT.hlf, 1, '2029-02-28', 'S2902-11'],
    ['bstunibindhlf01', 'artunibinder001', ORT.hlf, 1, '', ''],
    ['bstverbgrhlf001', 'artverbandgr001', ORT.hlf, 6, '2030-04-30', 'V3004-21'],
    ['bstverbmihlf001', 'artverbandmi001', ORT.hlf, 7, '2030-01-31', 'V3001-09'],
    ['bstwaermehlf001', 'artwaermekomp01', ORT.hlf, 4, '2028-09-30', 'W2809-04'],
    ['bstwundhlf00001', 'artwundschnell1', ORT.hlf, 2, '2029-11-30', 'P2911-30'],
    // Gerätehaus: der Vorrat, aus dem das Fahrzeug wieder aufgefüllt wird
    ['bstaugenhaus001', 'artaugenspuel01', ORT.haus, 6, '2027-10-31', 'L2710-03'],
    ['bstbrandhaus001', 'artbrandwunde01', ORT.haus, 5, '2028-06-30', 'B2806-10'],
    ['bsthandhaus0001', 'arteinmalhand01', ORT.haus, 240, '2029-08-31', 'N2908-31'],
    ['bstkaeltehaus01', 'artkaeltekomp01', ORT.haus, 12, '2028-05-31', 'K2805-02'],
    ['bstoelhaus00001', 'artoelbinder001', ORT.haus, 12, '', ''],
    ['bstdeckehaus001', 'artrettdecke001', ORT.haus, 24, '', ''],
    ['bstsauerhaus001', 'artsauerstoff01', ORT.haus, 6, '2029-02-28', 'S2902-11'],
    ['bstunibindhaus1', 'artunibinder001', ORT.haus, 8, '', ''],
    ['bstverbgrhaus01', 'artverbandgr001', ORT.haus, 24, '2030-04-30', 'V3004-21'],
    ['bstverbmihaus01', 'artverbandmi001', ORT.haus, 22, '2030-01-31', 'V3001-09'],
    ['bstwaermehaus01', 'artwaermekomp01', ORT.haus, 10, '2028-09-30', 'W2809-04'],
    ['bstwundhaus0001', 'artwundschnell1', ORT.haus, 6, '2029-11-30', 'P2911-30'],
    // LF 10/2
    ['bsthandlf100001', 'arteinmalhand01', ORT.lf, 50, '2029-08-31', 'N2908-31'],
    ['bstdeckelf10001', 'artrettdecke001', ORT.lf, 6, '', ''],
    ['bstverbgrlf1001', 'artverbandgr001', ORT.lf, 4, '2030-04-30', 'V3004-21'],
    ['bstunibindlf101', 'artunibinder001', ORT.lf, 1, '', ''],
  ]
  for (const [id, item_id, location_id, quantity, ablauf, batch] of bestand) {
    BESTAND.push(satz('inventory_stock', id, { item_id, location_id, quantity, expiry_date: mhd(ablauf), batch }, pb('2026-10-02', '18:30')))
  }
}
import('../daten.mjs').then(aufbauen)

export const bild = {
  name: 'lager',
  pfad: '/lager',
  warte: 900,
  sammlungen: {
    inventory_locations: STANDORTE,
    inventory_items: ARTIKEL,
    inventory_stock: BESTAND,
    inventory_transactions: [],
    product_outputs: [],
    lager_settings: [],
  },
  // Bestand je Standort, wie PocketBase ihn mit dem Filter location_id liefert
  routen: (methode, url) => {
    if (methode !== 'GET' || url.pathname !== '/api/collections/inventory_stock/records') return undefined
    const ort = /location_id\s*=\s*"([a-z0-9]+)"/.exec(url.searchParams.get('filter') || '')?.[1]
    const items = ort ? BESTAND.filter((b) => b.location_id === ort) : BESTAND
    const perPage = Number(url.searchParams.get('perPage') || 30)
    return { body: { page: 1, perPage, totalItems: items.length, totalPages: 1, items } }
  },
  // Wie am Gerät: den Standort des Fahrzeugs wählen, von dem das Material genommen wurde (Auswahl im roten Kopf)
  vorher: async (page) => {
    await page.selectOption('select[aria-label="Standort wählen"]', { label: 'HLF 20/1' })
    await page.waitForTimeout(800)
  },
}
