// views/dashboard.view.js

'use strict';

function calcularPlato(estadoIntensidad) {
    if (estadoIntensidad.includes('ALTA INTENSIDAD')) return { granos: '50%', vegetales: '25%', proteina: '25%', nombre: 'DÍA DE ALTA INTENSIDAD', color: 'var(--primary)' };
    if (estadoIntensidad.includes('BASE AERÓBICA') || estadoIntensidad.includes('MODERADO')) return { granos: '33%', vegetales: '33%', proteina: '33%', nombre: 'DÍA MODERADO / BASE', color: '#ff8800' };
    return { granos: '25%', vegetales: '50%', proteina: '25%', nombre: 'REGENERATIVO / DESCARGA', color: '#8fb3c2' };
}

function calcularPorcentajesMacros(ia) {
    const carbos = parseInt(ia.carbos) || 0, protes = parseInt(ia.protes) || 0, grasas = parseInt(ia.grasas) || 0;
    const maxVal = Math.max(carbos, protes, grasas, 1);
    return { pctCarbos: (carbos / maxVal) * 100, pctProtes: (protes / maxVal) * 100, pctGrasas: (grasas / maxVal) * 100 };
}

function renderBitacora(historialIA, resumenActividades, hoy) {
    const fechasSet = new Set([hoy, ...Object.keys(resumenActividades), ...historialIA.map(h => h.fecha)]);
    const fechasOrdenadas = Array.from(fechasSet).sort().reverse().slice(0, 14);

    return fechasOrdenadas.map(fecha => {
        const itemIA = historialIA.find(h => h.fecha === fecha) || {};
        const actividadReal = resumenActividades[fecha] ?? '<span style="color:#505050">SIN REGISTRO</span>';
        const checked = itemIA.cumplido ? 'checked' : '';
        const resumen = itemIA.resumen && itemIA.resumen !== 'No generada' ? itemIA.resumen : '<span style="color:#888; font-style:italic;">LIBRE / SIN IA</span>';
        
        return '<div class="bitacora-row"><div class="bitacora-cell date-cell">' + fecha.slice(5) + '</div><div class="bitacora-cell real-cell">' + actividadReal + '</div><div class="bitacora-cell ia-cell"><label style="cursor:pointer; display:flex; align-items:center; gap:6px;"><input type="checkbox" class="ia-checkbox" data-fecha="' + fecha + '" ' + checked + '><span>' + resumen + '</span></label></div></div>';
    }).join('');
}

function renderSensaciones(historialIA, resumenActividades, hoy) {
    const fechasSet = new Set([hoy, ...Object.keys(resumenActividades), ...historialIA.map(h => h.fecha)]);
    const fechasOrdenadas = Array.from(fechasSet).sort().reverse().slice(0, 14);

    return fechasOrdenadas.map(fecha => {
        const itemIA = historialIA.find(h => h.fecha === fecha) || {};
        const rpe = itemIA.rpe ?? 5, dolor = itemIA.dolor ?? 1, comentario = itemIA.comentario ?? '';
        let descripcion = '';
        if (resumenActividades[fecha]) descripcion = 'REAL: ' + resumenActividades[fecha].toUpperCase();
        else if (itemIA.resumen && itemIA.resumen !== 'No generada' && itemIA.resumen !== 'Actividad Libre') descripcion = 'PRESCRIPCIÓN: ' + itemIA.resumen.toUpperCase();
        else descripcion = 'DESCANSO / SIN ACTIVIDAD REGISTRADA';

        return '<div class="bloque-entrenamiento sensacion-card"><div class="sensacion-header"><h4 class="sensacion-titulo">REGISTRO: ' + fecha + '</h4><span class="sensacion-resumen">' + descripcion + '</span></div><div class="sensacion-sliders"><div><div class="slider-row"><label class="slider-label">ESFUERZO PERCIBIDO (RPE)</label><span id="val-rpe-' + fecha + '" class="slider-val rpe-val">' + rpe + '/10</span></div><input type="range" min="1" max="10" value="' + rpe + '" class="slider-sensacion" data-tipo="rpe" data-fecha="' + fecha + '"></div><div><div class="slider-row"><label class="slider-label">NIVEL DE DOLOR MUSCULAR</label><span id="val-dolor-' + fecha + '" class="slider-val dolor-val">' + dolor + '/10</span></div><input type="range" min="1" max="10" value="' + dolor + '" class="slider-sensacion" data-tipo="dolor" data-fecha="' + fecha + '"></div></div><div class="sensacion-notas"><label class="slider-label">ANOTACIONES</label><textarea class="textarea-comentario" data-fecha="' + fecha + '" placeholder="Ingresa estado muscular o sensaciones..." rows="2">' + comentario + '</textarea></div></div>';
    }).join('');
}

function generarHTML(datos, retroIA, ia, memoria, lesiones, historialIA, porcentajePlan, nombreAtleta = 'Atleta', pendingIA = false, localIp = 'localhost', puerto = 3000) {
    const plato = calcularPlato(datos.estadoIntensidad);
    const bitacoraHTML = renderBitacora(historialIA, datos.resumenActividades, datos.hoy);
    const sensacionesHTML = renderSensaciones(historialIA, datos.resumenActividades, datos.hoy);
    const chartLabels = JSON.stringify(datos.chartLabels), chartHRV = JSON.stringify(datos.chartHRV), chartRHR = JSON.stringify(datos.chartRHR), chartFitness = JSON.stringify(datos.chartFitness), chartCargaTrabajo = JSON.stringify(datos.chartCargaTrabajo);

    const boxSemana = (titulo, sem, isActual) => '<div class="box-summary box-multisport" style="border-left-color: ' + (isActual ? 'var(--primary)' : '#555') + ';"><div class="multisport-title" style="color: ' + (isActual ? 'var(--primary)' : '#888') + ';">' + titulo + ' <span style="float:right; color:#555;">SEMANA ' + sem.numSemana + '</span></div><div class="multisport-row"><span class="ms-label">🏃 Carrera:</span> <span class="ms-val">' + sem.runTime + ' <span style="color:#555;">|</span> ' + sem.runKm + ' km</span></div><div class="multisport-row"><span class="ms-label">🚴 Ciclismo:</span> <span class="ms-val">' + sem.rideTime + ' <span style="color:#555;">|</span> ' + sem.rideKm + ' km</span></div><div class="multisport-row"><span class="ms-label">🏊 Natación:</span> <span class="ms-val">' + sem.swimTime + ' <span style="color:#555;">|</span> ' + sem.swimKm + ' km</span></div><div class="multisport-row"><span class="ms-label">🏋️ Fuerza:</span> <span class="ms-val">' + sem.strengthTime + '</span></div><div class="multisport-row" style="margin-top:6px; border-top:1px solid #222; padding-top:6px;"><span class="ms-label" style="color:#ff8800;">🔥 Kcal Activas:</span> <span class="ms-val" style="color:#ff8800;">' + sem.kcal + '</span></div><div class="multisport-row"><span class="ms-label" style="color:var(--primary);">📈 Carga Impacto:</span> <span class="ms-val" style="color:var(--primary);">' + sem.carga + '</span></div></div>';

    const analisisHtml = '<h4 style="color:#ff8800; border-bottom:1px solid var(--primary-dark); padding-bottom:4px; margin-bottom:8px; margin-top:0; font-size:12px; letter-spacing:1px; text-transform:uppercase;">Evaluación de la Última Misión</h4><p style="margin-bottom:16px;">' + retroIA.analisisRetrospectivo + '</p><h4 style="color:var(--primary); border-bottom:1px solid var(--primary-dark); padding-bottom:4px; margin-bottom:8px; font-size:12px; letter-spacing:1px; text-transform:uppercase;">Justificación de Nueva Prescripción</h4>' + (pendingIA ? '<p style="color:#888; font-style:italic;">Sistema IA en reposo. Esperando solicitud manual.</p>' : '<p>' + ia.analisisPrescripcion + '</p>');

    const entrenamientoHtml = pendingIA ? '<button id="btn-generar-ia" class="file-upload-btn" style="width:100%; padding:15px; margin-top:10px; font-size:14px; background:var(--primary); color:#fff;">⚡ SOLICITAR ENTRENAMIENTO DE HOY</button><div id="ia-loading" style="display:none; color:#ff8800; text-align:center; padding:20px; font-family:\'Consolas\', monospace; font-weight:bold; letter-spacing:2px; font-size:12px;">CONECTANDO IA... ESPERE.</div>' : '<div class="seccion-ruta"><div class="tag-ruta">Calentamiento</div>' + ia.calentamiento + '</div><div class="seccion-ruta"><div class="tag-ruta">Principal</div>' + ia.principal + '</div><div class="seccion-ruta"><div class="tag-ruta">Enfriamiento</div>' + ia.enfriamiento + '</div>';

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>A.R.G.O.S. | Panel de Rendimiento</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root { --primary: #ff2a2a; --primary-hover: #ff5555; --primary-dark: #330000; --primary-rgb: 255, 42, 42; }
        *, *::before, *::after { box-sizing: border-box; }
        body { font-family: 'Consolas', 'Segoe UI', monospace; background-color: #030303; color: #dcdcdc; margin: 0; padding: 25px; display: flex; justify-content: center; }
        .container { max-width: 1200px; width: 100%; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid var(--primary); padding-bottom: 12px; position: relative; }
        .header h1 { color: var(--primary); margin: 0 0 4px; letter-spacing: 8px; font-size: 38px; text-transform: uppercase; text-shadow: 0 0 10px rgba(var(--primary-rgb), 0.4); }
        .header-sub { font-size: 13px; color: #888; letter-spacing: 3px; text-transform: uppercase; }
        .memoria-box { background: rgba(var(--primary-rgb), 0.05); border: 1px solid var(--primary); border-radius: 2px; padding: 14px 20px; margin-bottom: 20px; text-align: center; font-size: 15px; font-weight: bold; color: var(--primary-hover); text-transform: uppercase; letter-spacing: 1px;}
        .tabs { display: flex; gap: 0; margin-bottom: 25px; border-bottom: 2px solid #1a1a1a; }
        .tab-btn { background: #0a0a0a; border: 1px solid #1a1a1a; border-bottom: none; color: #666; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; cursor: pointer; padding: 12px 20px; transition: all 0.2s; margin-right: 4px; border-radius: 2px 2px 0 0;}
        .tab-btn:hover { color: #fff; background: #111; }
        .tab-btn.active { color: #000; background: var(--primary); border-color: var(--primary); text-shadow: none;}
        .tab-content { display: none; }
        .tab-content.active { display: block; animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .grid-avanzado { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }
        .card-avanzada { background: #080808; border: 1px solid var(--primary-dark); border-left: 3px solid var(--primary); border-radius: 0; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; min-height: 90px; }
        .card-title-avz { font-size: 11px; color: #777; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; margin-bottom: 10px; }
        .card-desc-avz { font-size: 15px; font-weight: bold; line-height: 1.5; font-family: 'Segoe UI', sans-serif;}
        .progress-bar-container { background: #111; border: 1px solid var(--primary-dark); border-radius: 0; height: 12px; margin-top: 10px; width: 100%; overflow: hidden; }
        .progress-bar-fill { background: linear-gradient(90deg, var(--primary-dark), var(--primary)); height: 100%; border-radius: 0; transition: width 0.6s ease; width: ${porcentajePlan}%; }
        .ticker-container { display: flex; justify-content: space-around; background: #000; padding: 10px 8px; border-radius: 0; border: 1px solid #222; }
        .ticker-item { font-size: 14px; text-align: center; }
        .ticker-label { font-size: 10px; color: #777; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 1px;}
        .grid-resumen { display: grid; grid-template-columns: 1.5fr 1.5fr 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        .box-summary { background: #080808; border: 1px solid #222; border-radius: 0; padding: 14px 16px; text-align: center; display: flex; flex-direction: column; justify-content: center;}
        .box-multisport { text-align: left; align-items: stretch; }
        .multisport-title { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid var(--primary-dark); padding-bottom: 4px;}
        .multisport-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; font-family: 'Segoe UI', sans-serif; font-weight: 600;}
        .ms-label { color: #888; }
        .ms-val { color: #eee; }
        .box-val { font-size: 24px; font-weight: bold; color: #fff; font-family: 'Segoe UI', sans-serif;}
        .box-lbl { font-size: 10px; color: #777; text-transform: uppercase; letter-spacing: 1px; margin-top: 6px; }
        .grid-charts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 20px; }
        .chart-container { background: #080808; border: 1px solid #222; border-radius: 0; padding: 16px; height: 230px; position: relative; }
        .chart-title { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px; font-weight: bold; }
        .chart-canvas-wrapper { height: 185px; }
        .panel-inferior { display: grid; grid-template-columns: 340px 1fr 1fr; gap: 20px; }
        .bloque-historial, .bloque-entrenamiento, .bloque-nutricion, .bloque-obiwan { background: #080808; border: 1px solid #222; border-radius: 0; padding: 16px; margin-bottom: 0; }
        .bloque-historial h3, .bloque-entrenamiento h3, .bloque-nutricion h3 { color: #555; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #222; padding-bottom: 8px; margin: 0 0 12px; }
        .bitacora-grid { display: flex; flex-direction: column; gap: 6px; }
        .bitacora-header { display: grid; grid-template-columns: 42px 1fr 1fr; gap: 5px; font-size: 10px; color: #777; text-transform: uppercase; font-weight: bold; padding-bottom: 5px; border-bottom: 1px solid #222; letter-spacing: 1px;}
        .bitacora-row { display: grid; grid-template-columns: 42px 1fr 1fr; gap: 5px; }
        .bitacora-cell { background: #000; padding: 7px 8px; border-radius: 0; font-size: 12px; display: flex; align-items: center; border: 1px solid #111; font-family: 'Segoe UI', sans-serif;}
        .date-cell  { color: #888; font-weight: bold; justify-content: center; font-family: 'Consolas', monospace; font-size: 10px;}
        .real-cell  { border-left: 2px solid #56d364; color: #ddd; }
        .ia-cell    { border-left: 2px solid var(--primary); color: var(--primary-hover); }
        input[type="checkbox"] { margin-right: 0; accent-color: var(--primary); transform: scale(1.15); flex-shrink: 0; cursor: pointer;}
        .bloque-obiwan { background: #050000; border-color: var(--primary); box-shadow: inset 0 0 20px rgba(var(--primary-rgb), 0.05); }
        .bloque-obiwan h3 { color: var(--primary); border-color: var(--primary); }
        .bloque-obiwan p  { line-height: 1.65; font-size: 14px; margin: 0; color: #ccc; white-space: pre-wrap; font-family: 'Segoe UI', sans-serif;}
        .seccion-ruta { background: #000; padding: 12px 14px; border-radius: 0; margin-bottom: 10px; border-left: 4px solid var(--primary); font-size: 14px; line-height: 1.55; white-space: pre-wrap; font-family: 'Segoe UI', sans-serif; border-right: 1px solid #111; border-top: 1px solid #111; border-bottom: 1px solid #111;}
        .tag-ruta { font-weight: bold; font-size: 10px; color: var(--primary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
        .plate-container { display: flex; flex-direction: column; align-items: center; padding: 20px; background: #000; border-radius: 0; border: 1px solid #222; margin-top: 16px; }
        .plate-title { font-size: 18px; font-weight: bold; margin-bottom: 16px; letter-spacing: 2px;}
        .plate-stats { display: flex; gap: 24px; }
        .plate-stat { text-align: center; }
        .plate-stat-val { font-size: 28px; font-weight: bold; font-family: 'Consolas', monospace;}
        .plate-stat-lbl { font-size: 10px; color: #777; text-transform: uppercase; margin-top: 5px; letter-spacing: 1px;}
        .sensacion-card { margin-bottom: 14px; background: #080808 !important; border-color: #222 !important; border-left: 3px solid #555 !important;}
        .sensacion-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #222; padding-bottom: 10px; margin-bottom: 14px; gap: 12px; }
        .sensacion-titulo { margin: 0; color: var(--primary); font-size: 14px; white-space: nowrap; letter-spacing: 1px;}
        .sensacion-resumen { font-size: 10px; color: #aaa; background: #000; padding: 4px 9px; border-radius: 0; border: 1px solid #222; text-align: right; text-transform: uppercase; letter-spacing: 1px;}
        .sensacion-sliders { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .slider-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
        .slider-label { font-size: 11px; color: #aaa; font-weight: bold; letter-spacing: 1px; }
        .slider-val { font-weight: bold; font-size: 14px; font-family: 'Consolas', monospace;}
        .rpe-val   { color: #ff8800; }
        .dolor-val { color: var(--primary); }
        .sensacion-notas { margin-top: 14px; }
        .slider-sensacion { -webkit-appearance: none; appearance: none; width: 100%; height: 4px; background: #333; outline: none; cursor: pointer; border-radius: 0;}
        .slider-sensacion::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 24px; background: var(--primary); cursor: pointer; transition: background 0.15s; border-radius: 0; border: 1px solid #000;}
        .slider-sensacion::-webkit-slider-thumb:hover { background: var(--primary-hover); }
        .textarea-comentario, .textarea-lesiones { width: 100%; background: #000; border: 1px solid #333; color: #ccc; padding: 12px; border-radius: 0; margin-top: 6px; resize: vertical; font-family: 'Segoe UI', sans-serif; font-size: 13px; line-height: 1.5; }
        .textarea-comentario:focus, .textarea-lesiones:focus { outline: none; border-color: var(--primary); }
        .textarea-lesiones { color: var(--primary); font-weight: bold; border-color: var(--primary-dark); }
        .textarea-lesiones:focus { background: #0a0000;}
        .panel-lesiones { background: #0a0000; border: 1px solid var(--primary); border-radius: 0; padding: 20px; margin-bottom: 28px; box-shadow: 0 0 15px rgba(var(--primary-rgb), 0.1);}
        .panel-lesiones h3 { color: var(--primary); margin: 0 0 8px; border-bottom: 1px solid var(--primary-dark); padding-bottom: 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; }
        .panel-lesiones p { font-size: 12px; color: #999; margin: 0 0 14px; font-family: 'Segoe UI', sans-serif;}
        .select-dieta { width: 100%; padding: 10px; background: #000; color: #fff; border: 1px solid #333; font-family: 'Consolas', monospace; font-size: 14px; margin-bottom: 15px;}
        .select-dieta:focus { outline: none; border-color: #ff8800; }
        .file-upload-btn { display: inline-block; padding: 10px 20px; background: #ff8800; color: #000; font-weight: bold; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; border: none; font-family: 'Consolas', monospace; margin-bottom: 10px; transition: background 0.2s;}
        .file-upload-btn:hover { background: #ffa64d; }
        .btn-analizar { width: 100%; padding: 14px; background: var(--primary); color: #000; font-weight: bold; font-size: 16px; cursor: pointer; text-transform: uppercase; letter-spacing: 2px; border: none; font-family: 'Consolas', monospace; margin-top: 15px; transition: background 0.2s;}
        .btn-analizar:hover { background: var(--primary-hover); }
        .btn-analizar:disabled { background: #555; cursor: not-allowed; color: #888;}
        #loading-overlay { display: none; text-align: center; color: #ff8800; padding: 20px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;}
        .cuadrante-fotos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px; margin-bottom: 15px; }
        .caja-foto { background: #0a0a0a; border: 1px solid #222; padding: 12px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100px; }
        .caja-foto-titulo { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-weight: bold; }
        .miniatura-foto { display: none; width: 100%; height: 80px; object-fit: cover; border: 1px solid #333; margin-top: 8px; border-radius: 2px; }
        .qr-box { background: #0a0a0a; border: 1px solid #222; padding: 15px; text-align: center; margin-bottom: 20px; }
        .qr-box h4 { color: #ff8800; margin-top: 0; margin-bottom: 5px; letter-spacing: 1px; text-transform: uppercase; }
        .qr-box p { font-size: 12px; color: #888; margin-top: 0; margin-bottom: 15px; }
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <div style="position: absolute; top: 0; right: 0; display: flex; align-items: center; gap: 10px;">
            <label style="font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Color de Tema</label>
            <input type="color" id="theme-color-picker" value="#ff2a2a" style="background: none; border: none; cursor: pointer; height: 25px; width: 25px; padding: 0;">
        </div>
        <h1>A.R.G.O.S.</h1>
        <div class="header-sub">DASHBOARD DE RENDIMIENTO // ${datos.hoy} // ${nombreAtleta}</div>
    </div>
    <div class="memoria-box">${memoria}</div>
    <div class="tabs">
        <button class="tab-btn active" onclick="openTab('tab-mando')">Panel Principal</button>
        <button class="tab-btn"        onclick="openTab('tab-nutricion')">Auditoría Nutricional</button>
        <button class="tab-btn"        onclick="openTab('tab-sensaciones')">Registro Médico</button>
    </div>
    <div id="tab-mando" class="tab-content active">
        <div class="grid-avanzado">
            <div class="card-avanzada"><div class="card-title-avz">Disposición Fisiológica</div><div class="card-desc-avz" style="color:${datos.colorIntensidad}">${datos.estadoIntensidad}</div></div>
            <div class="card-avanzada"><div class="card-title-avz">Equilibrio de Carga</div><div class="card-desc-avz" style="color:${datos.colorFatiga}">${datos.zonaFatiga}<br><small style="color:#666; font-weight:normal; font-family:'Consolas',monospace;">TSB: ${datos.latestForm}</small></div></div>
            <div class="card-avanzada"><div class="card-title-avz">Progreso Semanal</div><div class="card-desc-avz" style="color:var(--primary); font-family:'Consolas',monospace;">${porcentajePlan}% COMPLETADO<div class="progress-bar-container"><div class="progress-bar-fill"></div></div></div></div>
            <div class="card-avanzada"><div class="card-title-avz">Motor Cardiovascular</div><div class="ticker-container"><div class="ticker-item"><div class="ticker-label">HRV</div><div>${datos.hrvTicker}</div></div><div class="ticker-item"><div class="ticker-label">RHR</div><div>${datos.rhrTicker}</div></div></div></div>
        </div>
        <div class="grid-resumen">
            ${boxSemana('Semana Anterior', datos.semAnterior, false)}
            ${boxSemana('Semana Actual', datos.semActual, true)}
            <div class="box-summary"><div class="box-val">${datos.cardHRV} ms</div><div class="box-lbl">HRV Actual</div></div>
            <div class="box-summary"><div class="box-val">${datos.cardRHR} bpm</div><div class="box-lbl">Pulso Reposo</div></div>
        </div>
        <div class="grid-charts">
            <div class="chart-container"><div class="chart-title">Fisiología — HRV & Pulso</div><div class="chart-canvas-wrapper"><canvas id="canvasFisiologia"></canvas></div></div>
            <div class="chart-container"><div class="chart-title">Carga — Fitness Base & Impacto</div><div class="chart-canvas-wrapper"><canvas id="canvasEsfuerzo"></canvas></div></div>
        </div>
        <div class="panel-inferior">
            <div class="bloque-historial"><h3 style="color:var(--primary); border-color:var(--primary-dark);">Historial de Entrenamientos</h3><div class="bitacora-grid"><div class="bitacora-header"><div>Día</div><div>Completado</div><div>Prescripción</div></div>${bitacoraHTML}</div></div>
            <div class="bloque-obiwan"><h3>Análisis del Entrenador</h3>${analisisHtml}</div>
            <div class="bloque-entrenamiento"><h3 style="color:#fff;">Sesión Prescrita</h3>${entrenamientoHtml}</div>
        </div>
    </div>
    
    <div id="tab-nutricion" class="tab-content">
        <div class="bloque-nutricion" style="margin-bottom: 20px;">
            <h3 style="color:#fff;">Perfil Metabólico (Ecuación Mifflin-St Jeor)</h3>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px;">
                <div><label class="slider-label">GÉNERO</label><select id="calc-genero" class="select-dieta" style="margin-bottom:0; padding:8px;"><option value="M">Hombre</option><option value="F">Mujer</option></select></div>
                <div><label class="slider-label">EDAD (Años)</label><input type="number" id="calc-edad" class="select-dieta" style="margin-bottom:0; padding:8px;" value="30"></div>
                <div><label class="slider-label">PESO (Kg)</label><input type="number" id="calc-peso" class="select-dieta" style="margin-bottom:0; padding:8px;" value="75"></div>
                <div><label class="slider-label">ALTURA (cm)</label><input type="number" id="calc-altura" class="select-dieta" style="margin-bottom:0; padding:8px;" value="175"></div>
            </div>
            <div style="display:flex; justify-content: space-around; background: #000; padding: 15px; border: 1px solid #222;">
                <div style="text-align:center;"><div style="font-size:10px; color:#777; text-transform:uppercase; letter-spacing:1px;">Metabolismo Basal (BMR)</div><div id="res-bmr" style="font-size:24px; font-weight:bold; color:#8fb3c2; font-family:'Consolas', monospace;">--- kcal</div></div>
                <div style="text-align:center;"><div style="font-size:10px; color:#777; text-transform:uppercase; letter-spacing:1px;">Mantenimiento (Sedentario)</div><div id="res-tdee" style="font-size:24px; font-weight:bold; color:#56d364; font-family:'Consolas', monospace;">--- kcal</div></div>
            </div>
        </div>

        <div class="grid-resumen" style="grid-template-columns: 1fr 1fr;">
            <div class="box-summary" style="border-color:#ff8800;"><div class="box-val" style="color:#ff8800">${datos.avgCalorias} kcal</div><div class="box-lbl">Referencia: Gasto Activo Promedio</div></div>
            <div class="box-summary"><div class="box-val" style="color:#fff">El Plato del Atleta</div><div class="box-lbl">Guía Visual Estándar</div></div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1.5fr; gap:20px;">
            
            <div class="bloque-nutricion">
                <h3 style="color:#fff;">Carga Múltiple de Ingesta</h3>
                
                <div class="qr-box">
                    <h4>Enlace Táctico Móvil</h4>
                    <p>Escanea este código con la cámara de tu móvil para subir las fotos directamente (requiere misma WiFi).</p>
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=http://${localIp}:${puerto}/mobile&color=ff2a2a&bgcolor=000000" style="border:1px solid #ff2a2a; border-radius:4px; margin-bottom:10px;">
                </div>

                <label style="font-size:11px; color:#888; text-transform:uppercase; letter-spacing:1px; display:block; margin-bottom:5px;">Estrategia Nutricional Preferida</label>
                <select id="selector-dieta" class="select-dieta"><option value="Alta en Carbohidratos">Alta en Carbohidratos</option><option value="Alta en Proteínas">Alta en Proteínas</option><option value="Cetogénica (Keto)">Cetogénica / Baja en Carbohidratos</option><option value="Ayuno Intermitente">Ayuno Intermitente</option><option value="Equilibrada">Equilibrada Padrón</option></select>
                
                <div class="cuadrante-fotos">
                    <div class="caja-foto">
                        <span class="caja-foto-titulo">Entrante</span>
                        <label class="file-upload-btn" style="font-size:10px; padding:6px 12px; margin:0; width:auto;"><input type="file" id="input-foto-entrante" accept="image/*" style="display:none;">📷 SUBIR (PC)</label>
                        <img id="preview-img-entrante" class="miniatura-foto">
                    </div>
                    <div class="caja-foto">
                        <span class="caja-foto-titulo">Primer Plato</span>
                        <label class="file-upload-btn" style="font-size:10px; padding:6px 12px; margin:0; width:auto;"><input type="file" id="input-foto-primero" accept="image/*" style="display:none;">📷 SUBIR (PC)</label>
                        <img id="preview-img-primero" class="miniatura-foto">
                    </div>
                    <div class="caja-foto">
                        <span class="caja-foto-titulo">Segundo Plato</span>
                        <label class="file-upload-btn" style="font-size:10px; padding:6px 12px; margin:0; width:auto;"><input type="file" id="input-foto-segundo" accept="image/*" style="display:none;">📷 SUBIR (PC)</label>
                        <img id="preview-img-segundo" class="miniatura-foto">
                    </div>
                    <div class="caja-foto">
                        <span class="caja-foto-titulo">Postre</span>
                        <label class="file-upload-btn" style="font-size:10px; padding:6px 12px; margin:0; width:auto;"><input type="file" id="input-foto-postre" accept="image/*" style="display:none;">📷 SUBIR (PC)</label>
                        <img id="preview-img-postre" class="miniatura-foto">
                    </div>
                </div>

                <label style="font-size:11px; color:#888; text-transform:uppercase; letter-spacing:1px; display:block; margin-top:15px;">Ingredientes Ocultos o Notas Generales</label>
                <textarea id="texto-notas-comida" class="textarea-comentario" rows="2" placeholder="Ej: Aceite de oliva añadido a la ensalada..."></textarea>
                <button id="btn-analizar" class="btn-analizar" disabled>Iniciar Escáner Combinado</button>
            </div>
            
            <div class="bloque-nutricion" style="display:flex; flex-direction:column;">
                <h3 style="color:#fff;">Análisis Científico del Sistema</h3>
                <div id="loading-overlay">Analizando matriz de nutrientes combinados... Por favor espera.</div>
                <div id="resultados-analisis" style="display:none; font-family:'Segoe UI', sans-serif;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #330000; padding-bottom:10px; margin-bottom:15px;"><span style="font-family:'Consolas', monospace; color:#888; text-transform:uppercase; letter-spacing:1px; font-size:12px;">Carga Energética Global</span><span id="res-kcal" style="font-family:'Consolas', monospace; font-size:24px; font-weight:bold; color:#ff8800;">---</span></div>
                    <div style="font-family:'Consolas', monospace; color:#888; text-transform:uppercase; letter-spacing:1px; font-size:12px; margin-bottom:8px;">Macronutrientes Estimados Totales</div><div id="res-macros" class="seccion-ruta" style="border-left-color:#8fb3c2; color:#fff; font-size:15px;">---</div>
                    <div style="font-family:'Consolas', monospace; color:#888; text-transform:uppercase; letter-spacing:1px; font-size:12px; margin-top:20px; margin-bottom:8px;">Evaluación Objetiva</div><div id="res-evaluacion" class="seccion-ruta" style="border-left-color:var(--primary); color:#ddd;">---</div>
                    <div style="font-family:'Consolas', monospace; color:#888; text-transform:uppercase; letter-spacing:1px; font-size:12px; margin-top:20px; margin-bottom:8px;">Recomendación de Ajuste</div><div id="res-recomendacion" class="seccion-ruta" style="border-left-color:#56d364; background:#051005; color:#ddd;">---</div>
                </div>
                <div id="guia-plato" style="margin-top:auto; margin-bottom:auto;"><div class="plate-container"><div class="plate-title" style="color:${plato.color}">${plato.nombre}</div><div class="plate-stats"><div class="plate-stat"><div class="plate-stat-val" style="color:#e3c57a">${plato.granos}</div><div class="plate-stat-lbl">Granos</div></div><div class="plate-stat"><div class="plate-stat-val" style="color:#8fb3c2">${plato.vegetales}</div><div class="plate-stat-lbl">Vegetales</div></div><div class="plate-stat"><div class="plate-stat-val" style="color:var(--primary);">${plato.proteina}</div><div class="plate-stat-lbl">Proteína</div></div></div></div></div>
            </div>
        </div>
        <div class="bloque-entrenamiento bloque-consejo" style="margin-top:20px; border-color:#331100;"><h3>Directiva Nutricional de la Misión</h3><div class="seccion-ruta" style="background:#050000; font-family:'Segoe UI', sans-serif;"><p style="margin:0; color:#ddd;">${ia.nutricion || '---'}</p></div></div>
    </div>
    
    <div id="tab-sensaciones" class="tab-content">
        <div style="max-width:820px; margin:0 auto;">
            <div class="panel-lesiones"><h3>REGISTRO DE LESIONES ACTIVAS</h3><p>El sistema evadirá el impacto en estas zonas. Mantén este registro hasta la total recuperación.</p><textarea id="texto-lesiones" class="textarea-lesiones" rows="3" placeholder="Ej: Molestia en rodilla derecha.">${lesiones}</textarea></div>
            <h2 style="color:#fff; font-size:16px; border-bottom:1px solid #222; padding-bottom:10px; margin-bottom:20px; text-transform:uppercase; letter-spacing:2px;">Historial de Desgaste (RPE)</h2>${sensacionesHTML}
        </div>
    </div>
</div>
<script>
    const colorPicker = document.getElementById('theme-color-picker');
    function hexToRgb(hex) { let r=0,g=0,b=0; if(hex.length===4){r=parseInt(hex[1]+hex[1],16);g=parseInt(hex[2]+hex[2],16);b=parseInt(hex[3]+hex[3],16);}else if(hex.length===7){r=parseInt(hex.substring(1,3),16);g=parseInt(hex.substring(3,5),16);b=parseInt(hex.substring(5,7),16);} return \`\${r}, \${g}, \${b}\`; }
    function adjustColor(hex, amount) { let color = hex.replace('#', ''); if (color.length === 3) color = color[0]+color[0]+color[1]+color[1]+color[2]+color[2]; let r = Math.max(0, Math.min(255, parseInt(color.substring(0, 2), 16) + amount)); let g = Math.max(0, Math.min(255, parseInt(color.substring(2, 4), 16) + amount)); let b = Math.max(0, Math.min(255, parseInt(color.substring(4, 6), 16) + amount)); return \`#\${r.toString(16).padStart(2, '0')}\${g.toString(16).padStart(2, '0')}\${b.toString(16).padStart(2, '0')}\`; }
    function setThemeColor(hex) { const root = document.documentElement; const rgb = hexToRgb(hex); root.style.setProperty('--primary', hex); root.style.setProperty('--primary-hover', adjustColor(hex, 40)); root.style.setProperty('--primary-dark', adjustColor(hex, -80)); root.style.setProperty('--primary-rgb', rgb); localStorage.setItem('argos_theme_color', hex); if (colorPicker) colorPicker.value = hex; Chart.instances.forEach(chart => { let updated = false; chart.data.datasets.forEach(ds => { if (ds._isPrimaryTheme || ds.borderColor === '#ff2a2a' || ds.borderColor === 'var(--primary)') { ds._isPrimaryTheme = true; ds.borderColor = hex; ds.backgroundColor = ds.type === 'bar' ? \`rgba(\${rgb}, 0.3)\` : \`rgba(\${rgb}, 0.1)\`; updated = true; } }); if (updated) { chart.options.plugins.tooltip.borderColor = hex; chart.options.plugins.tooltip.titleColor = hex; chart.update(); } }); }
    if (colorPicker) colorPicker.addEventListener('input', (e) => setThemeColor(e.target.value));
    const savedThemeColor = localStorage.getItem('argos_theme_color');
    if (savedThemeColor) setTimeout(() => setThemeColor(savedThemeColor), 50); else setTimeout(() => setThemeColor('#ff2a2a'), 50);

    function openTab(tabId) { document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active')); document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); document.getElementById(tabId).classList.add('active'); document.querySelector(\`[onclick="openTab('\${tabId}')"]\`).classList.add('active'); }
    
    // --- LÓGICA DE LA CALCULADORA BMR ---
    const calcGenero = document.getElementById('calc-genero');
    const calcEdad = document.getElementById('calc-edad');
    const calcPeso = document.getElementById('calc-peso');
    const calcAltura = document.getElementById('calc-altura');
    
    window.bmrCalculado = 0; 
    
    function cargarMetabolismoDesdeCache() {
        if (!calcGenero) return;
        const guardadoGenero = localStorage.getItem('argos_genero');
        const guardadoEdad = localStorage.getItem('argos_edad');
        const guardadoPeso = localStorage.getItem('argos_peso');
        const guardadoAltura = localStorage.getItem('argos_altura');

        if (guardadoGenero) calcGenero.value = guardadoGenero;
        if (guardadoEdad) calcEdad.value = guardadoEdad;
        if (guardadoPeso) calcPeso.value = guardadoPeso;
        if (guardadoAltura) calcAltura.value = guardadoAltura;
    }

    function actualizarMetabolismo() {
        if (!calcGenero) return;
        const genero = calcGenero.value; 
        const edad = parseInt(calcEdad.value) || 0; 
        const peso = parseFloat(calcPeso.value) || 0; 
        const altura = parseInt(calcAltura.value) || 0;
        
        localStorage.setItem('argos_genero', genero); 
        localStorage.setItem('argos_edad', edad); 
        localStorage.setItem('argos_peso', peso); 
        localStorage.setItem('argos_altura', altura);
        
        if(edad > 0 && peso > 0 && altura > 0) {
            let bmr = (10 * peso) + (6.25 * altura) - (5 * edad); 
            bmr += (genero === 'M') ? 5 : -161;
            window.bmrCalculado = Math.round(bmr); 
            document.getElementById('res-bmr').textContent = window.bmrCalculado + " kcal"; 
            document.getElementById('res-tdee').textContent = Math.round(bmr * 1.2) + " kcal";
        } else {
            window.bmrCalculado = 0;
            document.getElementById('res-bmr').textContent = "--- kcal"; 
            document.getElementById('res-tdee').textContent = "--- kcal";
        }
    }

    if (calcGenero) { 
        cargarMetabolismoDesdeCache();
        ['input', 'change'].forEach(evt => {
            calcGenero.addEventListener(evt, actualizarMetabolismo); 
            calcEdad.addEventListener(evt, actualizarMetabolismo); 
            calcPeso.addEventListener(evt, actualizarMetabolismo); 
            calcAltura.addEventListener(evt, actualizarMetabolismo); 
        });
        actualizarMetabolismo(); 
    }

    const selectorDieta = document.getElementById('selector-dieta');
    if (selectorDieta) {
        if (localStorage.getItem('argos_dieta')) selectorDieta.value = localStorage.getItem('argos_dieta');
        selectorDieta.addEventListener('change', (e) => localStorage.setItem('argos_dieta', e.target.value));
    }

    const btnGenerarIA = document.getElementById('btn-generar-ia');
    if (btnGenerarIA) { btnGenerarIA.addEventListener('click', async () => { btnGenerarIA.style.display = 'none'; document.getElementById('ia-loading').style.display = 'block'; try { const res = await fetch('/generate-ia', { method: 'POST' }); if(res.ok) window.location.reload(); else throw new Error('API Error'); } catch(e) { alert('Error al generar'); btnGenerarIA.style.display = 'inline-block'; document.getElementById('ia-loading').style.display = 'none'; } }); }
    document.querySelectorAll('.ia-checkbox').forEach(box => { box.addEventListener('change', e => { fetch('/update-tick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fecha: box.dataset.fecha, cumplido: e.target.checked }) }); }); });
    function enviarSensaciones(fecha) { const card = document.querySelector(\`.textarea-comentario[data-fecha="\${fecha}"]\`).closest('.sensacion-card'); const rpe = parseInt(card.querySelector('.slider-sensacion[data-tipo="rpe"]').value); const dolor = parseInt(card.querySelector('.slider-sensacion[data-tipo="dolor"]').value); const comentario = card.querySelector('.textarea-comentario').value; fetch('/update-sensaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fecha, rpe, dolor, comentario }) }); }
    document.querySelectorAll('.slider-sensacion').forEach(slider => { slider.addEventListener('input', e => { const { fecha, tipo } = e.target.dataset; document.getElementById(\`val-\${tipo}-\${fecha}\`).textContent = e.target.value + '/10'; }); slider.addEventListener('change', e => enviarSensaciones(e.target.dataset.fecha)); });
    document.querySelectorAll('.textarea-comentario').forEach(txt => { txt.addEventListener('blur', e => enviarSensaciones(e.target.dataset.fecha)); });
    document.getElementById('texto-lesiones').addEventListener('blur', async e => { try { fetch('/update-lesiones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lesiones: e.target.value }) }); } catch(err) {} });

    // === COMPRESIÓN DE IMÁGENES ===
    const comprimirImagen = (file) => new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 800; // Reducimos tamaño para que vuele por la red
                let w = img.width, h = img.height;
                if(w > h && w > MAX_SIZE) { h *= MAX_SIZE/w; w = MAX_SIZE; }
                else if(h > MAX_SIZE) { w *= MAX_SIZE/h; h = MAX_SIZE; }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', dataUrl });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });

    let imagenesComida = [];
    const btnAnalizar = document.getElementById('btn-analizar');
    const fasesComida = ['entrante', 'primero', 'segundo', 'postre'];

    // Para cargas manuales desde el PC
    fasesComida.forEach(fase => {
        const inputF = document.getElementById(\`input-foto-\${fase}\`);
        const prevF = document.getElementById(\`preview-img-\${fase}\`);
        if(inputF) {
            inputF.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if(file) {
                    const res = await comprimirImagen(file);
                    prevF.src = res.dataUrl;
                    prevF.style.display = 'block';
                    const idx = imagenesComida.findIndex(img => img.fase === fase);
                    if(idx > -1) imagenesComida[idx] = { fase, base64: res.base64, mimeType: res.mimeType };
                    else imagenesComida.push({ fase, base64: res.base64, mimeType: res.mimeType });
                    if(btnAnalizar) btnAnalizar.disabled = imagenesComida.length === 0;
                }
            });
        }
    });

    // Radar táctico: Consulta al servidor si el móvil ha mandado fotos
    setInterval(async () => {
        try {
            const res = await fetch('/api/sync-images');
            if(!res.ok) return;
            const data = await res.json();
            
            fasesComida.forEach(fase => {
                if(data[fase] && data[fase].base64) {
                    const prevF = document.getElementById(\`preview-img-\${fase}\`);
                    // Solo actualiza si la imagen es nueva
                    if(prevF && !prevF.src.includes(data[fase].base64.substring(0, 50))) {
                        prevF.src = \`data:\${data[fase].mimeType};base64,\${data[fase].base64}\`;
                        prevF.style.display = 'block';
                        
                        const idx = imagenesComida.findIndex(img => img.fase === fase);
                        if(idx > -1) imagenesComida[idx] = { fase, base64: data[fase].base64, mimeType: data[fase].mimeType };
                        else imagenesComida.push({ fase, base64: data[fase].base64, mimeType: data[fase].mimeType });
                        
                        if(btnAnalizar) btnAnalizar.disabled = false;
                    }
                }
            });
        } catch(e) {}
    }, 2000); // Consulta cada 2 segundos

    if (btnAnalizar) {
        btnAnalizar.addEventListener('click', async () => {
            if (imagenesComida.length === 0) return;
            const dieta = document.getElementById('selector-dieta').value;
            const notas = document.getElementById('texto-notas-comida').value;
            const caloriasObjetivo = ${datos.avgCalorias};
            const bmr = window.bmrCalculado || 0;
            
            document.getElementById('guia-plato').style.display = 'none';
            document.getElementById('resultados-analisis').style.display = 'none';
            document.getElementById('loading-overlay').style.display = 'block';
            btnAnalizar.disabled = true;

            try {
                const res = await fetch('/analyze-food', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imagenes: imagenesComida, dieta, notas, caloriasObjetivo, bmr })
                });
                const data = await res.json();
                
                document.getElementById('loading-overlay').style.display = 'none';
                document.getElementById('resultados-analisis').style.display = 'block';
                document.getElementById('res-kcal').textContent = data.kcal + " kcal";
                document.getElementById('res-macros').textContent = data.macros;
                document.getElementById('res-evaluacion').textContent = data.evaluacion;
                document.getElementById('res-recomendacion').textContent = data.recomendacion;
            } catch (error) {
                alert("Error de conexión IA. Verifica el terminal del servidor.");
                document.getElementById('loading-overlay').style.display = 'none';
            } finally {
                btnAnalizar.disabled = false;
            }
        });
    }

    Chart.defaults.color = '#666'; Chart.defaults.borderColor = '#1a1a1a'; Chart.defaults.font.family = "'Consolas', monospace"; Chart.defaults.font.size = 10;
    Chart.defaults.plugins.tooltip.backgroundColor = '#000'; Chart.defaults.plugins.tooltip.borderColor = 'var(--primary)'; Chart.defaults.plugins.tooltip.borderWidth = 1; Chart.defaults.plugins.tooltip.titleColor = 'var(--primary)'; Chart.defaults.plugins.tooltip.bodyColor = '#ccc';
    const CHART_OPTIONS_BASE = { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { color: '#111' } }, y: { grid: { color: '#111' } } } };
    new Chart(document.getElementById('canvasFisiologia').getContext('2d'), { type: 'line', data: { labels: ${chartLabels}, datasets: [{ label: 'HRV', data: ${chartHRV}, borderColor: '#555', backgroundColor: 'rgba(85,85,85,0.1)', fill: true, tension: 0.1, pointRadius: 2, pointHoverRadius: 4, spanGaps: true }, { label: 'RHR', data: ${chartRHR}, borderColor: '#ff2a2a', backgroundColor: 'rgba(255,42,42,0.1)', fill: true, tension: 0.1, pointRadius: 2, pointHoverRadius: 4, spanGaps: true }]}, options: CHART_OPTIONS_BASE });
    new Chart(document.getElementById('canvasEsfuerzo').getContext('2d'), { type: 'line', data: { labels: ${chartLabels}, datasets: [{ label: 'Fitness Base (CTL)', data: ${chartFitness}, borderColor: '#ff8800', backgroundColor: 'rgba(255,136,0,0.05)', fill: true, tension: 0.1, pointRadius: 2, pointHoverRadius: 4, spanGaps: true, yAxisID: 'y' }, { label: 'Impacto Diario', data: ${chartCargaTrabajo}, type: 'bar', backgroundColor: 'rgba(255,42,42,0.3)', borderColor: '#ff2a2a', borderWidth: 1, yAxisID: 'y1' }]}, options: { ...CHART_OPTIONS_BASE, scales: { x: { grid: { color: '#111' } }, y: { grid: { color: '#111' }, position: 'left' }, y1: { grid: { drawOnChartArea: false }, position: 'right' } } } });
</script>
</body>
</html>`;
}

module.exports = { generarHTML };