// utils/http.js

function leerBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
            // Límite táctico ampliado a 50MB para soportar el escaneo de 4 fotos simultáneas
            if (body.length > 52428800) { req.destroy(); reject(new Error('Payload demasiado grande')); }
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

module.exports = { leerBody, respuestaJSON };