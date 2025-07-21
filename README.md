# Agente de IA para Mashua Viajes

Este proyecto es un agente de IA conversacional y proactivo diseñado para la agencia de viajes "Mashua". Su objetivo principal es calificar leads de clientes potenciales a través de una conversación guiada, utilizando un sistema de Recuperación Aumentada de Generación (RAG) y la capacidad de llamar a herramientas externas para automatizar procesos de negocio.

---

## 🚀 Características Clave

- **Agente Conversacional con RAG**: El agente utiliza una base de conocimiento para ofrecer información relevante sobre viajes, ofertas y promociones, evitando las alucinaciones.
- **Derivación de Leads (Tool Calling)**: Una herramienta integrada permite al agente recopilar datos de contacto del cliente y enviarlos automáticamente a un sistema de gestión de leads (a través de un webhook de Make).
- **Arquitectura Robusta y Escalable**: El proyecto está construido con un enfoque en la optimización de costos y rendimiento, utilizando patrones como el preprocesamiento de datos y una base de datos vectorial local.
- **Observabilidad y Monitoreo (Langfuse)**: Cada interacción y evento crítico del agente es trazado y enviado a Langfuse, permitiendo un monitoreo detallado del comportamiento, costos y errores en tiempo real.
- **Sincronización de Datos Automática**: Un agente de fondo actualiza la base de conocimiento local, extrayendo y resumiendo posts y promociones de la API de WordPress.
- **Identificación de Usuario Anónimo**: Las conversaciones se asocian a un ID único, permitiendo el seguimiento de la experiencia del usuario de forma anónima.

---

## 🛠️ Tecnologías Usadas

- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **IA/LLMs**: OpenAI (GPT-4o, GPT-3.5-turbo), `langchain.js`
- **Bases de Datos**: `MemoryVectorStore` (base de datos vectorial en memoria)
- **Observabilidad**: Langfuse
- **Utilidades**: `zod`, `uuid`

---

## 📂 Estructura del Proyecto

- `src/app/page.tsx`: Componente principal del frontend que renderiza la interfaz de chat, gestiona el estado de la conversación y la comunicación con el backend.
- `src/app/api/chat/route.ts`: Endpoint de la API que actúa como el "cerebro" del agente. Contiene la lógica de la cadena de RAG, la llamada a herramientas y la orquestación de la conversación.
- `src/app/api/sync/route.ts`: Endpoint de la API que funciona como un cron job para la sincronización de la base de datos de conocimiento desde WordPress.
- `src/app/components/*`: Directorio que contiene los componentes reutilizables de la interfaz de chat (`ChatBubble`, `ChatWindow`, etc.).
- `.env.example`: Archivo de ejemplo para la configuración de las variables de entorno.
- `db.json`: Base de datos de conocimiento vectorial generada por el agente de sincronización.

---

## ⚙️ Configuración y Uso

### **1. Requisitos Previos**

- Node.js (versión 18 o superior)
- npm o yarn

### **2. Instalación de Dependencias**

```bash
npm install
# o
yarn install
```

### **3. Configuración del Entorno**

Crea un archivo .env en la raíz del proyecto y copia las variables del archivo .env.example, rellenando cada una con las claves y URLs correspondientes.

```
# Variables de Entorno del Proyecto

OPENAI_API_KEY=
CRON_SECRET=
MAKE_WEBHOOK_URL=
LANGFUSE_SECRET_KEY=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_BASEURL=
```

### **4. Sincronización de la Base de Datos**

Antes de usar el agente de chat, debes generar la base de datos vectorial con los datos de WordPress.

```
# Inicia el servidor de desarrollo

npm run dev

# En una nueva terminal, ejecuta el comando curl para activar la sincronización

curl --request GET \
 --url http://localhost:3000/api/sync \
 --header 'Authorization: Bearer TU_CRON_SECRET'
Una vez que el proceso finalice, se habrá creado el archivo db.json.
```

### **5. Ejecución del Agente de Chat**

```
# Si aún no está corriendo, inicia el servidor de desarrollo

npm run dev
```

Abre tu navegador en http://localhost:3000. El agente de chat estará disponible en la esquina inferior derecha.

---

# 🤝 Contribuciones

Siéntete libre de contribuir al proyecto.

```

```
