const fs = require('fs');
const { exec } = require('child_process');
const readline = require('readline');

// =========================================================================
// 1. TUS LLAVES DE ACCESO
// =========================================================================
const ATHLETE_ID = "PEGA_AQUI_TU_ID_DE_USUARIO";
const INTERVALS_API_KEY = "PEGA_AQUI_TU_CLAVE_API_DE_INTERVALS";
const GEMINI_API_KEY = "PEGA_AQUI_TU_CLAVE_API_DE_GEMINI";

const preguntarObjetivo = (memoriaActual) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        console.log(`\n======================================================`);
        console.log(`📡 A.R.G.O.S. v6.0 - SISTEMA DE PERIODIZACIÓN A LARGO PLAZO`);
        console.log(`======================================================`);
        console.log(`Tu meta maestra actual es:\n"${memoriaActual}"\n`);
        
        rl.question('Actualiza tu objetivo a largo plazo (o pulsa ENTER para mantenerlo):\n> ', (respuesta) => {
            rl.close();
            resolve(respuesta.trim());
        });
    });
};

async function iniciarArgos() {
    try {
        // =========================================================================
        // 2. LECTURA DE MEMORIAS (OBJETIVOS Y BASE DE DATOS DE BITÁCORA)
        // =========================================================================
        const rutaMemoria = 'memoria.txt';
        if (!fs.existsSync(rutaMemoria)) {
            fs.writeFileSync(rutaMemoria, "Preparación base. Construyendo resistencia aeróbica general.");
        }
        let memoriaAtleta = fs.readFileSync(rutaMemoria, 'utf-8');

        // Evolución: La bitácora ahora es un archivo JSON que guarda los últimos 7 días
        const rutaBitacora = 'bitacora.json';
        let historialIA = [];
        if (fs.existsSync(rutaBitacora)) {
            try {
                historialIA = JSON.parse(fs.readFileSync(rutaBitacora, 'utf-8'));
            } catch (e) {
                historialIA = [];
            }
        }

        const nuevoObjetivo = await preguntarObjetivo(memoriaAtleta);
        if (nuevoObjetivo !== "") {
            memoriaAtleta = nuevoObjetivo;
            fs.writeFileSync(rutaMemoria, memoriaAtleta);
            console.log(`\n[✓] Rumbo actualizado hacia: "${memoriaAtleta}"`);
        } else {
            console.log(`\n[✓] Rumbo mantenido.`);
        }

        console.log("Recopilando biometría y fatiga de tu Coros Pace 4...");

        // =========================================================================
        // 3. EXTRACCIÓN DE DATOS SEMANALES REALES (Intervals.icu)
        // =========================================================================
        const fechaHoy = new Date();
        const hoy = fechaHoy.toISOString().split('T')[0];
        const fechaSemanaPasada = new Date();
        fechaSemanaPasada.setDate(fechaHoy.getDate() - 7);
        const hace7Dias = fechaSemanaPasada.toISOString().split('T')[0];

        const tokenBase64 = Buffer.from('API_KEY:' + INTERVALS_API_KEY).toString('base64');
        const headers = { 'Authorization': `Basic ${tokenBase64}` };

        const urlWellness = `https://intervals.icu/api/v1/athlete/${ATHLETE_ID}/wellness?oldest=${hace7Dias}&newest=${hoy}`;
        const resWellness = await fetch(urlWellness, { headers });
        const datosWellness = await resWellness.json();

        const urlActivities = `https://intervals.icu/api/v1/athlete/${ATHLETE_ID}/activities?oldest=${hace7Dias}&newest=${hoy}`;
        const resActivities = await fetch(urlActivities, { headers });
        const datosActivities = await resActivities.json();

        const mapaCargaDiaria = {};
        let kilometrosTotales = 0;
        let cargaTotalSemanal = 0;

        datosActivities.forEach(act => {
            const fecha = act.start_date_local.split('T')[0];
            const carga = act.icu_training_load || 0;
            const dist = act.distance ? act.distance / 1000 : 0;
            mapaCargaDiaria[fecha] = (mapaCargaDiaria[fecha] || 0) + carga;
            if (act.type === 'Run' || act.type === 'VirtualRun') { kilometrosTotales += dist; }
            cargaTotalSemanal += carga;
        });

        let sumaHRV = 0, sumaRHR = 0, sumaSueno = 0, cuentaWellness = 0;
        datosWellness.forEach(d => {
            if (d.hrv || d.restingHR) {
                if (d.hrv) sumaHRV += d.hrv;
                if (d.restingHR) sumaRHR += d.restingHR;
                if (d.sleepSecs) sumaSueno += (d.sleepSecs / 3600);
                cuentaWellness++;
            }
        });

        const avgHRV = cuentaWellness > 0 ? Math.round(sumaHRV / cuentaWellness) : 'N/A';
        const avgRHR = cuentaWellness > 0 ? Math.round(sumaRHR / cuentaWellness) : 'N/A';
        const avgSueno = cuentaWellness > 0 ? (sumaSueno / cuentaWellness).toFixed(1) : 'N/A';

        const chartLabels = datosWellness.map(d => d.id.slice(5));
        const chartHRV = datosWellness.map(d => d.hrv || null);
        const chartRHR = datosWellness.map(d => d.restingHR || null);
        const chartSueno = datosWellness.map(d => d.sleepSecs ? (d.sleepSecs / 3600).toFixed(1) : null);
        const chartRecuperacion = datosWellness.map(d => d.readiness || null);
        const chartFitness = datosWellness.map(d => d.ctl || null);
        const chartCargaTrabajo = datosWellness.map(d => mapaCargaDiaria[d.id] || 0);

        let resumenEntrenos = datosActivities.length === 0 ? "Sin actividades." : 
            datosActivities.map(act => `- ${act.start_date_local.split('T')[0]} | ${act.type} | Dist: ${act.distance ? (act.distance / 1000).toFixed(2) + " km" : "N/A"}`).join('\n');

        // Formatear el historial de la IA para pasárselo al prompt
        let contextoIAAnterior = historialIA.length === 0 ? "No hay registros de prescripciones previas." :
            historialIA.map(h => `Día ${h.fecha}: Recomendé -> ${h.resumen}`).join('\n');

        // =========================================================================
        // 4. CONSULTA AL NÚCLEO DE INTELIGENCIA (CON VISIÓN DE MESOCICLO)
        // =========================================================================
        console.log("Calculando progresión a largo plazo...");

        const prompt = `Eres mi entrenador personal experto. Me llamo Pepito de los palotes. Asume la personalidad de Obi-Wan Kenobi.
        
        === MI META MAESTRA A LARGO PLAZO ===
        "${memoriaAtleta}"

        === LO QUE ME HAS MANDADO LOS ÚLTIMOS DÍAS ===
        Este es el historial de lo que tú me has prescrito recientemente:
        ${contextoIAAnterior}

        === MI ESTADO REAL HOY (SEGÚN MI RELOJ) ===
        Carga semanal: ${cargaTotalSemanal}. HRV medio: ${avgHRV}. Sueño: ${avgSueno}h.
        Entrenamientos reales completados esta semana:
        ${resumenEntrenos}

        === MISIÓN ESTRATÉGICA ===
        Diseña la sesión de hoy. IMPORTANTE: Esta sesión debe ser un bloque más en la construcción de mi "Meta Maestra". Evalúa qué me mandaste ayer y qué he hecho realmente para generar una progresión lógica (periodización). No repitas estímulos vacíos.
        
        Estructura exactamente así:
        [RESUMEN_CORTO] -> (OBLIGATORIO) Resume en 10 palabras el núcleo de la sesión de hoy (Ej: "Series 6x1000m en Z4" o "Rodaje regenerativo de 45 min").
        [ANALISIS] -> Explícame por qué toca esto hoy dentro de nuestro plan a largo plazo.
        [CALENTAMIENTO] -> Activación.
        [PRINCIPAL] -> Entrenamiento.
        [ENFRIAMIENTO] -> Vuelta a la calma.`;

        const urlGemini = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const respuestaGemini = await fetch(urlGemini, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const datosGemini = await respuestaGemini.json();
        const textoIA = datosGemini.candidates[0].content.parts[0].text;

        const ext = (tag) => {
            const regex = new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[(?:RESUMEN_CORTO|ANALISIS|CALENTAMIENTO|PRINCIPAL|ENFRIAMIENTO)\\]|$)`);
            const match = textoIA.match(regex);
            return match ? match[1].trim() : "Dato procesado.";
        };

        // Guardar la nueva prescripción en el historial de la IA
        historialIA.push({ fecha: hoy, resumen: ext("RESUMEN_CORTO") });
        if (historialIA.length > 7) historialIA.shift(); // Mantenemos solo los últimos 7 días
        fs.writeFileSync(rutaBitacora, JSON.stringify(historialIA, null, 2));

        // Construir el HTML de la línea de tiempo de prescripciones
        let timelineHTML = historialIA.slice().reverse().map(item => `
            <div class="timeline-item">
                <div class="timeline-date">${item.fecha}</div>
                <div class="timeline-desc">${item.resumen}</div>
            </div>
        `).join('');

        // =========================================================================
        // 5. CONSTRUCCIÓN DE LA INTERFAZ HTML
        // =========================================================================
        console.log("Desplegando proyecciones holográficas...");
        const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>A.R.G.O.S. | Panel de Periodización</title>
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <style>
                body { font-family: 'Segoe UI', system-ui, sans-serif; background-color: #0b0e14; color: #c9d1d9; margin: 0; padding: 25px; display: flex; justify-content: center; }
                .container { max-width: 1200px; width: 100%; }
                .header { text-align: center; margin-bottom: 25px; padding-bottom: 10px; border-bottom: 1px solid #21262d; }
                h1 { color: #58a6ff; margin: 0; letter-spacing: 4px; font-size: 34px; }
                .memoria-box { background: rgba(88, 166, 255, 0.05); border: 1px dashed #58a6ff; border-radius: 8px; padding: 15px; margin-bottom: 25px; text-align: center; }
                .memoria-title { font-size: 11px; color: #58a6ff; text-transform: uppercase; font-weight: bold; margin-bottom: 8px; letter-spacing: 1px; }
                .memoria-text { font-size: 16px; font-weight: bold; color: #a5d6ff; margin: 0; }
                
                .grid-resumen { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
                .box-summary { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 15px; text-align: center; }
                .box-val { font-size: 24px; font-weight: bold; color: #58a6ff; }
                .box-lbl { font-size: 11px; color: #8b949e; text-transform: uppercase; margin-top: 3px; }
                
                .grid-charts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 25px; }
                .chart-container { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 15px; height: 250px; }
                .chart-title { font-size: 12px; color: #8b949e; text-transform: uppercase; font-weight: bold; margin-bottom: 10px; text-align: center; }
                
                /* Nueva estructura a tres columnas para el plan */
                .panel-inferior { display: grid; grid-template-columns: 250px 1fr 1fr; gap: 20px; }
                
                /* Columna 1: Historial */
                .bloque-historial { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 15px; }
                .bloque-historial h3 { color: #8b949e; font-size: 13px; text-transform: uppercase; border-bottom: 1px solid #30363d; padding-bottom: 10px; margin-top: 0; }
                .timeline-item { border-left: 2px solid #30363d; padding-left: 10px; margin-bottom: 15px; position: relative; }
                .timeline-item::before { content: ''; position: absolute; left: -5px; top: 4px; width: 8px; height: 8px; border-radius: 50%; background: #58a6ff; }
                .timeline-item:first-child::before { background: #56d364; box-shadow: 0 0 8px #56d364; }
                .timeline-date { font-size: 11px; color: #8b949e; }
                .timeline-desc { font-size: 13px; color: #c9d1d9; margin-top: 3px; }

                /* Columna 2 y 3: Análisis y Entrenamiento */
                .bloque-obiwan { background: #1c1a16; border: 1px solid #b1872a; border-radius: 10px; padding: 20px; box-shadow: inset 0 0 10px rgba(177,135,42,0.1); }
                .bloque-obiwan h3 { color: #d4a356; margin-top: 0; border-bottom: 1px solid #b1872a; padding-bottom: 6px; font-size: 14px; letter-spacing: 1px; }
                .bloque-obiwan p { line-height: 1.6; font-size: 14px; margin: 0; color: #f0e6d2; white-space: pre-wrap; }
                
                .bloque-entrenamiento { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 20px; }
                .bloque-entrenamiento h3 { color: #58a6ff; margin-top: 0; font-size: 16px; margin-bottom: 15px; }
                .seccion-ruta { background: #0d1117; padding: 12px 18px; border-radius: 6px; margin-bottom: 12px; border-left: 4px solid #58a6ff; white-space: pre-wrap; font-size: 14px; line-height: 1.5; }
                .seccion-ruta.act { border-left-color: #d4bbff; }
                .seccion-ruta.fin { border-left-color: #56d364; }
                .tag-ruta { font-weight: bold; font-size: 11px; color: #8b949e; text-transform: uppercase; margin-bottom: 4px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header"><h1>A.R.G.O.S.</h1></div>
                
                <div class="memoria-box">
                    <div class="memoria-title">Plan de Periodización Actual</div>
                    <div class="memoria-text">${memoriaAtleta}</div>
                </div>
                
                <div class="grid-resumen">
                    <div class="box-summary"><div class="box-val">${kilometrosTotales.toFixed(1)} km</div><div class="box-lbl">Carrera Semanal</div></div>
                    <div class="box-summary"><div class="box-val">${cargaTotalSemanal}</div><div class="box-lbl">Carga de Impacto</div></div>
                    <div class="box-summary"><div class="box-val">${avgHRV} ms</div><div class="box-lbl">HRV Medio (7d)</div></div>
                    <div class="box-summary"><div class="box-val">${avgSueno} h</div><div class="box-lbl">Sueño Medio (7d)</div></div>
                </div>
                
                <div class="grid-charts">
                    <div class="chart-container"><div class="chart-title">Fisiología y % Recuperación</div><canvas id="canvasFisiologia"></canvas></div>
                    <div class="chart-container"><div class="chart-title">Carga de Trabajo y Forma Física</div><canvas id="canvasEsfuerzo"></canvas></div>
                </div>
                
                <div class="panel-inferior">
                    <div class="bloque-historial">
                        <h3>Bitácora A.R.G.O.S (7 Días)</h3>
                        ${timelineHTML}
                    </div>
                    <div class="bloque-obiwan">
                        <h3>VISIÓN TÁCTICA</h3>
                        <p>${ext("ANALISIS")}</p>
                    </div>
                    <div class="bloque-entrenamiento">
                        <h3>SESIÓN DEL DÍA</h3>
                        <div class="seccion-ruta act"><div class="tag-ruta">Fase 1: Calentamiento</div>${ext("CALENTAMIENTO")}</div>
                        <div class="seccion-ruta"><div class="tag-ruta">Fase 2: Bloque Principal</div>${ext("PRINCIPAL")}</div>
                        <div class="seccion-ruta fin"><div class="tag-ruta">Fase 3: Vuelta a la Calma</div>${ext("ENFRIAMIENTO")}</div>
                    </div>
                </div>
            </div>
            <script>
                new Chart(document.getElementById('canvasFisiologia').getContext('2d'), {
                    type: 'line',
                    data: { labels: ${JSON.stringify(chartLabels)}, datasets: [
                        { label: 'HRV', data: ${JSON.stringify(chartHRV)}, borderColor: '#58a6ff', backgroundColor: '#58a6ff', tension: 0.15, yAxisID: 'y' },
                        { label: 'RHR', data: ${JSON.stringify(chartRHR)}, borderColor: '#ff7b72', backgroundColor: '#ff7b72', tension: 0.15, yAxisID: 'y' },
                        { label: 'Recup (%)', data: ${JSON.stringify(chartRecuperacion)}, borderColor: '#56d364', backgroundColor: '#56d364', borderDash: [4, 4], tension: 0.15, yAxisID: 'y' }
                    ]}, options: { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: '#21262d' } } } }
                });
                new Chart(document.getElementById('canvasEsfuerzo').getContext('2d'), {
                    type: 'line',
                    data: { labels: ${JSON.stringify(chartLabels)}, datasets: [
                        { label: 'Base Fitness', data: ${JSON.stringify(chartFitness)}, borderColor: '#ffa657', backgroundColor: '#ffa657', tension: 0.2 },
                        { label: 'Training Load', data: ${JSON.stringify(chartCargaTrabajo)}, type: 'bar', backgroundColor: 'rgba(212, 187, 255, 0.4)', borderColor: '#d4bbff', borderWidth: 1 }
                    ]}, options: { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: '#21262d' } } } }
                });
            </script>
        </body>
        </html>
        `;

        fs.writeFileSync('argos.html', htmlContent);
        exec('start argos.html', (err) => {
            if (!err) console.log("\n[✓] Panel desplegado. Progresión a largo plazo activada.");
        });

    } catch (error) {
        console.error("He sentido una perturbación en la Fuerza:", error);
    }
}

iniciarArgos();