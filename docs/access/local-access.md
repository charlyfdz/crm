# Acceso local administrado

## Política

Cada instalación tiene su base de datos y sus usuarios.

Better Auth valida contraseñas y mantiene sesiones. El registro público queda cerrado.

Google, Microsoft y SSO no crean usuarios nuevos. El administrador provisiona cada cuenta.

La lista `ALLOWED_SIGN_IN` limita correos elegibles. La lista no concede una cuenta ni un rol.

El alta asigna una membresía explícita. El inicio de sesión no crea membresías ni propietarios.

El sistema consulta sesiones en PostgreSQL. La caché de sesión en cookies queda desactivada.

El sistema exige contraseñas de 12–128 caracteres. Better Auth calcula el hash.

El alta administrada no afirma verificar la propiedad del correo. El operador comprueba la identidad por un canal seguro.

## Primer propietario

1. Configura PostgreSQL, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `ALLOWED_SIGN_IN`, `APP_URL` y `API_URL`.
2. Aplica migraciones con `bun run db:deploy`.
3. Ejecuta `bun run auth:provision --bootstrap` desde la raíz.
4. Introduce nombre, correo, empresa y contraseña. La terminal oculta la contraseña.
5. Inicia sesión en `/sign-in` con correo y contraseña.

El bootstrap requiere una instalación sin usuarios. Un bloqueo PostgreSQL serializa altas simultáneas.

Una transacción crea usuario, credencial y membresía. Un fallo revierte los tres registros.

El comando no sustituye contraseñas existentes. El comando no imprime contraseñas ni hashes.

## Otros usuarios

En Configuración > Usuarios, el propietario crea cuentas `admin` o `member`.
Un administrador sólo crea y administra cuentas `member`. No eleva roles ni modifica propietarios o administradores.
Sólo el propietario asigna roles elevados. Ninguna acción puede dejar cero propietarios activos.
El bootstrap inicial sigue en la terminal, no en el registro público.

El operador también puede ejecutar `bun run auth:provision`. Introduce el rol `admin` o `member`.
La autoridad de operador de base es distinta del rol de administrador de la aplicación.

La creación del propietario debe completar antes del alta de otros usuarios.

Entrega contraseñas por un canal seguro. Nunca las guardes en tickets, logs ni parámetros del comando.

La automatización recibe JSON por entrada estándar con `--stdin-json`. Nunca incluye la contraseña en argumentos.

## Suspensión y recuperación administrada

El menú de cada usuario permite suspender, reactivar y recuperar una contraseña local según el rol actual.
Suspensión y reactivación exigen motivo. No borran clientes, oportunidades, tareas ni autoría.
La reasignación del trabajo pendiente sigue siendo una operación distinta y no ocurre automáticamente.
El cambio de rol, suspensión y recuperación revocan todas las sesiones y desactivan claves de ese usuario.
Reactivar no resucita cookies ni claves. El usuario necesita un nuevo login y nuevas claves autorizadas.
El servidor vuelve a consultar membresía en cada procedimiento protegido, sin confiar en la caché del navegador.
Los selectores de tareas sólo muestran usuarios activos. El servidor también rechaza responsables suspendidos.

Para recuperar una contraseña de otra persona, un gestor autorizado define una nueva contraseña y registra el motivo.
Se requiere una credencial local existente. No crea un acceso local oculto para una cuenta exclusivamente SSO.
La recuperación propia necesita cambio normal con contraseña actual; el endpoint administrativo la rechaza.
No se envía correo ni se fuerza aún un cambio de contraseña después del login.
La comprobación humana de identidad y la entrega de contraseña por canal seguro siguen siendo necesarias.

## Auditoría y claves

Configuración > Usuarios muestra la auditoría de identidad a propietarios y administradores.
Cada evento conserva actor, usuario afectado, fecha, acción y snapshots de rol/estado, sin incluir credenciales generadas.
El bootstrap identifica operador de instalación, no una persona inventada.
La aplicación no ofrece edición o eliminación del historial. PostgreSQL rechaza UPDATE y DELETE ordinarios de sus filas.
No es almacenamiento inmutable frente al superusuario de la base. No acredita toda la auditoría empresarial.
Nunca incluyas contraseñas en el motivo, tickets, capturas ni logs.

La gestión de claves queda limitada a propietarios y administradores sobre sus propias claves.
Una clave nueva exige expiración de 1 a 365 días. Los scopes empresariales siguen pendientes.
Los endpoints HTTP alternativos de organización y claves quedan cerrados. El servidor conserva su SDK interno para operaciones guardadas.
Una clave no administra identidad: altas, roles, suspensión, recuperación y lectura de auditoría requieren sesión humana.

## Producción

Usa HTTPS y conserva las comprobaciones de origen y cookies seguras.

Configura el proxy y los orígenes por instalación. No comparte secretos de autenticación entre clientes.

El usuario no necesita correo transaccional para iniciar sesión. La recuperación automática por correo queda pendiente.

## Prueba aislada

Ejecuta `bun run test:local-access` desde la raíz.

El banco crea PGlite en memoria, usa un puerto aleatorio en `127.0.0.1` y aplica una fixture SQL propia.

La fixture usa los archivos de migración versionados. No certifica `prisma migrate deploy` ni actualizaciones de PostgreSQL.

La prueba usa un pool de una conexión. PGlite no demuestra concurrencia de PostgreSQL ni recuperación tras fallos.

El banco crea únicamente cuentas ficticias. No usa `.env` del CRM tercero, proveedores ni servidores externos.

El banco comprueba 11 escenarios. Verifica bootstrap, login, denegaciones, logout y rechazo de la cookie revocada.

El banco cierra la base y comprueba el cierre del puerto. No mantiene una instancia operativa.

Ejecuta `bun --no-env-file run test:identity` para el ensayo ampliado de identidad y HTTP Nest/tRPC.
La [evidencia](../verification/2026-10-03-managed-identity.md) delimita pruebas y pendientes.
El servidor HTTP de prueba y la base usan loopback y puertos efímeros. Ambos se cierran.

## Pendientes

- Cinco perfiles empresariales, permisos GRANT y scopes de claves.
- Recuperación del primer propietario cuando nadie puede iniciar sesión.
- Cambio obligatorio de contraseña inicial, invitaciones y recuperación automática por correo.
- Validación visual, de teclado y de revocación en navegador real.
- Política de SSO obligatorio para empresas que la requieren.
- Prueba del flujo contra PostgreSQL 17 y altas simultáneas.
