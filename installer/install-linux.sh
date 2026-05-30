#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
#  Esharq — Linux Installer
#  https://github.com/LOSTSTR/Esharq
#  للدعم الفني: discord.gg/kDJYqWX3S3
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO="LOSTSTR/Esharq"
ASAR="desktop.asar"
RELEASE_API="https://api.github.com/repos/${REPO}/releases/latest"
DISCORD_URL="https://discord.gg/kDJYqWX3S3"
DATA_DIR="${XDG_DATA_HOME:-${HOME}/.local/share}/Esharq"

# ── Colors ────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  R='\033[0m' B='\033[1m'
  CA='\033[38;5;105m' CG='\033[38;5;77m'
  CR='\033[38;5;203m' CM='\033[38;5;244m' CW='\033[38;5;255m'
else
  R='' B='' CA='' CG='' CR='' CM='' CW=''
fi

banner() {
  echo ""
  echo -e "${CA}${B}  ╔══════════════════════════════════════════════╗${R}"
  echo -e "${CA}${B}  ║        ✦  Esharq  •  Linux Installer        ║${R}"
  echo -e "${CA}${B}  ║     للدعم: discord.gg/kDJYqWX3S3            ║${R}"
  echo -e "${CA}${B}  ╚══════════════════════════════════════════════╝${R}"
  echo ""
}

log()  { echo -e "  ${CM}→${R} $*"; }
ok()   { echo -e "  ${CG}✓${R} $*"; }
err()  { echo -e "  ${CR}✖${R} $*" >&2; }
die()  { err "$*"; exit 1; }
hdr()  { echo -e "  ${CW}${B}$*${R}"; }

# ── Verify Linux ──────────────────────────────────────────────────────
[ "$(uname -s)" = "Linux" ] || die "هذا السكريبت مخصص لـ Linux فقط — لـ macOS استخدم install-macos.sh"

# ── Discord detection ─────────────────────────────────────────────────
find_discord() {
  # Standard package manager installs
  local std_paths=(
    "/usr/lib/discord/resources"
    "/usr/share/discord/resources"
    "/usr/lib64/discord/resources"
    "/opt/discord/resources"
    "/opt/Discord/resources"
    "${HOME}/.local/lib/discord/resources"
    "${HOME}/.local/share/discord/resources"
  )
  for p in "${std_paths[@]}"; do
    [ -d "$p" ] && { echo "$p"; return 0; }
  done

  # Flatpak (~/.var/app/com.discordapp.Discord)
  local fp_base="${HOME}/.var/app/com.discordapp.Discord/config/discord"
  if [ -d "$fp_base" ]; then
    local fp_app
    fp_app=$(find "$fp_base" -maxdepth 1 -name "app-*" -type d 2>/dev/null | sort | tail -1)
    if [ -n "$fp_app" ] && [ -d "${fp_app}/resources" ]; then
      echo "${fp_app}/resources"
      return 0
    fi
  fi

  # Snap
  local snap_path="/snap/discord/current/usr/share/discord/resources"
  [ -d "$snap_path" ] && { echo "$snap_path"; return 0; }

  return 1
}

# ── GitHub helpers ────────────────────────────────────────────────────
require_curl() {
  command -v curl >/dev/null 2>&1 || die "curl غير مثبَّت — قم بتثبيته أولاً:\n  sudo apt install curl  أو  sudo dnf install curl"
}

fetch_json() {
  curl -fsSL -H "User-Agent: Esharq-Installer/1.14 (Linux)" "$RELEASE_API" \
    || die "تعذّر الوصول إلى GitHub API — تحقق من اتصال الإنترنت"
}

download_file() {
  local url="$1" dest="$2"
  # URL validation: يُسمح فقط بـ github.com و objects.githubusercontent.com
  local host
  host=$(echo "$url" | sed -E 's|https?://([^/]+).*|\1|')
  case "$host" in
    github.com|*.github.com|objects.githubusercontent.com|*.githubusercontent.com) ;;
    *) die "مصدر التنزيل غير موثوق: ${host}" ;;
  esac
  curl -fSL --progress-bar \
    -H "User-Agent: Esharq-Installer/1.14 (Linux)" \
    -o "$dest" "$url"
}

verify_sha256() {
  local file="$1" expected="$2"
  if [ -z "$expected" ]; then
    log "تحذير: لا يوجد checksums.txt في هذا الإصدار — تم تخطي التحقق من SHA-256"
    return 0
  fi
  local actual
  actual=$(sha256sum "$file" | awk '{print $1}')
  if [ "$expected" != "$actual" ]; then
    die "فشل التحقق من SHA-256 — الملف تالف أو تم التلاعب به\n  متوقع: ${expected}\n  فعلي:  ${actual}"
  fi
  ok "تم التحقق من سلامة الملف (SHA-256)"
}

kill_discord() {
  /usr/bin/pkill -x discord 2>/dev/null || true
  /usr/bin/pkill -x Discord 2>/dev/null || true
  sleep 1
}

# ── Commands ──────────────────────────────────────────────────────────

cmd_install() {
  local res_dir="${1:-}"

  if [ -z "$res_dir" ]; then
    log "جارٍ البحث عن Discord (حزمة عادية / Flatpak / Snap)..."
    res_dir=$(find_discord) \
      || die "لم يُعثر على Discord — تأكد من تثبيته أو مرِّر المسار يدوياً:\n  $0 install /path/to/discord/resources"
    ok "عُثر على Discord في: ${CW}${res_dir}${R}"
  else
    [ -d "$res_dir" ] || die "المسار غير موجود: $res_dir"
    ok "مسار مخصص: ${CW}${res_dir}${R}"
  fi

  require_curl

  hdr "جارٍ جلب معلومات آخر إصدار..."
  local json tag url checksums_url expected_hash
  json=$(fetch_json)
  tag=$(echo "$json" | grep -o '"tag_name": *"[^"]*"' | head -1 | grep -o '"[^"]*"$' | tr -d '"' || echo "—")
  url=$(echo "$json" | grep -o '"browser_download_url": *"[^"]*desktop\.asar[^"]*"' | head -1 | grep -o 'https://[^"]*')
  checksums_url=$(echo "$json" | grep -o '"browser_download_url": *"[^"]*checksums\.txt[^"]*"' | head -1 | grep -o 'https://[^"]*' || true)
  [ -n "$url" ] || die "لم يُعثر على ملف ${ASAR} في أحدث إصدار"
  log "الإصدار: ${tag}"

  mkdir -p "$DATA_DIR"
  local tmp
  tmp=$(mktemp "${DATA_DIR}/esharq_XXXXXX.asar")
  chmod 600 "$tmp"
  trap 'rm -f "$tmp"' EXIT

  hdr "جارٍ تنزيل ${ASAR}..."
  download_file "$url" "$tmp"

  hdr "جارٍ التحقق من سلامة الملف..."
  expected_hash=""
  if [ -n "$checksums_url" ]; then
    local ck_host
    ck_host=$(echo "$checksums_url" | sed -E 's|https?://([^/]+).*|\1|')
    case "$ck_host" in
      github.com|*.github.com|objects.githubusercontent.com|*.githubusercontent.com)
        local ck_tmp
        ck_tmp=$(mktemp "${DATA_DIR}/esharq_ck_XXXXXX.txt")
        if curl -fsSL -H "User-Agent: Esharq-Installer/1.14 (Linux)" -o "$ck_tmp" "$checksums_url" 2>/dev/null; then
          expected_hash=$(grep "desktop\.asar" "$ck_tmp" | awk '{print $1}' || true)
        fi
        rm -f "$ck_tmp"
        ;;
      *) log "تحذير: تم تجاهل checksums.txt من مصدر غير موثوق: ${ck_host}" ;;
    esac
  fi
  verify_sha256 "$tmp" "$expected_hash"

  hdr "جارٍ تطبيق التعديل..."
  kill_discord

  # Inject by swapping app.asar: back up the original to _app.asar (once), then
  # place the Esharq mod as app.asar. Its patcher.js loads ../_app.asar at runtime.
  local app_asar="${res_dir}/app.asar"
  local backup_asar="${res_dir}/_app.asar"
  if [ ! -f "$backup_asar" ]; then
    [ -f "$app_asar" ] || die "لم يُعثر على app.asar في ${res_dir} — تأكد من مجلد resources الصحيح"
    mv "$app_asar" "$backup_asar"
  elif [ -f "$app_asar" ]; then
    rm -f "$app_asar"
  fi
  cp "$tmp" "$app_asar"
  cp "$tmp" "${DATA_DIR}/equicord.asar"

  echo ""
  ok "تم التثبيت — أعد تشغيل Discord لتفعيل Esharq"
  echo ""
  echo -e "  ${CM}للدعم الفني انضم للخادم الرسمي:${R}"
  echo -e "  ${CA}${DISCORD_URL}${R}"
  echo ""
}

cmd_uninstall() {
  local res_dir="${1:-}"

  if [ -z "$res_dir" ]; then
    res_dir=$(find_discord) || die "لم يُعثر على Discord"
    ok "عُثر على Discord في: ${CW}${res_dir}${R}"
  fi

  kill_discord

  # Restore the original Discord app.asar from the backup.
  local app_asar="${res_dir}/app.asar"
  local backup_asar="${res_dir}/_app.asar"
  if [ -f "$backup_asar" ]; then
    rm -f "$app_asar"
    mv "$backup_asar" "$app_asar"
    ok "تمت استعادة app.asar الأصلي"
  fi

  # Clean up the data copy and any stray desktop.asar from older installs.
  [ -f "${DATA_DIR}/equicord.asar" ] \
    && rm -f "${DATA_DIR}/equicord.asar" \
    && ok "تم حذف equicord.asar"
  [ -f "${res_dir}/${ASAR}" ] && rm -f "${res_dir}/${ASAR}"

  ok "اكتملت الإزالة — أعد تشغيل Discord"
}

cmd_status() {
  echo ""
  local asar="${DATA_DIR}/equicord.asar"

  if [ -f "$asar" ]; then
    local mtime
    mtime=$(stat -c "%y" "$asar" 2>/dev/null | cut -d' ' -f1 || echo "مجهول")
    ok "Esharq مثبَّت  (${mtime})"
  else
    log "Esharq غير مثبَّت"
  fi

  local res_dir
  if res_dir=$(find_discord 2>/dev/null); then
    ok "Discord موجود في: ${res_dir}"
    [ -f "${res_dir}/_app.asar" ] \
      && ok "التعديل مطبَّق على هذا التثبيت (app.asar مُحقون)" \
      || log "التعديل غير مطبَّق على هذا التثبيت"
  else
    log "لم يُعثر على Discord"
  fi
  echo ""
}

usage() {
  echo ""
  hdr "الاستخدام  (Linux):"
  echo "  $0 install   [مسار-resources]   — تثبيت Esharq"
  echo "  $0 uninstall [مسار-resources]   — إزالة Esharq"
  echo "  $0 status                       — فحص حالة التثبيت"
  echo ""
  echo -e "  ${CM}مثال:  sudo bash $0 install${R}"
  echo -e "  ${CM}يدعم: حزمة عادية / Flatpak / Snap${R}"
  echo -e "  ${CM}للدعم: ${DISCORD_URL}${R}"
  echo ""
}

# ── Entry ─────────────────────────────────────────────────────────────
banner
cmd="${1:-install}"; shift 2>/dev/null || true

case "$cmd" in
  install)   cmd_install   "${1:-}" ;;
  uninstall) cmd_uninstall "${1:-}" ;;
  status)    cmd_status ;;
  -h|--help|help) usage ;;
  *) err "أمر غير معروف: $cmd"; usage; exit 1 ;;
esac
