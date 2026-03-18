# lib/config.sh
CCM_HOME="${CCM_HOME:-$HOME/.ccm}"
CCM_GLOBAL_CONFIG="$CCM_HOME/config"

get_meta_repo() {
  if [[ ! -f "$CCM_GLOBAL_CONFIG" ]]; then
    echo ""
    return 1
  fi
  jq -r '.default_meta' "$CCM_GLOBAL_CONFIG"
}

set_meta_repo() {
  local path="$1"
  mkdir -p "$CCM_HOME"
  if [[ -f "$CCM_GLOBAL_CONFIG" ]]; then
    jq --arg p "$path" '.default_meta = $p' "$CCM_GLOBAL_CONFIG" \
      > "$CCM_GLOBAL_CONFIG.tmp" && mv "$CCM_GLOBAL_CONFIG.tmp" "$CCM_GLOBAL_CONFIG"
  else
    echo "{\"default_meta\": \"$path\"}" > "$CCM_GLOBAL_CONFIG"
  fi
}
