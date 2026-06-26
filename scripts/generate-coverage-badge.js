const fs = require('fs');
const path = require('path');

const lcovPath = path.resolve(__dirname, '../coverage/lcov.info');
const badgeDir = path.resolve(__dirname, '../.github/badges');
const badgePath = path.join(badgeDir, 'coverage.svg');

try {
  if (!fs.existsSync(lcovPath)) {
    console.error(`Error: Coverage file not found at ${lcovPath}`);
    console.error('Make sure you have run tests with coverage enabled.');
    process.exit(1);
  }

  const content = fs.readFileSync(lcovPath, 'utf8');
  let totalLF = 0;
  let totalLH = 0;

  const lines = content.split('\n');
  for (const line of lines) {
    if (line.startsWith('LF:')) {
      totalLF += parseInt(line.substring(3).trim(), 10);
    } else if (line.startsWith('LH:')) {
      totalLH += parseInt(line.substring(3).trim(), 10);
    }
  }

  if (totalLF === 0) {
    console.error('Error: No instrumented lines found in lcov.info.');
    process.exit(1);
  }

  const pct = (totalLH / totalLF) * 100;
  const displayPct = pct.toFixed(1).replace(/\.0$/, '');

  // Determine color based on coverage percentage (Shields.io standard)
  let color = '#e05d44'; // Red
  if (pct >= 90) {
    color = '#4c1'; // Green
  } else if (pct >= 80) {
    color = '#a4a61d'; // Yellow-Green
  } else if (pct >= 70) {
    color = '#dfb317'; // Yellow
  } else if (pct >= 60) {
    color = '#fe7d37'; // Orange
  }

  // Shields.io style SVG template
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="104" height="20" role="img" aria-label="coverage: ${displayPct}%">
  <title>coverage: ${displayPct}%</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="104" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="59" height="20" fill="#555"/>
    <rect x="59" width="45" height="20" fill="${color}"/>
    <rect width="104" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="305" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="490">coverage</text>
    <text x="305" y="140" transform="scale(.1)" fill="#fff" textLength="490">coverage</text>
    <text aria-hidden="true" x="805" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="350">${displayPct}%</text>
    <text x="805" y="140" transform="scale(.1)" fill="#fff" textLength="350">${displayPct}%</text>
  </g>
</svg>`;

  if (!fs.existsSync(badgeDir)) {
    fs.mkdirSync(badgeDir, { recursive: true });
  }

  fs.writeFileSync(badgePath, svg, 'utf8');
  console.log(`Success: Generated coverage badge at ${badgePath} (${displayPct}% coverage)`);
} catch (error) {
  console.error('Error generating coverage badge:', error);
  process.exit(1);
}
