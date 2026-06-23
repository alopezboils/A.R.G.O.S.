// intervals.service.js - Módulo de extracción y cálculo fisiológico multidisciplinar

async function extraerMetricas(athleteId, apiKey) {
    const fechaHoy  = new Date();
    const hoy       = fechaHoy.toISOString().split('T')[0];
    
    // CÁLCULO DE SEMANAS NATURALES
    const dayOfWeek = fechaHoy.getDay(); 
    const diasDesdeLunes = (dayOfWeek + 6) % 7; 
    const dateLunesActual = new Date(fechaHoy);
    dateLunesActual.setDate(fechaHoy.getDate() - diasDesdeLunes);
    const strLunesActual = dateLunesActual.toISOString().split('T')[0];

    const dateLunesAnterior = new Date(dateLunesActual);
    dateLunesAnterior.setDate(dateLunesActual.getDate() - 7);
    const fechaInicio = dateLunesAnterior.toISOString().split('T')[0];

    // FUNCIÓN PARA OBTENER EL DÍA DEL MES (DEL LUNES)
    const getDiaLunes = (dStr) => {
        return parseInt(dStr.split('-')[2], 10);
    };

    const tokenBase64 = Buffer.from('API_KEY:' + apiKey).toString('base64');
    const headers = { 'Authorization': `Basic ${tokenBase64}` };

    const [resWellness, resActivities] = await Promise.all([
        fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/wellness?oldest=${fechaInicio}&newest=${hoy}`, { headers }),
        fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/activities?oldest=${fechaInicio}&newest=${hoy}`, { headers })
    ]);

    if (!resWellness.ok)    throw new Error(`Intervals Wellness API error: ${resWellness.status}`);
    if (!resActivities.ok)  throw new Error(`Intervals Activities API error: ${resActivities.status}`);

    const [datosWellness, datosActivities] = await Promise.all([
        resWellness.json(),
        resActivities.json()
    ]);

    const mapaCargaDiaria       = {};
    const resumenActividades    = {};
    const mapaCaloriasActividades = {};
    
    const initWeekData = () => ({
        runKm: 0, runSecs: 0, rideKm: 0, rideSecs: 0, swimKm: 0, swimSecs: 0, strengthSecs: 0, cargaTotal: 0, caloriasTotales: 0
    });

    const datosAnterior = initWeekData();
    const datosActual = initWeekData();

    let caloriasTotalesActividades = 0;

    for (const act of datosActivities) {
        const fecha    = act.start_date_local.split('T')[0];
        const carga    = act.icu_training_load || 0;
        const calorias = act.calories || 0;
        const distMetros = typeof act.distance === 'number' ? act.distance : 0;
        const timeSecs = typeof act.moving_time === 'number' ? act.moving_time : 0;
        const tipo = act.type || '';
        const dist = distMetros > 0 ? `${(distMetros / 1000).toFixed(1)} km` : '';

        const target = (fecha >= strLunesActual) ? datosActual : datosAnterior;

        target.cargaTotal += carga;
        target.caloriasTotales += calorias;

        if (['Run', 'VirtualRun', 'Treadmill', 'TrailRun'].includes(tipo)) {
            target.runKm += distMetros / 1000;
            target.runSecs += timeSecs;
        } else if (['Ride', 'VirtualRide', 'IndoorCycling', 'GravelRide', 'MountainBikeRide'].includes(tipo)) {
            target.rideKm += distMetros / 1000;
            target.rideSecs += timeSecs;
        } else if (['Swim', 'OpenWaterSwim'].includes(tipo)) {
            target.swimKm += distMetros / 1000;
            target.swimSecs += timeSecs;
        } else if (['WeightTraining', 'Workout', 'Strength', 'Crossfit'].includes(tipo)) {
            target.strengthSecs += timeSecs;
        }

        mapaCargaDiaria[fecha]          = (mapaCargaDiaria[fecha] || 0) + carga;
        mapaCaloriasActividades[fecha]  = (mapaCaloriasActividades[fecha] || 0) + calorias;

        resumenActividades[fecha] = resumenActividades[fecha]
            ? `${resumenActividades[fecha]} + ${tipo} ${dist}`.trim()
            : `${tipo} ${dist}`.trim();

        caloriasTotalesActividades += calorias;
    }

    const formatTime = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        if (h === 0 && m === 0) return '0m';
        if (h === 0) return `${m}m`;
        return `${h}h${m.toString().padStart(2, '0')}m`;
    };

    const formatWeek = (w, dStr) => ({
        numSemana: getDiaLunes(dStr), // <-- Ahora pasamos el día del mes
        runKm: w.runKm.toFixed(1), runTime: formatTime(w.runSecs),
        rideKm: w.rideKm.toFixed(1), rideTime: formatTime(w.rideSecs),
        swimKm: w.swimKm.toFixed(1), swimTime: formatTime(w.swimSecs),
        strengthTime: formatTime(w.strengthSecs),
        carga: w.cargaTotal,
        kcal: w.caloriasTotales
    });

    const semAnterior = formatWeek(datosAnterior, fechaInicio);
    const semActual = formatWeek(datosActual, strLunesActual);

    let ultimaMetricaValida = { hrv: null, restingHR: null, sleepSecs: 0, ctl: 0, atl: 0, id: hoy };
    let sumaHRV = 0, sumaRHR = 0, sumaSueno = 0, cuentaWellness = 0;
    let sumaKcalWellness = 0, diasConKcalWellness = 0, ultimaKcalWellness = 0;

    for (const d of datosWellness) {
        if (d.hrv || d.restingHR) {
            ultimaMetricaValida = d;
            if (d.hrv)        sumaHRV   += d.hrv;
            if (d.restingHR)  sumaRHR   += d.restingHR;
            if (d.sleepSecs)  sumaSueno += d.sleepSecs / 3600;
            cuentaWellness++;
        }
        if (d.kcal) {
            ultimaKcalWellness = d.kcal;
            sumaKcalWellness  += d.kcal;
            diasConKcalWellness++;
        }
    }

    const cardHRV  = ultimaMetricaValida.hrv        ?? 'N/A';
    const cardRHR  = ultimaMetricaValida.restingHR  ?? 'N/A';
    const avgHRV   = cuentaWellness > 0 ? Math.round(sumaHRV / cuentaWellness)  : 'N/A';
    const avgRHR   = cuentaWellness > 0 ? Math.round(sumaRHR / cuentaWellness)  : 'N/A';
    const avgSueno = cuentaWellness > 0 ? (sumaSueno / cuentaWellness).toFixed(1) : 'N/A';

    let caloriasCard = 0;
    let avgCalorias  = 0;

    if (diasConKcalWellness > 0) {
        caloriasCard = ultimaKcalWellness;
        avgCalorias  = Math.round(sumaKcalWellness / diasConKcalWellness);
    } else {
        const fechasActivas = Object.keys(mapaCaloriasActividades).sort().reverse();
        caloriasCard = mapaCaloriasActividades[hoy] ?? (fechasActivas.length > 0 ? mapaCaloriasActividades[fechasActivas[0]] : 0);
        const diasEntrenados = fechasActivas.length;
        avgCalorias = diasEntrenados > 0 ? Math.round(caloriasTotalesActividades / diasEntrenados) : 0;
    }

    let estadoIntensidad = "Moderada";
    let colorIntensidad  = "#ffa657";

    if (cardHRV !== 'N/A' && avgHRV !== 'N/A') {
        if      (cardHRV >= avgHRV * 0.98 && cardRHR <= avgRHR * 1.02)  { estadoIntensidad = "RECUPERADO: ALTA INTENSIDAD ⚡"; colorIntensidad = "#56d364"; }
        else if (cardHRV <  avgHRV * 0.88 || cardRHR >  avgRHR * 1.08)  { estadoIntensidad = "FATIGA: REGENERATIVO 🛡️"; colorIntensidad = "#ff2a2a"; }
        else                                                               { estadoIntensidad = "MODERADO: BASE AERÓBICA 🏃‍♂️"; colorIntensidad = "#ff2a2a"; }
    }

    const latestCTL  = ultimaMetricaValida.ctl ? Math.round(ultimaMetricaValida.ctl) : 0;
    const latestATL  = ultimaMetricaValida.atl ? Math.round(ultimaMetricaValida.atl) : 0;
    const latestForm = latestCTL - latestATL;

    let zonaFatiga  = "Mantenimiento";
    let colorFatiga = "#8b949e";

    if      (latestForm > 5)                          { zonaFatiga = "FRESCO / DESCARGA"; colorFatiga = "#79c0ff"; }
    else if (latestForm >= -10 && latestForm <= 5)    { zonaFatiga = "ZONA ÓPTIMA: MANTENIMIENTO"; colorFatiga = "#ff2a2a"; }
    else if (latestForm >= -30 && latestForm <  -10)  { zonaFatiga = "ZONA ÓPTIMA: ESTÍMULO"; colorFatiga = "#56d364"; }
    else if (latestForm < -30)                         { zonaFatiga = "ALERTA: SOBREENTRENAMIENTO"; colorFatiga = "#ff2a2a"; }

    const buildTicker = (actual, media, invertido = false) => {
        if (actual === 'N/A' || media === 'N/A') return `<span style="color:#8b949e">--</span>`;
        const pct     = (((actual - media) / media) * 100).toFixed(1);
        const positivo = invertido ? pct <= 0 : pct >= 0;
        const flecha   = positivo ? "▲" : "▼";
        const color    = positivo ? "#56d364" : "#ff2a2a";
        return `<span style="color:${color}; font-weight:bold;">${flecha} ${Math.abs(pct)}%</span>`;
    };

    const hrvTicker = buildTicker(cardHRV, avgHRV, false);
    const rhrTicker = buildTicker(cardRHR, avgRHR, true);

    return {
        hoy, 
        semAnterior, 
        semActual,
        caloriasCard, avgCalorias, avgSueno, cardHRV, cardRHR, avgHRV, avgRHR,
        latestCTL, latestATL, latestForm, estadoIntensidad, colorIntensidad, zonaFatiga, colorFatiga, hrvTicker, rhrTicker, resumenActividades,
        chartLabels:        datosWellness.map(d => d.id.slice(5)),
        chartHRV:           datosWellness.map(d => d.hrv        ?? null),
        chartRHR:           datosWellness.map(d => d.restingHR  ?? null),
        chartFitness:       datosWellness.map(d => d.ctl        ?? null),
        chartCargaTrabajo:  datosWellness.map(d => mapaCargaDiaria[d.id] || 0)
    };
}

module.exports = { extraerMetricas };