#!/usr/bin/env bash
# dev-guard.sh — chạy dev server ERP an toàn.
#
#   bash dev-guard.sh --port 10003 -- bun run start:dev
#   bash dev-guard.sh --env-file .env --default-port 5173 -- bun run dev
#   bash dev-guard.sh --ps  [--repo DIR]     liệt kê tiến trình dev của repo
#   bash dev-guard.sh --clean [--repo DIR]   dừng tiến trình dev của repo (in danh sách trước)
#
# Hành vi khi start:
#   1. Xác định port (từ --port, hoặc PORT trong --env-file, hoặc --default-port).
#   2. Nếu port đang bị giữ: chỉ kill khi tiến trình là node/bun/vite/nest/esbuild.
#      Kill cả cây tiến trình (con trước), SIGTERM -> chờ 5s -> SIGKILL.
#      Tiến trình khác (docker-proxy, nginx, ...) thì không kill, thoát mã 3.
#   3. Chạy lệnh trong process group riêng. Ctrl+C / HUP / TERM sẽ gửi tín hiệu
#      cho cả nhóm, nên không để lại con mồ côi (vd. "node dist/main").
#   4. Nếu inotify instance còn ít, bật CHOKIDAR_USEPOLLING=true và cảnh báo.
#
# Không dùng pkill theo tên. Chỉ tác động tới port của lần start này.
set -uo pipefail

ALLOWED_COMM='^(node|bun|vite|nest|esbuild)$'
MIN_FREE_INOTIFY=20

log()  { printf '[dev-guard] %s\n' "$*" >&2; }
die()  { log "$*"; exit "${2:-1}"; }

# ---------- tiện ích ----------

# PID đang LISTEN trên port (không lấy trùng)
pids_on_port() {
  local port="$1"
  ss -ltnpH "sport = :${port}" 2>/dev/null \
    | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -un
}

comm_of()  { cat "/proc/$1/comm" 2>/dev/null; }
cmd_of()   { tr '\0' ' ' < "/proc/$1/cmdline" 2>/dev/null | cut -c1-160; }
etime_of() { ps -o etime= -p "$1" 2>/dev/null | tr -d ' '; }

# Các con (đệ quy) của một pid, con sâu nhất trước
descendants() {
  local pid="$1" child
  for child in $(pgrep -P "$pid" 2>/dev/null); do
    descendants "$child"
    echo "$child"
  done
}

# Kill cả cây: con trước, cha sau. SIGTERM -> chờ 5s -> SIGKILL
kill_tree() {
  local root="$1" list p i
  list="$(descendants "$root") $root"
  for p in $list; do kill -TERM "$p" 2>/dev/null; done
  for i in 1 2 3 4 5; do
    sleep 1
    local alive=0
    for p in $list; do kill -0 "$p" 2>/dev/null && alive=1; done
    [ "$alive" -eq 0 ] && return 0
  done
  for p in $list; do kill -KILL "$p" 2>/dev/null; done
}

# Số inotify instance còn trống cho user hiện tại
inotify_free() {
  local limit used
  limit="$(cat /proc/sys/fs/inotify/max_user_instances)"
  used="$(find /proc/[0-9]*/fd -maxdepth 1 -lname 'anon_inode:inotify' \
            -user "$(id -u)" 2>/dev/null | wc -l)"
  echo $((limit - used))
}

port_from_env_file() {
  local f="$1"
  [ -f "$f" ] || return 1
  grep -E '^PORT=' "$f" | tail -1 | cut -d= -f2- | tr -d '"'"'"' \r'
}

# Tiến trình dev thuộc một repo (nhận diện theo đường dẫn trong cmdline/cwd)
dev_procs_in_repo() {
  local repo="$1" pid comm cmd cwd
  for pid in $(ls /proc | grep -E '^[0-9]+$'); do
    comm="$(comm_of "$pid")"
    echo "$comm" | grep -qE "$ALLOWED_COMM" || continue
    cmd="$(cmd_of "$pid")"
    cwd="$(readlink "/proc/$pid/cwd" 2>/dev/null)"
    case "$cmd $cwd" in
      *"$repo"*) echo "$pid" ;;
    esac
  done
}

# ---------- phân tích tham số ----------

MODE="start"
ENV_PORT="${PORT:-}"   # PORT đã export trong môi trường (nếu có) giữ lại trước khi bị ghi đè
PORT=""
ENV_FILE=""
DEFAULT_PORT=""
REPO="$(pwd)"
CMD=()

while [ $# -gt 0 ]; do
  case "$1" in
    --port)          PORT="$2"; shift 2 ;;
    --env-file)      ENV_FILE="$2"; shift 2 ;;
    --default-port)  DEFAULT_PORT="$2"; shift 2 ;;
    --repo)          REPO="$2"; shift 2 ;;
    --ps)            MODE="ps"; shift ;;
    --clean)         MODE="clean"; shift ;;
    --)              shift; CMD=("$@"); break ;;
    *)               die "tham số không rõ: $1" 2 ;;
  esac
done

REPO="$(cd "$REPO" && pwd)" || die "repo không tồn tại"

# ---------- chế độ ps / clean ----------

if [ "$MODE" = "ps" ] || [ "$MODE" = "clean" ]; then
  mapfile -t PIDS < <(dev_procs_in_repo "$REPO")
  if [ "${#PIDS[@]}" -eq 0 ]; then
    log "không có tiến trình dev nào thuộc $REPO"
    exit 0
  fi
  printf '%-8s %-8s %-6s %-10s %s\n' PID PPID STAT ELAPSED CMD
  for p in "${PIDS[@]}"; do
    printf '%-8s %-8s %-6s %-10s %s\n' "$p" \
      "$(ps -o ppid= -p "$p" | tr -d ' ')" \
      "$(ps -o stat= -p "$p" | tr -d ' ')" \
      "$(etime_of "$p")" "$(cmd_of "$p")"
  done
  if [ "$MODE" = "clean" ]; then
    log "dừng ${#PIDS[@]} tiến trình trên (cây tiến trình, SIGTERM rồi SIGKILL)"
    for p in "${PIDS[@]}"; do
      kill -0 "$p" 2>/dev/null && kill_tree "$p"
    done
    log "xong"
  fi
  exit 0
fi

# ---------- chế độ start ----------

[ "${#CMD[@]}" -gt 0 ] || die "thiếu lệnh sau --" 2

if [ -z "$PORT" ] && [ -n "$ENV_FILE" ]; then
  PORT="$(port_from_env_file "$ENV_FILE" || true)"
fi
[ -z "$PORT" ] && PORT="$ENV_PORT"
[ -z "$PORT" ] && PORT="$DEFAULT_PORT"
[ -n "$PORT" ] || die "không xác định được port (dùng --port, --env-file hoặc --default-port)" 2

export PORT
log "port $PORT, repo $REPO"

HOLDERS="$(pids_on_port "$PORT")"
if [ -n "$HOLDERS" ]; then
  for p in $HOLDERS; do
    comm="$(comm_of "$p")"
    if ! echo "$comm" | grep -qE "$ALLOWED_COMM"; then
      log "port $PORT đang bị '$comm' (pid $p) giữ. Không phải tiến trình dev nên không kill."
      exit 3
    fi
  done
  for p in $HOLDERS; do
    log "port $PORT bị giữ bởi pid $p ($(etime_of "$p") trước): $(cmd_of "$p") -> dừng"
    kill_tree "$p"
  done
  for i in 1 2 3 4 5; do
    [ -z "$(pids_on_port "$PORT")" ] && break
    sleep 1
  done
  [ -z "$(pids_on_port "$PORT")" ] || die "port $PORT vẫn bận sau khi dừng" 4
  log "port $PORT đã trống"
fi

FREE="$(inotify_free)"
if [ "$FREE" -lt "$MIN_FREE_INOTIFY" ]; then
  export CHOKIDAR_USEPOLLING=true
  log "cảnh báo: chỉ còn $FREE inotify instance, bật CHOKIDAR_USEPOLLING=true"
fi

# Chạy trong process group riêng; pgid = pid của lệnh
setsid "${CMD[@]}" &
CHILD=$!

cleanup() {
  trap - INT TERM HUP EXIT
  # Luôn dọn cả nhóm, kể cả khi leader (bun) đã thoát trước: các con như vite
  # vẫn có thể còn sống trong nhóm và sẽ thành mồ côi nếu bỏ qua.
  # Nếu nhóm đã trống, kill báo lỗi và bị bỏ qua.
  kill -TERM -- "-$CHILD" 2>/dev/null || return 0
  log "dừng nhóm tiến trình $CHILD"
  for i in 1 2 3 4 5; do
    kill -0 -- "-$CHILD" 2>/dev/null || return 0
    sleep 1
  done
  kill -KILL -- "-$CHILD" 2>/dev/null
}
trap cleanup INT TERM HUP EXIT

wait "$CHILD"
RC=$?
cleanup
exit "$RC"
