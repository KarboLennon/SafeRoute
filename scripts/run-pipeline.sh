#!/bin/bash
# Wrapper untuk cron: jalankan pipeline scraping berita tiap 12 jam & catat log.
# Pipeline idempotent: berita baru ditarik, lama (<14h) dipertahankan, ≥14h dihapus.

NODE="/Users/muchtar/.nvm/versions/node/v20.20.2/bin/node"
DIR="/Users/muchtar/Project Gabut/Hackaton/jagamalam"
LOG="$DIR/scripts/pipeline.log"

# Batasi ukuran log (simpan 500 baris terakhir).
if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt 500 ]; then
  tail -n 200 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

echo "===== $(date '+%Y-%m-%d %H:%M:%S') =====" >> "$LOG"
"$NODE" "$DIR/scripts/news-pipeline.mjs" >> "$LOG" 2>&1
echo "" >> "$LOG"
