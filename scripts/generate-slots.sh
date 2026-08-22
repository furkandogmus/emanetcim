#!/bin/bash
# Gunluk slot uretimi. Ince sarmalayici -- is adi burada SABITLENIR.
#
# NEDEN VAR: Slot uretimi 2026-07-14'te durdu ve onu calistiran hicbir zamanlanmis
# is yoktu. Sonuc 37 gun boyunca fark edilmedi: her dukkanin ilan ettigi saatlik
# urun secilemez hale geldi ve per-slot kapasite kontrolu yerini kaba, dukkan
# geneli bir kontrole birakti. Slotlar 30 gun ileriye uretildigi icin bu is
# calismazsa kesinti sessizce tekrarlanir.
# Ayrinti: docs/DEFECT_BACKLOG.md -> P0-1
set -e
exec "$(dirname "$0")/call-internal-job.sh" --job generate-slots "$@"
