// argos.js - Núcleo Maestro y Servidor Local
'use strict';

const fs       = require('fs');
const readline = require('readline');
const http     = require('http');
const { exec } = require('child_process');

const intervals = require('./intervals');
const gemini    = require('./gemini');
const visual    = require('./visual');

const CONFIG = {
    ATHLETE_ID:         'PEGA_AQUI_TU_ID_DE_USUARIO',
    INTERVALS_API_KEY:  'PEGA_AQUI_TU_CLAVE_API_DE_INTERVALS',
    GEMINI_API_KEY:     'PEGA_AQUI_TU_CLAVE_API_DE_GEMINI',
    NOMBRE_ATLETA:      'Atleta',
    PUERTO_SERVIDOR:    3000,
    MAX_HISTORIAL_DIAS: 14,
    MAX_CHARS_LESIONES: 2000,
    MAX_CHARS_COMENTARIO: 500,
};

const RUTA_MEMORIA   = 'memoria.txt';
const RUTA_LESIONES  = 'lesiones.txt';
const RUTA_BITACORA  = 'bitacora.json';
const RUTA_IA_CACHE  = 'ia_cache.json';
const RUTA_RETRO_CACHE = 'retro_cache.json';

function leerArchivoTexto(ruta, valorDefecto) {
    try {
        if (!fs.existsSync(ruta)) fs.writeFileSync(ruta, valorDefecto, 'utf-8');
        return fs.readFileSync(ruta, 'utf-8');
    } catch { return valorDefecto; }
}

function leerBitacora() {
    try {
        if (!fs.existsSync(RUTA_BITACORA)) return [];
        return JSON.parse(fs.readFileSync(RUTA_BITACORA, 'utf-8'));
    } catch {
        console.warn('[A.R.G.O.S.] Bitácora corrupta, iniciando nueva.');
        return [];
    }
}

function guardarBitacora(data) { fs.writeFileSync(RUTA_BITACORA, JSON.stringify(data, null, 2), 'utf-8'); }

function leerBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
            if (body.length > 10_485_760) { req.destroy(); reject(new Error('Payload demasiado grande')); }
        });
        req.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch { reject(new Error('JSON inválido')); }
        });
        req.on('error', reject);
    });
}

function respuestaJSON(res, codigo, payload) {
    res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
}

function validarSensaciones({ fecha, rpe, dolor, comentario }) {
    if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
    if (!Number.isInteger(rpe)   || rpe   < 1 || rpe   > 10) return false;
    if (!Number.isInteger(dolor) || dolor < 1 || dolor > 10) return false;
    if (typeof comentario !== 'string') return false;
    return true;
}

function validarFecha(fecha) { return typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha); }

function preguntarObjetivo(memoriaActual) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('  A.R.G.O.S.  —  Software de Rendimiento Deportivo');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`\nObjetivo actual:\n  "${memoriaActual}"\n`);
        rl.question('Actualiza tu meta (o pulsa ENTER para mantener):\n> ', res => {
            rl.close();
            resolve(res.trim());
        });
    });
}

function preguntarIntencionDia() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question('\n¿Tienes alguna preferencia para el entrenamiento de hoy?\n(Ej. "Quiero correr 10km suaves", o pulsa ENTER para cálculo automático):\n> ', res => {
            rl.close();
            resolve(res.trim());
        });
    });
}

async function iniciarArgos() {
    try {
        let memoriaAtleta  = leerArchivoTexto(RUTA_MEMORIA,  'Preparación base.');
        
        const nuevoObjetivo = await preguntarObjetivo(memoriaAtleta);
        if (nuevoObjetivo) {
            memoriaAtleta = nuevoObjetivo;
            fs.writeFileSync(RUTA_MEMORIA, memoriaAtleta, 'utf-8');
        }

        const intencionHoy = await preguntarIntencionDia();

        console.log('\n[1/3] Extrayendo telemetría vital de Intervals.icu...');
        const datos = await intervals.extraerMetricas(CONFIG.ATHLETE_ID, CONFIG.INTERVALS_API_KEY);

        console.log('[2/3] Auditando misiones pasadas de forma automática...');
        let retroGenerada = null;
        if (fs.existsSync(RUTA_RETRO_CACHE)) {
            try {
                const cache = JSON.parse(fs.readFileSync(RUTA_RETRO_CACHE, 'utf-8'));
                if (cache.fecha === datos.hoy) retroGenerada = cache.retro;
            } catch(e) {}
        }
        if (!retroGenerada) {
            retroGenerada = await gemini.obtenerAnalisisRetrospectivo(CONFIG.GEMINI_API_KEY, datos, CONFIG.NOMBRE_ATLETA);
            fs.writeFileSync(RUTA_RETRO_CACHE, JSON.stringify({ fecha: datos.hoy, retro: retroGenerada }, null, 2), 'utf-8');
        }

        let iaGenerada = null;
        if (fs.existsSync(RUTA_IA_CACHE)) {
            try {
                const cache = JSON.parse(fs.readFileSync(RUTA_IA_CACHE, 'utf-8'));
                if (cache.fecha === datos.hoy) {
                    iaGenerada = cache.ia;
                    console.log('[!] Prescripción de hoy recuperada de la memoria caché.');
                }
            } catch(e) {}
        }

        console.log('[3/3] Compilando el Panel de Control. (Planificación futura en espera manual)...');

        const server = http.createServer(async (req, res) => {
            try {
                if (req.method === 'GET' && req.url === '/') {
                    let historial = leerBitacora();
                    const porcentajePlan = Math.min(100, Math.round((historial.length / CONFIG.MAX_HISTORIAL_DIAS) * 100));
                    
                    let iaData = iaGenerada || {
                        resumen: 'No generada', analisisPrescripcion: '', calentamiento: '', principal: '', enfriamiento: '',
                        dieta: '---', carbos: 0, protes: 0, grasas: 0, nutricion: ''
                    };
                    
                    const lesionesActuales = leerArchivoTexto(RUTA_LESIONES, 'Ninguna lesión activa.');
                    const memoriaActual = leerArchivoTexto(RUTA_MEMORIA, 'Preparación base.');

                    const htmlFinal = visual.generarHTML(datos, retroGenerada, iaData, memoriaActual, lesionesActuales, historial, porcentajePlan, CONFIG.NOMBRE_ATLETA, !iaGenerada);
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    return res.end(htmlFinal);
                }

                if (req.method === 'POST' && req.url === '/generate-ia') {
                    console.log('[A.R.G.O.S.] Solicitud de prescripción manual recibida. Consultando a la IA...');
                    
                    const lesionesActuales = leerArchivoTexto(RUTA_LESIONES, 'Ninguna lesión activa.');
                    const memoriaActual = leerArchivoTexto(RUTA_MEMORIA, 'Preparación base.');
                    let historial = leerBitacora();

                    iaGenerada = await gemini.obtenerEntrenamiento(
                        CONFIG.GEMINI_API_KEY,
                        memoriaActual,
                        lesionesActuales,
                        historial,
                        datos,
                        intencionHoy,
                        CONFIG.NOMBRE_ATLETA
                    );

                    fs.writeFileSync(RUTA_IA_CACHE, JSON.stringify({ fecha: datos.hoy, ia: iaGenerada }, null, 2), 'utf-8');

                    const idxHoy = historial.findIndex(h => h.fecha === datos.hoy);
                    if (idxHoy === -1) {
                        historial.push({ fecha: datos.hoy, resumen: iaGenerada.resumen, cumplido: false });
                    } else {
                        historial[idxHoy].resumen = iaGenerada.resumen;
                    }
                    if (historial.length > CONFIG.MAX_HISTORIAL_DIAS) historial.shift();
                    guardarBitacora(historial);

                    console.log('[A.R.G.O.S.] Prescripción generada y lista.');
                    return respuestaJSON(res, 200, { success: true });
                }

                if (req.method === 'POST' && req.url === '/update-tick') {
                    const { fecha, cumplido } = await leerBody(req);
                    if (!validarFecha(fecha) || typeof cumplido !== 'boolean') return respuestaJSON(res, 400, { error: 'Datos inválidos' });
                    const bitacora = leerBitacora();
                    const idx = bitacora.findIndex(i => i.fecha === fecha);
                    if (idx !== -1) { bitacora[idx].cumplido = cumplido; guardarBitacora(bitacora); }
                    return respuestaJSON(res, 200, { success: true });
                }

                // INTEGRACIÓN DE SENSACIONES LIBRES
                if (req.method === 'POST' && req.url === '/update-sensaciones') {
                    const body = await leerBody(req);
                    body.rpe   = parseInt(body.rpe,   10);
                    body.dolor = parseInt(body.dolor, 10);
                    body.comentario = String(body.comentario ?? '').slice(0, CONFIG.MAX_CHARS_COMENTARIO);

                    if (!validarSensaciones(body)) return respuestaJSON(res, 400, { error: 'Datos inválidos' });
                    
                    const bitacora = leerBitacora();
                    const idx = bitacora.findIndex(i => i.fecha === body.fecha);
                    
                    if (idx !== -1) {
                        bitacora[idx] = { ...bitacora[idx], rpe: body.rpe, dolor: body.dolor, comentario: body.comentario };
                    } else {
                        // Si la fecha no está registrada, crea la misión libre y sus sensaciones
                        bitacora.push({ fecha: body.fecha, resumen: 'Actividad Libre', cumplido: true, rpe: body.rpe, dolor: body.dolor, comentario: body.comentario });
                        bitacora.sort((a,b) => a.fecha.localeCompare(b.fecha));
                        if (bitacora.length > CONFIG.MAX_HISTORIAL_DIAS) bitacora.shift();
                    }
                    guardarBitacora(bitacora);
                    return respuestaJSON(res, 200, { success: true });
                }

                if (req.method === 'POST' && req.url === '/update-lesiones') {
                    const { lesiones } = await leerBody(req);
                    if (typeof lesiones !== 'string') return respuestaJSON(res, 400, { error: 'Payload inválido' });
                    const lesionesSeguras = lesiones.slice(0, CONFIG.MAX_CHARS_LESIONES);
                    fs.writeFileSync(RUTA_LESIONES, lesionesSeguras, 'utf-8');
                    console.log('[A.R.G.O.S.] Registro médico actualizado.');
                    return respuestaJSON(res, 200, { success: true });
                }

                if (req.method === 'POST' && req.url === '/analyze-food') {
                    const payload = await leerBody(req);
                    const { imagenBase64, mimeType, dieta, notas, caloriasObjetivo } = payload;
                    
                    if (!imagenBase64 || !mimeType || !dieta) {
                        return respuestaJSON(res, 400, { error: 'Faltan parámetros de imagen o dieta' });
                    }

                    console.log(`[A.R.G.O.S.] Escaneando ingesta del atleta (Dieta: ${dieta})...`);
                    const resultado = await gemini.analizarComida(
                        CONFIG.GEMINI_API_KEY, 
                        imagenBase64, 
                        mimeType, 
                        dieta, 
                        notas, 
                        caloriasObjetivo, 
                        CONFIG.NOMBRE_ATLETA
                    );
                    
                    return respuestaJSON(res, 200, resultado);
                }

                respuestaJSON(res, 404, { error: 'Ruta no encontrada' });
            } catch (err) {
                console.error('[A.R.G.O.S.] Error:', err.message);
                respuestaJSON(res, 500, { error: 'Error interno' });
            }
        });

        server.listen(CONFIG.PUERTO_SERVIDOR, () => {
            const url = `http://localhost:${CONFIG.PUERTO_SERVIDOR}`;
            console.log(`\n✓ Servidor A.R.G.O.S. operativo → ${url}`);
            console.log('  Ctrl+C para cerrar el sistema.\n');
            const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
            exec(`${cmd} ${url}`);
        });

    } catch (error) {
        console.error('\n[A.R.G.O.S.] Fallo crítico en el arranque:', error);
        process.exit(1);
    }
}

iniciarArgos();