# calendario-deportivo

Qué juegos hay hoy — sin abrir apps de marcadores ni sitios de ligas.

Una **capa de datos** (un script que sabe qué juegos de mis equipos/ligas hay hoy)
y **capas de entrega** que ponen ese dato frente a mis ojos sin pedirlo.

## Cómo funciona

```
statsapi.mlb.com ─┐
ESPN (WNBA/NBA) ──┤                       ┌─ web/index.html   (página de inicio de Firefox)
TheSportsDB ──────┼→ src/fetch-games.ts ─→ web/data.json ─────┼─ src/print-terminal.ts (banner en la terminal)
HockeyTech (PWHL)─┘   (launchd: 6/12/17h)   web/data.js       └─ futuras superficies (e-ink, teléfono…)
```

`data.json` guarda una ventana rodante: hoy + resultados de los últimos `historyDays`
días (7 por defecto). Los días que salen de la ventana se archivan en `archive/YYYY-MM.json`,
así el archivo vivo pesa ~100 KB para siempre y nada se pierde.

## Instalación

```sh
npm install        # solo devDependencies (typescript)
./install.sh       # agente launchd + instrucciones de Firefox y .zshrc
```

Pasos manuales que imprime el instalador:

1. **Firefox** → Ajustes → Inicio → Página de inicio = `file:///…/web/index.html`
2. **~/.zshrc** → `source "$HOME/calendario-deportivo/shell/calendario.zsh"`

## Uso diario

No hay uso diario — esa es la idea. Abre Firefox o una terminal y ahí están los juegos.

- `calendario` — reimprime el banner a demanda (el automático sale máx. 1 vez cada 30 min).
- `npm run fetch` — refresca los datos a mano.
- La página se auto-actualiza (marcadores en vivo de MLB/ESPN cada 60 s mientras esté visible).

## Configuración (`config.json`)

- `historyDays` — días de historia visibles en la página.
- `leagues.<liga>.teams` — `"all"` o lista de filtros (`"Dodgers"`, `"LAD"`, o id de la API).
- `leagues.nba.enabled: true` cuando empiece la temporada, con tu equipo en `teams`.

## Fuentes de datos (verificadas jul 2026)

| Liga | Fuente | Nota |
|---|---|---|
| MLB | statsapi.mlb.com (oficial) | CORS abierto → marcador en vivo en la página |
| WNBA / NBA | site.api.espn.com | CORS abierto → marcador en vivo en la página |
| Liga MX Femenil | TheSportsDB (liga 5206, key gratuita `123`) | ESPN no la tiene; fixtures de temporada nueva pueden tardar en cargarse |
| PWHL | HockeyTech modulekit (`client_code=pwhl`) | Temporada nov–may; en verano no hace llamadas |

## Pruebas

```sh
npm test           # node:test con fixtures reales de cada API
npm run typecheck
```

## Página hospedada (GitHub Pages)

El workflow ya existe: `.github/workflows/update-and-deploy.yml` corre `fetch-games.ts`
en el mismo horario que launchd (6/12/17h, `TZ=America/Monterrey`), guarda la historia
committeando `web/data.*` y `archive/`, y publica `web/` en GitHub Pages. Pasos únicos:

```sh
git init -b main && git add -A && git commit -m "calendario deportivo"
gh repo create calendario-deportivo --public --source=. --push
```

Luego en GitHub: **Settings → Pages → Source = "GitHub Actions"**, y corre el workflow
una vez (**Actions → Actualizar datos y publicar en Pages → Run workflow**). La página
queda en `https://<usuario>.github.io/calendario-deportivo/` — ponla como página de
inicio de Firefox (escritorio y teléfono). Nota: en plan gratuito Pages requiere repo
público; los datos son marcadores públicos, no hay nada sensible.

## Rutas futuras de entrega (el contrato es `data.json`)

- **E-ink**: la pantalla consulta el `data.json` hospedado, o un paso extra lo renderiza a PNG 1-bit.
- **Android sin notificaciones**: widget KWGT leyendo el JSON hospedado, o la página como PWA,
  o página de inicio de Firefox móvil.
- **Barra de menús de macOS**: plugin SwiftBar/xbar que lea `data.json` (`⚾ 8:10 | 🏀 ×2`).
- **Calendario**: generar un `.ics` desde `data.json` y suscribirse en Calendario — los juegos
  aparecen en todos los dispositivos, sin notificaciones.
