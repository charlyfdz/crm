# Guía de usuario comercial

Estado: guía del código inspeccionado hasta el 2026-10-04. No es un ensayo de navegador.
El instructor ejecuta los pasos sólo en una instancia sintética previamente autorizada.
La interfaz todavía combina español e inglés. Conservamos etiquetas existentes para localizar los controles.

## Conceptos

| Concepto | Uso |
| --- | --- |
| Workspace | Empresa que utiliza esta instalación. No representa un cliente dentro del CRM. |
| Company | Empresa prospecto, cliente o relacionada. |
| Contact | Persona vinculada a una empresa. |
| Deal | Oportunidad comercial con empresa, responsable y etapa. |
| Owner | Responsable del registro. No equivale necesariamente al rol de propietario de la instalación. |
| Activity | Nota, llamada, correo registrado, reunión registrada, tarea o evento de etapa. |

La dirección `/<slug>` identifica el espacio. No separa datos entre empresas usuarias.
Cada empresa usuaria necesita otra instalación.

## 1. Acceso y salida

1. Abre la dirección privada aprobada de la instancia de ensayo.
2. En `/sign-in`, introduce el correo ficticio provisionado y su contraseña temporal privada.
3. Selecciona `Iniciar sesión`.
4. Completa onboarding sólo con el instructor: nombre, dirección del espacio y sitio ficticio.
5. Selecciona `Continuar sin IA`. Guardar el sitio no activa IA.
6. Para salir, usa `Sign out` en el menú de cuenta.

El registro público está cerrado. Google y Context.dev no son requisitos de acceso local.
No compartas contraseña ni sesión. Cerrar la pestaña no equivale a revocar una sesión.
La recuperación completa sigue pendiente. Solicita diagnóstico al operador; no cambies la base manualmente.

## 2. Crear una empresa

1. Abre `Companies` y selecciona `New company`.
2. En `Name`, introduce `Demo Consultoría Alba`.
3. En `Domain`, introduce `alba.example.test` o deja el campo vacío para el ejercicio sin dominio.
4. En `Owner`, selecciona la identidad ficticia indicada por el instructor.
5. Selecciona `Add company` y anota el identificador de ensayo.
6. Abre la ficha y comprueba nombre, dominio y responsable después de recargar.

El dominio es opcional en este formulario. Un dominio repetido requiere revisión, no reemplazo automático.
La descripción del formulario todavía promete campos del agente. No tomes ese texto como resultado con IA apagada.

## 3. Crear y relacionar un contacto

1. Abre `Contacts` y selecciona `New contact`.
2. Introduce `Lina`, `Prueba` y `lina@alba.example.test`.
3. Usa `Title` para un cargo ficticio y selecciona `Demo Consultoría Alba` en `Company`.
4. Selecciona un `Owner` ficticio y guarda con `Add contact`.
5. Abre una oportunidad de Alba y su pestaña `Contacts`.
6. Usa `Add contact` para vincular a Lina.
7. Registra `Decisión técnica ficticia` en el campo `Role` de esa relación.

El correo y apellido son opcionales. El nombre es obligatorio.
`Role` del contacto describe su papel comercial. No concede permisos del CRM.
El servicio exige que el contacto pertenezca a la empresa de la oportunidad.
El texto del formulario menciona importación. Este kit no confirma un importador disponible.

## 4. Crear una oportunidad

1. Abre `Oportunidades` y selecciona `Nueva oportunidad`.
2. Introduce `Diagnóstico empresarial ficticio` en `Name`.
3. Selecciona Alba, el responsable ficticio, el proceso comercial y una etapa abierta.
4. Para el ejercicio monetario, introduce `100.00` y selecciona explícitamente `USD`.
5. Para el ejercicio sin valor conocido, deja `Amount` vacío. No uses cero como desconocido.
6. Deja `Expected close date` vacía hasta acordar una fecha ficticia.
7. Selecciona `Crear oportunidad` y recarga la ficha.

USD es sólo moneda del ejercicio. No representa precios de servicios ni la moneda elegida por S&F.
El catálogo admite MXN. No introduzcas MXN como USD. Confirma la moneda de cada oportunidad.
Usa punto decimal y omite separadores de miles durante este ensayo.

## 5. Registrar trabajo manual

1. Abre `Activity` en la ficha de oportunidad.
2. Selecciona `Note` y escribe `Demo: se acuerda revisar alcance; no existen documentos reales`.
3. Selecciona `Log note` o usa Ctrl+Enter.
4. Selecciona `Task` y escribe `Demo: confirmar necesidad ficticia` en `Tarea`.
5. Configura detalles, fecha y hora UTC, prioridad y responsable. Selecciona `Crear tarea`.
6. Comprueba la tarea en la actividad y la cola personal del responsable.
7. Usa `Gestionar tarea` para editar, completar o reabrir. El autor original permanece visible.

`Email` registra lo ocurrido. Este compositor no envía correo.
`Meeting` registra una reunión. No crea una cita de calendario ni una invitación externa.
El autor y el responsable son campos separados. Sólo owner/admin asigna o reasigna a otra persona.
El autor, el responsable y owner/admin editan la tarea. La API comprueba la membresía vigente.
La fecha de entrada usa UTC explícita. La zona regional configurable sigue pendiente.
No presentes estas pruebas focales como aceptación completa de REQ-013.

## 6. Cambiar etapa y conservar evidencia

Abre el control de etapa en la ficha o lista.
`Configuración > Procesos comerciales` permite crear, renombrar y ordenar procesos y etapas.
Sólo owner/admin modifica la configuración. Cada etapa conserva su identificador y resultado.
El sistema rechaza retirar etapas o procesos con oportunidades activas o archivadas.
La migración conserva estas clasificaciones históricas:

| Etiqueta | Significado en este ensayo |
| --- | --- |
| Demo booked | Inicio del caso ficticio. |
| Qualified to buy | Necesidad ficticia revisada. |
| Decision maker in | Contacto decisor ficticio identificado. |
| Contract sent | Propuesta ficticia registrada. No demuestra envío ni firma. |
| Closed won | Resultado comercial ganado ficticio. No demuestra pago ni entrega. |
| Closed lost | Resultado perdido. Registra un motivo. |
| Unqualified | Caso descartado. Registra un motivo. |

1. Abre el control de etapa. Selecciona proceso y etapa activa. Comprueba el evento en `Activity`.
2. En un segundo caso, selecciona una etapa de resultado perdido.
3. Introduce `Demo: necesidad fuera del alcance ficticio` y guarda el cambio.
4. Comprueba etapa, motivo y evento después de recargar.
5. Tras un ganado ficticio, comprueba la tarea automática de traspaso asignada al responsable de la oportunidad.

La prueba aislada comprueba el traspaso automático y evita duplicados al repetir la misma etapa.
Ganar, reabrir y ganar otra vez registra otro cierre y otro traspaso. No representa una entrega completada.
La reapertura mediante etapa abierta existe. El motivo obligatorio de reapertura todavía no está implementado allí.
Registra el motivo como nota de ensayo; no lo presentes como validación obligatoria del sistema.
No renombres etapas mediante cambios directos a la base. Usa la configuración y conserva el historial.
Mover a otro proceso exige confirmación. Los movimientos masivos comunican éxitos y fallos parciales.

## 7. Archivo y reportes

Usa `More actions` y `Archive company/contact/deal` sólo sobre una fixture de ensayo.
La vista `Archived` permite localizar registros archivados. `Restore` solicita recuperación del registro.
No uses `Delete forever` durante capacitación. Esa acción elimina datos y relaciones según el registro.
El archivo no reemplaza un respaldo.

Para oportunidades, `member` edita, archiva y restaura sólo sus registros asignados.
`owner` y `admin` administran otras oportunidades y reasignan sólo a miembros actuales.
Los cambios de contactos respetan la oportunidad, empresa y estado activo del contacto.
Una oportunidad archivada exige restauración antes de editar o cambiar vínculos.
La eliminación definitiva pública queda limitada a `owner` después del archivo.
No uses esa eliminación durante capacitación. La recuperación exige respaldo verificado.
Los botones todavía no acreditan todos los permisos visibles. El servidor rechaza operaciones sin autoridad.
Empresas y contactos aplican ahora la misma restricción por responsable con los tres roles actuales.
El alta asigna el registro al usuario actual. Sólo owner/admin selecciona otro responsable activo o elimina la asignación.
Un contacto nuevo admite selección explícita sin empresa. Omitir selección permite asociación automática por dominio del correo.
Usa empresas activas para crear, mover o restaurar contactos.
Retira la designación de contacto principal antes de mover o archivar ese contacto.
Desvincula sus oportunidades antes de trasladarlo a otra empresa.
Archiva las oportunidades relacionadas antes de solicitar eliminación definitiva de una empresa.
La eliminación de empresa conserva contactos sin empresa y elimina las oportunidades archivadas asociadas.
No ejecutes esa eliminación durante capacitación. Los ejercicios usan archivo y restauración solamente.
La interfaz todavía muestra controles que el servidor rechaza. No cambies permisos mediante SQL para superar esos rechazos.
Estos controles no aceptan la política empresarial completa ni los cinco perfiles objetivo.
Consulta la [política parcial](../product/ROLES-PERMISSIONS.md) y la [evidencia actual](../verification/2026-10-04-company-contact-authorization.md).

Consulta importes originales, moneda y exclusiones por tasas faltantes.
Contrasta el dashboard con el conteo manual del ejercicio.
El dashboard excluye oportunidades archivadas. Restaurarlas restablece su participación sin cambiar importes ni tasas almacenadas.
Los importes sin conversión válida permanecen excluidos y declarados. No se convierten en cero.
La prueba usa servicios reales y una base temporal. La aceptación empresarial del reporte continúa pendiente.

## Funciones todavía fuera de esta guía operativa

Importación completa, exportación portable, documentos privados versionados y calendario local esperan desarrollo y ensayo.
Permisos empresariales completos, reasignación integral y recuperación del primer propietario esperan desarrollo y ensayo.
La suspensión y recuperación administrativa actuales tienen [evidencia focal](../verification/2026-10-03-managed-identity.md), no aceptación empresarial completa.
Los [ejercicios R4](CAPACITACION.md) los mantienen como criterios pendientes, no como pasos disponibles.
Consulta el [registro de fuentes](FUENTES-Y-LIMITES.md) para actualizar esta guía después de cambios de código.

## Issues

1. NOT DONE — Esta guía carece de validación de navegador y capacitación observada.
   Fix: registrar etiqueta, paso, revisión y resultado durante el ensayo autorizado.
2. RISK — Textos upstream prometen enriquecimiento e importación sin demostrar esas capacidades en el núcleo actual.
   Fix: aclarar las limitaciones al usuario y actualizar textos en un trabajo de código separado.
3. NOT DONE — Tareas, permisos, documentos y portabilidad no cumplen todo el alcance empresarial.
   Fix: completar las funciones y reensayar antes de entregar una guía como aceptada.
4. NOT DONE — Zona horaria empresarial, reconciliación de navegador y recuperación operativa permanecen pendientes.
   Fix: completar y probar estas funciones antes de aceptar reportes empresariales.
