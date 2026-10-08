# Identidad funcional de CRM Corporativo

Fecha: 2026-10-02.
Área: diseño gráfico, diseño web y frontend.
Estado: adaptación local con verificación estática. La aceptación visual sigue pendiente.

## Dirección y límites

CRM Corporativo identifica el producto interno. El nombre no constituye una marca legal aprobada.

Corporativo S&F identifica la empresa piloto. Su marca y su logo permanecen separados del producto.

Este trabajo no crea una identidad corporativa nueva para S&F.

Cada empresa mantiene su nombre de espacio, usuarios, configuración y datos.

El producto no presenta una suscripción SaaS ni promete servicios externos activos.

El [mandato del producto](../../PROJECT-CHARTER.md) define instalaciones independientes por empresa.

La adaptación conserva los avisos de licencia existentes. No acredita propiedad legal ni aprobación comercial.

## Inventario y selección de archivos

El inventario identifica estos componentes reales antes de editar.

| Superficie | Fuente real | Acción de esta entrega |
| --- | --- | --- |
| Logo compartido | `packages/ui/src/components/logo.tsx` | Sustituir el símbolo upstream por un símbolo funcional neutral. |
| Navegación principal y menú móvil | `apps/app/components/app-icon-rail.tsx` | Traducir etiquetas y desacoplar el chat del texto traducido. |
| Layout raíz | `apps/app/app/layout.tsx` | Cambiar sólo `lang` de `en` a `es`. |
| Contrato de identidad | `apps/app/test/product-identity.spec.tsx` | Añadir pruebas de renderizado SVG y contratos estáticos. |
| Este documento | `docs/design/product-identity.md` | Registrar decisiones, evidencia y límites. |

No existe `apps/app/components/app-sidebar.tsx` en el inventario inspeccionado.

`app-icon-rail.tsx` contiene la navegación de escritorio, su fallback y los dos menús móviles.

`mobile-nav.tsx` sólo proporciona estado. Este trabajo no modifica ese proveedor.

El logo compartido ya tiene consumidores en `app-header.tsx`, `auth-shell.tsx` y otras superficies.

La sustitución alcanza esos consumidores sin editar sus archivos.

La metadata raíz ya utiliza CRM Corporativo antes de esta entrega. Este trabajo conserva esa metadata.

Los cambios previos de fuentes Geist, proveedores y layout permanecen intactos.

## Símbolo funcional

El componente usa `Collaborate` de `@carbon/icons-react`, una dependencia ya instalada.

El símbolo representa personas y relaciones. No representa IA obligatoria ni una nueva empresa.

Este símbolo es un icono de biblioteca. No es un logotipo exclusivo ni un diseño registrable aprobado.

La fuente instalada identifica la licencia Apache-2.0 y el copyright de IBM.

La dependencia conserva su licencia. Este trabajo no copia ni modifica el archivo generado del icono.

El componente conserva `React.SVGProps<SVGSVGElement>` y las dimensiones predeterminadas existentes.

Los consumidores mantienen sus clases, dimensiones y nombres accesibles propios.

El SVG utiliza `currentColor`. No incorpora colores, raster, fuentes remotas ni imágenes externas.

El nombre accesible predeterminado es `CRM Corporativo`.

Un símbolo informativo utiliza `role="img"` y `focusable={false}`.

Un consumidor decorativo utiliza `aria-hidden={true}`. El componente elimina su nombre y su rol informativo.

Las formas booleanas y de texto de `aria-hidden` tienen pruebas independientes.

## Lenguaje y navegación

La navegación utiliza términos empresariales breves en español.

| Identificador estable | Etiqueta | Ruta existente | Función |
| --- | --- | --- | --- |
| `overview` | Resumen | `/` | Consultar el resumen del espacio. |
| `chat` | Conversaciones | `/chat` | Consultar conversaciones; agrupar también `/agents`. |
| `companies` | Empresas | `/companies` | Consultar organizaciones registradas. |
| `contacts` | Contactos | `/contacts` | Consultar personas registradas. |
| `deals` | Oportunidades | `/deals` | Consultar oportunidades comerciales. |
| `settings` | Configuración | `/settings` | Consultar la configuración existente. |

Las etiquetas no cambian rutas, permisos, formularios ni contratos de API.

El identificador `chat` selecciona el menú móvil de conversaciones y su transición existente.

La selección no compara `item.title`. Una traducción no altera ese comportamiento.

Las rutas relacionadas y el prefijo del espacio conservan su implementación existente.

Las etiquetas coinciden en tooltips, nombres ocultos, filas visibles y fallback.

Los cuatro landmarks usan `Navegación principal`.

Los títulos móviles usan `Navegación principal` y `Navegación y conversaciones con agentes`.

Ambos menús usan botones explícitos con `Cerrar navegación`.

El menú general deja de usar el cierre predeterminado en inglés del componente Sheet.

Los botones explícitos conservan los componentes compartidos y el cierre controlado del menú.

La navegación de escritorio conserva la barra por iconos. Los tooltips presentan sus etiquetas.

El menú móvil general conserva sus filas con etiquetas visibles.

El menú móvil de conversaciones conserva la barra por iconos y el panel existente de agentes.

El atributo raíz `lang="es"` declara el idioma objetivo. No traduce automáticamente el contenido restante.

## Sistema visual conservado

Las reglas de [diseño](../design.md) mantienen `packages/ui` como fuente única de componentes.

Las skills locales `shadcn`, `better-ui` y `better-accessibility` guían composición, continuidad visual y nombres accesibles.

La inspección utiliza las implementaciones locales. No consulta registros ni proveedores externos.

La entrega conserva Button, Icon, Tooltip y Sheet.

La entrega no añade variantes, estilos globales, animaciones, colores, fuentes ni dependencias.

La paleta existente mantiene grises neutros y verde primario `#006B4F`.

Ese token identifica la interfaz existente. No asigna una paleta corporativa a S&F.

Las clases de navegación preexistentes permanecen. Este trabajo no amplía el ámbito a corregir estilos heredados.

## Verificación local

Entorno observado: Windows, Bun 1.4.2 y checkout compartido `CRM Corporativo`.

No se inicia aplicación, API, agente, base de datos ni navegador.

La prueba nueva intercepta `fetch`, rechaza solicitudes y comprueba cero llamadas.

Las pruebas existentes seleccionadas utilizan sus fixtures y mocks de red.

| Directorio | Comando ejecutado | Resultado observado |
| --- | --- | --- |
| `apps/app` | `bun test test/product-identity.spec.tsx` | 16 pass, 0 fail, 44 aserciones. |
| `apps/app` | `bun test test/product-identity.spec.tsx test/ai-disabled-ui.spec.tsx test/dashboard-money.spec.ts test/onboarding-gate.spec.ts` | 60 pass, 0 fail, 149 aserciones. |
| `apps/app` | `bun run check-types --incremental false` | Código 0. |
| `packages/ui` | `bun run check-types --incremental false` | Código 0. |
| Raíz | `bunx --no-install @biomejs/biome check --write apps/app/components/app-icon-rail.tsx apps/app/test/product-identity.spec.tsx` | 2 archivos comprobados. Sin correcciones en la ejecución final. |
| Raíz | `git -c safe.directory='D:/respaldo de proyectos/CRM Corporativo' diff --check -- apps/app/components/app-icon-rail.tsx packages/ui/src/components/logo.tsx apps/app/app/layout.tsx` | Código 0. Advertencias de finales de línea, sin errores de whitespace. |

La primera comprobación de tipos detecta un mock sin `fetch.preconnect`, requerido por los tipos de Bun.

Esta entrega causa ese fallo temporal y lo corrige antes de repetir la comprobación.

El renderizado estático prueba el logo real, no una copia de su markup.

Los contratos de navegación y metadata inspeccionan el AST de los archivos reales con TypeScript.

Esos contratos no ejecutan eventos, portales, foco ni navegación en un navegador.

La comprobación de tipos cubre los componentes. No acredita comportamiento visual ni aceptación del producto completo.

Los hashes anteriores y posteriores coinciden para el CSS global y la licencia raíz.

No se escribe `.env`, se importan datos reales ni se modifica el código generado.

No se usa Docker, SSH, Coolify, homelab, servicios terceros, commits, pushes ni escrituras remotas.

El motor local devuelve código 2 por frescura pendiente. Su contexto conserva la dirección del piloto.

Este especialista no renueva fuentes ni modifica el motor. La identidad no depende de admisión operativa remota.

## Handoff y límites

El director técnico recibe cinco archivos dentro del ámbito anunciado.

El equipo de producto conserva la decisión sobre nombres comerciales y marcas legales.

Los responsables de cada pantalla mantienen la traducción de sus componentes.

Esta entrega no cambia formularios, pipelines, tareas, autenticación, despliegue ni activos corporativos de S&F.

### Coordinación de Pipelines

El usuario indica que otro especialista implementa `settings/pipelines`.

El inventario sitúa la subnavegación en `apps/app/app/(app)/[slug]/settings/settings-sidebar.tsx`.

Ese archivo queda fuera del ámbito anunciado. Este trabajo no lo edita.

La lectura actual no contiene el enlace `/settings/pipelines`.

El responsable añade `Pipelines` y la ruta `/settings/pipelines` dentro de `ITEMS`.

La navegación principal conserva `Configuración` y su ruta `/settings` con coincidencia por prefijo.

El director técnico conserva la coordinación de cache y generación de código.

Esta entrega no escribe layouts, formularios de pipeline, record-sheet ni quick-add.

## Issues

1. NOT DONE — Favicon, iconos raster y manifest conservan activos y nombres upstream.
   Fix: asignar esos activos a una entrega separada. Están fuera del ámbito actual.
2. NOT DONE — AuthShell, landing y componentes de Slack conservan textos o referencias upstream.
   Fix: adaptar esos archivos con sus responsables. Este trabajo sólo sustituye su símbolo compartido.
3. NOT DONE — Header, páginas y paneles conservan textos en inglés fuera de esta navegación.
   Fix: completar la traducción por área. `lang="es"` no acredita traducción completa.
4. UNKNOWN — Apariencia, legibilidad pequeña, foco, tooltips, zoom y menús móviles carecen de revisión en navegador.
   Fix: ejecutar revisión visual autorizada en ambos temas y dispositivos. No existe evidencia de navegador en esta entrega.
5. UNKNOWN — El nombre comercial definitivo y la identidad legal no tienen aprobación documentada.
   Fix: mantener la identidad funcional neutral hasta una decisión específica.
6. NOT DONE — El registro transversal del motor y las fuentes caducadas quedan fuera del ámbito del especialista.
   Fix: entregar esta fuente al director técnico. No renovar fuentes ni escribir plataformas en esta tarea.
7. NOT DONE — La lectura de settings-sidebar no contiene el enlace Pipelines solicitado.
   Fix: su responsable añade `Pipelines` y `/settings/pipelines`. Este archivo no pertenece al ámbito actual.
