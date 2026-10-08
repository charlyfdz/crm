# Soporte autorizado y revocable

Estado: checklist de entrega propuesto. No concede acceso ni inicia una intervención.
El CRM debe funcionar sin soporte permanente del proveedor.
No incluye SLA, atención continua, fechas comprometidas ni tiempos prometidos.

## Antes de acceso

- [ ] Cliente autorizado identifica instalación, versión, problema y alcance.
- [ ] Ticket registra efectos y evidencia redactada, no cookies ni datos privados.
- [ ] Autorización nombra identidad temporal, acciones, límites y expiración.
- [ ] Cliente conserva propietario, recuperación y custodia propios.
- [ ] Operador comprueba controles técnicos que limitan y revocan ese acceso.
- [ ] Se prohíbe credencial compartida, cuenta global del propietario y acceso permanente implícito.
- [ ] Datos ficticios bastan para diagnóstico inicial; datos reales requieren aprobación distinta.
- [ ] Escrituras, migraciones, restores y salida externa requieren permisos explícitos por operación.

Usa la [autorización vacía](templates/AUTORIZACION-SOPORTE.md).
Un ticket abierto no concede acceso. La asistencia por pantalla con el operador evita una cuenta permanente del proveedor.
La conexión real o el soporte remoto no están autorizados por esta tarea.

## Durante intervención

- [ ] Confirma identidad, instancia y autorización vigente antes de cada cambio.
- [ ] Conserva el mínimo acceso necesario y registra acciones por referencia segura.
- [ ] Detén trabajo que excede alcance, cambia destino o necesita información real no autorizada.
- [ ] Obtén evidencia antes y después del cambio sin cuerpos comerciales ni secretos.
- [ ] Conserva recursos fallidos y evita borrar datos como diagnóstico.
- [ ] Registra errores y pendientes sin afirmar aceptación del cliente.

## Cierre y revocación

| Paso | Acción necesaria | Evidencia requerida | Límite actual |
| --- | --- | --- | --- |
| S-01 | Entregar diagnóstico, cambios y pendientes. | Ticket con versión y efectos observados. | Un cierre de ticket no retira acceso técnico. |
| S-02 | Cerrar la sesión de soporte usada. | Sesión previa denegada tras logout. | Logout no revoca sesiones ajenas ni suspende cuenta completa. |
| S-03 | Revocar cada clave API de soporte. | Solicitud posterior denegada y clave ausente/desactivada. | El código ofrece revocación de claves propias; alcance empresarial completo espera ensayo. |
| S-04 | Retirar acceso de usuario y sesiones restantes. | Denegación de login y de todas las sesiones previas. | Suspensión administrada completa todavía pendiente; no usar cambio a member como revocación. |
| S-05 | Retirar permisos de infraestructura y canales. | Readback por operador y prueba de rechazo. | Este documento no ejecuta cambios en servidor, VPN ni cuentas. |
| S-06 | Rotar secretos expuestos de forma autorizada. | Referencias nuevas y validación sin valores. | No sustituye identidad ni política de recuperación. |
| S-07 | Revisar archivos y exportaciones temporales. | Retención, destino y cierre de acceso documentados. | Eliminación requiere permiso y procedimiento recuperable apropiado. |
| S-08 | Comprobar control y operación del cliente. | Propietario propio, consulta y flujo manual tras retiro de soporte. | Prueba pendiente contra candidato completo. |

`Settings > API Keys` muestra claves de la identidad actual y ofrece revocación con confirmación.
No promete a un administrador una revocación global no inspeccionada.
No crees claves como workaround de permisos incompletos.

La baja contractual, retiro técnico y aceptación empresarial se registran por separado.
La revocación sólo cierra después de observar las denegaciones necesarias.
Cuando falta un control técnico, no concedas soporte independiente con ese alcance.
Registra NOT DONE y conserva la intervención asistida por el cliente hasta existir un procedimiento aceptado.

## Sin dependencia permanente

El cliente conserva fuentes/artefactos entregados, documentación y referencias de custodia propias.
El cierre de soporte no elimina datos del cliente ni desactiva su instalación.
El ensayo D-08 comprueba exportación y uso sin cuenta de proveedor o servidor de activación.
El soporte no exige transmitir datos a IA ni mantener un consentimiento externo.

## Issues

1. NOT DONE — Suspensión global, revocación completa y autonomía carecen de ejecución integrada aquí.
   Fix: demostrar S-02 a S-08 antes de aceptar soporte con acceso independiente.
2. UNKNOWN — Identidades, expiración, canales y compromisos del soporte real permanecen sin aprobación.
   Fix: completar autorización privada y términos revisados por separado.
