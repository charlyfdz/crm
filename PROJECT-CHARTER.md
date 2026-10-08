# CRM Corporativo

## Dirección

El usuario inicia un CRM propio para uso interno de su empresa.

El producto no es un SaaS ni comparte datos entre empresas.

Cada empresa recibe su instalación, base de datos, usuarios y configuración.

La instalación funciona en un servidor privado, homelab o VPS del cliente.

El producto admite venta, implementación y soporte para otras empresas.

La oferta comercial y los contratos requieren revisión y aprobación antes de publicarse.

El proyecto usa como base el código Comp AI CRM bajo licencia MIT.

La copia parte del commit `6d4793d` del laboratorio local.

El proyecto mantiene una carpeta y un historial Git separados del laboratorio.

El proyecto no tiene un remoto Git configurado.

## Decisión de piloto — 2026-10-02

Corporativo S&F es la empresa del primer piloto.

El destino futuro es Coolify en `paas-control`, dentro del servidor homelab.

El usuario exige completar la versión antes de instalarla allí.

La tarea actual no autoriza instalación, despliegue, exposición de red ni carga de datos empresariales reales.

Homelab pertenece al ámbito Personal — Carlos. El CRM alojado conserva el ámbito empresarial de Corporativo S&F.

Esta decisión no asigna propiedad legal del producto ni constituye una aceptación empresarial.

El [contrato del piloto](docs/product/PILOT-CORPORATIVO-SF.md) registra fuentes, límites, decisiones pendientes y criterios de instalación futura.

## Alcance de desarrollo

- El CRM administra empresas cliente, contactos, oportunidades, etapas y actividades.
- El CRM ofrece búsqueda, historial, tareas, informes e importación controlada.
- El CRM usa PostgreSQL y admite acceso local con correo y contraseña.
- Google no es un requisito para iniciar sesión.
- Cada instalación admite una empresa interna y un espacio de trabajo.
- El catálogo completo de permisos, el ciclo de usuarios y la recuperación requieren implementación y pruebas integradas.
- La IA y el enriquecimiento externo quedan apagados por defecto.
- Ningún dato real sale del homelab sin una aprobación específica.

## Requisitos de operación

- El paquete incluye aplicación, API, PostgreSQL y tareas de mantenimiento.
- El agente de IA es opcional y usa un perfil separado.
- El despliegue incluye health checks, migraciones y configuración documentada.
- El despliegue incluye copias de seguridad y una prueba de restauración.
- El sistema conserva logs útiles y evita registrar secretos o datos innecesarios.
- El acceso externo requiere TLS y un proxy inverso configurado.
- El despliegue productivo espera una aceptación explícita del propietario.

## Fases

1. Implementar plantillas configurables y registrar usuarios, permisos, flujo comercial e importación pendientes de confirmación empresarial.
2. Revisar autenticación, límites de acceso y fallos reproducibles de la base.
3. Adaptar el núcleo de empresas, contactos, oportunidades y actividades.
4. Completar respaldo, restauración, actualización y recuperación operativa.
5. Probar con datos sintéticos en un entorno aislado.
6. Completar y validar el paquete local. Revisar admisión y pedir autorización separada antes de instalar en el homelab.

## Criterio de versión completa

R1 entrega fundamentos locales. R1 no habilita la primera instalación.

La versión exige los flujos manuales completos de R2 y la evidencia operativa de R3.

El paquete también demuestra aislamiento, portabilidad y entrega técnica con ensayos sintéticos de R4.

La aceptación incluye permisos directos de API, recuperación de acceso, restauración, seguridad y capacidad medida.

La empresa revisa el proceso y la demostración antes de la decisión de instalación.

La aceptación final del piloto requiere comprobaciones posteriores a una instalación autorizada.

La IA permanece opcional. Su ausencia y el bloqueo de salidas externas forman parte de los criterios obligatorios.

Las condiciones comerciales para terceros no bloquean el desarrollo ni sustituyen la aceptación del piloto interno.

La [matriz](docs/product/REQUIREMENTS-MATRIX.md) conserva 44 requisitos sin aceptación operativa completa.

## Equipo y aceptación

El equipo de agentes cubre producto, marketing, diseño gráfico, diseño web, frontend, backend, datos, IA, operación y calidad.

Los agentes trabajan como especialistas. Sus roles no representan credenciales profesionales humanas.

El director técnico integra cambios y verifica los entregables de cada área.

La matriz de aceptación distingue implementación, prueba automatizada, prueba operativa y aceptación del propietario.

El desarrollo continúa hasta completar los criterios acordados. Un documento no sustituye una función operativa.

## Límites

- El laboratorio tercero conserva sus cambios locales y su configuración.
- Esta copia excluye cambios sin guardar del laboratorio y archivos de entorno.
- Esta copia no reutiliza cuentas, credenciales ni datos de clientes.
- Los datos sintéticos pueden usar servicios externos tras autorización del usuario.
- Los datos empresariales reales requieren aprobación antes de salir del equipo.
- La licencia MIT exige conservar su aviso de derechos y permiso.

## Pendientes de decisión

- Confirmar responsables empresariales, operadores y usuarios del piloto de Corporativo S&F.
- Definir etapas, campos y reglas del proceso comercial.
- Definir perfiles, permisos, invitaciones y recuperación de acceso.
- Definir importación desde hojas de cálculo y calidad de datos.
- Definir correo, calendario, archivos, IA y enriquecimiento externo.
- Definir el proxy, dominio interno, copias y retención del homelab.
- Medir la carga y obtener una cuota específica. El límite compartido de `paas-control` no acredita capacidad libre.
- Registrar aceptación del candidato y autorización de instalación en decisiones separadas.
