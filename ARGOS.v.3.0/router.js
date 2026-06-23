// router.js

const config = require('./config');
const storage = require('./utils/storage');
const validation = require('./utils/validation');
const httpUtils = require('./utils/http');
const intervalsService = require('./services/intervals.service');
const geminiService = require('./services/gemini.service');
const dashboardView = require('./views/dashboard.view');
const mobileView = require('./views/mobile.view');

async function handleRequest(req, res, context) {
    try {
        if (req.method === 'GET' && req.url === '/mobile') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            return res.end(mobileView.generarHTML());
        }

        if (req.method === 'POST' && req.url === '/api/mobile-upload') {
            const { fase, base64, mimeType } = await httpUtils.leerBody(req);
            config.MOBILE_UPLOADS[fase] = { base64, mimeType };
            return httpUtils.respuestaJSON(res, 200, { success: true });
        }

        if (req.method === 'GET' && req.url === '/api/sync-images') {
            return httpUtils.respuestaJSON(res, 200, config.MOBILE_UPLOADS);
        }

        if (req.method === 'GET' && req.url === '/') {
            let historial = storage.leerBitacora();
            const porcentajePlan = Math.min(100, Math.round((historial.length / config.MAX_HISTORIAL_DIAS) * 100));
            
            let iaData = context.iaGenerada || {
                resumen: 'No generada', analisisPrescripcion: '', calentamiento: '', principal: '', enfriamiento: '',
                dieta: '---', carbos: 0, protes: 0, grasas: 0, nutricion: ''
            };
            
            const lesionesActuales = storage.leerArchivoTexto(config.RUTAS.LESIONES, 'Ninguna lesión activa.');
            const memoriaActual = storage.leerArchivoTexto(config.RUTAS.MEMORIA, 'Preparación base.');

            const htmlFinal = dashboardView.generarHTML(
                context.datos, context.retroGenerada, iaData, memoriaActual, 
                lesionesActuales, historial, porcentajePlan, config.NOMBRE_ATLETA, !context.iaGenerada,
                config.LOCAL_IP, config.PUERTO_SERVIDOR
            );
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            return res.end(htmlFinal);
        }

        if (req.method === 'POST' && req.url === '/generate-ia') {
            console.log('[A.R.G.O.S.] Solicitud de prescripción manual recibida...');
            const lesionesActuales = storage.leerArchivoTexto(config.RUTAS.LESIONES, 'Ninguna lesión activa.');
            const memoriaActual = storage.leerArchivoTexto(config.RUTAS.MEMORIA, 'Preparación base.');
            let historial = storage.leerBitacora();

            context.iaGenerada = await geminiService.obtenerEntrenamiento(
                config.GEMINI_API_KEY, memoriaActual, lesionesActuales, historial, 
                context.datos, context.intencionHoy, config.NOMBRE_ATLETA
            );

            storage.guardarCacheJSON(config.RUTAS.IA_CACHE, context.datos.hoy, context.iaGenerada);

            const idxHoy = historial.findIndex(h => h.fecha === context.datos.hoy);
            if (idxHoy === -1) historial.push({ fecha: context.datos.hoy, resumen: context.iaGenerada.resumen, cumplido: false });
            else historial[idxHoy].resumen = context.iaGenerada.resumen;
            
            if (historial.length > config.MAX_HISTORIAL_DIAS) historial.shift();
            storage.guardarBitacora(historial);

            return httpUtils.respuestaJSON(res, 200, { success: true });
        }

        if (req.method === 'POST' && req.url === '/update-tick') {
            const { fecha, cumplido } = await httpUtils.leerBody(req);
            if (!validation.validarFecha(fecha) || typeof cumplido !== 'boolean') return httpUtils.respuestaJSON(res, 400, { error: 'Datos inválidos' });
            const bitacora = storage.leerBitacora();
            const idx = bitacora.findIndex(i => i.fecha === fecha);
            if (idx !== -1) { bitacora[idx].cumplido = cumplido; storage.guardarBitacora(bitacora); }
            return httpUtils.respuestaJSON(res, 200, { success: true });
        }

        if (req.method === 'POST' && req.url === '/update-sensaciones') {
            const body = await httpUtils.leerBody(req);
            body.rpe   = parseInt(body.rpe, 10);
            body.dolor = parseInt(body.dolor, 10);
            body.comentario = String(body.comentario ?? '').slice(0, config.MAX_CHARS_COMENTARIO);

            if (!validation.validarSensaciones(body)) return httpUtils.respuestaJSON(res, 400, { error: 'Datos inválidos' });
            
            const bitacora = storage.leerBitacora();
            const idx = bitacora.findIndex(i => i.fecha === body.fecha);
            
            if (idx !== -1) {
                bitacora[idx] = { ...bitacora[idx], rpe: body.rpe, dolor: body.dolor, comentario: body.comentario };
            } else {
                bitacora.push({ fecha: body.fecha, resumen: 'Actividad Libre', cumplido: true, rpe: body.rpe, dolor: body.dolor, comentario: body.comentario });
                bitacora.sort((a,b) => a.fecha.localeCompare(b.fecha));
                if (bitacora.length > config.MAX_HISTORIAL_DIAS) bitacora.shift();
            }
            storage.guardarBitacora(bitacora);
            return httpUtils.respuestaJSON(res, 200, { success: true });
        }

        if (req.method === 'POST' && req.url === '/update-lesiones') {
            const { lesiones } = await httpUtils.leerBody(req);
            if (typeof lesiones !== 'string') return httpUtils.respuestaJSON(res, 400, { error: 'Payload inválido' });
            storage.escribirArchivoTexto(config.RUTAS.LESIONES, lesiones.slice(0, config.MAX_CHARS_LESIONES));
            return httpUtils.respuestaJSON(res, 200, { success: true });
        }

        if (req.method === 'POST' && req.url === '/analyze-food') {
            const { imagenes, dieta, notas, caloriasObjetivo, bmr } = await httpUtils.leerBody(req);
            
            if (!imagenes || imagenes.length === 0 || !dieta) return httpUtils.respuestaJSON(res, 400, { error: 'Faltan parámetros' });

            const resultado = await geminiService.analizarComida(
                config.GEMINI_API_KEY, imagenes, dieta, notas, caloriasObjetivo, bmr, config.NOMBRE_ATLETA
            );
            
            // --- NUEVO: Guardar copia de seguridad en el disco duro antes de limpiar la RAM ---
            if (resultado.kcal !== 'Error') {
                storage.guardarRegistroComida(imagenes, resultado, { dieta, notas, caloriasObjetivo, bmr });
            }
            
            config.MOBILE_UPLOADS = { entrante: null, primero: null, segundo: null, postre: null };
            
            return httpUtils.respuestaJSON(res, 200, resultado);
        }

        httpUtils.respuestaJSON(res, 404, { error: 'Ruta no encontrada' });
    } catch (err) {
        console.error('[Router] Error:', err.message);
        httpUtils.respuestaJSON(res, 500, { error: 'Error interno' });
    }
}

module.exports = { handleRequest };