function validarSensaciones({ fecha, rpe, dolor, comentario }) {
    if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
    if (!Number.isInteger(rpe)   || rpe   < 1 || rpe   > 10) return false;
    if (!Number.isInteger(dolor) || dolor < 1 || dolor > 10) return false;
    if (typeof comentario !== 'string') return false;
    return true;
}

function validarFecha(fecha) { 
    return typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha); 
}

module.exports = { validarSensaciones, validarFecha };