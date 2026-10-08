# Mapeo, ensayo y conciliación de migración

Estado: material R4. No ejecuta importación ni exportación del CRM.
La inspección no confirma el importador completo requerido por AC-017 a AC-019.

## Entrada y política

Usa fuentes sintéticas para ensayar. El cliente real autoriza cada fuente por separado en el futuro.
Registra entidad, columnas, encoding, separador, formato de fechas, valores vacíos y responsable.
Declara alcance y política para duplicados antes de un preview.
Conserva la fuente original. Trabaja en copia y registra su hash, no su contenido privado.

| Dato | Criterio de preparación |
| --- | --- |
| Empresa | `source_id` estable, nombre y dominio opcional normalizado. |
| Contacto | `source_id`, nombre y referencia de empresa; correo opcional. |
| Oportunidad | Identidad fuente, empresa, responsable, moneda, etapa y valor nullable. |
| Asociaciones | Referencias fuente existentes; no sustituirlas por nombres ambiguos. |
| Usuario/propietario | Mapeo explícito a usuario activo de la instancia; nunca importar credenciales. |
| Etapas | Mapeo aprobado a etapa existente; pipeline configurado espera implementación. |
| Fecha | Formato y zona declarados; rechazar valor ambiguo. |
| Documentos | Manifest y hashes sólo tras existir almacenamiento privado aceptado. |

Completa [columnas](templates/MAPEO-COLUMNAS.csv) y decisiones en la [ficha](templates/CONFIGURACION-EMPRESA.md).
Ese CSV es una hoja de mapeo, no formato de entrada ejecutable del CRM.

## Material sintético incluido

- [Empresas](fixtures/empresas.csv): tres filas, una sin dominio y un nombre con coma entre comillas.
- [Contactos](fixtures/contactos.csv): tres filas, una sin correo y referencias fuente consistentes.
- [Casos rechazables](fixtures/casos-revision.csv): cinco filas separadas del conjunto válido.
- [Catálogo de negocio](fixtures/negocio-sintetico.json): oportunidades, tareas y resultados aritméticos previstos.

Todos los correos y dominios del conjunto usan `example.test`.
No entregues estos nombres como cartera de clientes, prospectos o información real de S&F.

| Caso de revisión | Decisión prevista antes de aplicar | Comprobación del futuro CRM |
| --- | --- | --- |
| DUP-DOMAIN | Revisar dominio normalizado contra Alba; no crear duplicado automáticamente. | Preview identifica conflicto y política explícita. |
| BAD-EMAIL | Rechazar correo sintácticamente inválido. | Preview devuelve error por fila sin escrituras. |
| MISSING-RELATION | Rechazar referencia a empresa fuente ausente. | No deja contacto huérfano por sustitución silenciosa. |
| UNSUPPORTED-CURRENCY | Rechazar MXN mientras falta soporte. | No lo convierte en USD ni lo guarda como monto sin regla. |
| FORMULA-TEXT | Mantener texto literal `=1+1`. | Exportación evita ejecución de fórmula; no altera el texto empresarial. |

Las decisiones de tabla son expectativas. El validador documental no prueba el importer ni el exporter.

## Ensayo de aplicación futura

1. Captura IDs y conteos del destino sintético limpio.
2. Prepara mapeo, política de duplicados y preview versionado.
3. Comprueba que preview no cambia registros.
4. Revisa cada rechazo y asociación antes de autorizar aplicación ficticia.
5. Aplica empresas, contactos, oportunidades y asociaciones en el orden definido.
6. Interrumpe, reanuda y repite el archivo para comprobar idempotencia.
7. Corrige sólo filas fallidas mediante otro preview.
8. Concilia resultados y exportación por identidad fuente y relaciones.

Registra creados, actualizados, omitidos, rechazados y pendientes.
Para cada entidad, filas recibidas deben equivaler a la suma de resultados mutuamente excluyentes.
Compara valores, asociaciones, responsables, moneda y motivos. Un conteo igual no demuestra datos correctos.
El conjunto base espera 3 empresas, 3 contactos y 4 oportunidades sólo tras una aplicación limpia correcta.
La fila fórmula permanece en el conjunto de revisión hasta su política y protección explícitas.

## Recuperación y salida

Retén fuente, mapeo, preview y recibos seguros del ensayo.
Un preview vencido o configuración cambiada requiere otro preview.
No borres registros para simular rollback o hacer coincidir conteos.
No reconstruyas datos con `db seed`.
La reversión necesita una estrategia probada que conserve actividad y otros cambios posteriores.
Una restauración completa requiere base, archivos y configuración concordantes.
El paquete portable excluye credenciales y entrega manifests privados con política de acceso y expiración.
No configura ni ejecuta esa política este documento.

## Issues

1. NOT DONE — Preview, aplicación, replay y exportación del CRM no tienen evidencia de ejecución en este kit.
   Fix: implementar y ensayar AC-017 a AC-019 antes de cargar datos reales.
2. NOT DONE — La reversión de importación y restauración completa necesitan estrategia ejecutada.
   Fix: comprobar el ensayo sin destruir fuente ni registros concurrentes.
