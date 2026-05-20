import sharp from 'sharp';
import { mkdirSync } from 'fs';

mkdirSync('./public/icons', { recursive: true });

const sizes = [192, 512];

for (const size of sizes) {
  const pad = Math.round(size * 0.15);
  const inner = size - pad * 2;
  const fontSize = Math.round(inner * 0.42);
  const radius = Math.round(size * 0.22);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1b2230"/>
        <stop offset="100%" stop-color="#0b0f14"/>
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bg)"/>
    <text
      x="50%" y="54%"
      dominant-baseline="middle"
      text-anchor="middle"
      font-family="Arial Black, Arial, sans-serif"
      font-weight="900"
      font-size="${fontSize}"
      fill="#f0c75f"
      letter-spacing="-2"
    >TZ</text>
  </svg>`;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(`./public/icons/icon-${size}.png`);

  console.log(`✓ icon-${size}.png`);
}
