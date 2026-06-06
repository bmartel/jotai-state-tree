const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];
if (!newVersion) {
  console.error('Please provide the new version as the first argument.');
  process.exit(1);
}

// Helper to update a file
function updateFile(filePath, regex, replacement) {
  const absolutePath = path.resolve(__dirname, '..', filePath);
  if (!fs.existsSync(absolutePath)) {
    console.warn(`File not found: ${filePath}`);
    return;
  }
  const content = fs.readFileSync(absolutePath, 'utf8');
  const updatedContent = content.replace(regex, replacement);
  if (content !== updatedContent) {
    fs.writeFileSync(absolutePath, updatedContent, 'utf8');
    console.log(`Updated version in ${filePath} to ${newVersion}`);
  } else {
    console.log(`No changes needed in ${filePath}`);
  }
}

// 1. Update docs/examples-and-templates.md
// Match: "jotai-state-tree": "^X.Y.Z"
updateFile(
  'docs/examples-and-templates.md',
  /"jotai-state-tree": "\^([0-9]+\.[0-9]+\.[0-9]+)"/g,
  `"jotai-state-tree": "^${newVersion}"`
);
// Match: "jotai-state-tree" to "^X.Y.Z"
updateFile(
  'docs/examples-and-templates.md',
  /"jotai-state-tree" to "\^([0-9]+\.[0-9]+\.[0-9]+)"/g,
  `"jotai-state-tree" to "^${newVersion}"`
);

// 2. Update docs/index.html brand badge version
// Match: <span class="brand-badge">vX.Y.Z</span>
updateFile(
  'docs/index.html',
  /<span class="brand-badge">v([0-9]+\.[0-9]+\.[0-9]+)<\/span>/g,
  `<span class="brand-badge">v${newVersion}</span>`
);
