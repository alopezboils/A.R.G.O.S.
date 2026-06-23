const os = require('os');

// Esta función rastrea tu router para encontrar la IP de tu ordenador
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
}

module.exports = {
    ATHLETE_ID:         'ATHLETE_ID',
    INTERVALS_API_KEY:  'API_KEY',
    GEMINI_API_KEY:     'API_KEY',
    NOMBRE_ATLETA:      'Atleta',
    PUERTO_SERVIDOR:    3000,
    LOCAL_IP:           getLocalIP(), // <-- Nueva variable de red
    MAX_HISTORIAL_DIAS: 14,
    MAX_CHARS_LESIONES: 2000,
    MAX_CHARS_COMENTARIO: 500,
    RUTAS: {
        MEMORIA: 'memoria.txt',
        LESIONES: 'lesiones.txt',
        BITACORA: 'bitacora.json',
        IA_CACHE: 'ia_cache.json',
        RETRO_CACHE: 'retro_cache.json'
        COMIDAS: 'historial_comidas' // <-- El nuevo almacén fotográfico
    },
    INTENCION_HOY: '',
    
    // Aquí el servidor guardará temporalmente las fotos que lleguen de tu móvil
    MOBILE_UPLOADS: { entrante: null, primero: null, segundo: null, postre: null } 
};