// views/mobile.view.js
'use strict';

function generarHTML() {
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>A.R.G.O.S. | Uplink Móvil</title>
    <style>
        body { font-family: 'Consolas', monospace; background: #030303; color: #fff; text-align: center; padding: 25px; margin: 0; }
        h1 { color: #ff2a2a; letter-spacing: 4px; text-transform: uppercase; font-size: 22px; margin-bottom: 5px; }
        .btn-fase { display: block; width: 100%; box-sizing: border-box; background: #0a0a0a; color: #ff8800; border: 1px solid #ff8800; padding: 20px; margin: 15px 0; font-size: 16px; font-weight: bold; text-transform: uppercase; border-radius: 4px; cursor: pointer; }
        .btn-fase.success { background: #051005; border-color: #56d364; color: #56d364; }
        input[type="file"] { display: none; }
    </style>
</head>
<body>
    <h1>A.R.G.O.S. Escáner</h1>
    <p style="color:#888; font-size:12px; margin-bottom:30px; text-transform:uppercase;">Transmisión directa al núcleo</p>

    <label id="lbl-entrante" class="btn-fase"><input type="file" accept="image/*" capture="environment" onchange="upload('entrante', this)">📷 Escanear Entrante</label>
    <label id="lbl-primero"  class="btn-fase"><input type="file" accept="image/*" capture="environment" onchange="upload('primero', this)">📷 Escanear Primero</label>
    <label id="lbl-segundo"  class="btn-fase"><input type="file" accept="image/*" capture="environment" onchange="upload('segundo', this)">📷 Escanear Segundo</label>
    <label id="lbl-postre"   class="btn-fase"><input type="file" accept="image/*" capture="environment" onchange="upload('postre', this)">📷 Escanear Postre</label>

    <script>
        const comprimirImagen = (file) => new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = e => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_SIZE = 800;
                    let w = img.width, h = img.height;
                    if(w > h && w > MAX_SIZE) { h *= MAX_SIZE/w; w = MAX_SIZE; }
                    else if(h > MAX_SIZE) { w *= MAX_SIZE/h; h = MAX_SIZE; }
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });

        async function upload(fase, input) {
            const file = input.files[0];
            if(!file) return;
            
            const label = document.getElementById('lbl-' + fase);
            label.textContent = "⏳ Comprimiendo...";
            label.style.borderColor = "#ff2a2a";
            label.style.color = "#ff2a2a";

            try {
                const { base64, mimeType } = await comprimirImagen(file);
                label.textContent = "⏳ Subiendo...";
                
                await fetch('/api/mobile-upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fase, base64, mimeType })
                });
                label.textContent = "✓ " + fase + " Transmitido";
                label.classList.add('success');
            } catch(err) {
                label.textContent = "❌ Error. Reintentar";
            }
        }
    </script>
</body>
</html>`;
}

module.exports = { generarHTML };