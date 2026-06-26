import { serve } from "bun";
import path from "path";
import { watch } from "fs";

const cwd = process.cwd();
const isProd = process.argv.includes('--prod') || process.argv.includes('--preview');

const mimeTypes: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

if (isProd) {
  const distDir = path.resolve(cwd, 'dist');
  const server = serve({
    port: 3000,
    async fetch(req) {
      const url = new URL(req.url);
      let pathname = url.pathname;
      if (pathname === '/') pathname = '/index.html';
      
      let filePath = path.join(distDir, pathname);
      let file = Bun.file(filePath);
      if (!(await file.exists())) {
        // Fallback to public folder if exists
        const publicFilePath = path.join(cwd, 'public', pathname.startsWith('/') ? pathname.slice(1) : pathname);
        const publicFile = Bun.file(publicFilePath);
        if (await publicFile.exists()) {
          return new Response(publicFile);
        }
        // SPA routing fallback
        filePath = path.join(distDir, 'index.html');
        file = Bun.file(filePath);
      }
      return new Response(file);
    }
  });
  console.log(`\x1b[32m[jotai-state-tree]\x1b[0m Preview server running at http://localhost:3000`);
} else {
  // Development mode
  const htmlPath = path.resolve(cwd, 'index.html');
  if (!(await Bun.file(htmlPath).exists())) {
    console.error(`Error: index.html not found in ${cwd}`);
    process.exit(1);
  }
  
  let htmlContent = await Bun.file(htmlPath).text();
  
  // Find script tag with type="module"
  const scriptMatch = htmlContent.match(/<script\s+type="module"\s+src="([^"]+)"/i);
  const entrySrc = scriptMatch ? scriptMatch[1] : 'src/main.tsx';
  const relativeEntry = entrySrc.startsWith('/') ? entrySrc.slice(1) : entrySrc;
  const entrypoint = path.resolve(cwd, relativeEntry);
  
  // Find link stylesheet tag
  const linkMatch = htmlContent.match(/<link\s+rel="stylesheet"\s+href="([^"]+)"/i);
  const cssSrc = linkMatch ? linkMatch[1] : null;
  const relativeCss = cssSrc && cssSrc.startsWith('/') ? cssSrc.slice(1) : cssSrc;

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

  async function buildApp() {
    const buildResult = await Bun.build({
      entrypoints: [entrypoint],
      outdir: path.resolve(cwd, '.dev'),
      sourcemap: 'inline',
      plugins: [jotaiStateTreePlugin],
    });
    if (!buildResult.success) {
      console.error('\x1b[31m[jotai-state-tree] Bun Build failed:\x1b[0m');
      console.error(buildResult.logs);
    }
    return buildResult;
  }

  // Initial Build
  await buildApp();

  // Tailwind CSS v4 support
  const pkgJsonPath = path.resolve(cwd, 'package.json');
  const pkgJson = await Bun.file(pkgJsonPath).json();
  const hasTailwind = !!(pkgJson.dependencies?.tailwindcss || pkgJson.devDependencies?.tailwindcss);
  let tailwindProcess: any = null;

  if (hasTailwind) {
    const cssInput = relativeCss || 'src/index.css';
    const cssOutput = '.dev/index.css';
    console.log(`\x1b[34m[jotai-state-tree]\x1b[0m Tailwind CSS detected. Compiling ${cssInput} -> ${cssOutput}...`);
    // Ensure .dev directory exists
    await Bun.write(path.resolve(cwd, '.dev/.keep'), '');
    tailwindProcess = Bun.spawn([
      'bunx',
      'tailwindcss',
      '-i',
      cssInput,
      '-o',
      cssOutput,
      '--watch'
    ], {
      stdout: 'inherit',
      stderr: 'inherit',
    });
  }

  // WebSocket clients for reload
  const sockets = new Set<any>();

  // Dev server
  const server = serve({
    port: 3000,
    async fetch(req, server) {
      const url = new URL(req.url);
      const pathname = url.pathname;

      if (pathname === '/ws-reload') {
        const success = server.upgrade(req);
        if (success) return undefined;
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      if (pathname === '/' || pathname === '/index.html') {
        let processedHtml = htmlContent;
        
        const reloadScript = `
        <script>
          (function() {
            const ws = new WebSocket("ws://" + location.host + "/ws-reload");
            ws.onmessage = (event) => {
              if (event.data === "reload") {
                console.log("[jotai-state-tree] File change detected. Reloading page...");
                location.reload();
              }
            };
            ws.onclose = () => {
              console.log("[jotai-state-tree] Live reload connection lost. Reconnecting in 1s...");
              setTimeout(() => location.reload(), 1000);
            };
          })();
        </script>
        `;

        if (processedHtml.includes('</body>')) {
          processedHtml = processedHtml.replace('</body>', `${reloadScript}</body>`);
        } else {
          processedHtml = processedHtml + reloadScript;
        }

        // Rewrite entry point script
        if (scriptMatch) {
          const originalSrc = scriptMatch[1];
          const newSrc = originalSrc.endsWith('.tsx')
            ? originalSrc.replace('.tsx', '.js').replace('/src/', '/')
            : originalSrc.replace('.ts', '.js').replace('/src/', '/');
          processedHtml = processedHtml.replace(scriptMatch[0], scriptMatch[0].replace(originalSrc, newSrc));
        }

        // Rewrite/inject CSS
        if (linkMatch) {
          const originalHref = linkMatch[1];
          const newHref = originalHref.replace('/src/', '/');
          processedHtml = processedHtml.replace(linkMatch[0], linkMatch[0].replace(originalHref, newHref));
        } else {
          // Check if Bun.build outputted a CSS file
          const entryBasename = path.basename(entrypoint, path.extname(entrypoint));
          const cssFileExists = await Bun.file(path.resolve(cwd, `.dev/${entryBasename}.css`)).exists();
          if (cssFileExists) {
            const cssLink = `<link rel="stylesheet" href="/${entryBasename}.css" />`;
            if (processedHtml.includes('</head>')) {
              processedHtml = processedHtml.replace('</head>', `${cssLink}</head>`);
            } else {
              processedHtml = cssLink + processedHtml;
            }
          }
        }

        return new Response(processedHtml, { headers: { 'Content-Type': 'text/html' } });
      }

      // Serve compiled JS entry point
      const entryBasename = path.basename(entrypoint, path.extname(entrypoint));
      if (pathname === `/${entryBasename}.js`) {
        const file = Bun.file(path.resolve(cwd, `.dev/${entryBasename}.js`));
        if (await file.exists()) {
          return new Response(file, { headers: { 'Content-Type': 'application/javascript' } });
        }
      }

      // Serve compiled CSS file
      if (pathname === `/${entryBasename}.css`) {
        const file = Bun.file(path.resolve(cwd, `.dev/${entryBasename}.css`));
        if (await file.exists()) {
          return new Response(file, { headers: { 'Content-Type': 'text/css' } });
        }
      }

      // Serve Tailwind CSS output
      if (pathname === '/index.css') {
        const file = Bun.file(path.resolve(cwd, `.dev/index.css`));
        if (await file.exists()) {
          return new Response(file, { headers: { 'Content-Type': 'text/css' } });
        }
        // Fallback if Tailwind CSS compilation is pending
        if (hasTailwind) {
          return new Response("Tailwind CSS compiling...", { status: 503 });
        }
      }

      // Fallback for raw files requested directly (like raw src/index.css or static assets)
      let resolvedPath = path.resolve(cwd, pathname.startsWith('/') ? pathname.slice(1) : pathname);
      let file = Bun.file(resolvedPath);
      if (await file.exists()) {
        const ext = path.extname(resolvedPath);
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        return new Response(file, { headers: { 'Content-Type': contentType } });
      }

      // Try serving from public folder or project-level static files if exist
      resolvedPath = path.resolve(cwd, 'public', pathname.startsWith('/') ? pathname.slice(1) : pathname);
      file = Bun.file(resolvedPath);
      if (await file.exists()) {
        const ext = path.extname(resolvedPath);
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        return new Response(file, { headers: { 'Content-Type': contentType } });
      }

      // SPA routing fallback: serve the rewritten index.html for unknown routes
      return new Response(htmlContent, { headers: { 'Content-Type': 'text/html' } });
    },
    websocket: {
      open(ws) {
        sockets.add(ws);
      },
      close(ws) {
        sockets.delete(ws);
      },
      message(ws, message) {}
    }
  });

  // Watch for changes in src/
  let debounceTimeout: Timer | null = null;
  const debouncedRebuild = () => {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(async () => {
      console.log(`[jotai-state-tree] Rebuilding...`);
      const res = await buildApp();
      if (res.success) {
        console.log(`[jotai-state-tree] Rebuilt successfully. Sending reload...`);
        for (const socket of sockets) {
          socket.send('reload');
        }
      }
    }, 100);
  };

  const srcDir = path.resolve(cwd, 'src');
  watch(srcDir, { recursive: true }, (event, filename) => {
    if (filename) {
      debouncedRebuild();
    }
  });

  // Also watch index.html
  watch(htmlPath, async () => {
    console.log(`[jotai-state-tree] index.html changed. Reloading...`);
    htmlContent = await Bun.file(htmlPath).text();
    for (const socket of sockets) {
      socket.send('reload');
    }
  });

  console.log(`\x1b[32m[jotai-state-tree]\x1b[0m Dev server running at http://localhost:3000`);

  // Handle cleanup
  const cleanup = () => {
    if (tailwindProcess) {
      tailwindProcess.kill();
    }
    process.exit();
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
