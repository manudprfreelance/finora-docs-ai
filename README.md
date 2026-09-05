# Finora Docs AI

Plataforma conversacional basada en inteligencia artificial para la automatización inteligente de solicitudes y generación de documentación financiera.

Finora Docs AI permite solicitar documentos bancarios utilizando lenguaje natural. La plataforma interpreta la petición mediante IA, contrasta la información con datos financieros de confianza, aplica reglas de negocio deterministas, solicita confirmación explícita al usuario y orquesta automáticamente la generación, almacenamiento y descarga del documento resultante.

El proyecto ha sido desarrollado como prueba de concepto técnica y académica dentro de un Trabajo Fin de Máster centrado en la aplicación de inteligencia artificial a procesos financieros.

> La IA interpreta el lenguaje. Los sistemas deterministas establecen la verdad.

---

## Descripción general

Los procesos tradicionales de solicitud de documentación financiera suelen depender de formularios, introducción manual de datos y múltiples pasos de validación.

Finora Docs AI explora un modelo de interacción diferente: una interfaz conversacional capaz de comprender lo que necesita el usuario y convertirlo en una solicitud estructurada y controlada.

```text
Usuario
   |
   | Lenguaje natural
   v
Interfaz conversacional Finora
   |
   v
Extracción de intención y entidades mediante IA
   |
   v
Validación determinista
   |
   v
Datos bancarios de confianza
   |
   v
Confirmación explícita del usuario
   |
   v
Procesamiento de la solicitud
   |
   v
n8n
   |
   +----> Gotenberg ----> Generación del PDF
   |
   +----> MinIO --------> Almacenamiento privado
   |
   v
Descarga mediante Finora
```

La inteligencia artificial se utiliza para comprender el lenguaje del usuario, pero no actúa como fuente de verdad para datos financieros ni como responsable directa de las decisiones de negocio.

---

## Funcionalidades principales

- Solicitud conversacional de documentación financiera.
- Interpretación de lenguaje natural mediante OpenAI.
- Extracción estructurada de intención y entidades.
- Conversaciones multi-turno con mantenimiento del estado.
- Validación determinista de las solicitudes.
- Resolución de clientes, cuentas, préstamos y operaciones.
- Uso de datos bancarios sintéticos como fuente de confianza.
- Detección automática de información pendiente.
- Confirmación explícita antes del procesamiento.
- Persistencia de las sesiones de solicitud en PostgreSQL.
- Gestión del ciclo de vida de cada solicitud.
- Registro de eventos para trazabilidad.
- Orquestación de procesos mediante n8n.
- Generación de documentos HTML.
- Conversión de HTML a PDF mediante Gotenberg.
- Almacenamiento privado S3-compatible mediante MinIO.
- Descarga de documentos a través del backend de Finora.
- Entorno local de producción dockerizado.
- Separación entre interpretación mediante IA y lógica financiera determinista.

---

## Documentos implementados

La prueba de concepto implementa actualmente tres flujos completos de generación documental.

### Extracto de cuenta

El usuario puede solicitar el extracto correspondiente a una cuenta y un periodo determinado.

Ejemplo:

```text
Necesito un extracto de la cuenta 0236 para agosto de 2026.
Mi DNI es 12345678A.
```

Finora identifica al cliente, resuelve la cuenta correspondiente, valida el periodo solicitado y genera un PDF utilizando los movimientos financieros sintéticos asociados.

### Cuadro de amortización

El usuario puede solicitar el cuadro de amortización correspondiente a uno de sus préstamos.

Ejemplo:

```text
Necesito el cuadro de amortización de mi hipoteca terminada en 4401.
Mi DNI es 12345678A.
```

Los datos financieros del préstamo proceden de la fuente de datos de confianza.

El cuadro de amortización se calcula de forma determinista en el backend. El modelo de lenguaje no calcula ni inventa las cuotas, intereses o saldos del préstamo.

### Confirmación SWIFT

El usuario puede solicitar el justificante correspondiente a una transferencia internacional.

Ejemplo:

```text
Necesito el justificante SWIFT de la transferencia de 2.500 euros.
Mi DNI es 12345678A y la cuenta termina en 0236.
```

Finora identifica la operación correspondiente y genera una confirmación SWIFT simulada utilizando los datos asociados a la transferencia.

---

## Arquitectura

Finora Docs AI utiliza una arquitectura híbrida que combina inteligencia artificial generativa con servicios y reglas deterministas.

### Capa conversacional

La aplicación web está desarrollada con Next.js y TypeScript.

El usuario interactúa con Finora mediante lenguaje natural en lugar de completar un formulario bancario tradicional.

La interfaz mantiene y representa el estado actual de la solicitud, incluyendo información como:

- tipo de documento,
- cliente identificado,
- cuenta,
- préstamo,
- operación,
- periodo solicitado,
- información pendiente,
- estado del procesamiento.

### Capa de inteligencia artificial

OpenAI se utiliza exclusivamente desde el servidor para interpretar los mensajes del usuario y convertir lenguaje natural en información estructurada.

El modelo puede identificar, entre otros elementos:

- tipo de documento solicitado,
- DNI,
- referencia de cuenta,
- referencia de préstamo,
- información sobre una operación,
- periodos y fechas.

La respuesta del modelo se considera una interpretación del mensaje.

Antes de utilizarla para ejecutar cualquier proceso, la información es validada por la lógica determinista de la aplicación.

### Motor determinista de solicitudes

El motor de solicitudes determina si la información disponible es válida y suficiente para continuar.

Entre sus responsabilidades se encuentran:

- resolver clientes,
- validar cuentas,
- validar préstamos,
- localizar operaciones,
- detectar campos pendientes,
- decidir la siguiente acción conversacional,
- impedir cambios de estado inconsistentes,
- exigir confirmación explícita,
- controlar el ciclo de vida de la solicitud.

De esta forma, el modelo de lenguaje no tiene autoridad directa para ejecutar operaciones financieras o generar documentos.

### Persistencia

PostgreSQL almacena las sesiones de solicitud en el servidor y la información relacionada con su ciclo de vida.

Esto permite desacoplar el estado de la solicitud del navegador y proporciona una base para trazabilidad y auditoría.

### Orquestación

Cuando una solicitud ha sido validada y confirmada, Finora envía el trabajo de procesamiento a n8n.

n8n actúa como capa de orquestación documental y selecciona el flujo correspondiente según el tipo de documento solicitado.

### Generación de PDF

Cada flujo genera un documento HTML utilizando los datos validados de la solicitud.

Gotenberg transforma posteriormente el HTML en un documento PDF.

### Almacenamiento documental

Los PDF generados se almacenan en un bucket privado de MinIO utilizando su interfaz compatible con S3.

Los objetos se organizan mediante identificadores de cliente y solicitud.

Ejemplo:

```text
customers/
  customer-001/
    account-statements/
      <request-id>/
        account-statement-<request-id>.pdf

    loan-amortizations/
      <request-id>/
        loan-amortization-<request-id>.pdf

    swift-confirmations/
      <request-id>/
        swift-confirmation-<request-id>.pdf
```

El navegador no accede directamente al almacenamiento privado.

Finora proporciona un endpoint de descarga que recupera el documento desde el backend utilizando el estado persistido de la solicitud.

---

## Ciclo de vida de una solicitud

Las solicitudes siguen una máquina de estados controlada:

```text
collecting_information
        |
        v
ready_for_confirmation
        |
        v
confirmed
        |
        v
processing
        |
        +------> completed
        |
        +------> failed
```

Este diseño impide que una interpretación del modelo de lenguaje pueda desencadenar directamente la generación de un documento sin pasar previamente por las reglas de validación y la confirmación del usuario.

---

## Stack tecnológico

### Aplicación

- Next.js 16
- React
- TypeScript
- Node.js

### Inteligencia artificial

- OpenAI API
- Extracción estructurada de información
- Gestión de conversación contextual

### Persistencia y datos

- PostgreSQL
- Dataset bancario sintético

### Automatización y orquestación

- n8n

### Generación documental

- HTML
- Gotenberg
- PDF

### Almacenamiento

- MinIO
- API compatible con Amazon S3

### Infraestructura

- Docker
- Docker Compose

---

## Estructura del repositorio

```text
finora-docs-ai/
|
+-- apps/
|   +-- web/
|       +-- src/
|       |   +-- app/
|       |   +-- lib/
|       |       +-- server/
|       |
|       +-- Dockerfile
|       +-- .dockerignore
|       +-- package.json
|
+-- infra/
|   +-- docker-compose.yml
|   +-- .env.example
|
+-- README.md
```

---

## Ejecución del proyecto

### Requisitos

Para ejecutar el entorno local se necesita:

- Docker Desktop
- una API key de OpenAI
- una instancia de n8n con el workflow de procesamiento documental de Finora

Clona el repositorio:

```bash
git clone <URL-DEL-REPOSITORIO>
cd finora-docs-ai
```

Crea el archivo local de configuración a partir del ejemplo.

En Windows PowerShell:

```powershell
Copy-Item .\infra\.env.example .\infra\.env
```

Configura posteriormente las variables necesarias dentro de:

```text
infra/.env
```

Este archivo contiene secretos locales y **no debe subirse al repositorio**.

---

## Construcción de la imagen de Finora

Desde la raíz del proyecto:

```powershell
docker compose `
  -f .\infra\docker-compose.yml `
  --env-file .\infra\.env `
  build web
```

La aplicación Next.js se compila en modo de producción y se empaqueta dentro de una imagen Docker.

---

## Arranque de la plataforma

```powershell
docker compose `
  -f .\infra\docker-compose.yml `
  --env-file .\infra\.env `
  up -d
```

Comprueba el estado de los servicios:

```powershell
docker compose `
  -f .\infra\docker-compose.yml `
  --env-file .\infra\.env `
  ps
```

La aplicación estará disponible en:

```text
http://localhost:3000
```

La infraestructura local utiliza además:

```text
Finora Web:      http://localhost:3000
Gotenberg:       http://localhost:3001
MinIO API:       http://localhost:9000
MinIO Console:   http://localhost:9001
PostgreSQL:      localhost:5433
```

---

## Apagado de la plataforma

```powershell
docker compose `
  -f .\infra\docker-compose.yml `
  --env-file .\infra\.env `
  down
```

Los datos de PostgreSQL y MinIO utilizan volúmenes persistentes de Docker.

Por tanto, un `docker compose down` normal elimina los contenedores pero conserva los datos.

No debe utilizarse:

```text
docker compose down -v
```

salvo que se quiera eliminar intencionadamente el almacenamiento persistente local.

---

## Desarrollo local

Accede a la aplicación:

```powershell
cd apps\web
```

Instala las dependencias:

```powershell
npm install
```

Ejecuta el servidor de desarrollo:

```powershell
npm run dev
```

Compila la aplicación:

```powershell
npm run build
```

Ejecuta el análisis estático:

```powershell
npm run lint
```

---

## Principios de seguridad

Aunque Finora Docs AI es una prueba de concepto académica, su arquitectura incorpora diferentes principios orientados a la seguridad.

### Acceso a OpenAI desde servidor

La API key de OpenAI se utiliza exclusivamente desde código de servidor y no debe exponerse al navegador.

### Almacenamiento privado

Los documentos generados se almacenan en un bucket privado de MinIO.

El navegador no recibe acceso directo al almacenamiento de objetos.

### Datos financieros de confianza

El modelo de lenguaje no actúa como fuente de verdad para clientes, cuentas, préstamos, movimientos o cálculos financieros.

Estos datos proceden de fuentes deterministas controladas por la aplicación.

### Confirmación explícita

Una solicitud debe superar las validaciones deterministas y ser confirmada explícitamente antes de iniciar su procesamiento documental.

### Gestión de secretos

Las credenciales y API keys se proporcionan mediante variables de entorno.

Los archivos `.env` reales están excluidos del control de versiones.

El repositorio contiene únicamente plantillas `.env.example` con valores ficticios.

---

## Consideraciones para un entorno real

Finora Docs AI es una prueba de concepto y **no constituye un sistema bancario preparado para producción**.

Una implementación real requeriría controles adicionales, entre ellos:

- autenticación,
- autorización,
- verificación de identidad,
- control de acceso basado en roles,
- gestión profesional de secretos,
- cifrado y gestión de claves,
- rate limiting,
- auditoría completa,
- monitorización y observabilidad,
- procesamiento resiliente de trabajos,
- mecanismos de idempotencia,
- políticas de conservación de datos,
- integración con sistemas bancarios reales,
- segmentación de red,
- análisis de seguridad,
- revisión regulatoria y de cumplimiento normativo.

---

## Datos sintéticos y documentos de demostración

**Finora Bank es una entidad completamente ficticia** creada exclusivamente con fines educativos y de demostración.

Todos los clientes, cuentas, préstamos, operaciones, identificadores y datos financieros utilizados por el proyecto son sintéticos.

Los documentos bancarios generados incluyen una indicación visible:

```text
DOCUMENTO DEMO - NO VALIDO
```

Los PDF generados no constituyen documentos bancarios auténticos y no deben utilizarse como justificantes de ninguna actividad financiera real.

El proyecto no está afiliado a SWIFT, a ninguna entidad bancaria ni a ninguna institución financiera real.

---

## Objetivo técnico

Finora Docs AI demuestra cómo integrar inteligencia artificial generativa dentro de un proceso financiero controlado sin convertir al modelo de lenguaje en la fuente de verdad del sistema.

El principio central de la arquitectura es:

> Utilizar IA para interpretar. Utilizar sistemas deterministas para validar, calcular y ejecutar.

Este enfoque permite aprovechar interfaces conversacionales manteniendo reglas de negocio predecibles, trazabilidad y control sobre la ejecución.

---

## Contexto académico

Finora Docs AI ha sido desarrollado en el contexto de un Trabajo Fin de Máster relacionado con inteligencia artificial y automatización de documentación financiera.

El objetivo es estudiar y demostrar una arquitectura capaz de combinar:

- modelos de lenguaje,
- procesamiento conversacional,
- reglas deterministas,
- persistencia,
- automatización de workflows,
- generación documental,
- almacenamiento privado,
- contenerización.

---

## Estado del proyecto

La prueba de concepto implementa y valida de extremo a extremo los flujos de:

- extractos de cuenta,
- cuadros de amortización,
- confirmaciones SWIFT.

El entorno ha sido probado tanto en desarrollo como mediante una build de producción dockerizada.

---

## Licencia y uso

Este repositorio está destinado a fines académicos, demostrativos y de portfolio.

Consulta la licencia del repositorio antes de reutilizar o redistribuir el proyecto.