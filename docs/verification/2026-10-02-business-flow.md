# Evidencia integrada — procesos, tareas y reportes

Fecha local: 2026-10-02. Zona de ejecución: America/Mexico_City.
Última compilación verificada: antes de `2026-10-02T19:06:47-06:00`.
Repositorio: `D:/respaldo de proyectos/CRM Corporativo`.
Rama: `crm-corporativo`. HEAD base: `6d4793dd6d7aeea91aa6a034e00b17d7408a2d08`.
El árbol contiene cambios locales sin commit. HEAD no identifica todos los archivos verificados.
No existe remote de este repositorio. Este recibo no acredita publicación.

Estado: incremento local verificado. Versión completa y aceptación empresarial pendientes.
Este recibo conserva el estado histórico del 2 de octubre. Las huellas no identifican los cambios posteriores.
El [recibo del 3 de octubre](2026-10-03-opportunity-authorization.md) documenta autorización de oportunidades y regresiones posteriores.
Corporativo S&F es el consumidor del primer piloto. No se decide propiedad legal por esta relación.
Coolify en `paas-control` permanece como destino futuro. No se realiza instalación.

## Alcance y aislamiento

Las pruebas usan empresas, usuarios, dominios, oportunidades, tasas y tareas ficticias.
Los dominios de ensayo usan `example.test`.
La base de integración usa PGlite en memoria y un socket loopback efímero.
El harness restringe el entorno del proceso hijo y desactiva IA y telemetría.
No se lee configuración, datos ni credenciales del checkout tercero.
No se conecta una cuenta empresarial ni un proveedor de IA.
No se modifica homelab, SSH, Coolify, Tailscale, DNS ni reglas de red.
No se escribe Linear, Trello, Notion, Drive o GitHub.
No queda un nuevo servicio persistente activo.

Las migraciones se aplican sólo a fixtures desechables. No se ejecuta `db:deploy` contra una instalación persistente.
La compilación usa variables sintéticas y una URL loopback sin PostgreSQL activo.
No existen `.env` ni `.env.local` propios durante estas compilaciones.

## Funciones integradas

### Procesos comerciales

- Procesos y etapas configurables con identificadores estables, orden, revisión y proceso predeterminado.
- Resultados OPEN, WON, LOST y DISQUALIFIED independientes de los nombres visibles.
- Configuración reservada a owner y admin. La API vuelve a comprobar la membresía dentro de la transacción.
- Cambios concurrentes de configuración rechazados mediante revisión y bloqueo transaccional.
- Etapas retiradas, no borradas. Etapas ocupadas y procesos ocupados rechazan archivo.
- Alta de oportunidades mediante proceso y etapa explícitos en ambos formularios existentes.
- Cambios de etapa con actor, fecha, razón y nombres históricos preservados.
- Traslado entre procesos con confirmación y proceso destino explícito.
- Pérdida y descalificación con razón obligatoria.
- Operaciones masivas con las mismas reglas por registro y resultados parciales explícitos.
- Filtros por etapa real en URL y API. La clasificación heredada conserva su filtro separado.
- Orden por proceso, posición de etapa, fecha esperada e identificador.
- Cada entrada nueva a WON crea una tarea de entrega para el responsable. No asigna un SLA contractual.

La migración conserva clasificación heredada, importes, conversiones, archivos y fechas de los registros antiguos.
No inventa historial previo. El historial comienza con cambios nuevos.

### Tareas

- Autor y responsable separados. La reasignación conserva la autoría.
- Alta, edición, reasignación, prioridad, fecha límite, finalización y reapertura.
- Prioridades entre cero y tres. El formulario indica UTC de forma explícita.
- Edición permitida al autor, responsable, owner o admin.
- Reasignación reservada a owner y admin. El servidor comprueba al miembro destino.
- Relaciones consistentes entre empresa, contacto y oportunidad.
- Registros archivados rechazan altas y cambios de tareas.
- Bandeja personal y tareas vencidas consultadas por responsable, no por autor.
- Conflictos serializables explícitos. Un fallo de índice derivado no presenta una escritura confirmada como fallida.
- Búsqueda del responsable con consulta limitada y preservación de la selección actual.

### Reportes e importes

- MXN disponible sin imponer moneda ni tasas a Corporativo S&F.
- Dashboard sin oportunidades archivadas en conteos, importes ni actividades vinculadas.
- Conteos independientes de la elegibilidad monetaria. Sólo se suman conversiones válidas en la moneda de reporte.
- Oportunidades mayores ordenadas por valor válido antes del límite de consulta.
- Cero medido distinto de importe ausente. Conversión inválida distinta de tasa faltante.
- Avisos de gráficos sin afirmar ausencia de oportunidades cuando existen registros sin valor positivo.
- Formato monetario compartido determinista entre defaults `es-MX` y `es-ES`.
- Entrada decimal exacta sin redondear sufijos, exponentes o fracciones inválidas.

El gráfico conserva la clasificación heredada de resultados. No agrega por nombres de etapas configurables.
La interfaz lo declara. La configuración de locale y zona empresarial sigue pendiente.

### Identidad y entrega

La identidad vectorial compartida usa la familia Carbon existente.
La navegación principal y los accesos móviles mantienen rutas y nombres accesibles en español.
Las pruebas de identidad inspeccionan fuente y render estático. No prueban navegación de navegador.
Las guías distinguen funciones disponibles, configuración pendiente y capacitación sin ejecutar.
El kit documental incorpora verificación de enlaces, plantillas vacías y marcadores sintéticos.
El README separa el CRM propio de la documentación histórica upstream. La licencia MIT permanece intacta.

## Resultados ejecutados

Cada fila corresponde a un proceso aislado. Los mocks de servicio no contaminan los harnesses de Prisma.

| Ejecución | Resultado | Afirmaciones | Qué prueba |
| --- | --- | --- | --- |
| Formularios, identidad y presentación monetaria, tres archivos | 73 pass, 0 fail | 168 | Contratos puros, render estático, configuración, fechas, roles y locale determinista. |
| Tareas y dashboard, dos archivos | 89 pass, 0 fail | 9574 | Contratos, identidad servidor, permisos focales, relaciones, archivo y cálculos sintéticos. |
| Monedas | 23 pass, 0 fail | 77 | Catálogo MXN, conservación del fallback y conversiones de fixtures. |
| Migraciones comerciales | 32 pass, 0 fail | 125 | Conservación de datos antiguos, FKs, índices, trigger, historial y asignación. |
| Flujo comercial con Prisma y servicios reales | 22 pass, 0 fail | 81 | Configuración, altas, cambios, historia, entrega, tareas, filtros y operación masiva. |
| Acceso local con BetterAuth HTTP | 11 pass, 0 fail | 29 | Acceso administrado y denegaciones después de todas las migraciones. |
| **Total seleccionado de esta reejecución** | **250 pass, 0 fail** | **10054** | **Incremento focal; no aceptación completa.** |

Las afirmaciones repetidas de predicates no equivalen a escenarios empresariales independientes.
No se suman las 260 pruebas del [recibo anterior](2026-10-02-local-foundations.md).
Hay pruebas repetidas entre recibos. El número actual tampoco sustituye la ejecución completa de todas las suites.

TypeScript API: PASS. TypeScript app: PASS después del último build.
Next.js 16.3.0: PASS; 33 páginas generadas con configuración sintética.
Bundle API: PASS; 188 módulos; `main.js` 0.72 MB y mapa 1.31 MB.
El sandbox rechaza primero la escritura del bundle Bun. La reejecución local autorizada termina con código cero.
No se arranca el bundle ni el servidor Next por este resultado.

Validador documental: PASS; 15 documentos, 57 enlaces locales y plantillas sintéticas comprobadas.
Suite del validador: tres pruebas PASS. Estas pruebas documentales no se suman a las 250 pruebas del producto.
El primer intento detecta dos enlaces al recibo todavía ausente. La creación de este recibo resuelve ambos enlaces.
La comprobación no conecta servicios ni declara una entrega empresarial ejecutada.
Biome final: 52 archivos comprobados, sin diagnósticos ni cambios automáticos.
`git diff --check` final: PASS. Los avisos LF/CRLF de Git no representan errores de espacios.

### Conservación de migraciones

El harness aplica 56 migraciones precedentes y luego las dos migraciones nuevas.
Siembra registros antiguos antes del incremento comercial.
Las pruebas SQL esperan errores dentro de un bloque PostgreSQL con savepoint.
Ese patrón evita un defecto de recuperación de conexiones del adaptador PGlite-socket.
No prueba recuperación de conexiones ni concurrencia de PostgreSQL 17.
El harness verifica `ECONNREFUSED` después de cerrar su socket.

| Migración | SHA-256 |
| --- | --- |
| `20261002210000_configurable_pipelines` | `44a0df8b8eb26ede1729bc5018f057a81de0460043e8b31bf348f3d684886400` |
| `20261002210100_assigned_tasks` | `7b161df3e609ac783cbcce9605206db039c687803714ed93e8e69427c4ab0b56` |

## Reproducción segura

Desde `apps/app`:

```powershell
bun --no-env-file test test/business-forms.spec.tsx test/product-identity.spec.tsx test/dashboard-money.spec.ts
bun --no-env-file run check-types
```

Desde `apps/api`:

```powershell
bun --no-env-file test test/activities-tasks.spec.ts test/dashboard-summary.spec.ts
bun --no-env-file run check-types
bun --no-env-file run build
```

Desde la raíz, sin URL de datos ambiental:

```powershell
bun --no-env-file test packages/db/test/currency.spec.ts
$env:CRM_BUSINESS_SCHEMA_TEST='1'
bun --no-env-file run test:business-schema
bun --no-env-file run test:business-flow
bun --no-env-file run test:local-access
node docs/delivery/validation/check.mjs
node --test docs/delivery/validation/check.test.mjs
```

El harness comercial sólo usa su base desechable. El flag no autoriza otra URL ni una migración persistente.
Los builds Next requieren variables sintéticas y proveedores apagados, como en el recibo anterior.
No copiar estas variables a producción. No ejecutar scripts de reset o seed sobre datos empresariales.

## Huellas de código verificado

| Archivo | SHA-256 |
| --- | --- |
| `apps/api/src/pipelines/pipelines.service.ts` | `EEEBEAD1993ECF5C14C46A508B475C0C7BFA442BA87F4DF17B50C9B119CD5652` |
| `apps/api/src/deals/deals.service.ts` | `DB51E18D460D72A6E20E96357EC6CD1C40CB4A2335825A8A39305AFE23DBFDAC` |
| `apps/api/src/activities/activities.service.ts` | `F9D4CD357B1472D9EFCEB81D18A22B297E4E37037064B4DEFC37F3040147FD10` |
| `apps/api/src/dashboard/dashboard.service.ts` | `D9E6AA71A83FE2568ACD859B08C0C138A1CAB165B19609A0C535F2B37C5FECBF` |
| `apps/api/test/local-business-flow.integration.spec.ts` | `D7B3C3A864ECCCE55AD5951FF7A6ABABC5C99D364D8DC20D6DD87E1724071F4E` |
| `packages/auth/scripts/verify-business-schema.mjs` | `6B5E65974A49EBFF2A78009E275C1034EC088373FCFB273ABA62AFF5CDEFEA57` |
| `packages/auth/scripts/verify-local-access.mjs` | `CC937183BA5FC4D7062D49249B94E4F0B7949F5B0B3B2C5C2D5E6FD28A5AD9DC` |
| `packages/ui/src/lib/format.ts` | `A10F3E5A86E2086446CB86F567798A20DEEA163E276CA7872FBD3DE19380F5B0` |
| `packages/validation/src/deal-money.ts` | `B6FB03F5A8E0018FE26553FD331E44EE0A3B8520574F7885ED399C6C7DB6B506` |
| `apps/app/lib/dashboard-presentation.ts` | `0463945308420EDBB504D61F584822C926942C2F7CFA22BD41D179EEE7790207` |
| `apps/app/app/(app)/[slug]/deals/create-deal-sheet.tsx` | `4D0F34F8C35F0565748C7A8A39B7B1DAA4631FFB48E509DE09E3FFC62894A6D5` |
| `apps/app/components/crm/activity-tasks/activity-task-controls.tsx` | `979770ED4D04F245BCB3B973813CA67C619A6F912C719B87A2AF9206458157F2` |

## Integración de equipo y método

Seis especialistas entregan trabajo completo o parcial. Todas sus ejecuciones quedan cerradas.
El principal integra tareas, procesos, harnesses y documentación después de los límites de uso de los especialistas.
El principal ejecuta las comprobaciones anteriores en el árbol integrado.
Las reglas Prisma y Nest-tRPC guían transacciones, contratos y regeneración del router.
Las reglas shadcn y nuqs guían controles compartidos y filtros URL tipados.
Las reglas Next.js guían separación servidor/cliente y presentación monetaria determinista.
No se instala una biblioteca UI nueva ni se inventa aceptación visual.

## Registro local del motor

El anexo del motor enlaza este recibo mediante `plan:work:crm-business-flow-20261002`.
El ensayo focal queda `completed-record`. El desarrollo completo y la admisión siguen `pending`.
La propiedad legal conserva `owner_entity=unclassified`.
Build local: `551aa518a420b82d00e5`, generado `2026-10-03T01:14:56Z`.
Las 145 pruebas del motor pasan. Dos pruebas nuevas bloquean promoción indebida a propiedad, instalación o aceptación completa.
El chequeo focal CRM pasa. El motor conserva `engine_changed=false`.
El chequeo general interno devuelve código dos; PowerShell presenta su excepción con código uno.
Noventa y tres fuentes remotas y cuatro locales requieren relectura.
La reconstrucción sólo lee fuentes permitidas locales. No renueva APIs ni publica la réplica.
`motor-conocimiento/SYNC.md` registra destinos escritos y pendientes.

## Issues

1. NOT DONE — Los 44 escenarios completos conservan aceptación pendiente. Este incremento no termina la versión empresarial.
   Fix: completar funciones R2, R3 y ensayos R4 técnico antes de solicitar instalación.
2. NOT DONE — Documentos privados versionados, calendario local e importación/exportación portables siguen sin implementación completa.
   Fix: implementar almacenamiento privado, agenda y previsualización repetible de importaciones.
3. RISK — La autorización empresarial completa no cubre todos los escritores. Este recibo histórico no acredita los controles posteriores.
   Fix: consultar el recibo del 3 de octubre para oportunidades. Extender controles al resto antes de datos reales.
4. NOT DONE — Los cinco perfiles empresariales, suspensión, recuperación de cuentas y auditoría amplia siguen pendientes.
   Fix: completar el ciclo de identidad y trazabilidad, no sólo las tres membresías heredadas.
5. NOT DONE — PostgreSQL 17, concurrencia, reinicios, recuperación de conexiones y diagnóstico del error original no tienen ejecución integrada.
   Fix: probar una instancia sintética independiente. PGlite no sustituye esa evidencia.
6. NOT DONE — Docker Linux, instalación limpia, actualización, dos instancias independientes y restauración completa no tienen ensayo operativo.
   Fix: completar pruebas aisladas, backup de archivos, cifrado y copia offsite antes de prometer RPO/RTO.
7. NOT DONE — La interfaz conserva textos upstream y no tiene aceptación de navegador, teclado, responsive ni capacitación empresarial.
   Fix: ejecutar los recorridos completos y completar traducción e identidad visual.
8. RISK — Reportes paralelos no comparten snapshot transaccional. La zona empresarial y la precisión extrema no están aceptadas.
   Fix: validar concurrencia, timezone y transporte monetario exacto antes de aceptar métricas empresariales.
9. NOT DONE — Auditoría de configuración, paginación del historial y política de reutilización de nombres retirados siguen pendientes.
   Fix: cerrar los contratos administrativos sin borrar identificadores ni historia.
10. RISK — Herramientas IA heredadas todavía usan clasificaciones antiguas. Desactivar IA no cancela solicitudes ya iniciadas.
    Fix: adaptar herramientas a identificadores reales y completar política de cancelación y salida. Mantener IA apagada.
11. UNKNOWN — Etapas, responsables, moneda, locale, contratos y perfiles reales de S&F requieren confirmación empresarial.
    Fix: revisar las plantillas sin inventar decisiones a partir de la web pública.
12. UNKNOWN — Capacidad, cuota, hostname, TLS, acceso, privacidad y admisión de homelab no están acreditados para este CRM.
    Fix: verificar el destino después de la versión completa y una autorización independiente de instalación.
13. NOT DONE — Suite completa y pruebas HTTP de autorización empresarial no se ejecutan en este recibo.
    Fix: adaptar fixtures heredados y probar todos los routers mediante el transporte real.
14. NOT DONE — Plataformas externas y freshness general del motor no tienen renovación en este incremento.
    Fix: separar registro local de relecturas y escrituras externas autorizadas. No anunciar alineación total.
15. RISK — El selector limita coincidencias y las consultas fallidas no tienen recuperación de borrador aceptada en navegador.
    Fix: probar búsqueda, fallos, revocación y preservación de selección en los formularios completos.
