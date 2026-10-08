# Kit de implementación y entrega por empresa

Fecha de revisión: 2026-10-02. Versión documental: 0.1.

Estado: material R4 preparado para revisión y ensayo. No es una versión aceptada del CRM.

El CRM se entrega como instalación independiente. No es SaaS.
Cada empresa conserva recursos, usuarios, configuración y respaldos separados.
Corporativo S&F es el primer piloto. Su instalación todavía no está autorizada.

## Uso del kit

1. Lee el [alcance comercial](ALCANCE-COMERCIAL.md) y las [responsabilidades](RESPONSABILIDADES.md).
2. Completa una copia de la [ficha de configuración](templates/CONFIGURACION-EMPRESA.md).
3. Sigue la [secuencia de implementación](IMPLEMENTACION.md).
4. Prepara el [mapeo de migración](MIGRACION.md), sin cargar datos reales.
5. Usa la [guía de usuario](GUIA-USUARIO.md) y la [guía de operador](GUIA-OPERADOR.md).
6. Imparte la [capacitación sintética](CAPACITACION.md). Registra lo observado, no lo esperado.
7. Completa el [registro de entrega](templates/REGISTRO-ENTREGA.md) y el [soporte revocable](SOPORTE-REVOCABLE.md).
8. Presenta el [acta vacía](templates/ACTA-ACEPTACION.md) al responsable autorizado.

No reemplaces decisiones pendientes con valores del ejemplo sintético.
Las plantillas JSON describen la entrega. No son importadores ni configuración ejecutable del CRM.

## Archivos y audiencias

| Documento | Audiencia | Resultado práctico |
| --- | --- | --- |
| Alcance comercial | Dirección y proveedor propuesto | Servicios separados del software y sus límites. |
| Responsabilidades | Empresa y proveedor propuesto | Responsables por datos, acceso, operación y decisiones. |
| Implementación | Coordinador de entrega | Secuencia con entradas, evidencias y puntos de detención. |
| Guía de usuario | Usuario comercial | Trabajo manual basado en controles existentes. |
| Guía de operador | Operador y administrador | Acceso, diagnóstico seguro y límites de recuperación. |
| Capacitación | Instructor y participantes | Ejercicios, resultados esperados y evaluación individual. |
| Migración | Responsable de datos | Mapeo, rechazos, conciliación y reversión sin carga actual. |
| Soporte revocable | Empresa y soporte | Autorización temporal, cierre y pruebas de revocación. |
| Plantillas | Coordinador de entrega | Configuración, aceptación, evidencia y control de acceso en blanco. |
| Fixtures | Instructor y QA | Datos ficticios A/B y casos inválidos claramente separados. |
| [Fuentes](FUENTES-Y-LIMITES.md) | Revisor | Código leído y distinción entre inspección y ejecución. |
| [Verificación](VERIFICACION.md) | Integrador | Comandos reales de revisión documental y sus límites. |

## Relación con R4

| Gate | Material de este kit | Evidencia todavía necesaria |
| --- | --- | --- |
| D-01 | Registro de artefactos, licencia y referencias de entrega. | Paquete congelado, avisos de dependencias y hashes de artefactos reales. |
| D-02 | Perfiles ficticios A/B y ejercicio E-08. | Dos instalaciones independientes y denegaciones cruzadas observadas. |
| D-03 | Configuración vacía y perfil documental sin secretos. | Esquema ejecutable, aplicación y replay en instancia limpia. |
| D-04 | Mapeo, CSV sintéticos y conciliación E-06. | Preview, aplicación, reintento y exportación implementados y ejecutados. |
| D-05 | Guías, capacitación, responsabilidades y revocación. | Participantes, ejecución, transferencia de control y pruebas de denegación. |
| D-06 | Oferta propuesta sin precios ni compromisos de servicio. | Revisión comercial del responsable competente. |
| D-07 | Acta y autorización en blanco. | Decisiones humanas reales y términos revisados por separado. |
| D-08 | Salida y autonomía en E-08 y soporte. | Exportación conciliada y operación observada sin cuenta del proveedor. |

Ningún gate cambia a aprobado por existir este kit.
Los [44 escenarios](../product/USER-STORIES.md) conservan su aceptación completa pendiente.
Consulta el [roadmap](../product/ROADMAP.md), el [piloto](../product/PILOT-CORPORATIVO-SF.md) y el [charter](../../PROJECT-CHARTER.md).

## Validación local del material

Ejecuta desde la raíz. Estos comandos sólo leen archivos y usan fixtures ficticias.

```powershell
node docs/delivery/validation/check.mjs
node --test docs/delivery/validation/check.test.mjs
git -c safe.directory='D:/respaldo de proyectos/CRM Corporativo' diff --check -- docs/delivery
```

El validador revisa enlaces locales, campos vacíos, relaciones ficticias y marcadores de código.
No inicia el CRM. No demuestra funciones empresariales ni ausencia de tráfico del CRM.
Los archivos nuevos no aparecen en `git diff` hasta añadirse. El validador revisa también su contenido.

## Issues

1. NOT DONE — Los ensayos R4 y la aceptación empresarial no están ejecutados.
   Fix: ejecutar el material contra un candidato completo y registrar resultados por gate.
2. NOT DONE — Artefactos, avisos de dependencias y contratos definitivos todavía no forman una entrega aceptada.
   Fix: completar el paquete técnico y obtener revisión comercial separada.
