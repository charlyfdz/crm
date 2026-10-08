# Evidencia local — identidad administrada

Fecha local: 2026-10-03. Zona: America/Mexico_City.
La verificación continúa hasta el 4 de octubre UTC. El nombre del recibo conserva la fecha local.
Repositorio: `D:/respaldo de proyectos/CRM Corporativo`. Rama: `crm-corporativo`.
HEAD base: `6d4793dd6d7aeea91aa6a034e00b17d7408a2d08`.
Los cambios permanecen locales, sin commit ni remote propio.
Estado: incremento focal verificado. Versión completa y aceptación empresarial pendientes.
El [recibo anterior](2026-10-03-opportunity-authorization.md) conserva su corte histórico.
No sumar recibos. Existen pruebas repetidas.

## Alcance y límites

El usuario autoriza continuar el desarrollo y las verificaciones necesarias.
La versión completa precede la instalación en Coolify de `paas-control`.
Corporativo S&F sigue como primer consumidor piloto. La propiedad legal del producto permanece sin asignar.
El checkout CRM tercero y su configuración privada permanecen intactos.
No se modifica homelab, SSH, Tailscale, DNS, permisos de red ni cuentas reales.
Las pruebas usan cuentas, contraseñas y dominios ficticios `example.test`.
IA y telemetría permanecen apagadas. Las llamadas externas del fixture se rechazan.
PGlite en memoria sirve SQL por un socket loopback efímero. Se aplican las 59 migraciones existentes.
Nest escucha otro puerto loopback efímero con routers de workspace y claves.
El fixture verifica el cierre del servidor HTTP. El wrapper verifica el cierre del puerto SQL.
No queda una instancia persistente nueva.
PGlite no acredita PostgreSQL 17, pool real, concurrencia multi-sesión ni recuperación de conexiones.
El harness comercial de esquema conserva su cobertura histórica de 58 migraciones.
La migración nueva se verifica en el harness de identidad, no se atribuye al harness comercial.

## Implementación

`Member.suspendedAt` representa suspensión sin borrar usuarios, autores ni responsables históricos.
El guard general de tRPC y las páginas protegidas exigen una membresía activa con rol conocido.
Los roles actuales siguen siendo `owner`, `admin` y `member`.
Un rol desconocido no recibe acceso como miembro.
La lectura de workspace no crea membresías ni repara autoridad automáticamente.
La provisión administrada escribe usuario, credencial, membresía y auditoría en una transacción.
La provisión comprueba al actor autenticado dentro de la transacción.
El operador conserva un procedimiento separado para bootstrap vacío.
Un propietario crea administradores y miembros. Un administrador crea miembros solamente.
Un administrador no modifica propietarios o administradores ni asigna esos roles.
Los cambios de rol y estado comparten bloqueo asesor y bloqueos ordenados de membresías.
La transacción conserva al menos un propietario activo.
Suspender o cambiar un rol revoca sesiones y desactiva todas las claves del usuario afectado.
La suspensión repetida conserva fecha y no inventa otro evento.
Reactivar exige nuevo login. No reactiva claves ni cookies antiguas.
El reset administrativo exige una cuenta con contraseña local y excluye al actor.
El reset revoca acceso anterior y no devuelve la contraseña ni su hash.
No existe entrega de contraseña por correo ni cambio obligatorio al primer acceso.
`IdentityAuditEvent` registra cambios exitosos, actor real y estado anterior/posterior.
El bootstrap del operador registra actor humano nulo, no una identidad inventada.
El trigger rechaza UPDATE y DELETE ordinarios. No impide TRUNCATE ni administración privilegiada de la base.
La auditoría de identidad tiene paginación y requiere propietario o administrador.
La auditoría no copia automáticamente contraseñas ni hashes. El motivo libre exige uso responsable.
Las mutaciones de identidad requieren sesión humana. Una clave API no las autoriza.
Los endpoints HTTP de los plugins organization y api-key quedan desactivados.
Sus métodos SDK internos permanecen disponibles para los servicios controlados.
Las claves nuevas tienen duración finita de uno a 365 días.
La creación de claves comprueba nuevamente membresía y propiedad antes de revelar el secreto.
Una suspensión entre creación SDK y comprobación final desactiva la clave nueva y niega su entrega.
Los scopes y capacidades completas de claves permanecen pendientes.
Actualizar empresa exige sesión humana, bloquea identidad/configuración y conserva metadatos existentes.
La respuesta usa el snapshot guardado. No vuelve a comprobar membresía después de confirmar la escritura.
La investigación opcional sigue fuera de esa transacción. IA OFF no crea tareas.
Configuración → Usuarios ofrece alta, cambio de rol, suspensión, reactivación, reset y auditoría.
Los formularios limpian contraseñas al cerrar, completar o fallar una operación.
Las tareas solicitan solamente responsables activos. El servidor también comprueba la membresía vigente.

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
| Regresiones heredadas aisladas | 46 | 115 | PASS |
| Identidad administrada y HTTP loopback | 30 | 97 | PASS |
| Total seleccionado, sin sumar historia | 370 | 10429 | PASS |

La suite de identidad registra 30 casos finales, cero fallos y 97 aserciones.
Los 12 casos nuevos de interfaz comprueban política y controles renderizados, no interacción de navegador.
El grupo de router directo usa servicio simulado. Su guard simulado conserva ese alcance explícito.
El transporte nuevo usa Nest, contexto Better Auth y middleware reales para workspace y claves.
No ejecuta todo AppModule, REST bridge, IdP externo, correo ni proveedores IA.
Los logins rápidos limpian rateLimit solamente en la base ficticia del harness.
No se cambia la política productiva de rate limit. Esta prueba no acepta resistencia a abuso.
La competencia de propietarios usa PGlite con pool serial. No acredita bloqueo PostgreSQL multi-sesión.
Las pruebas de cambios entre fases usan intercalado determinista, no solicitudes simultáneas productivas.

Las pruebas iniciales detectan expectativas incorrectas sobre claves desactivadas y rate limit del fixture.
Se corrige el fixture sin relajar los controles productivos.
Las nuevas negativas de configuración fallan antes del fix: una clave modifica empresa y falta revalidación transaccional.
La negativa de miembro inicialmente usa un mensaje traducido todavía inexistente. Se corrige junto con el mensaje del servicio.
El primer interceptor Prisma no intercepta la transacción. El fixture usa un proxy explícito y comprueba su entrada.
Biome detecta una función de pruebas demasiado larga. Se extraen helpers sin desactivar la regla.
Las 30 pruebas finales pasan después de esas correcciones.

## Compilación y comandos

Prisma Client 7.9.1 se regenera desde el esquema existente. No se ejecuta auth:generate.
El CLI tRPC regenera 22 routers y 169 procedimientos.
TypeScript API y app pasan después de la generación y del build Next.
Next compila y genera 33 páginas. El build usa variables sintéticas y comprueba ausencia de `.env`/`.env.local` propios.
La API compila 188 módulos, bundle 0.74 MB y source map 1.34 MB.
La compilación API requiere la ejecución local aprobada tras el rechazo de spawn del sandbox.
La compilación no inicia la API ni despliega recursos.
Biome focal conserva una advertencia de barrel en `packages/auth/src/index.ts`.
El chequeo de diff pasa. No se limpia el árbol ni se sobrescriben cambios ajenos.

```powershell
bun --no-env-file run test:identity
bun --no-env-file run test:local-access
bun --no-env-file run test:business-schema
bun --no-env-file run test:business-flow
bun --no-env-file run test:deal-regressions
bun --no-env-file run --cwd apps/api trpc:generate
bun --no-env-file run --cwd apps/api check-types
bun --no-env-file run --cwd apps/app check-types
bun --no-env-file run --cwd apps/api build
node docs/delivery/validation/check.mjs
node --test docs/delivery/validation/check.test.mjs
```

Los comandos Prisma/build requieren las variables sintéticas del harness o una configuración explícita del operador.
No ejecutar DB reset, seed, push o migrate contra datos existentes para reproducir este recibo.
Las reglas Better Auth, Prisma y Nest/tRPC guían la revocación, migración incremental y comprobaciones dentro del servicio.
La [documentación de sesiones](https://better-auth.com/docs/concepts/session-management) explica los límites del cache de cookies.
Esta configuración mantiene cookieCache desactivado y añade comprobación vigente de membresía.
La [documentación de organización](https://better-auth.com/docs/plugins/organization) describe el plugin base, no la aceptación empresarial de este CRM.

## Huellas SHA256 focales

| Archivo | SHA256 |
| --- | --- |
| `packages/auth/src/identity.ts` | `daed062d483a5fcd48602b25b1e34294c52512f87676293d5c5dc30fd5e5a18f` |
| `packages/auth/src/auth.ts` | `56f3c8906716434907bc263e8a2af44aa12965c99055ec39d072d7f0e70c8e09` |
| `packages/auth/src/provision-user.ts` | `304c723dc9190b7a788e5850142560a193e68ef6a2662cd39a8a1c54707cfd7c` |
| `packages/db/prisma/schema.prisma` | `914a3fe36f8b1e19bd65fc65d91e11bc8ebb5be07189af19f964b2ad95d1d2af` |
| `packages/db/prisma/migrations/20261003200000_managed_identity/migration.sql` | `9a8c04c9542db40b5c2877dc58f6088103b41bec24fab3fafd388e5d038999ac` |
| `apps/api/src/workspace/workspace.service.ts` | `036f0773b6079b9f035325a865b2362b4e3f216dc3aeb78ed50f30b793f40ff5` |
| `apps/api/src/workspace/workspace.contracts.ts` | `6fa496bc9e2489b30c627fccd91c948791f31ffbb069931ea0de732961919a7f` |
| `apps/api/src/workspace/workspace.router.ts` | `bcfb837bf65ced8eb66e1ccee18db39f6592bba8f9d0fb44c3fa87bb6cf30091` |
| `apps/api/src/trpc/middlewares/auth.middleware.ts` | `9f7b801fa8908028bb0f6591d32b0565ab4482dfb8a55c034062003e2c5986ba` |
| `apps/api/src/api-keys/api-keys.service.ts` | `af9b40b117afe57fc99f1f8b3760cdceb79cfa4cd510d80889eb267ddc05536b` |
| `apps/api/test/local-identity.integration.spec.ts` | `4ac42dc0dc60841da2c4288da01d115e881467809ca4498e75acb1d4e8e2f1fa` |
| `apps/app/test/member-management.spec.tsx` | `13e06ff654d0ecb83d99ff5e32eb74ce24571421238276c24ca43aef3982286a` |
| `apps/app/app/(app)/[slug]/settings/members/member-management.tsx` | `f0e3ba827f83676547b66547457d5db07c7b6bfffb9064272c9f980e7ff1798b` |
| `apps/app/app/(app)/[slug]/settings/members/identity-audit.tsx` | `f28a8b6fa3347bb236dd142ccecf3ff3a22bd5fa30996b1b9ffcbb2f450c1695` |
| `apps/app/app/(app)/[slug]/settings/members/member-policy.ts` | `f0a162a34d290fa3089b64b77241232b3c4c3059507b1a76c7062184fd9d35a6` |
| `packages/auth/scripts/verify-local-access.mjs` | `d2fc70fdf6896d54a6b076a73db90df662dcdb8a3d82ff2d59775992ab03bed2` |

## Registro y siguiente bloque

La lectura actual de Linear confirma el proyecto S&F separado de SUNTRAM y WOMAN, todavía Planned.
El proyecto conserva historia de evaluación del tercero. Esta evidencia describe el nuevo checkout propio.
El siguiente bloque amplía permisos y autoría de empresas/contactos antes de portabilidad y documentos privados.
El motor registra sólo el incremento local. Su build no renueva fuentes remotas ni autoriza producción.

El comentario Linear `9da7db37-c4c7-4015-bb22-90fa0158d613` registra el incremento en el proyecto piloto existente.
La relectura confirma contenido idéntico y estado Planned. No cambia historia, responsables ni gates del proyecto.
Captura focal: `2026-10-04T02:50:21Z`.
No se escriben GitHub, Notion, Drive, Trello ni la réplica privada.
El motor añade `plan:work:crm-managed-identity-20261003` como completed-record, no como producto terminado.
Sus cuatro afirmaciones nuevas conservan fecha local del 3 de octubre y `runtime_verified=false`.
Las 153 pruebas del motor pasan. Dos nuevas protegen propiedad, admisión y alcance del fixture HTTP.
Build local: `396fd3fedd3db3e78861`, fecha `2026-10-04T02:52:21.634134+00:00`.
El build del motor realiza cero llamadas de red y cero cambios de runtime.
El chequeo focal CRM pasa con plan-records fechado `2026-10-04T02:50:21Z`.
El chequeo global interno devuelve código dos y `engine_changed=false`.
Noventa y tres fuentes remotas y siete locales requieren relectura. No se declara alineación general.
Biome final revisa 30 archivos sin cambios y conserva una advertencia de barrel.
La inspección final no encuentra listeners propios en 3100, 3102 o 65432.

## Issues

1. NOT DONE — Los 44 escenarios completos y la entrega empresarial siguen pendientes.
   Fix: completar R2, R3 y los ensayos técnicos R4.
2. NOT DONE — Documentos privados, calendario e importación/exportación siguen incompletos.
   Fix: implementar versiones privadas, agenda y portabilidad verificable.
3. RISK — Otros escritores no aplican todos los permisos empresariales.
   Fix: extender propiedad, asignación y negativas a empresas, contactos, campos, conexiones, exportaciones y workers.
4. NOT DONE — Cinco perfiles, GRANT, invitaciones, recuperación del primer propietario y cambio obligatorio de contraseña siguen pendientes.
   Fix: completar identidad objetivo sin promover los tres roles actuales a aceptación total.
5. NOT DONE — PostgreSQL 17, concurrencia, reinicios y el error original de conexiones siguen sin verificación integrada.
   Fix: ejecutar una instancia PostgreSQL sintética independiente.
6. NOT DONE — Linux, instalación limpia, actualización, dos instancias, respaldo cifrado/offsite y restore completo siguen pendientes.
   Fix: ejecutar los ensayos operativos antes de instalar.
7. NOT DONE — Navegador, traducción completa, teclado, responsive y capacitación siguen sin aceptación.
   Fix: probar recorridos humanos y controles de permiso visibles.
8. RISK — Lecturas paralelas carecen de snapshot común. Zona empresarial y precisión extrema no tienen aceptación.
   Fix: validar consistencia, timezone y transporte monetario exacto.
9. NOT DONE — Auditoría empresarial amplia, historial paginado y política de nombres retirados siguen incompletos.
   Fix: conservar identificadores y completar trazabilidad administrativa.
10. RISK — IA conserva clasificaciones heredadas y no cancela solicitudes iniciadas al desactivarse.
    Fix: adaptar identificadores y cancelación. Mantener IA OFF durante estos ensayos.
11. UNKNOWN — S&F no confirma todavía etapas, responsables, moneda, locale, perfiles y contratos operativos.
    Fix: confirmar el proceso real con la empresa.
12. UNKNOWN — Capacidad, cuota, dominio, TLS, privacidad y admisión del CRM en homelab siguen sin acreditar.
    Fix: revisar destino después de terminar la versión.
13. NOT DONE — Suite completa, REST bridge, todos los routers HTTP y capacidades de retención siguen sin aceptación.
    Fix: ampliar pruebas integradas sin confundir este fixture focal con toda la plataforma.
14. NOT DONE — La relectura focal de Linear no renueva todas las plataformas ni la réplica privada.
    Fix: sincronizar destinos autorizados mediante evidencia y relectura específica.
15. RISK — Selectores limitados, roles corruptos y recuperación de borradores carecen de aceptación de navegador.
    Fix: probar búsqueda y recuperación. La lista de miembros falla ante roles no compatibles.
16. RISK — Bun ejecutado es 1.4.2; el contrato declara 1.3.12.
    Fix: verificar el runtime declarado antes de distribuir el candidato Linux.
17. RISK — La investigación opcional de empresa se despacha después del commit, sin outbox atómico aceptado.
    Fix: completar el outbox y probar fallos de dispatch con IA habilitada.
18. RISK — Biome conserva una advertencia de barrel en el paquete de autenticación.
    Fix: revisar las exportaciones y los consumidores sin relajar la regla.
