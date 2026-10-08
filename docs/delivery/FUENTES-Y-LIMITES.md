# Fuentes y límites del kit

Fecha: 2026-10-02. Revisión propia: `crm-corporativo`, base `6d4793d`, cambios locales sin commit.

El kit describe una instalación por empresa. No acredita SaaS ni aceptación productiva.
Conserva la licencia MIT. No fija precios, contratos, moneda empresarial ni decisiones legales.

| Área | Fuente inspeccionada | Evidencia de ejecución |
| --- | --- | --- |
| Acceso administrado | `packages/auth/src/auth.ts`, `provision-user.ts` | [Fundamentos](../verification/2026-10-02-local-foundations.md) y reejecución de 11 pruebas de acceso. |
| Procesos comerciales | `apps/api/src/pipelines/`, `apps/api/src/deals/`, `apps/app/components/pipelines/` | [Ensayo comercial](../verification/2026-10-02-business-flow.md). |
| Tareas | `apps/api/src/activities/`, `apps/app/components/crm/activity-tasks/` | Pruebas unitarias, servicios con Prisma y markup estático. Sin aceptación de navegador. |
| Reportes y MXN | `packages/db/src/currency.ts`, `apps/api/src/dashboard/` | [Reconciliación](../data/reporting-20261002.md) y ensayo comercial. |
| Recuperación y paquete | `deploy/`, [operación](../deployment/README.md) | Contratos estáticos. PostgreSQL 17, Linux y restore completo siguen pendientes. |
| Producto | [Roadmap](../product/ROADMAP.md), [piloto S&F](../product/PILOT-CORPORATIVO-SF.md) | Los 44 escenarios completos conservan aceptación pendiente. |

Los documentos de capacitación y fixtures permanecen NO EJECUTADOS.
Las plantillas JSON son documentos. No configuran el CRM ni importan datos.
Los perfiles A/B no acreditan dos instalaciones ni aislamiento observado.
El ensayo comercial no envía correos, no llama IA y no registra servicios del homelab.
La prueba PGlite no demuestra recuperación del error original en PostgreSQL productivo.

## Issues

1. NOT DONE — El kit carece de ensayos completos R4 y capacitación observada.
   Fix: ejecutar contra un candidato completo y conservar recibos por gate.
2. UNKNOWN — Los controles interactivos todavía carecen de aceptación integral de navegador.
   Fix: comprobar navegación, teclado, errores, permisos y persistencia en una instancia sintética.
