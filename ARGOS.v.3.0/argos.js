// argos.js - Núcleo Maestro Nativo Modular
'use strict';

const http = require('http');
const readline = require('readline');
const { exec } = require('child_process');

const config = require('./config');
const storage = require('./utils/storage');
const router = require('./router');
const intervalsService = require('./services/intervals.service');
const geminiService = require('./services/gemini.service');

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
        let memoriaAtleta = storage.leerArchivoTexto(config.RUTAS.MEMORIA, 'Preparación base.');
        
        const nuevoObjetivo = await preguntarObjetivo(memoriaAtleta);
        if (nuevoObjetivo) {
            storage.escribirArchivoTexto(config.RUTAS.MEMORIA, nuevoObjetivo);
            memoriaAtleta = nuevoObjetivo;
        }

        const intencionHoy = await preguntarIntencionDia();

        console.log('\n[1/3] Extrayendo telemetría vital de Intervals.icu...');
        const datos = await intervalsService.extraerMetricas(config.ATHLETE_ID, config.INTERVALS_API_KEY);
        
        console.log('[2/3] Auditando misiones pasadas de forma automática...');
        let retroGenerada = storage.leerCacheJSON(config.RUTAS.RETRO_CACHE, datos.hoy);
        if (!retroGenerada) {
            retroGenerada = await geminiService.obtenerAnalisisRetrospectivo(config.GEMINI_API_KEY, datos, config.NOMBRE_ATLETA);
            storage.guardarCacheJSON(config.RUTAS.RETRO_CACHE, datos.hoy, retroGenerada);
        }

        let iaGenerada = storage.leerCacheJSON(config.RUTAS.IA_CACHE, datos.hoy);
        if (iaGenerada) console.log('[!] Prescripción de hoy recuperada de la caché local.');

        console.log('[3/3] Compilando el Panel de Control...');

        const context = {
            datos,
            intencionHoy,
            retroGenerada,
            iaGenerada
        };

        const server = http.createServer((req, res) => router.handleRequest(req, res, context));

        server.listen(config.PUERTO_SERVIDOR, () => {
            const url = `http://localhost:${config.PUERTO_SERVIDOR}`;
            console.log(`\n✓ A.R.G.O.S. TACTICAL ENGINE ONLINE -> ${url}`);
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