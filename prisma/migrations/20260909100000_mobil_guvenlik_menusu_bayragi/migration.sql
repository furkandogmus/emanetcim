-- Mobilde yeni eklenen "Bildirim Alan Cihazlar" / "Izinler" menu girdileri
-- icin uzaktan kapatma anahtari (feature flag). VARSAYILAN ACIK: bugun
-- kimseye yeni davranis getirmiyor, ama bir sorun cikarsa admin panelinden
-- (/admin/feature-flags) app store surumu beklemeden aninda kapatilabilir.
INSERT INTO "FeatureFlag" (id, key, enabled, "rolloutPct", description, "createdAt", "updatedAt")
VALUES (
  'seed_mobile_security_menu',
  'mobile_security_menu',
  true,
  100,
  'Mobil profilde "Bildirim Alan Cihazlar" ve "Izinler" menu girdilerini gosterir.',
  now(),
  now()
)
ON CONFLICT (key) DO NOTHING;
