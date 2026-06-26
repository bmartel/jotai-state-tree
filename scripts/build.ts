import path from "path";
import fs from "fs";

const cwd = process.cwd();
const isSsr = process.argv.includes('--ssr');

// Path remapping plugin for Bun.build
const projectRoot = path.resolve(import.meta.dir, '..');
const jotaiStateTreePlugin = {
  name: 'jotai-state-tree-plugin',
  setup(build: any) {
    build.onResolve({ filter: /^jotai-state-tree($|\/)/ }, (args: any) => {
      const pkgName = args.path;
      let targetPath = '';
      if (pkgName === 'jotai-state-tree') {
        targetPath = path.resolve(projectRoot, 'src/index.ts');
      } else if (pkgName === 'jotai-state-tree/react') {
        targetPath = path.resolve(projectRoot, 'src/react.ts');
      } else if (pkgName === 'jotai-state-tree/devtools') {
        targetPath = path.resolve(projectRoot, 'src/devtools.tsx');
      } else if (pkgName === 'jotai-state-tree/ssr') {
        targetPath = path.resolve(projectRoot, 'src/ssr.ts');
      }
      return { path: targetPath };
    });
  }
};

async function runBuild() {
  console.log(`[jotai-state-tree] Building application in ${cwd}...`);

  // Clean dist/
  const distDir = path.resolve(cwd, 'dist');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }

  // Load index.html
  const htmlPath = path.resolve(cwd, 'index.html');
  if (!fs.existsSync(htmlPath)) {
    console.error(`Error: index.html not found in ${cwd}`);
    process.exit(1);
  }
  let htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // Read package.json to check for Tailwind
  const pkgJsonPath = path.resolve(cwd, 'package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const hasTailwind = !!(pkgJson.dependencies?.tailwindcss || pkgJson.devDependencies?.tailwindcss);

  if (isSsr) {
    console.log(`[jotai-state-tree] Performing SSR Build...`);

    // 1. Build client-side bundle
    const clientEntry = path.resolve(cwd, 'src/entry-client.tsx');
    console.log(`[jotai-state-tree] Bundling client entry: ${clientEntry}...`);
    const clientBuild = await Bun.build({
      entrypoints: [clientEntry],
      outdir: path.resolve(cwd, 'dist/client'),
      minify: true,
      sourcemap: 'external',
      plugins: [jotaiStateTreePlugin],
    });
    if (!clientBuild.success) {
      console.error('[jotai-state-tree] Client Build failed:');
      console.error(clientBuild.logs);
      process.exit(1);
    }

    // 2. Build server-side bundle
    const serverEntry = path.resolve(cwd, 'src/entry-server.tsx');
    console.log(`[jotai-state-tree] Bundling server entry: ${serverEntry}...`);
    const serverBuild = await Bun.build({
      entrypoints: [serverEntry],
      outdir: path.resolve(cwd, 'dist/server'),
      target: 'bun',
      minify: true,
      plugins: [jotaiStateTreePlugin],
    });
    if (!serverBuild.success) {
      console.error('[jotai-state-tree] Server Build failed:');
      console.error(serverBuild.logs);
      process.exit(1);
    }

    // 3. Compile Tailwind CSS if present
    if (hasTailwind) {
      console.log(`[jotai-state-tree] Compiling Tailwind CSS (minified)...`);
      const tailwindResult = Bun.spawnSync([
        'bunx',
        'tailwindcss',
        '-i',
        'src/index.css',
        '-o',
        'dist/client/index.css',
        '--minify'
      ]);
      if (tailwindResult.exitCode !== 0) {
        console.error('[jotai-state-tree] Tailwind CSS compilation failed:');
        console.error(tailwindResult.stderr.toString());
        process.exit(1);
      }
    }

    // 4. Modify and copy index.html to dist/client/index.html
    let processedHtml = htmlContent;
    processedHtml = processedHtml.replace('/src/entry-client.tsx', '/entry-client.js');
    processedHtml = processedHtml.replace('/src/index.css', '/index.css');

    fs.mkdirSync(path.resolve(cwd, 'dist/client'), { recursive: true });
    fs.writeFileSync(path.resolve(cwd, 'dist/client/index.html'), processedHtml);

    // Copy public folder to dist/client if exists
    const publicDir = path.resolve(cwd, 'public');
    if (fs.existsSync(publicDir)) {
      fs.cpSync(publicDir, path.resolve(cwd, 'dist/client'), { recursive: true });
    }

  } else {
    console.log(`[jotai-state-tree] Performing Standard Build...`);

    // Find script tag with type="module"
    const scriptMatch = htmlContent.match(/<script\s+type="module"\s+src="([^"]+)"/i);
    const entrySrc = scriptMatch ? scriptMatch[1] : 'src/main.tsx';
    const relativeEntry = entrySrc.startsWith('/') ? entrySrc.slice(1) : entrySrc;
    const entrypoint = path.resolve(cwd, relativeEntry);

    // 1. Build application bundle
    console.log(`[jotai-state-tree] Bundling entrypoint: ${entrypoint}...`);
    const appBuild = await Bun.build({
      entrypoints: [entrypoint],
      outdir: path.resolve(cwd, 'dist'),
      minify: true,
      sourcemap: 'external',
      plugins: [jotaiStateTreePlugin],
    });
    if (!appBuild.success) {
      console.error('[jotai-state-tree] Build failed:');
      console.error(appBuild.logs);
      process.exit(1);
    }

    const entryBasename = path.basename(entrypoint, path.extname(entrypoint));

    // 2. Compile Tailwind CSS if present
    if (hasTailwind) {
      console.log(`[jotai-state-tree] Compiling Tailwind CSS (minified)...`);
      const linkMatch = htmlContent.match(/<link\s+rel="stylesheet"\s+href="([^"]+)"/i);
      const cssSrc = linkMatch ? linkMatch[1] : 'src/index.css';
      const relativeCss = cssSrc.startsWith('/') ? cssSrc.slice(1) : cssSrc;
      
      const tailwindResult = Bun.spawnSync([
        'bunx',
        'tailwindcss',
        '-i',
        relativeCss,
        '-o',
        'dist/index.css',
        '--minify'
      ]);
      if (tailwindResult.exitCode !== 0) {
        console.error('[jotai-state-tree] Tailwind CSS compilation failed:');
        console.error(tailwindResult.stderr.toString());
        process.exit(1);
      }
    }

    // 3. Modify and copy index.html to dist/index.html
    let processedHtml = htmlContent;

    // Rewrite script tag
    if (scriptMatch) {
      const originalSrc = scriptMatch[1];
      const newSrc = `/${entryBasename}.js`;
      processedHtml = processedHtml.replace(scriptMatch[0], scriptMatch[0].replace(originalSrc, newSrc));
    }

    // Rewrite/inject CSS
    const linkMatch = htmlContent.match(/<link\s+rel="stylesheet"\s+href="([^"]+)"/i);
    if (linkMatch) {
      const originalHref = linkMatch[1];
      const newHref = '/index.css';
      processedHtml = processedHtml.replace(linkMatch[0], linkMatch[0].replace(originalHref, newHref));
    } else {
      // Check if Bun.build outputted a CSS file in dist
      const cssFileExists = fs.existsSync(path.resolve(cwd, `dist/${entryBasename}.css`));
      if (cssFileExists) {
        const cssLink = `<link rel="stylesheet" href="/${entryBasename}.css" />`;
        if (processedHtml.includes('</head>')) {
          processedHtml = processedHtml.replace('</head>', `${cssLink}</head>`);
        } else {
          processedHtml = cssLink + processedHtml;
        }
      }
    }

    fs.mkdirSync(path.resolve(cwd, 'dist'), { recursive: true });
    fs.writeFileSync(path.resolve(cwd, 'dist/index.html'), processedHtml);

    // Copy public folder to dist if exists
    const publicDir = path.resolve(cwd, 'public');
    if (fs.existsSync(publicDir)) {
      fs.cpSync(publicDir, path.resolve(cwd, 'dist'), { recursive: true });
    }
  }

  console.log(`\x1b[32m[jotai-state-tree]\x1b[0m Build completed successfully! Output: dist/`);
}

runBuild().catch(err => {
  console.error(err);
  process.exit(1);
});
