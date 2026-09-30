# ChileFlota

> **Transport Compliance OS**

[ChileFlota](https://chileflota.app) es una plataforma de compliance operacional para flotas desarrollada por **N3uralia** e implementada actualmente para **Transportes Labbé**. Conecta empresas de transporte, subcontratistas, conductores, vehículos, documentos, evidencia externa, revisión humana, automatización e inteligencia operacional en un modelo trazable.

<p align="center"><strong>Evidencia → Estado canónico → Decisión operacional → Acción → Trazabilidad</strong></p>

---

## Qué resuelve

ChileFlota reemplaza la gestión documental aislada por un sistema operacional basado en evidencia. El objetivo es responder de forma consistente preguntas como:

- ¿qué empresa, conductor o documento requiere atención?;
- ¿qué evidencia está vigente, pendiente, rechazada o vencida?;
- ¿qué cambió respecto de una versión anterior?;
- ¿qué información respalda una decisión de compliance?;
- ¿qué debe revisar una ejecutiva o prevencionista a continuación?;
- ¿qué puede resolverse automáticamente y qué debe escalarse a revisión humana?;

El sistema conserva historia y procedencia. Un documento renovado o corregido no elimina silenciosamente la evidencia anterior.

---

## Objetos operacionales

| Objeto | Capacidades actuales |
|---|---|
| **Empresa / transportista** | identidad canónica, RUT, razón social, contexto documental y estado observado de compliance |
| **Subcontratista** | gestión, documentación, relación operacional y seguimiento de evidencia |
| **Conductor** | identidad, RUT, estado, licencia, vencimiento, documentos y evidencia vigente |
| **Vehículo** | identidad vehicular, evidencia documental, PRT e historial asociado |
| **Documento** | carga, versionado, estado, vigencia, aprobación/rechazo, visualización, descarga y trazabilidad |
| **Evidencia externa** | integración y reconciliación con fuentes como PRT/SII cuando corresponde, sin sobrescribir la fuente original |
| **Usuario / equipo** | perfiles, roles operacionales y vistas acotadas por autorización |
| **Automatización** | ingestión, OCR, procesamiento, reconciliación, jobs y manejo de excepciones |

---

## Superficies principales

La aplicación operacional incluye actualmente:

- **Dashboard** — resumen y control operacional.
- **Gestión de Equipo** — administración del equipo interno y sus accesos.
- **Subcontratistas** — gestión de empresas y su evidencia.
- **Conductores** — consulta y seguimiento documental de conductores.
- **Documentos** — colas, búsqueda, filtros, revisión y estados documentales.
- **Analytics** — lectura operacional de conductores y documentación.
- **Reportes** — vistas consolidadas y exportables según los flujos disponibles.
- **Compliance Matrix** — lectura estructurada del estado de cumplimiento y su evidencia.
- **Impacto Operacional** — métricas y señales de operación.
- **Perfil** — datos del usuario y sesión.

La navegación y el shell responsivo mantienen una única jerarquía operacional para escritorio y móvil.

---

## Gestión documental

ChileFlota incluye un ciclo documental completo:

- carga de documentos;
- asociación a empresa, subcontratista, conductor o vehículo según el caso;
- clasificación por tipo documental;
- control de vigencia y fecha de expiración;
- estados pendientes, aprobados y rechazados;
- motivo de rechazo cuando existe;
- conservación de versiones e historial;
- distinción entre evidencia actual e histórica;
- filtros por período, empresa, ejecutiva y tipo documental;
- búsqueda por documento, empresa, RUT o conductor;
- visualización y descarga de evidencia;
- colas operacionales para revisión humana;
- reconciliación entre evidencia procesada y estado operacional.

La plataforma evita tratar filas históricas o legacy como si fueran automáticamente el estado vigente.

---

## Búsqueda inteligente

El buscador superior funciona como una única entrada para búsqueda exacta y consultas operacionales.

### Búsqueda determinística

El typeahead autenticado puede resolver:

- RUT de empresa;
- razón social o nombre de empresa;
- RUT de conductor;
- nombre completo de conductor;
- nombre de archivo/documento;
- documentos aprobados y evidencia vigente disponible en los dominios implementados.

El ranking prioriza coincidencias exactas antes que coincidencias parciales. Empresa, conductor y documento aparecen diferenciados en el typeahead.

### Intelligence Core

ChileFlota incorpora un **Intelligence Core read-only** que reutiliza la misma superficie del buscador, sin agregar un chatbot separado.

Arquitectura actual:

```text
consulta
  ↓
router determinístico
  ↓
fast path | operational agent
  ↓
herramientas autorizadas y acotadas
  ↓
evidencia estructurada
  ↓
respuesta + siguiente acción existente
```

Capacidades implementadas:

- resolución de empresas por nombre o RUT;
- consulta de documentos actuales de empresa;
- resumen de estados documentales observados;
- lectura conservadora de compliance de empresa;
- resolución de conductores por nombre o RUT;
- consulta de documentos actuales de conductor;
- lectura de licencia y vencimiento;
- detección de conductor activo/inactivo;
- identificación de documentos rechazados, pendientes o vencidos;
- respuestas compactas con hechos, interpretación, desconocidos y siguiente acción.

Ejemplos de consultas soportadas:

```text
documentos de Transportes X
cumplimiento de Transportes X
puede operar Transportes X
documentos del conductor Juan Pérez
licencia del conductor Juan Pérez
qué le falta al conductor Juan Pérez
puede trabajar el conductor Juan Pérez
```

### Guardrail de clearance

El Intelligence Core puede detectar señales observadas de riesgo o bloqueo, pero **no declara una entidad como APTO/cleared mientras la cobertura operacional completa no esté certificada**.

Esto evita convertir evidencia parcial en una decisión operacional falsa.

---

## Conductores

El dominio de conductores incluye actualmente:

- búsqueda por nombre y RUT;
- nombres y apellidos canónicos;
- relación con transportista cuando existe;
- estado activo/inactivo;
- clase de licencia cuando está disponible;
- fecha de vencimiento de licencia;
- documentos vigentes asociados;
- estados de validación documental;
- fechas de expiración;
- motivos de rechazo;
- acceso directo desde el buscador inteligente.

---

## Subcontratistas y empresas

La plataforma permite trabajar sobre empresas y subcontratistas con:

- identidad canónica;
- RUT y razón social;
- evidencia documental vigente;
- historial documental;
- estados observados de cumplimiento;
- filtros y búsqueda;
- relación con revisión operacional;
- acceso desde búsqueda exacta e Intelligence Core.

---

## Vehículos y PRT

ChileFlota incluye soporte para evidencia vehicular y procesos de PRT, incluyendo:

- asociación de evidencia a vehículos;
- historial y versiones;
- ingestión de datos PRT;
- procesamiento de lotes grandes;
- workflows reanudables para importaciones de alto volumen;
- reconciliación de evidencia externa con registros internos;
- conservación de procedencia para evitar que una integración externa reemplace silenciosamente la fuente original.

---

## OCR e inteligencia documental

La capa documental incorpora procesamiento automatizado y validación asistida:

- OCR y extracción de contenido;
- extracción estructurada de hechos documentales;
- validadores determinísticos cuando corresponde;
- procesamiento multi-capa;
- análisis de fechas, vigencia y campos relevantes;
- revisión humana posterior;
- separación entre confianza del modelo y verdad revisada;
- conservación de evidencia y trazabilidad del procesamiento.

La plataforma no trata la confianza de un modelo como equivalente a exactitud real.

---

## Alertas, anomalías y excepciones

El sistema contiene capacidades para detectar y presentar excepciones operacionales, entre ellas:

- documentación pendiente;
- documentación rechazada;
- vencimientos;
- inconsistencias entre evidencia y estado;
- anomalías que requieren revisión;
- señales que deben escalarse a una persona;
- estados de procesamiento o jobs que requieren atención.

La filosofía es que la revisión humana se concentre en excepciones y no en trabajo determinístico que puede resolverse automáticamente.

---

## Compliance y evidencia

ChileFlota trabaja con un modelo **evidence-first**:

1. se identifica la evidencia observada;
2. se asocia a una entidad canónica;
3. se valida o reconcilia;
4. se deriva un estado operacional observado;
5. se explicitan desconocidos o evidencia faltante;
6. se entrega una siguiente acción trazable.

Principios:

- evidencia antes que inferencia;
- ausencia de evidencia = desconocido, no incumplimiento automático;
- historia y versiones se conservan;
- una decisión debe poder explicarse con evidencia;
- datos externos no sobrescriben silenciosamente datos internos;
- `APTO` requiere cobertura certificada, no sólo ausencia de alertas visibles.

---

## Seguridad y autorización

El sistema implementa controles de acceso server-side y vistas según rol.

Roles operacionales presentes en la arquitectura incluyen, según el flujo habilitado:

- super admin;
- admin / administrador;
- ejecutiva;
- prevencionista;
- dispatcher / despachador;
- conductor;
- mandante;
- transportista.

Las APIs sensibles deben validar autorización en servidor antes de utilizar clientes privilegiados. El Intelligence Core y la búsqueda inteligente son read-only y no exponen acceso SQL genérico al cliente.

---

## Automatización y seguridad operacional

Las automatizaciones siguen un modelo conservador:

```text
reconstrucción read-only
  ↓
dry-run
  ↓
idempotencia / ledger
  ↓
ejecución
  ↓
resultado real
  ↓
auditoría
```

La plataforma incluye infraestructura para:

- cron jobs;
- procesamiento batch;
- reintentos controlados;
- importaciones reanudables;
- health/status de procesos;
- workflows de reconciliación;
- validaciones de seguridad en CI para componentes críticos.

No se considera exitoso un proceso operacional sólo porque una llamada HTTP respondió correctamente: debe existir evidencia del resultado de negocio.

---

## Trazabilidad

ChileFlota conserva trazabilidad sobre:

- origen de la evidencia;
- identidad de la entidad relacionada;
- versión documental;
- estado de validación;
- revisión humana cuando existe;
- cambios de estado;
- resultados de procesamiento automatizado;
- evidencia histórica relevante.

El objetivo es que una decisión pueda reconstruirse posteriormente sin depender de memoria informal o mensajes externos.

---

## Arquitectura de producto

```text
Operational Core
   ├── Empresas / Subcontratistas
   ├── Conductores
   ├── Vehículos
   ├── Documentos
   └── Usuarios / Roles
            │
            ▼
Canonical Evidence Layer
            │
            ▼
Validation / OCR / Reconciliation
            │
            ▼
Compliance State
            │
            ├── Search / Intelligence Core
            ├── Alerts / Exceptions
            ├── Analytics / Reports
            └── Human Review
            │
            ▼
Operational Action + Auditability
```

Dirección del Intelligence Core:

```text
search / ask
   ↓
router
   ↓
fast path | operational agent
   ↓
authorized read-only tools
   ↓
evidence set
   ↓
answer + direct action
```

---

## Stack técnico

La implementación actual utiliza principalmente:

- **Next.js 14**;
- **React 18**;
- **TypeScript**;
- **Tailwind CSS**;
- **Supabase / PostgreSQL**;
- **Vercel**;
- **Jest**;
- **Zod**;
- **Sentry**;
- **Vercel Analytics**;
- librerías de procesamiento PDF/Excel y pipelines de OCR/IA según el flujo.

El repositorio contiene tests unitarios, validadores chilenos, pruebas OCR, pruebas de seguridad del Intelligence Core y workflows específicos para procesos batch/PRT.

---

## Estado actual del producto

En `main` ya están integrados:

- UI operacional unificada ChileFlota;
- Dashboard y navegación principal;
- Gestión de Equipo;
- Subcontratistas;
- Conductores;
- Document Manager;
- Analytics;
- Reportes;
- Compliance Matrix;
- Impacto Operacional;
- búsqueda autenticada con typeahead;
- búsqueda por empresa, RUT, conductor y documento;
- Intelligence Core v1 para empresas/documentos/compliance;
- Intelligence Core para conductores y evidencia documental;
- respuestas operacionales read-only con guardrails de clearance;
- OCR, procesamiento documental y reconciliación existentes en la plataforma;
- infraestructura de PRT, cron, batch jobs y validaciones de seguridad.

La siguiente expansión natural del Intelligence Core es:

1. Operational Clearance con cobertura certificada;
2. Action Center;
3. evidencia documental detallada;
4. SII y otras fuentes externas correctamente reconciliadas;
5. continuidad conversacional limitada a la tarea actual;
6. acciones controladas sólo después de demostrar calidad read-only y mantener confirmación humana.

---

## Principios de producto

1. **Evidence before inference.**
2. **Missing evidence is unknown.**
3. **History is not a duplicate.**
4. **Canonical identity before automation.**
5. **Sensitive processing stays server-side.**
6. **Automation must reconcile.**
7. **Human review is for exceptions.**
8. **No APTO without certified coverage.**
9. **One intelligence layer, not another parallel app.**
10. **Every operational answer should lead back to evidence and an existing action.**

---

## Producto y relación de marca

**N3uralia** → proveedor de tecnología  
**ChileFlota** → producto / Transport Compliance OS  
**Transportes Labbé** → implementación operacional actual

ChileFlota no transfiere la propiedad tecnológica del producto a la implementación cliente.

---

## Producción

**ChileFlota — Transport Compliance OS**  
[https://chileflota.app](https://chileflota.app)

> La documentación pública evita incluir credenciales, datos privados de transportistas, exportaciones de producción o detalles sensibles de infraestructura.
