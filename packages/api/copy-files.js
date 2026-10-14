const fs = require('fs');
const path = require('path');

function copyRecursive(src, dest) {
  try {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const files = fs.readdirSync(src);
    console.log(`[copy-files] Found ${files.length} items in ${src}`);

    files.forEach(file => {
      try {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        const stat = fs.statSync(srcPath);

        if (stat.isDirectory()) {
          copyRecursive(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
          console.log(`✓ Copied: ${destPath}`);
        }
      } catch (err) {
        console.error(`[copy-files] ERROR copying ${file}: ${err.message}`);
        throw err;
      }
    });
  } catch (err) {
    console.error(`[copy-files] FATAL ERROR in copyRecursive(${src}, ${dest}): ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

// Copy db files (SQL, HTML, MD)
const dbSrc = path.join(__dirname, 'src/db');
const dbDest = path.join(__dirname, 'dist/db');

console.log('[copy-files] Starting copy process...');
console.log(`[copy-files] CWD: ${process.cwd()}`);
console.log(`[copy-files] __dirname: ${__dirname}`);
console.log(`[copy-files] DB source: ${dbSrc}`);
console.log(`[copy-files] DB dest: ${dbDest}`);

if (fs.existsSync(dbSrc)) {
  console.log('[copy-files] DB source exists, copying...');
  try {
    copyRecursive(dbSrc, dbDest);
    console.log('[copy-files] ✅ Database files copied successfully');
  } catch (err) {
    console.error('[copy-files] ❌ Failed to copy database files:', err.message);
    process.exit(1);
  }
} else {
  console.error(`[copy-files] ❌ Source db directory NOT found: ${dbSrc}`);
  process.exit(1);
}

// Copy templates
const templateSrc = path.join(__dirname, 'src/templates/legal');
const templateDest = path.join(__dirname, 'dist/templates/legal');

console.log(`[copy-files] Template source: ${templateSrc}`);
if (fs.existsSync(templateSrc)) {
  console.log('[copy-files] Template source exists, copying...');
  try {
    copyRecursive(templateSrc, templateDest);
    console.log('[copy-files] ✅ Template files copied successfully');
  } catch (err) {
    console.error('[copy-files] ❌ Failed to copy template files:', err.message);
    process.exit(1);
  }
} else {
  console.warn(`[copy-files] ⚠️ Source templates directory not found: ${templateSrc}`);
}

console.log('[copy-files] ✅ File copying complete!');
