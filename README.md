# A.R.G.O.S. 
**Análisis de Rendimiento Global y Orientación de Sesiones**

A.R.G.O.S. es un asistente virtual inteligente impulsado por IA, diseñado para ejecutarse localmente. Actúa como un entrenador personal analítico que evalúa tu historial de entrenamiento, tu recuperación fisiológica y prescribe la sesión deportiva óptima para cada día, alineada siempre con tus objetivos a largo plazo.

Este sistema aprende de tus datos sin depender de una marca de reloj específica. Si tus datos de salud y deporte están centralizados en Intervals.icu, A.R.G.O.S. puede interpretarlos.

---

##  Características Principales

* Independencia de Hardware: Compatible con cualquier reloj o anillo inteligente (Coros, Garmin, Suunto, Apple Watch, Oura, etc.) capaz de sincronizar datos con Intervals.icu.
* Periodización a Largo Plazo: A través de un sistema de memoria (memoria.txt), A.R.G.O.S. adapta los entrenamientos diarios a tu objetivo principal (ej. "Preparar un Triatlón", "Ganar fuerza", "Terminar un Hyrox").
* Memoria Táctica: Utiliza una bitácora local (bitacora.json) para recordar las sesiones prescritas en los últimos 7 días y evitar repeticiones innecesarias de estímulos.
* Panel Holográfico Interactivo: Genera un panel de control en HTML con gráficas de Chart.js que se abre automáticamente en el navegador, mostrando el historial, la fatiga (ATL), la base aeróbica (CTL), las horas de sueño, el HRV y el pulso en reposo.
* Análisis por IA: Las prescripciones son análisis dinámicos generados por la IA de Google (Gemini) en base a métricas de estrés y recuperación reales.

---

##  Requisitos Previos

Para ejecutar A.R.G.O.S. en tu máquina, necesitas:

1. Node.js (Versión 18 o superior).
2. Una cuenta en Intervals.icu con actividades y datos de salud (Wellness) registrados.
3. Una API Key de Intervals.icu (Se obtiene en la web de Intervals -> Ajustes -> Aplicaciones -> Configuración de desarrollador).
4. Una API Key de Google Gemini (Se obtiene de forma gratuita en Google AI Studio).

---

##  Instalación y Configuración

1. Clonar el repositorio
Descarga los archivos a tu entorno local abriendo la terminal y ejecutando:
git clone <URL_DE_ESTE_REPOSITORIO>
cd ARGOS

2. Insertar credenciales
Abre el archivo principal argos.js con cualquier editor de código y reemplaza las constantes en la parte superior con tu información real:
const ATHLETE_ID = "tu_id_de_intervals";
const INTERVALS_API_KEY = "TU_CLAVE_DE_INTERVALS";
const GEMINI_API_KEY = "TU_CLAVE_DE_GEMINI";

(Nota: A.R.G.O.S. utiliza únicamente módulos integrados de Node.js como fs, child_process y readline. No es necesario ejecutar npm install).

---

##  Uso del Sistema

Para iniciar el asistente, abre tu terminal en la carpeta del proyecto y ejecuta:

node argos.js

### El Flujo de Trabajo
1. Al iniciarse, la consola mostrará la Directiva Estratégica actual (la meta a largo plazo).
2. Preguntará si deseas actualizarla. Puedes escribir un nuevo objetivo y pulsar Enter, o pulsar Enter directamente para mantener el rumbo actual.
3. El sistema descargará los datos de los últimos 7 días, consultará la bitácora de sesiones previas, y procesará la información mediante el motor de IA.
4. Finalmente, el navegador web se abrirá automáticamente mostrando un panel HTML generado dinámicamente con las gráficas de rendimiento y el entrenamiento estructurado para el día.

---

##  Estructura de Archivos

* argos.js: Archivo principal. Contiene el núcleo de procesamiento, conexión a las APIs y generación de la interfaz.
* memoria.txt: (Autogenerado) Archivo de texto donde se guarda el objetivo maestro del atleta.
* bitacora.json: (Autogenerado) Base de datos temporal que almacena los entrenamientos de los últimos 7 días.
* argos.html: (Autogenerado) La interfaz gráfica temporal que se sobrescribe en cada ejecución.

---

##  Privacidad y Seguridad
A.R.G.O.S. está diseñado para operar localmente. Los datos fisiológicos se descargan directamente de Intervals.icu a la máquina local. Solo el contexto estrictamente necesario (carga semanal, promedios de HRV/Sueño y el historial reciente) se envía a la API de Gemini para formular la rutina. Ningún dato personal se almacena en servidores de terceros distintos a las plataformas mencionadas.
