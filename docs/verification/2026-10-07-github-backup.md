# Respaldo GitHub — 7 octubre 2026

## Alcance

El usuario autoriza respaldar cambios locales en sus repositorios.
El usuario excluye los repositorios originales de terceros.
Este respaldo no constituye una versión aceptada.
No se fusionan ramas.
No se instala el CRM en Homelab.

## Evidencia

- Repositorio verificado: https://github.com/charlyfdz/crm
- Rama de código: `gh-readonly-queue/local-backup-20261007-crm-corporativo`.
- SHA verificado: `4f72c090f3db0ff797d32d11610e12dbfef3c7aa`.
- Selección publicada: 301 archivos de código, pruebas, configuración de ejemplo y documentación.
- HEAD original conservado: `6d4793dd6d7aeea91aa6a034e00b17d7408a2d08`.
- El índice y los archivos originales permanecen intactos durante el respaldo.
- `origin` apunta al repositorio propio.
- No se publica ninguna credencial, base de datos ni archivo `.env` real.
- El inventario general registra 79 checkouts y 20 repositorios con respaldos nuevos.
- El informe local está en `_analisis/github-sync-20261007/README.md`, desde la raíz del espacio.

## Validación

Las cuatro puertas completas terminan con código 1.
La ejecución elimina variables de bases reales en su proceso.
La ejecución utiliza `bun --no-env-file`.
Los logs permanecen en la carpeta local de análisis.
La réplica del Motor supera `node verify.mjs` y sus 22 pruebas.
Ese resultado no valida el CRM.
Los respaldos históricos utilizan la excepción WIP de CONTRIBUTING.
La excepción no convierte las puertas fallidas en PASS.

## Issues

1. BROKEN — `lint` y `lint:slop` rechazan el estado actual del CRM.
   Fix: pendiente. Corregir los errores y repetir ambas puertas.
2. UNKNOWN — Tipos y pruebas completas se bloquean durante Prisma por falta de `DATABASE_URL`.
   Fix: pendiente. Validar con una base sintética aislada. No usar la base empresarial.
3. RISK — `FieldManagement` referencia `field_definition`. El esquema utiliza `fieldDefinition`.
   Fix: pendiente. Corregir el nombre antes de integrar esa clase.
4. NOT DONE — `FieldManagement` carece de integración con servicio, router y pruebas propias.
   Fix: pendiente. Completar la integración y verificar la autorización de campos.
5. NOT DONE — El último cambio de backfill no dispone de verificación integral nueva.
   Fix: pendiente. Ejecutar tipos, pruebas y revisión de regresiones del API.
6. NOT DONE — Faltan perfiles, GRANT, invitaciones, recuperación del propietario y reasignación empresarial.
   Fix: pendiente. Completar los flujos y sus pruebas antes de aceptar el piloto.
7. UNKNOWN — PostgreSQL real, concurrencia, Linux, dos instancias y restauración no tienen aceptación integral.
   Fix: pendiente. Ejecutar esas pruebas en un laboratorio aislado.
8. NOT DONE — Documentos privados, calendario, portabilidad y aceptación empresarial mantienen trabajo pendiente.
   Fix: pendiente. Completar el circuito funcional y la capacitación del piloto.
9. UNKNOWN — Los errores previos de conexión y de hidratación no tienen aceptación integral final aquí.
   Fix: pendiente. Repetir los escenarios del navegador después de completar las puertas técnicas.
