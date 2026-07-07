# calendario-deportivo — juegos del día al abrir la terminal.
# Instalación (una línea en ~/.zshrc):
#   source "$HOME/calendario-deportivo/shell/calendario.zsh"

CALENDARIO_DIR="${CALENDARIO_DIR:-$HOME/calendario-deportivo}"

# Imprime el resumen del día a demanda: `calendario`
calendario() {
  command node "$CALENDARIO_DIR/src/print-terminal.ts" "$@"
}

_calendario_startup() {
  [[ -o interactive ]] || return 0
  [[ -n "$CALENDARIO_SILENT" ]] && return 0
  command -v node >/dev/null || return 0
  # Máximo una vez cada 30 min: cada split/tab nuevo no repite el banner.
  local stamp="${TMPDIR:-/tmp}/calendario-last-print-$UID"
  if [[ -z "$(find "$stamp" -mmin -30 2>/dev/null)" ]]; then
    command touch "$stamp"
    calendario
  fi
}

_calendario_startup
