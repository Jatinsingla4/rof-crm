const fs = require('fs');
const path = require('path');

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const files = fs.readdirSync(src);

  files.forEach(file => {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);

    if (fs.statSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✓ Copied: ${destPath}`);
    }
  });
}

// Copy db files (SQL, HTML, MD)
const dbSrc = path.join(__dirname, 'src/db');
const dbDest = path.join(__dirname, 'dist/db');

console.log('Copying database files...');
if (fs.existsSync(dbSrc)) {
  copyRecursive(dbSrc, dbDest);
} else {
  console.warn('Source db directory not found:', dbSrc);
}

// Copy templates
const templateSrc = path.join(__dirname, 'src/templates/legal');
const templateDest = path.join(__dirname, 'dist/templates/legal');

console.log('Copying template files...');
if (fs.existsSync(templateSrc)) {
  copyRecursive(templateSrc, templateDest);
} else {
  console.warn('Source templates directory not found:', templateSrc);
}

console.log('✅ File copying complete!');
