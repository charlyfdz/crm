# Evidencia local — autorización de empresas y contactos

Fecha local: 2026-10-04. Zona: America/Mexico_City.
Repositorio: `D:/respaldo de proyectos/CRM Corporativo`. Rama: `crm-corporativo`.
HEAD base: `6d4793dd6d7aeea91aa6a034e00b17d7408a2d08`.
Estado: incremento focal verificado. Versión completa y aceptación empresarial pendientes.
Los cambios permanecen locales, sin commit ni remote propio.
El [recibo anterior](2026-10-03-managed-identity.md) conserva su evidencia histórica.
No sumar recibos. Existen pruebas repetidas.

## Alcance y límites

El usuario autoriza continuar los pendientes y las verificaciones necesarias.
La versión completa precede la instalación en Coolify de `paas-control`.
Corporativo S&F sigue como consumidor piloto. La propiedad legal del producto permanece sin asignar.
El checkout CRM tercero permanece intacto. No se utilizan sus datos ni configuración privada.
No se modifica homelab, SSH, DNS, Tailscale, redes, cuentas reales ni otras instancias locales.
Los fixtures usan usuarios, contraseñas y dominios ficticios `example.test`.
PGlite en memoria sirve SQL por un puerto loopback efímero.
Los wrappers de acceso aplican las 59 migraciones existentes. Este incremento no agrega migraciones.
Nest sirve los routers de empresas y contactos por otro puerto loopback efímero.
Better Auth, contexto tRPC, middleware y servicios reales participan en las pruebas HTTP seleccionadas.
El fixture verifica el cierre HTTP. Los wrappers verifican el cierre SQL.
La base se destruye al finalizar. No queda una instancia persistente nueva.
PGlite no acredita PostgreSQL 17, concurrencia multi-sesión, persistencia, reinicios ni recuperación del pool.
El harness comercial aplica 56 migraciones previas y dos comerciales. No se atribuye la migración de identidad a ese harness.

## Implementación

Los dieciséis procedimientos de empresas y quince de contactos transmiten `ctx.user.id` al servicio.
La identidad autenticada no procede de campos del cuerpo ni del responsable solicitado.
Los métodos públicos exigen el argumento de identidad. La retención usa un helper privado separado.
El helper común valida membresía actual, rol conocido y ausencia de suspensión.
Los roles actuales siguen siendo `owner`, `admin` y `member`.
Las lecturas siguen compartidas por instalación. No existe aislamiento confidencial por responsable.
Las mutaciones bloquean membresía y registro dentro de la transacción.
Un miembro modifica sólo sus registros asignados. Owner/admin modifica otros registros y reasigna responsabilidad.
La reasignación acepta sólo membresías activas con rol soportado.
El alta asigna por defecto al actor. Los miembros no reclaman registros sin responsable.
Owner/admin permite asignación nula explícita. El miembro no elimina su responsabilidad mediante actualización.
La edición de registros archivados se rechaza. Repetir archivo conserva la fecha inicial.
Cada operación masiva informa resultados individuales. No existe una transacción para toda la selección.
La purga pública exige owner y archivo previo. Admin no recibe GRANT implícito.
La retención revalida fecha de archivo dentro de la transacción.
La purga de empresa bloquea oportunidades relacionadas y rechaza oportunidades activas.
La retención omite esa empresa hasta cumplir la regla. No elimina contactos; elimina sus vínculos con la empresa.
Las supresiones de correo, limpieza de tareas y recomputación posterior de actividad conservan regresiones verificadas.

Los selectores de empresa excluyen registros archivados.
El alta de contacto diferencia selección omitida de selección explícita sin empresa.
La selección omitida permite resolver el dominio dentro de la transacción del contacto.
La empresa automática recibe el responsable validado del contacto. Su evento comparte la transacción.
La selección nula evita esa asociación automática.
Los contactos nuevos y restaurados requieren empresa vinculada activa.
Un contacto principal exige misma empresa y estado activo.
Su traslado o archivo exige retirar previamente la designación principal.
Los vínculos existentes con oportunidades impiden trasladar el contacto a otra empresa.
Las sugerencias exigen permiso sobre el contacto y estado PROPOSED vigente dentro de la transacción.

La solicitud manual de investigación comparte autorización y tareas en la misma transacción.
El enriquecimiento de empresa/contacto también guarda su estado en esa transacción.
El aviso de dispatch ocurre después del commit.
Dos negativas insertan tareas reales y después provocan fallo. SQL revierte tareas y conserva el registro completo.
Una prueba habilita sólo la política de cola local y comprueba rechazos por responsabilidad y commits autorizados.
Ese fixture sustituye el aviso de dispatch. No ejecuta workers ni proveedores.
El fixture base conserva IA OFF. Telemetría permanece OFF durante todas las pruebas.
El grupo puro de IA también usa mocks para sus ramas de opt-in.
Las pruebas rechazan llamadas externas. No consumen créditos ni transmiten información empresarial.
La investigación automática posterior al alta o cambio de dominio conserva trabajo pendiente de outbox.
La configuración de workspace y los workers heredados conservan revisiones independientes.

## Resultados seleccionados

| Grupo ejecutado | Casos | Aserciones | Resultado |
| --- | ---: | ---: | --- |
| Formularios, identidad, dashboard y usuarios app | 85 | 202 | PASS |
| Tareas y dashboard API | 89 | 9574 | PASS |
| Monedas | 23 | 77 | PASS |
| Migraciones comerciales desechables | 32 | 125 | PASS |
| Acceso local desechable | 11 | 29 | PASS |
| Flujo comercial y autorización desechables | 35 | 154 | PASS |
| Identidad del router directo y contratos | 19 | 56 | PASS |
| Regresiones de oportunidades aisladas | 46 | 115 | PASS |
| Identidad administrada y HTTP loopback | 30 | 97 | PASS |
| Empresas/contactos SQL, HTTP y rollback de colas | 45 | 153 | PASS |
| Regresiones de empresas/contactos aisladas | 16 | 42 | PASS |
| Política y flujos IA con mocks | 62 | 140 | PASS |
| Total seleccionado, sin sumar historia | 493 | 10764 | PASS |

Las negativas HTTP usan cookies de cuentas ficticias reales del fixture.
Incluyen cuerpo con responsable ajeno, roles inválidos, suspensión, operaciones masivas y vínculos incompatibles.
Las pruebas verifican el estado conservado tras rechazo. No aceptan todo AppModule ni el bridge REST.
Las regresiones heredadas exigen wrapper, base ficticia identificada, loopback y política IA OFF.
Ese guard rechaza su ejecución directa contra una base existente.
El primer intento del harness comercial omite su flag y no ejecuta pruebas.
El segundo intento rechaza URLs ambientales sintéticas. El tercero limpia esas variables y registra los 32 casos PASS.
Las primeras expectativas negativas usan un mensaje de permiso para identidad ausente. Se corrigen sin relajar autorización.
Biome detecta funciones largas. Se extraen helpers sin desactivar la regla.
La última ejecución registra 45 casos nuevos, cero fallos y 153 aserciones.

## Compilación y reproducción

El CLI tRPC genera 22 routers y 169 procedimientos. No se edita manualmente su salida.
TypeScript API y app pasan.
Next compila y genera 33 páginas con entorno sintético, IA OFF y telemetría OFF.
El launcher comprueba ausencia de archivos privados `.env` y `.env.local` propios antes de compilar.
La API compila 189 módulos: bundle 0.75 MB y source map 1.36 MB.
El sandbox rechaza inicialmente su spawn. La ejecución local aprobada completa el build sin iniciar servicios.
Biome revisa dieciséis archivos focales sin errores. Conserva una advertencia de barrel existente en autenticación.
El build no acepta persistencia, navegador, instalación Linux ni producción.

```powershell
bun --no-env-file run test:record-access
bun --no-env-file run test:record-regressions
bun --no-env-file run test:identity
bun --no-env-file run test:local-access
bun --no-env-file run test:business-flow
bun --no-env-file run test:deal-regressions
bun --no-env-file run --cwd apps/api trpc:generate
bun --no-env-file run --cwd apps/api check-types
bun --no-env-file run --cwd apps/app check-types
bun --no-env-file run --cwd apps/api build
node docs/delivery/validation/check.mjs
node --test docs/delivery/validation/check.test.mjs
```

El harness comercial exige `CRM_BUSINESS_SCHEMA_TEST=1` y ausencia de URLs ambientales antes de `test:business-schema`.
Los comandos de generación/build exigen entorno sintético explícito o configuración privada aprobada del operador.
`--no-env-file` no desactiva por sí solo el loader propio de `@crm/env`.
No ejecutar reset, seed, push o migrate contra una base existente para reproducir estas pruebas.
Las guías Prisma y Nest/tRPC orientan las comprobaciones transaccionales y los contratos con identidad autenticada.
La documentación de interfaz se actualiza sin atribuir un ensayo vivo de navegador.

## Huellas SHA256 focales

| Archivo | SHA256 |
| --- | --- |
| `apps/api/src/crm/record-access.ts` | `acd304f2d4e7177b856b1e8a636e200807ccb49fc8dae91ea7bab8365dd79793` |
| `apps/api/src/companies/companies.service.ts` | `0c3045b9c15c811fd3dce3f165d50ee4bad2760b8c72d28fb9f734501825dc9b` |
| `apps/api/src/contacts/contacts.service.ts` | `e99b0701e6d3d3bc04a1aedbbb4d7d9fab735233f4778d410d798735c9970f71` |
| `apps/api/src/companies/company-directory.service.ts` | `45d175e7325668df8c70f771db79e2f57680f4225f9da51282cf61801e1dcd71` |
| `apps/api/src/agent/agent-trigger.service.ts` | `a2db3148523bfffb8cb95aee99b9f1c7374e7413067d9cb620dc1b56014531ad` |
| `apps/api/src/companies/companies.router.ts` | `359d73d95be69b7c7e4c14167a54b8918b4c123fc9e7a3dc6a4bb5d9388de857` |
| `apps/api/src/contacts/contacts.router.ts` | `c629a43c7c626e8f4f0332696497238baf9df21c4bb5ad8da9c55d942995e212` |
| `apps/api/test/local-record-access.integration.spec.ts` | `2b4d65d42fa2c7bca9f1ef082a41169c5a08a12f9ab8a72c9c6ab8243569edcf` |
| `apps/api/test/disposable-deal-regression.ts` | `413cd1824fef01a6647057623974d16f83bdac4dc430602ba3aebdd0247e5247` |
| `packages/auth/scripts/verify-local-access.mjs` | `289aa4b0ef81ed1e70ce4453871f3d2d0dfa1bea7da4393d25e677ccd441927d` |

## Registro y siguiente bloque

La lectura actual de Linear confirma el proyecto piloto separado, todavía Planned.
Su historia de evaluación permanece intacta. Este recibo describe el checkout propio, no aquel candidato tercero.
El registro del incremento no acepta los 44 escenarios empresariales.
El siguiente bloque adapta controles visibles y extiende permisos a los escritores restantes.
Documentos privados, agenda y portabilidad mantienen desarrollo pendiente.
La sincronización del motor registra evidencia local. Su build no renueva APIs ni autoriza instalación.

El comentario Linear `bb180f97-c719-49f7-8eca-ef631bda1ec5` registra el incremento en el proyecto piloto existente.
La relectura confirma contenido idéntico a `2026-10-04T15:11:05Z`. Planned permanece sin cambio.
No se escriben GitHub, Notion, Drive, Trello ni la réplica privada.
El motor añade `plan:work:crm-record-authorization-20261004` como completed-record.
Sus afirmaciones conservan fecha del 4 de octubre y `runtime_verified=false`.
Las 158 pruebas actuales del motor pasan. Dos nuevas protegen admisión, propiedad y límites de SQL/HTTP/colas.
Build local: `abfcc2f0bae1295d808b`, fecha `2026-10-04T15:12:49.454301+00:00`.
El build realiza cero solicitudes de red y cero cambios de runtime.
El chequeo focal pasa con plan-records fechado `2026-10-04T15:11:05Z`.
El chequeo global conserva fuentes pendientes. La frescura focal no acredita alineación completa.
Las diez huellas del recibo se comparan con sus archivos y coinciden.
El chequeo de diff con configuración normal pasa.
Un primer override incorrecto de CRLF produce falsos avisos. No se normalizan ni sobrescriben archivos ajenos.
La inspección no encuentra listeners propios en 3100, 3102 o 65432.

## Issues

1. NOT DONE — Los 44 escenarios completos y la entrega empresarial siguen pendientes.
   Fix: completar R2, R3 y los ensayos R4.
2. NOT DONE — Documentos privados, calendario e importación/exportación siguen incompletos.
   Fix: implementar versiones privadas, agenda y portabilidad verificable.
3. RISK — Campos, conexiones, exportaciones, claves y workers no aplican toda la política empresarial.
   Fix: extender permisos y negativas a esos escritores. Adaptar también los controles UI de empresas y contactos.
4. NOT DONE — Cinco perfiles, GRANT, invitaciones, recuperación del primer propietario y cambio obligatorio de contraseña siguen pendientes.
   Fix: completar identidad objetivo y reasignación integral.
5. NOT DONE — PostgreSQL 17, concurrencia, reinicios y el error original de conexiones siguen sin verificación integrada.
   Fix: probar pools, restauraciones concurrentes, orden de bloqueos y conflictos de duplicados en PostgreSQL aislado.
6. NOT DONE — Linux, instalación limpia, actualización, dos instancias, respaldo cifrado/offsite y restore completo siguen pendientes.
   Fix: ejecutar los ensayos operativos antes de instalar.
7. NOT DONE — Navegador, traducción, teclado, responsive y capacitación siguen sin aceptación.
   Fix: probar recorridos y permisos visibles con datos ficticios.
8. RISK — Lecturas paralelas carecen de snapshot común. Zona empresarial y precisión extrema no tienen aceptación.
   Fix: validar consistencia, timezone y transporte monetario exacto.
9. NOT DONE — Auditoría empresarial amplia, historial paginado y política de nombres retirados siguen incompletos.
   Fix: conservar identificadores y completar trazabilidad administrativa.
10. RISK — IA conserva clasificaciones heredadas y no cancela solicitudes iniciadas al desactivarse.
    Fix: adaptar identificadores, cancelación y capacidades de workers. Mantener proveedores desconectados durante estos ensayos.
11. UNKNOWN — S&F no confirma todavía etapas, responsables, moneda, locale, perfiles y contratos operativos.
    Fix: confirmar el proceso real con la empresa. Su web no aprueba reglas internas.
12. UNKNOWN — Capacidad, cuota, dominio, TLS, privacidad y admisión del CRM en homelab siguen sin acreditar.
    Fix: revisar el destino después de terminar la versión y confirmar la propiedad legal del producto.
13. NOT DONE — Suite completa, bridge REST, todos los routers HTTP y capacidades de retención siguen sin aceptación.
    Fix: ampliar pruebas integradas sin presentar este fixture como toda la plataforma.
14. NOT DONE — La relectura focal de Linear no renueva todas las plataformas ni la réplica privada.
    Fix: sincronizar destinos autorizados con evidencia y relectura específica.
15. RISK — Selectores limitados, roles corruptos y recuperación de borradores carecen de aceptación de navegador.
    Fix: probar búsqueda y recuperación. La lista de miembros falla ante roles no compatibles.
16. RISK — Bun ejecutado es 1.4.2; el contrato declara 1.3.12.
    Fix: verificar el runtime declarado antes de distribuir el candidato Linux.
17. RISK — Investigación automática de empresa y workspace conserva rutas posteriores al commit sin outbox aceptado.
    Fix: completar esos outboxes y probar fallos de dispatch. Las colas manuales focales no resuelven esas rutas.
18. RISK — Biome conserva una advertencia de barrel en autenticación.
    Fix: revisar exportaciones y consumidores sin relajar la regla.
