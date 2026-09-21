# ChileFlota — Design System

## Propósito

ChileFlota es una superficie operacional de cumplimiento: sobria, rápida de leer y estable bajo presión. La interfaz debe priorizar decisiones, evidencia y acciones por sobre decoración. Esta guía es la fuente de verdad visual para producto, diseño y desarrollo.

La referencia visual es el shell lateral aprobado: grafito casi negro, tipografía gris clara y un único acento burdeo contenido.

## Principios

1. **Operación primero.** Una persona debe reconocer qué requiere atención, a quién afecta y la siguiente acción sin recorrer tarjetas decorativas.
2. **Un solo acento de marca.** El burdeo identifica selección, foco y acción primaria; no se usa como relleno general.
3. **El color comunica estado, no categoría.** Aprobado, atención, error y datos informativos usan semántica consistente en todas las rutas.
4. **Profundidad mínima.** El sistema es plano: separación con escala tonal, borde sutil y espacio; nunca con gradientes o sombras grandes.
5. **Contraste accesible.** El texto de trabajo debe ser legible sobre grafito. El gris tenue es sólo para metadata secundaria.

## Tokens de color

Los valores siguientes son los tokens canónicos. No introducir `slate-*`, `zinc-*`, `orange-*`, `purple-*` u otros colores ad-hoc en páginas o componentes sin extender primero este documento.

### Neutros

| Token | Hex | Uso |
| --- | --- | --- |
| `--cf-canvas` | `#171719` | Fondo raíz y áreas fuera del contenido. |
| `--cf-sidebar` | `#1D1D1F` | Navegación lateral y shell. |
| `--cf-surface` | `#232326` | Contenedores, tablas y paneles. |
| `--cf-surface-raised` | `#2A2A2E` | Hover, inputs y superficies elevadas. |
| `--cf-border` | `#36363B` | Divisores y bordes discretos. |
| `--cf-text` | `#E7E7E9` | Titulares, valores y texto principal. |
| `--cf-text-secondary` | `#B1B1B6` | Labels, navegación no activa y texto auxiliar. |
| `--cf-text-muted` | `#7D7D84` | Fechas, IDs y metadata no crítica. |

### Marca e interacción

| Token | Hex | Uso |
| --- | --- | --- |
| `--cf-accent` | `#873146` | Ítem de navegación activo, botón primario y foco. |
| `--cf-accent-hover` | `#9B3A52` | Hover/press de acciones primarias. |
| `--cf-accent-soft` | `#3B2029` | Fondo tenue de selección o foco persistente. |
| `--cf-focus-ring` | `#C86A82` | Anillo de foco visible; nunca eliminarlo. |

### Estados operacionales

| Estado | Fondo tenue | Texto/icono | Uso |
| --- | --- | --- | --- |
| Aprobado / vigente | `#173B2C` | `#67C18D` | Cumple con evidencia vigente. |
| Pendiente / revisión | `#40341B` | `#D9B65C` | Requiere revisión humana. |
| Por vencer | `#4A2F18` | `#E6A35A` | Vence pronto; acción preventiva. |
| Rechazado / vencido / crítico | `#45242B` | `#E17B8C` | Incumplimiento o bloqueo. |
| Informativo | `#1D3544` | `#7CB8D7` | Contexto sin acción urgente. |

No usar verde, ámbar, rojo o azul como fondo de una página completa, navegación o tarjeta estructural. Se reservan para badges, iconos, indicadores y bordes de estado.

## Tipografía y jerarquía

- **Familia:** `Inter`, con `system-ui` como fallback. No mezclar familias dentro del producto.
- **Título de página:** 24–28 px, peso 600, `--cf-text`.
- **Título de sección:** 16–18 px, peso 600, `--cf-text`.
- **Texto de trabajo:** 14 px, peso 400–500, `--cf-text-secondary` o `--cf-text` según prioridad.
- **Metadata y labels:** 12–13 px, peso 400–500, `--cf-text-muted`.
- **Valores clave:** 24–32 px, peso 600; acompañar con label explícito y periodo cuando corresponda.

Evitar mayúsculas extensas, pesos 700/800 y texto blanco puro. Los badges pueden usar mayúsculas sólo si tienen menos de dos palabras.

## Shell y navegación

- Sidebar fija con `--cf-sidebar`; nunca negra pura ni azulada.
- Marca: “ChileFlota” en `--cf-text`; “Transportes Labbé” en `--cf-text-muted`.
- Ítem inactivo: icono y texto `--cf-text-secondary`; hover sólo cambia a `--cf-text` con superficie `--cf-surface-raised` tenue.
- Ítem activo: fondo `--cf-accent`, texto/icono `--cf-text`; radio de 4–6 px. No añadir borde, gradiente ni sombra.
- Mantener un máximo de un ítem activo. Cada módulo debe conservar el mismo shell y orden de navegación.

## Componentes

### Botones

- **Primario:** `--cf-accent` / `--cf-accent-hover`, texto `--cf-text`. Para una única acción principal por bloque.
- **Secundario:** superficie transparente o `--cf-surface-raised`, borde `--cf-border`, texto `--cf-text-secondary`.
- **Destructivo:** usar el token crítico sólo cuando la acción cambia estado o elimina; nunca como botón predeterminado de una tarjeta.
- Los iconos no sustituyen el texto en acciones operacionales importantes.

### Cards, tablas y métricas

- Base `--cf-surface`, borde de 1 px `--cf-border`, radio 6–8 px.
- Sin tarjetas dentro de tarjetas. Una página tiene un canvas y bloques de contenido claramente separados.
- Métricas: no asignar un color diferente a cada tarjeta. Usar texto neutro y un indicador semántico sólo cuando el estado lo justifique.
- Tablas: header en `--cf-surface`, filas sobre canvas/surface; hover discreto con `--cf-surface-raised`.

### Inputs, filtros y búsqueda

- Fondo `--cf-surface-raised`, borde `--cf-border`, texto `--cf-text`.
- Placeholder `--cf-text-muted`.
- Foco: borde/acento y anillo `--cf-focus-ring`; no usar azul genérico del navegador como estilo final.

### Badges y alertas

- Badge compacto: fondo tenue + texto semántico; sin bordes brillantes.
- Todo estado debe incluir texto además del color: “Aprobado”, “Por vencer”, “Revisión”, etc.
- Una alerta debe mostrar: entidad afectada, evidencia/razón, antigüedad y destino de la acción.

## Espaciado y layout

- Escala: 4, 8, 12, 16, 24, 32 y 48 px.
- Padding de página: 24 px desktop; 16 px móvil.
- Separación entre título y contenido: 24 px.
- Densidad de tabla y cola: compacta pero no comprimida; altura mínima interactiva 40 px.
- En móvil, filtros y acciones deben apilarse antes de truncar etiquetas o forzar scroll horizontal.

## Reglas de implementación

1. Definir y consumir variables CSS/tema semánticas; no repetir hexadecimales en JSX.
2. Reemplazar clases visuales genéricas por tokens ChileFlota al tocar una superficie. Ejemplo: `bg-slate-800` → `bg-[var(--cf-surface)]`.
3. Mantener los estados semánticos en un helper/variantes compartidas, no con condicionales de color dispersos.
4. Toda nueva pantalla debe usar el shell, escala de espaciado y componentes existentes antes de crear variaciones.
5. Revisar escritorio y móvil, más estados vacío, carga, error, deshabilitado y foco antes de marcar una UI como PASS.

## Antipatrones prohibidos

- Gradientes, glassmorphism, neón o sombras difusas grandes.
- Mezclar burdeo, naranja, azul y verde como acentos de navegación.
- Texto blanco puro o gris de bajo contraste para información de trabajo.
- Contadores con colores arbitrarios sin semántica operacional.
- Botones “Aprobar/Rechazar” visualmente equivalentes cuando una acción es destructiva.
- Duplicar headings, frames o títulos de módulo.

## Checklist de revisión visual

- ¿La navegación activa usa sólo el burdeo canónico?
- ¿La superficie, bordes y textos usan tokens ChileFlota?
- ¿Cada color de estado coincide con su significado operacional?
- ¿Un usuario puede distinguir estado sin depender del color?
- ¿Hay contraste, foco y targets táctiles suficientes?
- ¿La interfaz se ve como un único producto, no como páginas de librerías distintas?


## Regla de cobertura

DESIGN.md aplica a **toda superficie autenticada y pública**: login, shell, contenido de páginas, tablas, filtros, modales, estados vacíos, onboarding, formularios y vistas móviles.

No se considera una migración completa si sólo cambió el shell o el login. Al tocar una ruta, el contenido interior debe cumplir también:

- Sin `slate-*`, `orange-*`, `cyan-*`, gradientes o sombras decorativas en JSX.
- Títulos de página de 24–28 px y peso 600; evitar `text-4xl/text-5xl` y `font-bold`.
- Cards planas con `--cf-surface`, `--cf-border` y radio 6–8 px.
- Estados con los tokens semánticos definidos en esta guía.
- Una sola acción primaria por bloque.
- No duplicar un título que ya exista en el shell.
