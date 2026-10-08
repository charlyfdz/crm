# Verificación local integrada — 2026-10-02

Proyecto: CRM Corporativo. Primer piloto: Corporativo S&F.

Resultado: fundamentos locales comprobados. Versión empresarial completa todavía pendiente. No se instala en homelab.

Rama: `crm-corporativo`. Base: `6d4793dd6d7aeea91aa6a034e00b17d7408a2d08`.

La verificación usa cambios locales no confirmados. El repositorio propio no tiene remoto configurado.

## Cambios integrados

- Acceso por contraseña, alta administrada y primer propietario explícito. El registro público permanece cerrado.
- Login sin Google ni Microsoft. La lista permitida no crea cuentas ni concede roles.
- Comprobación de membresía en login. La sesión consulta la base sin caché de cookies.
- Revocación comprobada mediante logout y reproducción de la cookie anterior.
- Corrección del bloqueo de alta: `$executeRaw` recibe el resultado `void` del bloqueo asesor de PostgreSQL.
- Pool con límites validados y diagnósticos sin credenciales. La recuperación productiva permanece pendiente.
- IA apagada por defecto. Claves almacenadas no conceden permiso para ejecutar agentes.
- Operaciones manuales conservadas. Favicon, investigación, backfill y escritores automáticos respetan el permiso de IA.
- Cola y lecturas separan historial almacenado de trabajo activo. No se reescriben estados históricos al apagar IA.
- Chat privado y compartido reciben la política. La interfaz oculta mensajes, ejecución y actividad automática con IA apagada.
- Aviso accesible de IA desactivada. El historial permanece disponible.
- Alta empresarial sin Context.dev obligatorio. Moneda del dashboard estable entre servidor y cliente.
- Fuentes Geist empaquetadas. La compilación no depende de descargar fuentes desde Google.
- Paquete de despliegue por empresa preparado. Admisión, recursos, rutas y recuperación permanecen pendientes.

La política de IA no convierte toda integración externa en modo offline.
Correo, calendario, tracking y cotizaciones necesitan sus propias pruebas de configuración y permisos.

## Pruebas ejecutadas

Entorno: Windows, Node 26.5.0 y Bun 1.4.2.
La versión declarada del gestor es Bun 1.3.12. La imagen Linux todavía no tiene ejecución comprobada.

| Grupo | Resultado | Alcance |
| --- | --- | --- |
| 11 archivos unitarios seleccionados | 98 pasan; 0 fallan; 404 aserciones | Entrada administrada, configuración, pool, telemetría, onboarding, moneda, comandos y presentación sin IA. |
| API: `ai-policy-api`, `ai-policy-flows`, `env-contract` | 109 pasan; 0 fallan; 323 aserciones | Dependencias simuladas y red rechazada; no consultas reales. |
| `bun run test:local-access` | 11 pasan; 0 fallan; 29 aserciones | BetterAuth HTTP, Prisma y base sintética temporal. |
| Tres archivos Node de `deploy/scripts` | 42 pasan; 0 fallan | Contratos, seguridad de planes y health probes simulados. |
| Total CRM, sin duplicar reruns | 260 pasan; 0 fallan | Selección focal. No es la suite completa del producto. |
| TypeScript app, API, auth, db y agent | Exit 0 | Contratos compilables. No prueba permisos empresariales completos. |
| Build Next | Exit 0; 32 páginas generadas | Artefacto standalone local. Sin servidor iniciado ni aceptación visual. |
| Build API | Exit 0; 183 módulos | Bundle local. Sin arranque operativo. |
| Validador estático de despliegue | Pasa | No sustituye Docker Compose ni runtime Linux. |
| Biome, 16 archivos del último parche | Pasa; sin avisos | Formato y reglas estáticas. |
| `git diff --check` | Exit 0 | Git conserva avisos LF/CRLF del checkout. |

La revisión documental final comprueba nueve documentos y 87 enlaces locales. Ningún destino local falta.
Las seis huellas de evidencia se releen y coinciden después de los cambios documentales.

La prueba de acceso usa PGlite 0.4.3 y pglite-socket 0.1.3.
Escucha solamente en `127.0.0.1`, con puerto aleatorio y base en memoria.
Aplica una fixture SQL desde las migraciones versionadas. No ejecuta `prisma migrate deploy`.
El pool de esta prueba usa una conexión por limitación del multiplexor PGlite.
La prueba cierra socket y base. Comprueba que el puerto rechaza conexiones al terminar.
Este resultado no prueba la causa ni la recuperación del error original en PostgreSQL productivo.

Un comando inicial con ruta `deploy/test/*.test.mjs` descubre cero pruebas.
La reejecución con tres rutas explícitas registra las 42 pruebas reales. Cero descubrimientos no cuenta como aprobación.

## Reproducción

Desde la raíz:

```powershell
bun test packages/auth/test/provision-input.spec.ts packages/env/test/features.spec.ts packages/env/test/root.spec.ts packages/telemetry/test/disabled.spec.ts packages/db/test/pool-config.spec.ts packages/db/test/pool-errors.spec.ts packages/db/test/pool-test-guard.spec.ts apps/app/test/dashboard-money.spec.ts apps/app/test/onboarding-gate.spec.ts apps/app/test/ai-disabled-ui.spec.tsx apps/app/test/agent-builder.spec.ts
bun run test:local-access
node --test deploy/scripts/contracts.test.mjs deploy/scripts/safety.test.mjs deploy/scripts/health.test.mjs
bun deploy/scripts/validate-static.mjs
```

Desde `apps/api`: `bun test test/ai-policy-api.spec.ts test/ai-policy-flows.spec.ts test/env-contract.spec.ts`.
El directorio importa: su configuración habilita los decoradores Nest.

Builds usan variables sintéticas inyectadas, IA y telemetría apagadas.
La compilación apunta a una dirección loopback sin PostgreSQL activo. No usa configuración del laboratorio tercero.

## Huellas de evidencia

SHA-256 de archivos verificados, después del último parche:

| Archivo | SHA-256 |
| --- | --- |
| `packages/auth/src/provision-user.ts` | `297A744FA3F76802C602964CFBA3AAB27E5CD104728B603AF76E0F2D8CEA4F3C` |
| `packages/auth/src/auth.ts` | `16DF7978484930FA0B706015167A316B1BDDBAB8573167BD9DAA9EC8007DDF8E` |
| `packages/auth/scripts/verify-local-access.mjs` | `8D021E26FDFD69F20771802AF9C3628D1BA6CC1B8EBE661A8847A06FE9A7E387` |
| `apps/api/test/ai-policy-flows.spec.ts` | `DDB00518C2DB45C9D2AA1B654251E1BE7A93D3B0645F75364065E9025C8D0D28` |
| `apps/app/test/ai-disabled-ui.spec.tsx` | `D79DC6A09E3F44589ECF2D7AB1DC887FE60E756FBD557004448695D73D50B87F` |
| `deploy/compose.yml` | `DFD2C9528F614C60F1A8191169EC7A24EF75686CBC83C73841C99F31822D01B9` |

## Contexto y siguiente incremento

La [fuente empresarial](../product/SF-BUSINESS-CONTEXT.md) separa contenido público, límites y propuestas.
La técnica de contexto empresarial conserva esa separación. No inventa procesos, precios, moneda ni autorización.

El [piloto](../product/PILOT-CORPORATIVO-SF.md) exige versión completa antes de instalación.
Los 44 requisitos y escenarios conservan aceptación completa pendiente.

Siguiente implementación: pipelines configurables, tareas asignadas, documentos privados y permisos empresariales.
Después: simulación integrada sin IA, restauración, seguridad, medición y entrega instalable independiente.
El destino futuro es Coolify dentro de `paas-control`. La PC accede por switch P4; no es TCP puerto 4.

El motor registra la dirección y el pendiente de admisión. No renueva plataformas externas mediante `build`.
Build motor: `947d16671b1559c37c2b`. Sus 139 pruebas pasan; el chequeo focal CRM pasa.
El chequeo general requiere relectura de 92 snapshots remotos y cuatro fuentes locales. No declara alineación total.
No se escribe en Linear, GitHub, Notion, Drive o Trello. No se abre SSH ni se cambia Coolify o Tailscale.
No se conectan cuentas reales ni se llaman proveedores IA. No queda runtime nuevo activo.

## Integración posterior — procesos y tareas, 2026-10-02

El [recibo comercial posterior](2026-10-02-business-flow.md) registra 250 pruebas seleccionadas y builds finales de app y API.
Los totales no se suman. Hay pruebas repetidas entre recibos.
El incremento incorpora procesos configurables, tareas asignadas, MXN y filtros de archivo del dashboard.
Los problemas históricos 11 y 12 quedan corregidos en el alcance probado.
El problema 3 conserva permisos empresariales y documentos pendientes. Su parte de procesos configurables tiene implementación focal.
El problema 9 conserva traducción y aceptación visual pendientes. La navegación e identidad compartida reciben pruebas estáticas.
La versión completa, los 44 escenarios y la instalación siguen pendientes.

## Issues históricos de este corte

1. NOT DONE — Los 44 escenarios completos y la simulación empresarial conservan aceptación pendiente.
   Fix: completar R2, R3 y R4 técnico antes de pedir instalación.
2. NOT DONE — PostgreSQL 17, migraciones productivas, alta concurrente y recuperación tras reinicio no tienen prueba integrada.
   Fix: ejecutar esas pruebas en una instancia sintética independiente. No reutilizar el laboratorio tercero.
3. NOT DONE — Permisos por registro, ciclo completo de usuarios, pipeline configurable y documentos privados requieren desarrollo.
   Fix: implementar contratos y denegaciones antes de datos empresariales.
4. NOT DONE — Docker Linux, límites efectivos, backup de archivos, cifrado, offsite y restauración completa permanecen pendientes.
   Fix: completar el paquete operativo y ensayar recuperación aislada antes de prometer RPO o RTO.
5. UNKNOWN — Capacidad actual, cuota CRM, rutas privadas, TLS, cookies y acceso autorizado todavía no acreditan admisión.
   Fix: releer y probar la plataforma cuando exista candidato completo y autorización independiente.
6. RISK — Apagar IA no termina solicitudes ya iniciadas ni representa un bloqueo global de integraciones externas.
   Fix: detener el agente al desactivar. Definir cancelación y políticas de salida por integración.
7. UNKNOWN — Etapas reales, responsables, moneda y valor contractual de S&F todavía necesitan confirmación empresarial.
   Fix: revisar la plantilla configurable. Usar datos ficticios durante el desarrollo.
8. RISK — La web incluye páginas internas de plantilla y respuestas indexadas de diferentes fechas.
   Fix: usar contexto explícito de portada y confirmar detalles. No modificar la web en esta tarea.
9. NOT DONE — La interfaz todavía conserva textos upstream y no tiene aceptación visual completa.
   Fix: completar identidad, traducción, accesibilidad y pruebas de navegador en el siguiente ciclo.
10. NOT DONE — Plataformas externas y snapshots generales no tienen sincronización en este incremento.
    Fix: informar cobertura local y obtener autorización específica antes de escrituras o publicación.
11. RISK — Consultas del dashboard incluyen oportunidades archivadas. Los totales no representan sólo oportunidades activas.
    Fix: aplicar filtros comunes y reconciliar métricas mediante pruebas de archivo y restauración.
12. NOT DONE — El catálogo monetario no incluye MXN. El piloto conserva moneda final sin decisión empresarial.
    Fix: implementar MXN y validar importes y conversiones. No imponer moneda ni tasas a S&F.

