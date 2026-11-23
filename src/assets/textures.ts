import * as THREE from 'three';

export interface FarmTextures {
  grass: THREE.CanvasTexture;
  pebblePath: THREE.CanvasTexture;
  woodLight: THREE.CanvasTexture;
  woodWarm: THREE.CanvasTexture;
  barnRed: THREE.CanvasTexture;
  plasterCream: THREE.CanvasTexture;
  roofTerracotta: THREE.CanvasTexture;
  stoneWall: THREE.CanvasTexture;
  soilUntilled: THREE.CanvasTexture;
  soilDry: THREE.CanvasTexture;
  soilWet: THREE.CanvasTexture;
  hayGolden: THREE.CanvasTexture;
  cowSpots: THREE.CanvasTexture;
  cowSpotsBrown: THREE.CanvasTexture;
  woolFluff: THREE.CanvasTexture;
  signSunnybrook: THREE.CanvasTexture;
  signGarden: THREE.CanvasTexture;
  signAnimals: THREE.CanvasTexture;
  waterRipple: THREE.CanvasTexture;
  woodBump: THREE.CanvasTexture;
  stoneBump: THREE.CanvasTexture;
  roofBump: THREE.CanvasTexture;
  soilBump: THREE.CanvasTexture;
  worldPathMask: THREE.CanvasTexture;
}

function createCanvas(size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

// Deterministic pseudo-random helper for consistent painterly brushstrokes
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  repeatX = 1,
  repeatY = 1,
  wrap = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (wrap) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function paintGrassTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512);
  const rand = mulberry32(101);
  // Warm sunlit pastel meadow green base
  ctx.fillStyle = '#8ec969';
  ctx.fillRect(0, 0, 512, 512);

  // Soft watercolor mottling patches
  const blotches = ['#9ad473', '#82be60', '#a4dc7b', '#7db55b', '#93ce6c'];
  for (let i = 0; i < 240; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 18 + rand() * 54;
    ctx.fillStyle = blotches[Math.floor(rand() * blotches.length)];
    ctx.globalAlpha = 0.24;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // Wrap tile edges
    if (x + r > 512) {
      ctx.beginPath();
      ctx.arc(x - 512, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (y + r > 512) {
      ctx.beginPath();
      ctx.arc(x, y - 512, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Painted grass blade tufts & tiny clovers
  ctx.globalAlpha = 0.45;
  for (let i = 0; i < 650; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const h = 5 + rand() * 9;
    ctx.strokeStyle = rand() > 0.45 ? '#75ae52' : '#b4e485';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (rand() - 0.5) * 6, y - h * 0.5, x + (rand() - 0.5) * 8, y - h);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return finalizeTexture(canvas, 18, 18);
}

function paintPebblePathTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(256);
  const rand = mulberry32(202);
  ctx.fillStyle = '#e5cfa7';
  ctx.fillRect(0, 0, 256, 256);

  const drawWrapped = (x: number, y: number, drawFn: (wx: number, wy: number) => void) => {
    for (const ox of [-256, 0, 256]) {
      for (const oy of [-256, 0, 256]) {
        const wx = x + ox;
        const wy = y + oy;
        if (wx >= -40 && wx <= 296 && wy >= -40 && wy <= 296) {
          drawFn(wx, wy);
        }
      }
    }
  };

  // Soft seamless sandy brushstrokes
  for (let i = 0; i < 110; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const rx = 10 + rand() * 22;
    const ry = 6 + rand() * 14;
    const rot = rand() * Math.PI;
    ctx.fillStyle = rand() > 0.5 ? '#eedbb7' : '#d6bc90';
    ctx.globalAlpha = 0.34;
    drawWrapped(x, y, (wx, wy) => {
      ctx.beginPath();
      ctx.ellipse(wx, wy, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Cute seamless smooth pastel cobblestones
  const stoneColors = ['#f0e4cd', '#e3d1b6', '#d8c2a5', '#eee1cc', '#cbb498'];
  ctx.globalAlpha = 0.88;
  for (let i = 0; i < 42; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const rx = 8 + rand() * 11;
    const ry = 6 + rand() * 8;
    const rot = rand() * Math.PI;
    ctx.fillStyle = stoneColors[Math.floor(rand() * stoneColors.length)];
    ctx.strokeStyle = '#bda583';
    ctx.lineWidth = 1.6;
    drawWrapped(x, y, (wx, wy) => {
      ctx.beginPath();
      ctx.ellipse(wx, wy, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }
  ctx.globalAlpha = 1;
  return finalizeTexture(canvas, 2, 2);
}

function paintWoodPlanks(base: string, light: string, dark: string, seed: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(256);
  const rand = mulberry32(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);

  const plankCount = 6;
  const plankH = 256 / plankCount;
  for (let p = 0; p < plankCount; p++) {
    const y = p * plankH;
    ctx.fillStyle = p % 2 === 0 ? light : base;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(0, y, 256, plankH);

    // Painted wood grain strokes
    ctx.globalAlpha = 0.25;
    for (let g = 0; g < 16; g++) {
      ctx.strokeStyle = rand() > 0.5 ? dark : light;
      ctx.lineWidth = 1 + rand() * 2;
      const gy = y + 3 + rand() * (plankH - 6);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(85, gy + (rand() - 0.5) * 6, 170, gy + (rand() - 0.5) * 6, 256, gy);
      ctx.stroke();
    }

    // Soft plank seam
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return finalizeTexture(canvas, 2, 2);
}

function paintPlasterTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(256);
  const rand = mulberry32(404);
  ctx.fillStyle = '#fff5e1';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = rand() > 0.5 ? '#f7e7cb' : '#fffaf0';
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(rand() * 256, rand() * 256, 12 + rand() * 28, 8 + rand() * 20, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return finalizeTexture(canvas, 2, 2);
}

function paintRoofShingles(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(256);
  const rand = mulberry32(505);
  ctx.fillStyle = '#d97656';
  ctx.fillRect(0, 0, 256, 256);

  const rows = 8;
  const cols = 6;
  const rowH = 256 / rows;
  const colW = 256 / cols;
  const tones = ['#df7f5e', '#d26b4c', '#e68c6c', '#c96244', '#da7655'];

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * colW + offset;
      const y = r * rowH;
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      ctx.strokeStyle = '#9e472d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, colW - 2, rowH + 3, [2, 2, 10, 10]);
      ctx.fill();
      ctx.stroke();

      // Sunlit highlight rim
      ctx.strokeStyle = 'rgba(255, 224, 194, 0.32)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x + 5, y + 4);
      ctx.lineTo(x + colW - 5, y + 4);
      ctx.stroke();
    }
  }
  return finalizeTexture(canvas, 3, 3);
}

function paintStoneWall(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(256);
  const rand = mulberry32(606);
  ctx.fillStyle = '#c8beae';
  ctx.fillRect(0, 0, 256, 256);

  const stoneColors = ['#ddd5c7', '#cfc5b6', '#e4ddd0', '#bfb5a4', '#d6ccbc'];
  const rows = 6;
  const rowH = 256 / rows;
  for (let r = 0; r < rows; r++) {
    let x = (r % 2) * -18;
    while (x < 256) {
      const w = 36 + rand() * 34;
      const h = rowH - 4;
      ctx.fillStyle = stoneColors[Math.floor(rand() * stoneColors.length)];
      ctx.strokeStyle = '#9a8f7f';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.roundRect(x + 2, r * rowH + 2, w - 4, h, 8);
      ctx.fill();
      ctx.stroke();
      x += w;
    }
  }
  return finalizeTexture(canvas, 2, 2);
}

function paintSoilTexture(mode: 'untilled' | 'dry' | 'wet'): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(256);
  const rand = mulberry32(mode === 'untilled' ? 701 : mode === 'dry' ? 702 : 703);

  if (mode === 'untilled') {
    ctx.fillStyle = '#c4a87d';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = rand() > 0.5 ? '#b3956a' : '#d2b88f';
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(rand() * 256, rand() * 256, 5 + rand() * 14, 0, Math.PI * 2);
      ctx.fill();
    }
    // Tiny grass specks on untilled garden plot
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 45; i++) {
      ctx.fillStyle = '#8ec267';
      ctx.beginPath();
      ctx.arc(rand() * 256, rand() * 256, 2 + rand() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return finalizeTexture(canvas, 1, 1);
  }

  const isWet = mode === 'wet';
  ctx.fillStyle = isWet ? '#4a2f1e' : '#9c6e47';
  ctx.fillRect(0, 0, 256, 256);

  // Sculpted tilled furrow ridges
  const rows = 5;
  const rowH = 256 / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const grad = ctx.createLinearGradient(0, y, 0, y + rowH);
    if (isWet) {
      grad.addColorStop(0, '#362013');
      grad.addColorStop(0.35, '#593924');
      grad.addColorStop(0.55, '#64412a');
      grad.addColorStop(1, '#311c10');
    } else {
      grad.addColorStop(0, '#7c5333');
      grad.addColorStop(0.35, '#ae7d53');
      grad.addColorStop(0.55, '#b9875b');
      grad.addColorStop(1, '#754d2e');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, 256, rowH);
  }

  // Organic soil crumbs & moisture sparkles
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = isWet
      ? rand() > 0.78
        ? '#7d573d'
        : '#2e1a0f'
      : rand() > 0.5
        ? '#c7976b'
        : '#734c2c';
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(rand() * 256, rand() * 256, 1.5 + rand() * 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return finalizeTexture(canvas, 1, 1);
}

function paintHayTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(256);
  const rand = mulberry32(808);
  ctx.fillStyle = '#e7c15b';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 420; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const len = 14 + rand() * 36;
    ctx.strokeStyle = rand() > 0.5 ? '#f5d97c' : '#c99b36';
    ctx.lineWidth = 1.6 + rand() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (rand() - 0.5) * 6);
    ctx.stroke();
  }
  return finalizeTexture(canvas, 2, 2);
}

function paintCowSpots(spotColor: string, seed: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(256);
  const rand = mulberry32(seed);
  ctx.fillStyle = '#fff9ef';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = spotColor;
  for (let i = 0; i < 11; i++) {
    const cx = rand() * 256;
    const cy = rand() * 256;
    const rx = 20 + rand() * 34;
    const ry = 16 + rand() * 28;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  return finalizeTexture(canvas, 1, 1);
}

function paintWoolTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(256);
  const rand = mulberry32(909);
  ctx.fillStyle = '#fff9ee';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 120; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const r = 8 + rand() * 12;
    ctx.strokeStyle = '#e7dcc8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, rand() * Math.PI, rand() * Math.PI + 3.8);
    ctx.stroke();
  }
  return finalizeTexture(canvas, 2, 2);
}

function paintWoodenSign(title: string, subtitle: string, bgColor = '#d39a62'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 512, 192);

  // Subtle wood grain
  ctx.strokeStyle = 'rgba(102, 58, 22, 0.22)';
  ctx.lineWidth = 3;
  for (let y = 14; y < 192; y += 26) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y + 5, 340, y - 5, 512, y);
    ctx.stroke();
  }

  // Storybook border frame
  ctx.strokeStyle = '#734420';
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, 492, 172);
  ctx.strokeStyle = '#f6dfb9';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, 472, 152);

  // Text (auto-fitted with generous margins inside wooden frame)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#472812';
  ctx.font = '800 37px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.fillText(title, 256, subtitle ? 76 : 98, 436);

  if (subtitle) {
    ctx.fillStyle = '#6c3f1d';
    ctx.font = '700 24px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillText(subtitle, 256, 130, 436);
  }

  return finalizeTexture(canvas, 1, 1, false);
}

function paintWaterRipple(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(256);
  const rand = mulberry32(1111);
  ctx.fillStyle = '#6ccae6';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 65; i++) {
    ctx.fillStyle = rand() > 0.5 ? '#88ddf2' : '#57b8d9';
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(rand() * 256, rand() * 256, 16 + rand() * 28, 6 + rand() * 12, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = '#d9f8ff';
  ctx.lineWidth = 2;
  for (let i = 0; i < 24; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    ctx.beginPath();
    ctx.arc(x, y, 8 + rand() * 14, 0, Math.PI);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return finalizeTexture(canvas, 3, 3);
}

function paintBumpMap(kind: 'wood' | 'stone' | 'roof' | 'soil'): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(256);
  const rand = mulberry32(kind === 'wood' ? 1201 : kind === 'stone' ? 1202 : kind === 'roof' ? 1203 : 1204);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  if (kind === 'wood') {
    const planks = 6;
    const h = 256 / planks;
    for (let p = 0; p < planks; p++) {
      ctx.fillStyle = '#303030';
      ctx.fillRect(0, p * h, 256, 4);
      for (let g = 0; g < 18; g++) {
        ctx.strokeStyle = rand() > 0.5 ? '#a2a2a2' : '#646464';
        ctx.lineWidth = 1.4;
        const gy = p * h + 5 + rand() * (h - 8);
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.bezierCurveTo(85, gy + (rand() - 0.5) * 5, 170, gy + (rand() - 0.5) * 5, 256, gy);
        ctx.stroke();
      }
    }
  } else if (kind === 'stone') {
    const rows = 6;
    const rowH = 256 / rows;
    ctx.fillStyle = '#323232';
    ctx.fillRect(0, 0, 256, 256);
    for (let r = 0; r < rows; r++) {
      let x = (r % 2) * -18;
      while (x < 256) {
        const w = 36 + rand() * 34;
        ctx.fillStyle = `rgb(${155 + Math.floor(rand() * 50)},${155 + Math.floor(rand() * 50)},${155 + Math.floor(rand() * 50)})`;
        ctx.beginPath();
        ctx.roundRect(x + 3, r * rowH + 3, w - 6, rowH - 6, 8);
        ctx.fill();
        x += w;
      }
    }
  } else if (kind === 'roof') {
    const rows = 8;
    const cols = 6;
    const rowH = 256 / rows;
    const colW = 256 / cols;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (colW * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * colW + off;
        const y = r * rowH;
        const grad = ctx.createLinearGradient(0, y, 0, y + rowH);
        grad.addColorStop(0, '#555555');
        grad.addColorStop(0.75, '#c8c8c8');
        grad.addColorStop(1, '#303030');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x + 1, y + 1, colW - 2, rowH + 2, [2, 2, 10, 10]);
        ctx.fill();
      }
    }
  } else {
    // Soil furrows + organic crumbs
    const rows = 5;
    const rowH = 256 / rows;
    for (let r = 0; r < rows; r++) {
      const grad = ctx.createLinearGradient(0, r * rowH, 0, (r + 1) * rowH);
      grad.addColorStop(0, '#303030');
      grad.addColorStop(0.5, '#d6d6d6');
      grad.addColorStop(1, '#303030');
      ctx.fillStyle = grad;
      ctx.fillRect(0, r * rowH, 256, rowH);
    }
    for (let i = 0; i < 240; i++) {
      ctx.fillStyle = rand() > 0.5 ? '#c0c0c0' : '#4a4a4a';
      ctx.beginPath();
      ctx.arc(rand() * 256, rand() * 256, 1.5 + rand() * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(kind === 'roof' ? 3 : kind === 'soil' ? 1 : 2, kind === 'roof' ? 3 : kind === 'soil' ? 1 : 2);
  tex.needsUpdate = true;
  return tex;
}

function paintWorldPathMask(): THREE.CanvasTexture {
  // World-space RGB splat mask covering X, Z in [-42, +42] (84m x 84m)
  // R = cobblestone pebble path, G = warm sandy path edge, B = pig pasture mud wallow
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);

  const toPx = (wx: number, wz: number): [number, number] => [
    ((wx + 42) / 84) * size,
    ((wz + 42) / 84) * size,
  ];
  const mToPx = (meters: number) => (meters / 84) * size;

  const drawPathNetwork = (extraWidthMeters: number, strokeColor: string, blurPx: number) => {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = strokeColor;
    ctx.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none';

    const strokeCurve = (pts: [number, number][], widthM: number) => {
      ctx.lineWidth = mToPx(widthM + extraWidthMeters);
      ctx.beginPath();
      const [sx, sy] = toPx(pts[0][0], pts[0][1]);
      ctx.moveTo(sx, sy);
      for (let i = 1; i < pts.length; i++) {
        const [px, py] = toPx(pts[i][0], pts[i][1]);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    };

    const fillOval = (wx: number, wz: number, rxM: number, rzM: number) => {
      const [cx, cy] = toPx(wx, wz);
      ctx.beginPath();
      ctx.ellipse(cx, cy, mToPx(rxM + extraWidthMeters * 0.5), mToPx(rzM + extraWidthMeters * 0.5), 0, 0, Math.PI * 2);
      ctx.fill();
    };

    // Main gently winding entrance spine from spawn z=26 north to z=-9.5
    const mainSpine: [number, number][] = [];
    for (let z = 26.2; z >= -9.8; z -= 1.2) {
      mainSpine.push([Math.sin(z * 0.14) * 0.45, z]);
    }
    strokeCurve(mainSpine, 3.6);

    // Cozy crossroads village plaza roundel
    fillOval(0, 6.8, 3.5, 3.2);

    // West branch into Vegetable Garden
    strokeCurve([[0, 7.0], [-4.5, 7.0], [-6.6, 7.0]], 2.3);
    // Central garden walkway between east and west soil beds
    strokeCurve([[-9.05, 2.8], [-9.05, 11.1]], 1.35);

    // North-West curved path to Farmhouse front porch
    strokeCurve(
      [[0, 4.4], [-2.4, 2.5], [-5.2, 0.5], [-8.4, -1.6], [-11.5, -3.3], [-14.2, -4.5]],
      2.35
    );

    // East branch into Animal Pasture gate
    strokeCurve([[0, 7.2], [3.5, 7.2], [6.4, 7.2]], 2.45);

    // North-West branch to Duck Pond Wooden Dock
    strokeCurve([[0, -8.8], [-2.2, -10.8], [-4.4, -12.0], [-5.5, -12.9]], 2.3);

    // North-East branch toward Barn & Windmill
    strokeCurve([[0, -8.4], [3.6, -9.4], [7.4, -10.8], [10.4, -12.5], [12.5, -14.5]], 2.3);

    ctx.restore();
  };

  // Use additive 'lighter' compositing so R, G, B channels stay completely independent!
  ctx.globalCompositeOperation = 'lighter';

  // G channel: soft warm sandy shoulder border outside the cobblestone path
  drawPathNetwork(0.95, '#00ff00', 10);
  // R channel: crisp cobblestone pebble path interior
  drawPathNetwork(0.0, '#ff0000', 4);

  // B channel: soft pig pasture mud wallow around (9.8, 2.3)
  ctx.save();
  ctx.filter = 'blur(10px)';
  ctx.fillStyle = '#0000ff';
  const [mx, my] = toPx(9.8, 2.3);
  ctx.beginPath();
  ctx.ellipse(mx, my, mToPx(2.7), mToPx(2.0), 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

let cachedTextures: FarmTextures | null = null;

export function getFarmTextures(): FarmTextures {
  if (cachedTextures) return cachedTextures;
  cachedTextures = {
    grass: paintGrassTexture(),
    pebblePath: paintPebblePathTexture(),
    woodLight: paintWoodPlanks('#d9a773', '#e7bb88', '#a37142', 301),
    woodWarm: paintWoodPlanks('#b97c4c', '#cf905d', '#7f4d28', 302),
    barnRed: paintWoodPlanks('#cf5f52', '#dd7265', '#963b31', 303),
    plasterCream: paintPlasterTexture(),
    roofTerracotta: paintRoofShingles(),
    stoneWall: paintStoneWall(),
    soilUntilled: paintSoilTexture('untilled'),
    soilDry: paintSoilTexture('dry'),
    soilWet: paintSoilTexture('wet'),
    hayGolden: paintHayTexture(),
    cowSpots: paintCowSpots('#4c4340', 901),
    cowSpotsBrown: paintCowSpots('#9b6d4c', 902),
    woolFluff: paintWoolTexture(),
    signSunnybrook: paintWoodenSign('SUNNYBROOK FARM', '✿ Welcome Home ✿', '#d79e65'),
    signGarden: paintWoodenSign('VEGETABLE GARDEN', 'Till • Plant • Water', '#cfa06b'),
    signAnimals: paintWoodenSign('ANIMAL PASTURE', 'Feed • Pet • Collect', '#cfa06b'),
    waterRipple: paintWaterRipple(),
    woodBump: paintBumpMap('wood'),
    stoneBump: paintBumpMap('stone'),
    roofBump: paintBumpMap('roof'),
    soilBump: paintBumpMap('soil'),
    worldPathMask: paintWorldPathMask(),
  };
  return cachedTextures;
}
