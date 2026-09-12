-- Sadakat puani ozelligi komple kaldirildi (DEFECT_BACKLOG.md B7).
--
-- NEDEN: puan her rezervasyonda KAZANILIYOR, iptalde geri ALINIYORDU ama
-- HARCANACAK hicbir yol yoktu -- checkout'ta puan alani, redeemPoints/
-- pointsToUse benzeri bir cagri, harcanan puani tutan bir alan, hicbiri.
-- Buna ragmen iki yerde indirim VAAT EDILIYORDU: rozet "X puan (Y TL
-- indirim)" yaziyordu, `Guest.loyaltyRewardsBody` ise "puan kazan, indirim
-- olarak kullan" diyordu. Misafir bu indirimi checkout'ta arar, bulamazdi.
--
-- Ozellik eklemek yerine (sunucu dogrulamasi + harcanan-puan alani + iki
-- tasiyici gerektirirdi) urun karari VAADIN KENDISINI kaldirmak oldu: hic
-- calismayan bir ozelligi tamamlamak yerine, hic olmamis gibi silmek.
--
-- BU MIGRATION GERI ALINAMAZ: her iki kolondaki mevcut bakiyeler/kayitlar
-- KALICI OLARAK SILINIR. Puan hicbir zaman harcanabilir olmadigi icin
-- silinen "deger" zaten misafire hicbir zaman ulasilamayan bir sayiydi.
ALTER TABLE "User" DROP COLUMN "loyaltyPoints";
ALTER TABLE "Booking" DROP COLUMN "loyaltyPointsAwarded";
