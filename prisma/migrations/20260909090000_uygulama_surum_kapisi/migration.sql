-- Mobil uygulama surum kapisi (zorunlu/opsiyonel guncelleme).
--
-- NEDEN: mobil istemcinin acilista karsilastirabilecegi bir minimum/guncel
-- surum bilgisi yoktu -- eski bir surumdeki kritik bir hata veya API sozlesme
-- degisikligi karsisinda kullaniciyi guncellemeye zorlamanin tek yolu store
-- inceleme surecini beklemekti.
--
-- Ikisi de NULLABLE, VARSAYILANSIZ: mevcut tek satir (`id = "default"`) icin
-- NULL = "kapi kapali", yani bu kolonlar eklenince hicbir mobil istemci
-- aniden guncellemeye zorlanmaz. Admin ayarlamadikca davranis degismez.
ALTER TABLE "PlatformSettings" ADD COLUMN "minAppVersion" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN "latestAppVersion" TEXT;
