const fs = require('fs');
const path = require('path');
const config = require('../config');

function leerArchivoTexto(ruta, valorDefecto) {
    try {
        if (!fs.existsSync(ruta)) fs.writeFileSync(ruta, valorDefecto, 'utf-8');
        return fs.readFileSync(ruta, 'utf-8');
    } catch { return valorDefecto; }
}

function escribirArchivoTexto(ruta, contenido) {
    try { fs.writeFileSync(ruta, contenido, 'utf-8'); } catch(e) {}
}

function leerBitacora() {
    try {
        if (!fs.existsSync(config.RUTAS.BITACORA)) return [];
        return JSON.parse(fs.readFileSync(config.RUTAS.BITACORA, 'utf-8'));
    } catch { return []; }
}

function guardarBitacora(data) {
    try { fs.writeFileSync(config.RUTAS.BITACORA, JSON.stringify(data, null, 2), 'utf-8'); } catch(e) {}
}

function leerCacheJSON(ruta, fechaHoy) {
    try {
        if (fs.existsSync(ruta)) {
            const cache = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
            if (cache.fecha === fechaHoy) return cache.data;
        }
    } catch(e) {}
    return null;
}

function guardarCacheJSON(ruta, fechaHoy, data) {
    try { fs.writeFileSync(ruta, JSON.stringify({ fecha: fechaHoy, data }, null, 2), 'utf-8'); } catch(e) {}
}

// --- NUEVO: Motor de almacenamiento físico clasificado por platos ---
function guardarRegistroComida(imagenes, analisis, extra) {
    try {
        const dirBase = config.RUTAS.COMIDAS || 'historial_comidas';
        if (!fs.existsSync(dirBase)) fs.mkdirSync(dirBase);

        // Crear marca de tiempo para alinear los nombres de fotos y textos
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);

        // Diseñar el reporte de inteligencia global
        const txtContent = 
`════════════════════════════════════════════════
  A.R.G.O.S. - ARCHIVO TÁCTICO NUTRICIONAL
════════════════════════════════════════════════
FECHA DEL REGISTRO:   ${now.toLocaleString()}
ESTRATEGIA APLICADA:  ${extra.dieta}
GASTO ACTIVO (RELOJ): ${extra.caloriasObjetivo} kcal
METABOLISMO (BMR):    ${extra.bmr} kcal
NOTAS DEL ATLETA:     ${extra.notas || 'Ninguna'}

════════════════════════════════════════════════
  EVALUACIÓN DE LA IA (GEMINI)
════════════════════════════════════════════════
CARGA ENERGÉTICA GLOBAL: 
${analisis.kcal}

MACRONUTRIENTES ESTIMADOS TOTALES: 
${analisis.macros}

EVALUACIÓN OBJETIVA:
${analisis.evaluacion}

RECOMENDACIÓN DE AJUSTE:
${analisis.recomendacion}
`;

        // Repartir cada imagen en su categoría correspondiente
        for (const img of imagenes) {
            // img.fase contiene 'entrante', 'primero', 'segundo' o 'postre'
            const faseDir = path.join(dirBase, img.fase); 
            if (!fs.existsSync(faseDir)) fs.mkdirSync(faseDir);

            const ext = img.mimeType.split('/')[1] || 'jpg';
            
            const imgPath = path.join(faseDir, `${timestamp}.${ext}`);
            const txtPath = path.join(faseDir, `${timestamp}.txt`);

            // Guardar la fotografía en la carpeta de su fase
            const buffer = Buffer.from(img.base64, 'base64');
            fs.writeFileSync(imgPath, buffer);

            // Clonar el análisis global junto a la foto para mantener el contexto
            fs.writeFileSync(txtPath, txtContent, 'utf-8');
        }

    } catch (e) {
        console.error('[Storage] Error táctico al guardar la clasificación de comida:', e.message);
    }
}

module.exports = { 
    leerArchivoTexto, 
    escribirArchivoTexto, 
    leerBitacora, 
    guardarBitacora, 
    leerCacheJSON, 
    guardarCacheJSON, 
    guardarRegistroComida 
};