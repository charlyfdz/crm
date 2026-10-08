# Evidencia local — autorización de oportunidades

Fecha local: 2026-10-03. Zona: America/Mexico_City.
Comprobaciones de código y compilación concluyen antes de `2026-10-03T11:15:19-06:00`.
Repositorio: `D:/respaldo de proyectos/CRM Corporativo`. Rama: `crm-corporativo`.
HEAD base: `6d4793dd6d7aeea91aa6a034e00b17d7408a2d08`.
El árbol contiene cambios locales sin commit. No existe remote del repositorio propio.
Estado: incremento focal verificado. Producto completo y aceptación empresarial pendientes.
El [recibo anterior](2026-10-02-business-flow.md) conserva la evidencia histórica del 2 de octubre.
No sumar sus resultados a los siguientes. Existen pruebas repetidas.

## Límites

Corporativo S&F es el primer piloto. Esta relación no decide propiedad legal.
Coolify en `paas-control` sigue como destino futuro. No se realiza instalación.
No se modifica homelab, SSH, Tailscale, DNS, credenciales ni reglas de red.
No se modifica el checkout tercero ni se lee su configuración privada.
No se publican commits ni se escribe GitHub, Linear, Trello, Notion o Drive.
Las pruebas usan usuarios, empresas, tasas, registros y dominios ficticios.
IA y telemetría permanecen apagadas. No se conectan proveedores o cuentas reales.
Los tres harnesses usan PGlite en memoria y sockets loopback efímeros.
Cada harness verifica el cierre del puerto. No queda un servicio persistente nuevo.
PGlite no acredita PostgreSQL 17, Linux, concurrencia simultánea ni recuperación de conexiones.
Los builds usan variables sintéticas. Se comprueba la ausencia de `.env` y `.env.local` propios antes del build Next.

## Cambios

Los dieciocho métodos del router `deals` transmiten `ctx.user.id` al servicio.
Los contratos públicos descartan identidad y cutoff de retención enviados en el cuerpo.
Las lecturas requieren membresía actual. Los miembros leen registros compartidos de esta instalación.
Las escrituras bloquean membresía y oportunidad dentro de una transacción.
`member` modifica oportunidades propias. `owner` y `admin` modifican oportunidades de otros responsables.
La reasignación requiere administración y un destino con membresía actual compatible.
Los roles desconocidos se deniegan. No se implementan `manager`, `rep` o `viewer` con este cambio.
Las oportunidades archivadas rechazan edición y cambios de vínculos. Restaurar precede a modificar.
Archivar de nuevo conserva la primera fecha de archivo.
El vínculo requiere contacto activo de la misma empresa. La desvinculación permite reparar vínculos obsoletos.
Cambiar empresa exige destino activo y contactos compatibles. Los contactos vinculados se bloquean durante esa comprobación.
La preparación monetaria ocurre fuera de la transacción. El guard compara importe y moneda antes de escribir.
Un snapshot monetario obsoleto devuelve conflicto. La prueba conserva el importe nuevo.
Una revocación durante la preparación monetaria impide la escritura posterior.
Estas dos pruebas simulan cambios entre fases. No ejecutan dos solicitudes PostgreSQL simultáneas.
La purga pública requiere `owner` y archivo previo. Los permisos `GRANT` de administradores siguen denegados.
La retención confiable usa un helper privado con cutoff. Su fixture conserva registros activos y archivos recientes.
La operación masiva valida cada registro y devuelve éxito parcial. No ofrece atomicidad sobre toda la selección.
No se agrega una migración de permisos ni auditoría inmutable.

## Resultados actuales

| Grupo ejecutado | Pruebas | Assertions | Resultado |
| --- | ---: | ---: | --- |
| Formularios, identidad y presentación de dashboard | 73 | 168 | PASS |
| Tareas y dashboard API | 89 | 9574 | PASS |
| Monedas | 23 | 77 | PASS |
| Migraciones comerciales desechables | 32 | 125 | PASS |
| Acceso local desechable | 11 | 29 | PASS |
| Flujo comercial y autorización desechables | 35 | 154 | PASS |
| Identidad transmitida por router y filtrado de contratos | 19 | 56 | PASS |
| Regresiones de contactos, moneda y campos | 46 | 115 | PASS |
| Total seleccionado, sin sumar recibos anteriores | 328 | 10298 | PASS |

La prueba de router llama métodos directamente con servicio simulado. No acredita transporte HTTP ni middleware desplegado.
Las regresiones heredadas ahora requieren `test:deal-regressions` y membresías ficticias explícitas.
El harness rechaza opciones desconocidas antes de crear una base.
El proceso hijo recibe sólo variables permitidas y configuración sintética. Bun no carga archivos `.env`.
Las llamadas `fetch` quedan bloqueadas en las regresiones. No se ejecuta la rama de backfill con IA activa.
Las expectativas heredadas de IA activa se conservan separadas por el switch. Este ensayo sólo acredita IA apagada.

Las ocho regresiones iniciales fallan antes del fix. Las 22 pruebas comerciales anteriores pasan en ese ensayo rojo.
El primer helper de membresía omite `id` y falla. El helper corregido define un identificador ficticio explícito.
Tres expectativas heredadas fallan con IA apagada. Las pruebas corregidas comprueban el switch y preservan la rama histórica.
La corrida final pasa los grupos anteriores. Estos fallos intermedios no describen el estado final.

Regeneración CLI: 22 routers y 165 procedimientos. No se edita manualmente el router generado.
TypeScript de API y aplicación: PASS después de la regeneración y del build.
API Bun: PASS, 188 módulos, `main.js` 0.73 MB y mapa 1.32 MB.
El primer empaquetado API recibe bloqueo del sandbox. El reintento aprobado compila sin iniciar servicios.
Next.js: PASS, 33 páginas generadas con proveedores apagados y variables sintéticas.
El build no acredita aceptación visual, datos reales, usuarios empresariales ni ejecución productiva.
Las reglas Nest-tRPC guían identidad y contratos. Las reglas Prisma guían comprobaciones y bloqueos transaccionales.
No existe índice GitNexus verificado para este checkout. Se revisan los consumidores directamente.

## Reproducción

Desde la raíz propia:

```powershell
bun --no-env-file run test:business-flow
bun --no-env-file run test:deal-regressions
bun --no-env-file run test:local-access
$env:CRM_BUSINESS_SCHEMA_TEST='1'
bun --no-env-file run test:business-schema
bun --no-env-file test packages/db/test/currency.spec.ts
```

Desde `apps/api`, ejecutar las pruebas unitarias en procesos separados por sus mocks de módulos:

```powershell
bun --no-env-file test test/deals-router-identity.spec.ts
bun --no-env-file test test/activities-tasks.spec.ts test/dashboard-summary.spec.ts
bun --no-env-file run trpc:generate
bun --no-env-file run check-types
bun --no-env-file run build
```

Desde `apps/app`:

```powershell
bun --no-env-file test test/business-forms.spec.tsx test/product-identity.spec.tsx test/dashboard-money.spec.ts
bun --no-env-file run check-types
```

El build Next requiere el entorno sintético descrito anteriormente. No copiar variables de ensayo a una instalación real.
No ejecutar reset, seed o migraciones persistentes con una URL empresarial.

## Huellas verificadas

| Archivo | SHA-256 |
| --- | --- |
| `apps/api/src/deals/deals.service.ts` | `FB08C272B72EDF011305B6B551A2FB2CA2FC8B69C15F6F200F6B218D040B89F2` |
| `apps/api/src/deals/deals.router.ts` | `6D057244851FBE791E4A80B17F4EC16FABE9B98B184361C1AD0286B7B834B638` |
| `apps/api/test/local-business-flow.integration.spec.ts` | `C0741E4DE147BFC3DB57AE577B34868C4360BFE18921AB4A13E57680B4AE83FF` |
| `apps/api/test/deals-router-identity.spec.ts` | `849C854EF695E70BC9B5F436E2AC517F08B44B1785C8D4A119E30DA11F945F9D` |
| `apps/api/test/disposable-deal-regression.ts` | `98B0609E8151D71340F27CBBC31FE53230500CD8E705434AA0A63FB0D8291B30` |
| `packages/auth/scripts/verify-local-access.mjs` | `DA100E63C46A852946FDC13EEA458331C4D1D492BC340F00567CA6E68B3CDE4E` |

## Documentación y registro local

Biome comprueba los diez archivos de código y configuración modificados en este bloque: PASS.
`git diff --check` pasa. Git emite advertencias de finales de línea, no errores de whitespace.
El kit documental conserva 15 documentos. Sus tres pruebas pasan y los enlaces locales se verifican por existencia.
El validador devuelve `synthetic=true` y `runtimeExecuted=false`. No convierte documentos en aceptación del producto.
La guía y el catálogo de permisos distinguen controles actuales y política completa pendiente.

El motor registra `plan:work:crm-opportunity-authorization-20261003` como `completed-record` focal.
El proyecto conserva propiedad legal `unclassified`. Desarrollo completo y admisión conservan estado `pending`.
Build local: `35de3b01067137f49a74`, generado `2026-10-03T17:22:39.783294+00:00`.
El build registra cero solicitudes de red y cero cambios runtime.
Las 151 pruebas del motor pasan. Las dos nuevas evitan promover el ensayo a producto o autorización productiva.
Un selector histórico toma inicialmente el incremento equivocado. El fix selecciona su identificador histórico explícito.
La relectura comprueba fecha del 3 de octubre y `runtime_verified=false` en las cuatro afirmaciones nuevas.
El chequeo focal CRM pasa con fuente plan-records fechada `2026-10-03T17:21:03Z`.
El chequeo general interno devuelve código dos. `engine_changed=false`.
Noventa y tres fuentes remotas y cuatro locales requieren relectura. El build no renueva esas fuentes.
`motor-conocimiento/SYNC.md` registra alcance y destinos. La réplica privada permanece sin publicación.

## Issues

1. NOT DONE — Los 44 escenarios completos siguen pendientes. Este incremento no termina el producto empresarial.
   Fix: completar R2, R3 y R4 técnico antes de solicitar instalación.
2. NOT DONE — Documentos privados versionados, calendario local e importación/exportación portables siguen incompletos.
   Fix: implementar archivos privados, agenda y previsualización repetible de importaciones.
3. RISK — Empresas, contactos, campos, claves, exportaciones y otros escritores no tienen autorización empresarial completa.
   Fix: extender controles por registro y pruebas negativas antes de datos reales.
4. NOT DONE — Cinco perfiles, suspensión, recuperación, último propietario, permisos GRANT y auditoría amplia siguen pendientes.
   Fix: completar identidad y trazabilidad. No promover tres roles heredados a aceptación empresarial.
5. NOT DONE — PostgreSQL 17, concurrencia, reinicios y diagnóstico del error original siguen sin ejecución integrada.
   Fix: probar una instancia sintética independiente. PGlite no sustituye esa evidencia.
6. NOT DONE — Docker Linux, instalación limpia, actualización, dos instancias y restauración completa siguen sin ensayo operativo.
   Fix: probar respaldos de datos y archivos, cifrado y copia externa antes de prometer RPO/RTO.
7. NOT DONE — Interfaz, controles de permiso visibles, traducción, navegador, teclado, responsive y capacitación siguen sin aceptación completa.
   Fix: completar recorridos y ocultar acciones no autorizadas sin sustituir guardas del servidor.
8. RISK — Reportes paralelos no comparten snapshot. Zona empresarial y precisión extrema siguen sin aceptación.
   Fix: validar concurrencia, timezone y transporte monetario exacto.
9. NOT DONE — Auditoría administrativa, paginación histórica y política de nombres retirados siguen pendientes.
   Fix: completar contratos sin borrar identificadores ni historia.
10. RISK — Herramientas IA usan clasificaciones heredadas. Desactivar IA no cancela solicitudes iniciadas.
    Fix: adaptar identificadores y cancelación. Mantener IA apagada durante este piloto técnico.
11. UNKNOWN — Etapas, responsables, moneda, locale, contratos y perfiles reales de S&F requieren confirmación empresarial.
    Fix: revisar plantillas con la empresa. La web pública no sustituye decisiones operativas.
12. UNKNOWN — Capacidad, cuota, hostname, TLS, privacidad y admisión homelab no están acreditados para este CRM.
    Fix: verificar destino tras completar la versión y obtener autorización independiente de instalación.
13. NOT DONE — Suite completa, HTTP real, autorización de retención y rama de IA activa no tienen aceptación en este ensayo.
    Fix: extender fixtures desechables y probar transporte, capacidades y revocación real.
14. NOT DONE — Freshness general y plataformas externas no se renuevan con este registro local.
    Fix: separar registro local de relecturas y escrituras externas autorizadas.
15. RISK — El selector limita coincidencias y no acredita recuperación del borrador después de errores.
    Fix: probar búsquedas, revocación y conservación de selección en navegador.
16. RISK — Los ensayos usan Bun 1.4.2. El contrato packageManager declara Bun 1.3.12.
    Fix: verificar el runtime declarado y alinear el candidato Linux antes de instalar. No cambiar el pin sin evidencia.
