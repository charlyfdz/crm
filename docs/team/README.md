# Equipo de desarrollo

## Mandato

Fecha de primera ejecución: 2026-10-01.
Actualización documental: 2026-10-02.

El equipo desarrolla un CRM interno instalable por empresa. No desarrolla un SaaS multiempresa.

Cada agente trabaja en un área concreta. El director técnico integra código y evidencia.

Los roles indican especialización de trabajo. No acreditan títulos profesionales humanos.

## Primera ejecución — registro histórico

Estos identificadores corresponden a la primera ejecución. Ya no identifican sesiones accesibles del equipo actual.

Los archivos conservan trabajo parcial. La tabla no acredita actividad actual ni entregables completos.

| Área | Agente | Identificador | Entregable | Estado |
| --- | --- | --- | --- | --- |
| Producto y análisis | Anscombe | 01a0f9ea-1e09-7060-9043-664ec89e696a | Requisitos, flujos y matriz de aceptación | Histórico; documentos disponibles, aceptación pendiente |
| Frontend | Popper | 01a0f9ea-1ef0-7260-852f-041da2066c46 | Alta sin IA obligatoria y moneda estable | Histórico; cambios parciales, integración pendiente |
| Datos y PostgreSQL | Boole | 01a0f9ea-2063-7d21-9cf9-65f8597f132c | Pool persistente y recuperación verificable | Histórico; configuración y pruebas presentes, recuperación pendiente |
| Operación | Plato | 01a0f9ea-21ea-7852-97e5-ba2bcb70477d | Paquete Docker por empresa, respaldo y restauración | Histórico; paquete parcial, operación pendiente |
| Ingeniería IA | Planck | 01a0f9eb-ae1b-7122-a446-74b5f9d204a9 | IA opcional y bloqueos de salida | Histórico; política presente, integración pendiente |
| Backend y acceso | Director técnico | Chat principal de primera ejecución | Acceso por contraseña y alta administrada | Histórico; acceso parcial, aceptación integrada pendiente |

## Handoff de producto — histórico del ciclo actual

El handoff actual asigna backend, DevOps y coordinación principal. Esta entrega cubre producto.

No se inventan identificadores, sesiones activas, credenciales profesionales ni resultados de otros agentes.

| Función | Tarea asignada | Evidencia disponible | Límite verificado por producto |
| --- | --- | --- | --- |
| Principal e integración | Integrar código, contratos de configuración y pruebas. Coordinar dependencias. | Reporta 95 pruebas aprobadas, typechecks y build standalone de Next. Véase [baseline](../product/BASELINE.md). | Evidencia estática parcial; no acredita operación empresarial, DB real, Docker ni producción. |
| Backend y acceso | Completar permisos, ciclo de usuarios, recuperación y bloqueos de IA en API. | `packages/auth/src/auth.ts`, `provision-user.ts` y [handoff IA](../ai/principal-handoff.md). | Inspección parcial; no se certifica ejecución ni finalización del agente actual. |
| DevOps | Completar paquete por empresa, contratos Coolify, restauración y medición de recursos. | `deploy/compose.yml`, `deploy/Dockerfile` y contratos operativos presentes. | Presencia de archivos; no acredita instalación ni recursos disponibles del homelab. |
| Producto de este ciclo | Actualizar contrato, piloto, criterios completos y preguntas pendientes. | [Piloto S&F](../product/PILOT-CORPORATIVO-SF.md), matriz y aceptación fechadas. | Entrega documental; los 44 requisitos mantienen aceptación operativa pendiente. |

Corporativo S&F es el primer piloto. Coolify en `paas-control` es el destino futuro, no una instalación autorizada.

## Integración principal — 2026-10-02

Las tres ejecuciones terminan cerradas. Ningún especialista permanece activo en segundo plano.

| Especialista | Identificador verificado | Resultado |
| --- | --- | --- |
| Producto, Chandrasekhar | `01a0fd21-78c1-74f3-8149-f2fc4893b28e` | Contrato completo y piloto documentados. Los 44 escenarios conservan aceptación pendiente. |
| DevOps, Hume | `01a0fd21-7768-71b2-9051-dffc571488d1` | Paquete y 42 pruebas estáticas. Sin Docker, instalación ni recursos concedidos. |
| Backend IA, Lovelace | `01a0fd21-7813-7671-9980-fafc23f17680` | Primer handoff completo. Segundo incremento interrumpido por límite de uso; principal integra y verifica. |
| Principal | Este chat | Acceso local, configuración, contexto S&F, integración IA, interfaz, pruebas y motor local. |

El principal corrige dos mocks incompletos del segundo incremento de backend.
El principal verifica 260 pruebas seleccionadas, typechecks y builds de app y API.
La [evidencia integrada](../verification/2026-10-02-local-foundations.md) sustituye el total histórico de 95 pruebas.
La evidencia no declara versión completa, aceptación empresarial ni instalación autorizada.

El motor registra el piloto y la admisión futura. No se escriben plataformas externas.

## Integración comercial posterior — 2026-10-02

Las seis ejecuciones de este incremento quedan cerradas. No permanecen especialistas activos en segundo plano.
Los handoffs incompletos se integran por el principal. Un handoff no equivale a una prueba ejecutada.

| Área | Especialista | Entrega e integración |
| --- | --- | --- |
| Reportes y moneda | Pasteur; `01a0fe63-fb7c-7ef3-b478-d56a32149fef` | Dashboard sin archivo y MXN. El principal reejecuta pruebas y corrige avisos frontend. |
| Tareas | Godel | Servicio y formularios parciales. El principal integra controles, permisos, fechas y búsqueda. |
| Procesos | Linnaeus | Modelo y configuración parcial. El principal integra API, etapas, historia, filtros y altas. |
| Identidad | Goodall | Vector y navegación accesible. El principal verifica las 16 pruebas estáticas. |
| Migraciones | James | Harness parcial. El principal corrige aislamiento de errores SQL y verifica conservación de datos. |
| Entrega | Hubble | Kit documental parcial. El principal completa fuentes, validador y guías actualizadas. |

Los identificadores no disponibles en este recibo no se reconstruyen por semejanza de nombres.
El [recibo comercial](../verification/2026-10-02-business-flow.md) registra 250 pruebas seleccionadas y tres pruebas documentales.
También registra typechecks y builds finales. Los 260 resultados históricos no se suman a este total.
La versión completa y aceptación empresarial permanecen pendientes. La instalación conserva su gate independiente.

## Áreas pendientes de asignación verificable

Marketing define la oferta de implementación y los límites de las promesas comerciales.

Diseño gráfico prepara identidad propia y recursos del producto, sin retirar la licencia MIT.

Diseño web revisa navegación, claridad, accesibilidad y flujos de trabajo.

Calidad y seguridad comprueban autenticación, permisos, datos, recuperación e instalación aislada.

Estas áreas conservan tareas propuestas. Esta actualización no acredita agentes activos ni entregas de esas áreas.

El principal registra identificadores nuevos sólo después de crear y comprobar cada ejecución.

## Reglas de integración

- Cada agente modifica archivos asignados. El equipo evita cambios simultáneos en el mismo archivo.
- Cada entrega incluye archivos, pruebas realizadas y límites pendientes.
- Las integraciones externas quedan apagadas por defecto.
- Las pruebas usan datos sintéticos. El equipo no usa datos ni credenciales del laboratorio tercero.
- El equipo completa la versión antes de pedir autorización de instalación. R1 no habilita el piloto del homelab.
- El equipo no despliega producción ni publica la oferta sin aprobación del propietario.
- Esta entrega sólo cambia documentos autorizados. El principal recibe la actualización del motor como pendiente separado.

## Issues

1. NOT DONE — Las áreas futuras no tienen una asignación comprobada en este ciclo.
   Fix: registrar cada ejecución nueva y sus entregables verificables.
2. NOT DONE — La aceptación integrada y operativa del CRM permanece pendiente.
   Fix: ejecutar los criterios completos del piloto antes de solicitar instalación.
