# Guía de operador y administrador

Estado: preparación basada en código. No inicia servicios ni instala el proyecto.
Los comandos de acceso siguientes describen ejecución futura dentro de una instancia autorizada.
No los ejecutes contra una base existente o destino sin identificar.

## Inventario previo

Registra identificador de instalación, versión exacta, orígenes aprobados, base, archivos y responsables.
Registra permisos, custodia de secretos, límites de recursos, respaldo y recuperación.
Usa referencias privadas de custodia. No copies secretos ni URLs con contraseñas.
Confirma que ningún recurso pertenece a otra empresa.
Lee [acceso local](../access/local-access.md), [entorno](../environment.md) y [paquete](../deployment/README.md).

## Acceso local observado en código

El operador provisiona cuentas. La lista `ALLOWED_SIGN_IN` no crea usuarios ni concede roles.
La política exige cuenta y membresía existentes.
El bootstrap requiere una instalación vacía. La prueba concurrente en PostgreSQL 17 sigue pendiente.
Las contraseñas de alta requieren 12–128 caracteres. La terminal oculta su captura interactiva.

Comandos existentes, desde la raíz y sólo tras migraciones y configuración autorizadas:

```powershell
bun run auth:provision --bootstrap
bun run auth:provision
```

El primer comando crea el propietario inicial. El segundo acepta `admin` o `member`.
No recrea usuarios existentes ni reemplaza contraseñas existentes.
No uses entrada de contraseña en argumentos, tickets o capturas.
La herramienta de provisioning carga entorno. Este kit no ejecuta esa herramienta ni crea archivos de entorno.

`owner`, `admin` y `member` son los roles de código actuales.
Manager, rep y viewer pertenecen al diseño pendiente. No los asigna esta herramienta.
`Configuración > Usuarios` permite crear cuentas, revisar acceso, suspender, reactivar y recuperar contraseñas locales.
Sólo el propietario crea administradores, cambia roles elevados o administra propietarios y administradores.
Un administrador sólo crea y administra miembros. No se deja cero propietarios activos.
Un motivo acompaña suspensión, reactivación y recuperación. No borra ni reasigna automáticamente el trabajo comercial.
El cambio de rol revoca sesiones y claves; cambiar a `member` no equivale a suspender el usuario.
Reactivar exige nuevo login y no reactiva claves anteriores. Recuperar no envía correo ni obliga todavía al siguiente cambio de contraseña.
No uses el endpoint administrativo para tu contraseña propia. Ese cambio necesita contraseña actual.
La auditoría de identidad muestra actor, acción, fecha y snapshots. No incluye credenciales generadas.
Las [pruebas](../verification/2026-10-03-managed-identity.md) son sintéticas y focales. No aceptan todos los permisos empresariales ni capacitación en navegador.

## Responsabilidad de empresas y contactos

Las [pruebas focales](../verification/2026-10-04-company-contact-authorization.md) verifican restricciones actuales por responsable.
Los miembros leen registros compartidos y sólo modifican registros asignados a ellos.
Owner/admin reasigna registros a miembros activos. Un registro sin responsable no concede permiso al miembro que lo consulta.
Suspender no reasigna trabajo. Revisa empresas, contactos, oportunidades y tareas mediante un proceso operativo explícito.
La purga pública exige owner y archivo previo. No utilices retención como sustituto de una autorización humana.
El ensayo de retención protege fechas recientes y registros activos. No acepta todavía la identidad del worker productivo.
Las operaciones masivas informan resultados parciales. Revisa cada fallo y conserva los registros rechazados.
Los controles visibles todavía requieren adaptación. La comprobación del servidor gobierna cada operación.
No habilites IA para compensar permisos incompletos o un worker sin identidad aceptada.

## Configuración empresarial

`Settings > General > Workspace` administra nombre y sitio.
El código exige sitio para onboarding y guardado del workspace.
El nombre cambia la ruta del espacio. Registra la nueva ruta después de guardar.
La futura configuración sin sitio sigue pendiente; no instruyas al cliente a inventar su sitio real.
Los ejercicios usan dominios reservados de prueba.

`Settings > Currencies` permite moneda de reporte y tasas manuales.
La tasa manual expresa unidades de moneda de reporte por unidad de la otra moneda.
No selecciones `Refresh rates` durante el ensayo sin salida externa autorizada.
Cambiar la moneda de reporte vuelve a calcular importes convertidos; revisa alcance antes de cambiarla.
El catálogo actual contiene USD, EUR, JPY, GBP, CNY, AUD, CAD, CHF, HKD, SGD, ZAR y MXN.
El ejercicio USD no aprueba esa moneda para una empresa real.

## Funciones opcionales

Mantén IA y telemetría desactivadas en el ensayo base.
No conectes Google, Microsoft, Slack, Blob ni proveedores de IA.
No generes claves API para suplir controles empresariales incompletos.
Apagar IA no cancela peticiones previas ni bloquea todas las integraciones del CRM.
La observación de salida externa necesita un ensayo completo separado.

## Diagnóstico sin ampliar acceso

| Síntoma | Comprobación limitada | Acción segura | Límite |
| --- | --- | --- | --- |
| Login rechazado | Cuenta, membresía, elegibilidad y versión mediante operador autorizado. | Registrar efecto y escalar; no abrir registro público. | La lista permitida no recupera contraseña ni verifica identidad. |
| Conexión cerrada | Estado de API y PostgreSQL de la instancia exacta. | Detener cambios y registrar hora/correlación sin datos sensibles. | No repetir automáticamente importación, cierre o alta; confirmar resultado previo. |
| `/health` retorna error | API y consulta `SELECT 1` de base. | Seguir diagnóstico de la instancia, sin tocar otras bases. | Health no comprueba archivos, usuarios, recuperación ni flujo comercial. |
| Reporte no concilia | Moneda, tasa, archivados y conjunto de oportunidades del ejercicio. | Comparar conteo manual y registrar diferencia. | El dashboard excluye oportunidades archivadas. No convertir importes desconocidos en cero. |
| Control ausente | Versión y [fuente](FUENTES-Y-LIMITES.md). | Marcar ejercicio BLOQUEADO y registrar requisito. | No inventar pantallas o ejecutar SQL como sustituto. |
| Acceso de soporte vigente | Ticket, expiración y pruebas de [revocación](SOPORTE-REVOCABLE.md). | Cerrar intervención y solicitar cierre técnico aceptado. | Logout sólo cierra la sesión usada; no suspende todas las credenciales. |

Los health checks sólo se consultan en un ensayo autorizado. Este kit no llama endpoints.
No pegues stack traces privados, cookies, cuerpos, dumps o cadenas de conexión en reportes.

## Respaldo, recuperación y actualización

El [runbook existente](../deployment/recovery.md) prepara backup de base y restauración hacia una base nueva.
El backup actual no cubre archivos, secretos ni toda configuración de instalación.
No ejecutes sus comandos en esta tarea. No uses `db reset`, `db push` ni seed como recuperación.
No prometas RPO, RTO o restauración completa desde la revisión de scripts.

Antes de una operación futura, el operador verifica destino, versión, autorización y respaldo íntegro.
El ensayo incluye archivos, relaciones, login, permisos y conciliación después de restaurar.
Una restauración conserva la instancia fuente y la instancia fallida.
Una actualización incompatible requiere restauración aceptada con artefactos anteriores; no presupone down migrations.
No cambia la base B durante una operación de A.

## Cierre de entrega

El cliente conserva su propietario y custodia propios.
El proveedor no permanece como propietario ni recibe credenciales globales por defecto.
Completa control transferido, instrucciones de salida y revocación observada en el [registro](templates/REGISTRO-ENTREGA.md).
Aceptación técnica e instalación mantienen decisiones separadas en el [acta](templates/ACTA-ACEPTACION.md).

## Issues

1. NOT DONE — Recuperación del primer propietario, cinco perfiles y RBAC completo no tienen procedimiento empresarial aceptado.
   Fix: completar casos restantes y navegador antes de usuarios reales.
2. NOT DONE — Restauración completa, Linux y límites efectivos todavía requieren ejecución integrada.
   Fix: ensayar el candidato congelado en un entorno aislado posteriormente autorizado.
3. RISK — Health y logout cubren sólo parte de la operación y revocación necesarias.
   Fix: registrar esa cobertura limitada y ejecutar pruebas adicionales antes de cerrar aceptación.
