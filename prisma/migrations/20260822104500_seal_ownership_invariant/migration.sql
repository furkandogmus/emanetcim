-- Mühür envanteri: sahiplik değişmezi DB seviyesinde.
--
-- P1-7 (2026-08-22 denetimi): 1.277 mühür `ASSIGNED`, bunların **1.247'si hiçbir
-- dükkana bağlı değil** (`shopId IS NULL`). Mühür envanteri anlaşmazlıklarda
-- fiziksel zilyetlik kanıtıdır ve %96'sı bir dükkanla eşleştirilemiyordu.
--
-- Kaynak: `SealRepository.updateStatus(serialNumber, status)` herhangi bir duruma
-- `shopId`'ye HİÇ dokunmadan yazıyordu. Kod tarafını düzeltmek yetmez — beş ayrı
-- yer ham `seal.update*` çağırıyor ve altıncısı yarın eklenebilir. Değişmez
-- kuralın yeri veritabanıdır.
--
-- KURAL: `STOCK` dışındaki her mühür bir dükkana ait olmak zorundadır.
-- `STOCK` = depoda, henüz kimseye verilmemiş -> `shopId` NULL olmalı.

-- NOT VALID: mevcut 1.249 bozuk satır BU MİGRASYONDA kontrol EDİLMEZ, ama
-- bundan sonraki her INSERT/UPDATE kontrol edilir.
--
-- Neden böyle: bozuk satırları migrasyonda düzeltmek 1.247 mührün envanter
-- durumunu sessizce değiştirmek olurdu. Onarım BİLİNÇLİ bir adımdır ve kendi
-- script'i var (`scripts/repair-seal-ownership.sh`, varsayılanı kuru çalışma).
-- Onarımdan sonra kısıt şu komutla doğrulanır:
--   ALTER TABLE "Seal" VALIDATE CONSTRAINT "Seal_ownership_matches_status";
ALTER TABLE "Seal"
  ADD CONSTRAINT "Seal_ownership_matches_status"
  CHECK (
    (status = 'STOCK' AND "shopId" IS NULL)
    OR
    (status <> 'STOCK' AND "shopId" IS NOT NULL)
  )
  NOT VALID;
