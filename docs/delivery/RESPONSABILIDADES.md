# Responsabilidades de implementación y operación

Estado: matriz propuesta. Los nombres y decisiones quedan en blanco.
Cliente significa empresa usuaria. Proveedor significa prestador propuesto de servicios.
Operador significa responsable de infraestructura con autoridad específica.
La propiedad de infraestructura no determina la propiedad legal del software.

| Actividad | Cliente | Proveedor propuesto | Operador | Evidencia requerida |
| --- | --- | --- | --- | --- |
| Proceso y criterios | Decide etapas, campos, resultados y restricciones. | Traduce decisiones a alcance comprobable. | Revisa efectos operativos. | Ficha de configuración y criterios observables. |
| Datos | Autoriza fuente y uso; resuelve duplicados. | Mapea y concilia dentro del alcance. | Protege almacenamiento y transferencia. | Autorización, mapeo y conteos sin contenido privado. |
| Versión | Revisa límites y funciones demostradas. | Entrega referencia exacta y avisos. | Conserva artefactos recuperables. | Inventario y hashes de distribución. |
| Instalación | Solicita autorización específica. | Prepara paquete y ensayo. | Ejecuta sólo en destino autorizado. | Resultado técnico y permiso separados. |
| Usuarios | Confirma identidad, roles y baja. | Explica controles y limita su acceso. | Provisiona mediante procedimiento aceptado. | Membresía, pruebas de denegación y responsable. |
| Secretos | Mantiene control de custodia y recuperación. | No conserva secretos permanentes del cliente. | Genera material independiente por instancia. | Referencias de custodia, nunca valores. |
| Integraciones | Autoriza campos, destino y acciones. | Explica salidas y límites comprobados. | Aplica bloqueo y revocación aceptados. | Consentimiento específico y observación. |
| Respaldo | Decide objetivos y riesgo residual. | Documenta y ensaya recuperación contratada. | Ejecuta y supervisa política aprobada. | Inventario, hashes y tiempos observados. |
| Actualización | Revisa cambio y ventana acordada. | Entrega compatibilidad y recuperación. | Conserva instancia fallida y controla cambio. | Ensayo, autorización y smoke posterior. |
| Capacitación | Designa participantes y valida aprendizaje. | Imparte ejercicios y registra límites. | Practica diagnóstico y recuperación. | Asistencia y evaluación sin éxito anticipado. |
| Soporte | Autoriza cada intervención y puede revocarla. | Diagnostica con mínimo acceso. | Aplica cierres técnicos autorizados. | Ticket, expiración y pruebas de revocación. |
| Aceptación | Decide mediante representante autorizado. | Expone resultados y pendientes. | Confirma controles operativos observados. | Acta sin aceptación prellenada. |
| Salida | Decide exportación, conservación y cierre. | Entrega documentación sin bloquear el uso. | Protege exportaciones y retira accesos aprobados. | Conciliación y lista de recursos retenidos. |

Completa responsables en la [ficha](templates/CONFIGURACION-EMPRESA.md) y el [registro de entrega](templates/REGISTRO-ENTREGA.md).
No guardes teléfonos, documentos personales, credenciales ni expedientes en este repositorio.
En una entrega real, conserva registros privados en el sistema autorizado del cliente.

## Escalación

1. El usuario registra versión, hora, paso y efecto sin capturar cookies ni contenido de clientes.
2. El operador delimita instancia, usuarios afectados y controles que no responden.
3. El proveedor revisa evidencia redactada dentro de la autorización vigente.
4. El cliente decide cambios de alcance, uso de datos, ventanas y aceptación de riesgos.
5. El operador suspende cambios con destino ambiguo, acceso vencido o recuperación no comprobada.

No fijes nombres, tiempos de respuesta ni obligaciones de atención en esta matriz.

## Issues

1. UNKNOWN — Los responsables reales y las obligaciones comerciales no están designados.
   Fix: completar una copia privada y obtener decisiones del cliente antes de ejecutar servicios.
