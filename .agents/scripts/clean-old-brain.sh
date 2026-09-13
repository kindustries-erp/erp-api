#!/usr/bin/env bash
# ==============================================================================
# Script: clean-old-brain.sh
# Purpose: Dọn dẹp các thư mục session cũ (> 7 ngày) trong Antigravity Brain
#          để giải phóng dung lượng ổ đĩa và duy trì hiệu năng IDE.
# Usage:
#   bash .agents/scripts/clean-old-brain.sh            # Xóa các session > 7 ngày
#   bash .agents/scripts/clean-old-brain.sh --dry-run  # Xem trước danh sách sẽ xóa
#   bash .agents/scripts/clean-old-brain.sh --days 14  # Tùy chỉnh số ngày (ví dụ 14 ngày)
# ==============================================================================

set -euo pipefail

BRAIN_DIR="${HOME}/.gemini/antigravity-ide/brain"
DAYS=7
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --days)
            DAYS="$2"
            shift 2
            ;;
        *)
            echo "❌ Tham số không hợp lệ: $1"
            echo "Cách dùng: $0 [--dry-run] [--days <số_ngày>]"
            exit 1
            ;;
    esac
done

if [[ ! -d "$BRAIN_DIR" ]]; then
    echo "⚠️ Không tìm thấy thư mục Brain tại: $BRAIN_DIR"
    exit 0
fi

echo "🧠 Quét thư mục Brain: $BRAIN_DIR"
echo "⏳ Tiêu chí: Các session cũ hơn $DAYS ngày"

TOTAL_BEFORE=$(du -sh "$BRAIN_DIR" | cut -f1)
echo "📦 Dung lượng hiện tại: $TOTAL_BEFORE"

# Tìm các folder cấp 1 trong brain cũ hơn $DAYS ngày, loại trừ tempmediaStorage
OLD_FOLDERS=$(find "$BRAIN_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$DAYS" ! -name "tempmediaStorage")

if [[ -z "$OLD_FOLDERS" ]]; then
    echo "✨ Không có session nào cũ hơn $DAYS ngày cần dọn dẹp."
    exit 0
fi

COUNT=$(echo "$OLD_FOLDERS" | wc -l)
echo "🔍 Tìm thấy $COUNT session cũ hơn $DAYS ngày."

if [[ "$DRY_RUN" == "true" ]]; then
    echo "📋 [DRY-RUN] Danh sách các session sẽ bị xóa:"
    echo "$OLD_FOLDERS" | head -n 20
    if [[ "$COUNT" -gt 20 ]]; then
        echo "... và còn $(($COUNT - 20)) session khác."
    fi
    echo "💡 Chạy không có cờ --dry-run để thực hiện xóa thật."
    exit 0
fi

echo "🧹 Đang tiến hành dọn dẹp..."
echo "$OLD_FOLDERS" | while read -r folder; do
    if [[ -n "$folder" && -d "$folder" ]]; then
        rm -rf "$folder"
    fi
done

TOTAL_AFTER=$(du -sh "$BRAIN_DIR" | cut -f1)
echo "✅ Đã xóa thành công $COUNT session cũ (> $DAYS ngày)."
echo "🎉 Dung lượng sau khi dọn: $TOTAL_AFTER (Trước đó: $TOTAL_BEFORE)"
