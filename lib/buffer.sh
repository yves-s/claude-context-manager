CCM_HOME="${CCM_HOME:-$HOME/.ccm}"
CCM_BUFFER="${CCM_BUFFER:-$CCM_HOME/buffer.jsonl}"

buffer_append() {
  local entry="$1"
  mkdir -p "$(dirname "$CCM_BUFFER")"
  echo "$entry" >> "$CCM_BUFFER"
}

buffer_read() {
  [[ -f "$CCM_BUFFER" ]] && cat "$CCM_BUFFER"
  return 0
}

buffer_clear() {
  [[ -f "$CCM_BUFFER" ]] && > "$CCM_BUFFER"
  return 0
}

buffer_count() {
  if [[ ! -f "$CCM_BUFFER" ]] || [[ ! -s "$CCM_BUFFER" ]]; then
    echo "0"
    return 0
  fi
  wc -l < "$CCM_BUFFER" | tr -d ' '
}
