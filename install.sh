#!/bin/zsh
# Instala el agente launchd y muestra los pasos manuales (Firefox, .zshrc).
set -euo pipefail

DIR="${0:a:h}"
NODE="$(command -v node)"
LABEL="com.longoria.calendario-deportivo"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/calendario-deportivo.log"

mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$DIR/src/fetch-games.ts</string>
  </array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>RunAtLoad</key><true/>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>6</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>12</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>17</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$UID" "$PLIST"

echo "✓ Agente launchd instalado ($LABEL) — corre al iniciar sesión y a las 6:00, 12:00 y 17:00."
echo "  Log: $LOG"
echo
echo "Pasos manuales:"
echo
echo "1) Firefox → Ajustes → Inicio:"
echo "   · Página de inicio y ventanas nuevas → URL personalizada:"
echo "     file://$DIR/web/index.html"
echo
echo "2) Terminal → agrega esta línea al final de ~/.zshrc:"
echo "   source \"$DIR/shell/calendario.zsh\""
