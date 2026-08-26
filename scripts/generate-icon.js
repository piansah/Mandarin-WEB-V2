const fs = require('fs');
const { createCanvas } = require('canvas');

function generateIcon(size, outputPath) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background - green theme color
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(0, 0, size, size);

  // White 木 character
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.5}px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('木', size / 2, size / 2);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated ${outputPath}`);
}

// Generate icons
generateIcon(192, 'public/icon-192.png');
generateIcon(512, 'public/icon-512.png');
