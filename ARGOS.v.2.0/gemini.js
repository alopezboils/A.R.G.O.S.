// gemini.js - Módulo de Inteligencia Artificial

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const MAX_REINTENTOS = 3;
const TIMEOUT_MS     = 30_000;

async function fetchConTimeout(url, opciones, timeoutMs = TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...opciones, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function llamarGeminiConReintentos(apiKey, payload) {
    const url = `${GEMINI_URL}?key=${apiKey}`;
    let ultimoError;

    for (let intento = 0; intento < MAX_REINTENTOS; intento++) {
        if (intento > 0) {
            const espera = Math.pow(2, intento) * 500;
            console.warn(`[Motor IA] Reintento ${intento}/${MAX_REINTENTOS - 1} en ${espera}ms...`);
            await new Promise(r => setTimeout(r, espera));
        }

        try {
            const res = await fetchConTimeout(url, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(payload)
            });

            if (res.status === 429 || res.status >= 500) {
                ultimoError = new Error(`HTTP ${res.status}`);
                continue;
            }

            if (!res.ok) throw new Error(`API error: ${res.status}`);

            const json = await res.json();
            return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

        } catch (err) {
            ultimoError = err;
            if (err.name !== 'AbortError' && !err.message.startsWith('HTTP')) throw err;
        }
    }
    throw ultimoError;
}

function extraerEtiqueta(texto, tag) {
    const ETIQUETAS = 'RESUMEN_CORTO|ANALISIS_RETROSPECTIVO|ANALISIS_PRESCRIPCION|CALENTAMIENTO|PRINCIPAL|ENFRIAMIENTO|TIPO_DIETA|MACRO_CARBOS|MACRO_PROTES|MACRO_GRASAS|CONSEJO_NUTRICIONAL|KCAL_ESTIMADAS|MACROS|EVALUACION_OBJETIVA|RECOMENDACION_MEJORA';
    const re = new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[(?:${ETIQUETAS})\\]|$)`);
    const match = texto.match(re);
    return match ? match[1].trim() : '0';
}

// 1. ANÁLISIS AUTOMÁTICO DEL PASADO
async function obtenerAnalisisRetrospectivo(apiKey, datos, nombreAtleta = 'Atleta') {
    const actividadesRealizadas = Object.keys(datos.resumenActividades).length > 0 
        ? Object.keys(datos.resumenActividades).sort().slice(-3).map(fecha => `${fecha}: ${datos.resumenActividades[fecha]}`).join('\n')
        : 'Sin registros recientes de actividad por parte del reloj.';

    const prompt = `Eres A.R.G.O.S., inteligencia artificial deportiva de alto rendimiento para ${nombreAtleta}. Tu tono es profesional y científico.

=== ACTIVIDAD REAL REGISTRADA POR EL RELOJ (Últimos días) ===
${actividadesRealizadas}

=== SITUACIÓN FISIOLÓGICA HOY ===
Intensidad aconsejada: ${datos.estadoIntensidad}. Zona fatiga: ${datos.zonaFatiga}.
CTL (fitness base): ${datos.latestCTL}. ATL (fatiga aguda): ${datos.latestATL}. Form (TSB): ${datos.latestForm}.

=== MISIÓN ===
Evalúa el rendimiento reciente del atleta.
Estructura exactamente con esta etiqueta:
[ANALISIS_RETROSPECTIVO] -> Evaluación técnica y objetiva de la "ACTIVIDAD REAL REGISTRADA POR EL RELOJ". ¿Fue un buen estímulo o generó fatiga innecesaria basado en su TSB actual?`;

    try {
        const textoIA = await llamarGeminiConReintentos(apiKey, { contents: [{ parts: [{ text: prompt }] }] });
        if (!textoIA) return { analisisRetrospectivo: 'Error de conexión con IA.' };
        return { analisisRetrospectivo: extraerEtiqueta(textoIA, 'ANALISIS_RETROSPECTIVO') };
    } catch (error) {
        console.error('[Motor IA - Retro] Fallo:', error.message);
        return { analisisRetrospectivo: 'No se pudo contactar con el motor de IA.' };
    }
}

// 2. CREACIÓN A DEMANDA DEL FUTURO
async function obtenerEntrenamiento(apiKey, memoria, lesiones, historialIA, datos, intencionHoy, nombreAtleta = 'Atleta') {
    const contextoAnterior = historialIA.length === 0
        ? 'Sin prescripciones previas.'
        : historialIA.map(h =>
            `Día ${h.fecha}: Prescribiste -> ${h.resumen}. ` +
            `Sensaciones: Esfuerzo ${h.rpe ?? '-'}/10, Dolor ${h.dolor ?? '-'}/10. ` +
            `Notas: ${h.comentario ?? 'Ninguna'}`
          ).join('\n');

    const bloqueIntencion = intencionHoy 
        ? `\n=== PREFERENCIA DEL ATLETA PARA HOY ===\nEl atleta ha expresado este deseo para la sesión de hoy: "${intencionHoy}".\nSi su fisiología y sus lesiones lo permiten, ADAPTA la sesión principal para cumplir esta preferencia. Si es fisiológicamente perjudicial hoy, explícale por qué no debe hacerlo en el [ANALISIS_PRESCRIPCION] y proponle la alternativa correcta.\n` 
        : '';

    const prompt = `Eres A.R.G.O.S., un entrenador personal experto e inteligencia artificial deportiva de alto rendimiento para ${nombreAtleta}. Tu tono es profesional, científico, claro y motivador. No utilices jerga de ciencia ficción.

=== OBJETIVO PRINCIPAL ===
"${memoria}"

=== ESTADO MÉDICO Y LESIONES ACTIVAS (PRIORIDAD ABSOLUTA) ===
"${lesiones}"
Si hay una lesión registrada aquí, EVITA ESTRICTAMENTE prescribir ejercicios que involucren o impacten la zona afectada.

=== HISTORIAL DE TUS PRESCRIPCIONES Y SUS SENSACIONES ===
${contextoAnterior}

=== SITUACIÓN FISIOLÓGICA HOY ===
Intensidad aconsejada: ${datos.estadoIntensidad}. Zona fatiga: ${datos.zonaFatiga}.
CTL: ${datos.latestCTL}. ATL: ${datos.latestATL}. Form (TSB): ${datos.latestForm}.
${bloqueIntencion}
=== MISIÓN ===
Diseña la sesión de hoy integrada en la periodización y ADAPTADA a las lesiones, fatiga actuales y a la preferencia del atleta.
Estructura exactamente con estas etiquetas:
[RESUMEN_CORTO] -> Resumen en 10 palabras.
[ANALISIS_PRESCRIPCION] -> Explicación técnica justificando el entrenamiento sugerido hoy (o el descanso).
[CALENTAMIENTO] -> Activación (evitar zona lesionada).
[PRINCIPAL] -> Núcleo de la sesión (evitar zona lesionada).
[ENFRIAMIENTO] -> Vuelta a la calma.
[TIPO_DIETA] -> Alta en Carbohidratos, Alta en Proteínas, Cetogénica (Keto) o Ayuno Intermitente.
[MACRO_CARBOS] -> Gramos estimados de carbohidratos (solo el número).
[MACRO_PROTES] -> Gramos estimados de proteína (solo el número).
[MACRO_GRASAS] -> Gramos estimados de grasas (solo el número).
[CONSEJO_NUTRICIONAL] -> Pautas breves de nutrición deportiva para afrontar el día.`;

    const RESPUESTA_ERROR = {
        resumen: 'Error', analisisPrescripcion: 'No se pudo contactar con el motor de IA.',
        calentamiento: '-', principal: '-', enfriamiento: '-',
        dieta: 'Desconocida', carbos: '0', protes: '0', grasas: '0', nutricion: '-'
    };

    try {
        const textoIA = await llamarGeminiConReintentos(apiKey, { contents: [{ parts: [{ text: prompt }] }] });
        if (!textoIA) return RESPUESTA_ERROR;
        const ext = (tag) => extraerEtiqueta(textoIA, tag);
        return {
            resumen:               ext('RESUMEN_CORTO'),
            analisisPrescripcion:  ext('ANALISIS_PRESCRIPCION'),
            calentamiento:         ext('CALENTAMIENTO'),
            principal:             ext('PRINCIPAL'),
            enfriamiento:          ext('ENFRIAMIENTO'),
            dieta:                 ext('TIPO_DIETA'),
            carbos:                ext('MACRO_CARBOS'),
            protes:                ext('MACRO_PROTES'),
            grasas:                ext('MACRO_GRASAS'),
            nutricion:             ext('CONSEJO_NUTRICIONAL')
        };
    } catch (error) {
        console.error('[Motor IA] Fallo definitivo tras reintentos:', error.message);
        return RESPUESTA_ERROR;
    }
}

// 3. ANÁLISIS DE COMIDA
async function analizarComida(apiKey, base64Image, mimeType, dieta, notas, caloriasObjetivo, nombreAtleta) {
    const prompt = `Eres A.R.G.O.S., inteligencia artificial de alto rendimiento deportivo para el atleta ${nombreAtleta}.
    
    === CONTEXTO DEL ANÁLISIS ===
    - Estrategia nutricional: ${dieta}
    - Gasto calórico activo promedio: ${caloriasObjetivo} kcal/día.
    - Notas del atleta: "${notas || 'Sin notas adicionales.'}"

    === MISIÓN ===
    Analiza la imagen adjunta de esta comida.
    Estructura tu respuesta exactamente con estas etiquetas:
    [KCAL_ESTIMADAS] -> (Solo el número aproximado de kcal totales).
    [MACROS] -> (Detalla gramos estimados de Carbohidratos, Proteínas y Grasas).
    [EVALUACION_OBJETIVA] -> (Crítica fisiológica estricta: ¿Cumple con la dieta ${dieta}? ¿Es suficiente o excesivo para el gasto de ${caloriasObjetivo} kcal?).
    [RECOMENDACION_MEJORA] -> (Instrucción directa sobre qué alimentos añadir o eliminar en la próxima comida).`;

    try {
        const url = `${GEMINI_URL}?key=${apiKey}`;
        const payload = { contents: [{ parts: [ { text: prompt }, { inline_data: { mime_type: mimeType, data: base64Image } } ] }] };
        const res = await fetchConTimeout(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const json = await res.json();
        const textoIA = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const ext = (tag) => extraerEtiqueta(textoIA, tag);

        return {
            kcal: ext('KCAL_ESTIMADAS'), macros: ext('MACROS'),
            evaluacion: ext('EVALUACION_OBJETIVA'), recomendacion: ext('RECOMENDACION_MEJORA')
        };
    } catch (error) {
        console.error('[Motor IA - Visión] Fallo al analizar imagen:', error.message);
        return {
            kcal: 'Error', macros: 'Error', evaluacion: 'No se pudo procesar la imagen.', recomendacion: 'Revisa tu conexión.'
        };
    }
}

module.exports = { obtenerAnalisisRetrospectivo, obtenerEntrenamiento, analizarComida };