// PocketBase hook: Responda EKS (Einsatzführung)  (PocketBase v0.23+ API)
//
// Das Einsatztagebuch ist nach dem Einsatz ein rechtlich bedeutsames Dokument.
// Einträge dürfen deshalb NIE verändert oder gelöscht werden — Korrekturen
// entstehen ausschließlich als neuer Eintrag, der auf den alten verweist.
//
// Die API-Regeln der Collection sperren Update/Delete bereits. Diese Hooks sind
// die zweite Ebene: Superuser umgehen API-Regeln, diese Prüfung aber nicht.
//
// Benötigte Collection "eks_events":
//   id (Text, 15 Zeichen — vom Client vergeben), einsatz_id (Text),
//   organization_id (Text), seq (Text), device_id (Text), actor_user (Relation users, optional),
//   actor_name (Text), type (Text), payload (JSON), client_ts (Date),
//   client_offset_ms (Number, optional), prev_hash (Text), hash (Text), schema_v (Number)
//
// Empfohlene Regeln:
//   List/View : @request.auth.id != "" && organization_id = @request.auth.organization_id
//   Create    : @request.auth.id != "" && organization_id = @request.auth.organization_id
//   Update    : (leer lassen — gesperrt)
//   Delete    : (leer lassen — gesperrt)
//
// Empfohlene Indizes:
//   CREATE INDEX idx_eks_events_einsatz_seq ON eks_events (einsatz_id, seq);
//   CREATE INDEX idx_eks_events_org_created ON eks_events (organization_id, created);

onRecordUpdateRequest((e) => {
  throw new BadRequestError("Einträge des Einsatztagebuchs sind unveränderlich. Korrekturen bitte als neuen Eintrag erfassen.")
}, "eks_events")

onRecordDeleteRequest((e) => {
  throw new BadRequestError("Einträge des Einsatztagebuchs dürfen nicht gelöscht werden.")
}, "eks_events")
