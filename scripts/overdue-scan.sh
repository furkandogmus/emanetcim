#!/bin/bash
# Gunluk sure asimi mutabakati. Ince sarmalayici -- is adi burada SABITLENIR ki
# crontab'a elle yanlis ad yazilamasin.
#
# NEDEN VAR: prod'da 19 rezervasyonun 18'i cikis saatini gecmis halde acikti ve
# hicbiri hic CHECKED_OUT olmamisti; uc musterinin bavulu Haziran'dan beri
# "dukkanda" gorunuyordu. Kimse fark etmemisti cunku hic tarama yoktu.
# Ayrinti: docs/DEFECT_BACKLOG.md -> P1-6
set -e
exec "$(dirname "$0")/call-internal-job.sh" --job overdue-scan "$@"
