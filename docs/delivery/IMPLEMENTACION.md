# Secuencia de implementación por empresa

Estado: procedimiento preparado. Ninguna instalación ni migración ocurre en esta tarea.
R4 reutiliza el mismo paquete versionado. No crea forks de código por cliente.

## Expediente mínimo

Usa un expediente privado por empresa fuera del repositorio compartido.
Aquí sólo conserva plantillas vacías y fixtures sintéticas.
Incluye configuración, alcance, mapeo, artefactos, ensayos, capacitación, autorización de soporte y decisión de aceptación.
Mantén secretos, logs privados, dumps y documentos empresariales fuera de ese expediente documental compartible.

## Secuencia y puntos de detención

| Paso | Acción y responsable propuesto | Entrada | Salida comprobable | Detención obligatoria |
| --- | --- | --- | --- | --- |
| I-01 | Coordinador acuerda problema y límites. | Necesidad y responsable del cliente. | Alcance con criterios y exclusiones. | Falta autoridad del cliente o confusión entre CRM y ERP. |
| I-02 | Cliente revisa proceso y configuración. | Ficha vacía y capacidad inspeccionada. | Campos decididos y capacidades pendientes visibles. | Moneda, permisos o proceso obligatorio no implementados. |
| I-03 | Técnico congela candidato para ensayo. | Versión, artefactos y avisos aplicables. | Fuente, hashes y manifest de entrega. | Artefactos sin origen, cambios mezclados o secretos incluidos. |
| I-04 | QA demuestra núcleo y operación. | Candidato R2/R3 y fixtures propias. | Recibos L/P aplicables; restauración y denegaciones. | Resultado faltante, fallido o cobertura insuficiente. |
| I-05 | Datos prepara migración sintética. | CSV, mapa y política de duplicados. | Preview y conciliación; no carga real. | Importador ausente, preview vencido o relaciones sin resolver. |
| I-06 | QA ensaya dos empresas. | Perfiles A/B y recursos dedicados. | Ausencia de cruces, replay, exportación y recuperación. | Recursos o secretos compartidos; dependencia del proveedor. |
| I-07 | Instructor capacita usuarios y operador. | Versión ensayada y guías concordantes. | Ejercicios observados y brechas de aprendizaje. | Una guía describe un control ausente o un resultado no demostrado. |
| I-08 | Cliente revisa candidato. | Resultados, pendientes y límites explícitos. | Decisión de revisión con versión exacta. | Decisión ausente. No convertir silencio en aceptación. |
| I-09 | Operador solicita instalación futura. | Candidato completo y admisión específica. | Permiso humano independiente del acta técnica. | Instalación prohibida o destino/cuota/recuperación sin aprobación. |
| I-10 | Equipo entrega control tras instalación autorizada. | Resultados postinstalación y autorización vigente. | Usuarios del cliente, custodia propia y revocación de soporte observada. | Cliente sin control propio o revocación no comprobada. |
| I-11 | Cliente decide aceptación final. | Demostración empresarial y resultados completos. | Acta con decisión real y pendientes. | Prueba insuficiente o aceptación prellenada. |

I-09 a I-11 describen trabajo futuro. No se ejecutan ahora.
Las plantillas tampoco conceden permiso de instalación.

## Paquete que recibe cada empresa

- Referencia de fuente, versión, artefactos y hashes concordantes.
- Aviso [MIT](../../LICENSE) y registro de avisos de dependencias aplicables.
- Configuración empresarial sin secretos y referencias privadas de custodia.
- Inventario de base, archivos, respaldo y configuración por instancia.
- Mapeo de datos, límites, resultados por fila y conciliación.
- Guías ajustadas a etiquetas y controles de la versión entregada.
- Resultados de capacitación, restauración, aislamiento y revocación.
- Responsables, alcance de soporte y acta de aceptación sin decisión anticipada.

No distribuyas `.env`, sesiones, hashes de contraseña ni backups dentro del paquete compartible.
Un manifest no reemplaza los artefactos ni las pruebas del cliente.

## Control de cambios

Registra solicitud, motivo, alcance, versión afectada, riesgos, evidencia y autorización específica.
Reensaya los pasos afectados después de cualquier cambio material.
No cambia la instancia B durante una actualización de A.
Cambios de origen de aplicación requieren recompilación según el [contrato de despliegue](../deployment/environment-contract.md).
La recuperación no usa una promesa de downgrade automático.
Consulta la [recuperación técnica](../deployment/recovery.md) antes de diseñar el ensayo.

## Issues

1. NOT DONE — La secuencia todavía no dispone de un candidato completo con ejecución R2/R3/R4.
   Fix: completar el desarrollo y adjuntar recibos reales antes de promover cada paso.
2. UNKNOWN — Los valores por empresa y la admisión futura no tienen aprobación.
   Fix: completar el expediente privado sin copiar defaults sintéticos a producción.
