# Capacitación y demostración empresarial sintética

Estado: ejercicios preparados, no ejecutados. No acreditan R4 ni aceptación de S&F.
Usa un candidato integrado con recursos aislados, autorización y bloqueo externo comprobados por el técnico.
No utiliza cuentas, procesos, documentos ni clientes reales.
Los importes ficticios prueban aritmética. No son precios del CRM ni de servicios de consultoría.

## Preparación del instructor

1. Registra versión, artefacto, instancia, hora, etiquetas y alcance en el [recibo vacío](templates/recibo-ensayo.blank.json).
2. Confirma red simulada o denegada. No conectes proveedores ni agentes.
3. Usa [perfiles A/B](fixtures/perfiles-sinteticos.json) sólo como ficha de ensayo, no configuración ejecutable.
4. Selecciona datos del [catálogo ficticio](fixtures/negocio-sintetico.json). Provisiona sólo dentro de una autorización de ensayo.
5. Revisa [fuentes y límites](FUENTES-Y-LIMITES.md) contra el candidato.
6. Marca BLOQUEADO cualquier control obligatorio ausente. No reemplaza un criterio con un workaround.

Una fixture en disco no crea cuentas ni registros.
Los participantes no copian contraseñas, sesiones ni claves al recibo.
Un ejercicio terminado requiere resultado observado por aserción y evidencia segura.
El instructor registra PASA, FALLA, BLOQUEADO o NO EJECUTADO después del ensayo, nunca antes.

## Agenda de usuario

| Bloque | Acción | Material | Comprobación de aprendizaje |
| --- | --- | --- | --- |
| U-01 | Explicar empresa usuaria, Company, Contact, Deal y Owner. | Guía de usuario. | Participante distingue instalación y cliente comercial sin ayuda. |
| U-02 | Iniciar y cerrar sesión local. | E-01. | Participante usa cuenta propia ficticia y solicita acceso correctamente. |
| U-03 | Crear registros y relaciones. | E-02. | Participante localiza cada relación y distingue ausencia de correo o valor. |
| U-04 | Registrar nota, tarea y resultado. | E-03. | Participante explica qué registra y qué no envía el CRM. |
| U-05 | Revisar reporte y archivo. | E-04. | Participante detecta una diferencia y registra el problema. |
| U-06 | Identificar funciones pendientes y pedir soporte. | E-05 y checklist de soporte. | Participante no usa datos reales ni sustituye permiso con una pantalla visible. |

## Agenda de operador

| Bloque | Acción | Material | Comprobación de aprendizaje |
| --- | --- | --- | --- |
| O-01 | Explicar acceso, custodia y límites de roles. | E-01 y guía de operador. | Operador no confunde allowlist con alta ni member con usuario suspendido. |
| O-02 | Mapear y conciliar fuentes ficticias. | E-06. | Operador identifica duplicados, rechazos y fuente canónica. |
| O-03 | Revisar restauración y versión. | E-07. | Operador identifica recursos fuera del dump y la evidencia que falta. |
| O-04 | Ensayar aislamiento, autonomía y cierre de soporte. | E-08. | Operador demuestra denegaciones y conserva control del cliente. |

No asigna duraciones ni fechas comerciales. El instructor adapta sesiones al aprendizaje observado.

## Ejercicios

### E-01 — Acceso local y control del cliente

Trace: AC-002, AC-003, AC-004, AC-037, D-05. Estado de ejecución: NO EJECUTADO.

Usa identidades ficticias owner, admin y member del perfil A.
El operador ensaya bootstrap privado, rechazo de repetición, alta administrada y login sin OAuth.
El usuario ensaya credencial incorrecta y registro público cerrado.
Después de logout, QA reproduce la sesión previa sin almacenar su valor en el recibo.
Resultado esperado: login válido, denegaciones previstas y sesión usada revocada.
Suspensión global, roles empresariales y recuperación permanecen BLOQUEADOS hasta completar sus controles.
El recibo distingue estas aserciones. No declara AC-003 o D-05 completos por aprobar sólo logout.

### E-02 — Tres casos de servicios sin información real

Trace: AC-005, AC-006, AC-007, AC-008, L-04. Estado de ejecución: NO EJECUTADO.

Caso Alba: diagnóstico empresarial ficticio.
Caso Bruma: seguimiento contable ficticio.
Caso Cauce: proyecto tecnológico ficticio sin dominio ni correo.
Estos nombres no describen el proceso interno de S&F.

1. Crea tres empresas y tres contactos del catálogo usando la guía de usuario.
2. Crea cuatro oportunidades con los responsables ficticios y valores indicados.
3. Vincula Lina a la oportunidad de Alba y registra su papel comercial ficticio.
4. Repite la vinculación mediante QA; espera una sola relación sin perder el papel existente.
5. Intenta relacionar un contacto de Bruma con Alba mediante QA; espera denegación sin cambios.
6. Recarga y contrasta IDs, vínculos, responsables y cantidad de filas.

Resultado esperado: 3 empresas, 3 contactos y 4 oportunidades, sin vínculos cruzados.
Crear nombres nuevos para evitar un conflicto no demuestra resolución correcta de duplicados.

### E-03 — Nota, tarea y resultado comercial

Trace: AC-009, AC-012, AC-013, AC-015, AC-042. Estado de ejecución: NO EJECUTADO.

1. Registra la nota y la tarea ficticias de Alba.
2. Comprueba autor, empresa, oportunidad y fecha después de recargar.
3. Registra un EMAIL manual. Verifica ausencia de envío externo mediante QA.
4. Cambia Alba a `Qualified to buy`, después a `Closed won`.
5. Comprueba el evento histórico y crea una tarea manual de traspaso para la demostración básica.
6. Cambia Bruma a `Closed lost` y registra el motivo ficticio.
7. Intenta un cierre perdido sin motivo mediante QA; espera rechazo sin evento adicional.

Resultado esperado básico: actividad y eventos correctos; el correo manual no se envía.
La prueba focal verifica autor y responsable separados, historial de etapas y traspaso automático.
Este ejercicio de capacitación sigue NO EJECUTADO. Las pruebas técnicas no acreditan capacitación ni revisión completa de notas.
El traspaso manual no sustituye comprobar la tarea automática del nuevo código.
No declara firma, pago, prestación terminada ni factura desde una etapa ganada.

### E-04 — Conciliación y archivo

Trace: AC-021, AC-023, AC-027, L-07. Estado de ejecución: NO EJECUTADO.

Usa la clasificación final del catálogo tras los cambios de etapa.
La moneda del ejercicio es USD. Todos los valores conocidos usan esa misma moneda.

| Conjunto | Cantidad esperada | Valor conocido esperado |
| --- | --- | --- |
| Ganadas | 1 | 100.00 USD |
| Perdidas | 1 | 200.00 USD |
| Abiertas | 2 | 300.00 USD y una oportunidad sin importe |
| Todas | 4 | 600.00 USD conocidos; un importe desconocido |
| Activas tras archivar la ganada | 3 | 500.00 USD conocidos |

Estas sumas describen el fixture, no un resultado observado de dashboard.
No sumes la oportunidad desconocida como cero conocido.
Archiva Alba ganada; comprueba lista, historial y exclusión esperada de reportes activos.
La consulta agregada inspeccionada no excluye archivados. Registra FALLA al observar esa diferencia.
Restaura el registro de prueba y revisa conflicto y conteos.
No ejecuta purge ni `Delete forever`.

### E-05 — Funciones obligatorias pendientes

Trace: AC-010, AC-011, AC-013, AC-014, AC-016, AC-025, AC-038. Estado de ejecución: NO EJECUTADO.

Registra criterio, control disponible y fuente antes de practicar.
Ensaya una segunda pipeline, migración de etapas, tarea asignada, calendario local y propuesta privada versionada sólo después de implementación.
No usa adjuntos de chat ni Blob como sustituto de documentos empresariales privados.
No usa reunión registrada como sustituto de cita local.
El usuario practica detectar el límite y solicitar ayuda sin enviar datos privados.
Resultado esperado actual: criterios incompletos visibles y BLOCKED donde falta función.
No convierte esa detección documental en aceptación funcional.

### E-06 — Migración y salida

Trace: AC-017, AC-018, AC-019, D-04. Estado de ejecución: NO EJECUTADO.

Usa la [guía de migración](MIGRACION.md) y los CSV válidos e inválidos separados.
QA ejecuta preview sólo después de existir un importador aceptable.
Comprueba cero escrituras en preview, mapeo estable, resultados por fila y duplicados explícitos.
Interrumpe y reanuda una aplicación ficticia; compara IDs y relaciones, no sólo conteos.
Exporta a formato portable y verifica que `=1+1` queda como texto seguro para hoja de cálculo.
Comprueba ausencia de hashes de contraseña, tokens, sesiones y claves en el paquete exportado.
Resultado obligatorio: conciliación completa y replay sin duplicación.
La validación local de CSV de este kit no ejecuta esas funciones del CRM.

### E-07 — Recuperación del expediente empresarial

Trace: AC-016, AC-033, AC-034, P-05, D-05. Estado de ejecución: NO EJECUTADO.

El operador identifica base, documentos, configuración, secretos por referencia y artefactos exactos.
Tras autorización futura, ensaya recuperación aislada sin modificar la fuente.
Comprueba login, contactos, vínculos, eventos, archivos y hashes después de restaurar.
Registra tiempos observados, fallo forzado y ruta de recuperación.
Un dump con tablas reconciliadas no acredita archivos, permisos ni operación completa.
El procedimiento actual de base deja recuperación completa pendiente.
No convierte un tiempo observado en SLA, RPO o RTO prometido.

### E-08 — Dos empresas, soporte revocable y autonomía

Trace: AC-001, AC-040, AC-041, AC-044, D-02, D-03, D-05, D-08. Estado de ejecución: NO EJECUTADO.

1. Técnico prepara A/B con la misma versión y recursos distintos dentro de una autorización separada.
2. Instructor repite E-02 a E-07 en ambas instancias.
3. QA prueba que sesión y claves A no acceden a B; también prueba la dirección inversa.
4. QA verifica que actualización y restauración de A no modifican B.
5. Operador demuestra el [cierre de soporte](SOPORTE-REVOCABLE.md) con una identidad temporal ficticia.
6. Cliente ficticio conserva control propio y acceso tras retirar al proveedor.
7. QA ensaya exportación, consulta y operación con servicios externos denegados.

Resultado obligatorio: aislamiento, denegaciones y autonomía observados, no inferidos desde nombres de perfil distintos.
Una fixture A/B no demuestra dos instalaciones ni revocación efectiva.

## Evaluación y registro

Cada participante ejecuta su parte sin indicaciones durante la evaluación final.
Registra ejercicio, acción, resultado, ayuda requerida, evidencia y siguiente práctica.
Separa evidencia de código, prueba técnica, práctica del usuario y decisión empresarial.
El [acta](templates/ACTA-ACEPTACION.md) nunca se completa con éxito por asistencia a capacitación.

## Issues

1. NOT DONE — Los ejercicios no tienen ejecución, participantes ni resultados observados.
   Fix: ejecutar por aserción con el candidato completo y rellenar recibos privados redactados.
2. NOT DONE — Varias funciones obligatorias faltan en el checkout inspeccionado.
   Fix: mantener sus criterios bloqueados y completar desarrollo antes del ensayo integral.
