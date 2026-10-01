# Empresas ↔ Ejecutivas — fuente canónica

Fecha canónica: 2026-10-01

Fuente original: `Empresas y Ejecutivas(1).xlsx` proporcionado por operación.

- 210 empresas.
- Carolina: 75.
- Javiera: 73.
- Olga: 62.
- 0 RUT duplicados.
- 0 empresas duplicadas tras normalización.
- 0 campos vacíos.
- SHA-256 del XLSX original: `78f709e9e21b4c4001fe19d41950c2aebb6a010980fd37ae894b7cbd34db9276`.

Regla: el RUT es la identidad canónica de empresa. La relación `Empresa/RUT → Ejecutiva` de este archivo debe considerarse fuente operativa de verdad para asignaciones de ChileFlota hasta que exista una fuente posterior explícitamente aprobada.

Hallazgos relevantes para QA:
- `12671737-7 · Cristian Mauricio Jimenez Reyes → Carolina`.
- `77503624-9 · Transportes Jrm E Hijos Limitada → Carolina`.
- `77653071-9 · 4Vial SPA → Carolina`.

Nota: la fuente escribe **Jrm**, no **Jmr**.
