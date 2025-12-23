import JSZip from 'jszip';
import { 
    cleanName, 
    AssetAnalyzer 
} from './processors.js';

import {
    generatePackageJson,
    generateDevvitJson,
    generateClientViteConfig,
    generateServerViteConfig,
    tsConfig,
    getMainTs,
    simpleLoggerJs,
    websimSocketPolyfill,
    websimStubsJs,
    websimPackageJs,
    jsxDevProxy,
    validateScript,
    setupScript,
    generateReadme
} from './templates.js';

export async function generateDevvitZip(projectMeta, assets, includeReadme = true) {
    const zip = new JSZip();
    
    const safeId = projectMeta.project.id ? projectMeta.project.id.slice(0, 4) : '0000';
    const rawSlug = cleanName(projectMeta.project.slug || "websim-game");
    const truncatedSlug = rawSlug.slice(0, 11);
    const projectSlug = `${truncatedSlug}-${safeId}`;
    const projectTitle = projectMeta.project.title || "WebSim Game";

    // Initialize Analyzer
    const analyzer = new AssetAnalyzer();
    const clientFiles = {};

    // 1. Process Assets
    for (const [path, content] of Object.entries(assets)) {
        if (path.includes('..')) continue;

        if (/\.(js|mjs|ts|jsx|tsx)$/i.test(path)) {
            const processed = analyzer.processJS(content, path);
            clientFiles[path] = processed;
        } else if (path.endsWith('.html')) {
            const { html, extractedScripts } = analyzer.processHTML(content, path.split('/').pop());
            clientFiles[path] = html;
            
            extractedScripts.forEach(script => {
                const parts = path.split('/');
                parts.pop();
                const dir = parts.join('/');
                const fullPath = dir ? `${dir}/${script.filename}` : script.filename;
                clientFiles[fullPath] = script.content;
            });
        } else if (path.endsWith('.css')) {
            clientFiles[path] = analyzer.processCSS(content, path);
        } else {
            clientFiles[path] = content;
        }
    }

    // 2. Configs
    const hasRemotion = !!analyzer.dependencies['remotion'];
    const hasReact = hasRemotion || !!analyzer.dependencies['react'];

    const extraDevDeps = {};
    if (hasReact) {
        extraDevDeps['@vitejs/plugin-react'] = '^4.2.0';
        extraDevDeps['@babel/core'] = '^7.23.0';
        extraDevDeps['@babel/preset-react'] = '^7.23.0';
    }

    zip.file("package.json", generatePackageJson(projectSlug, analyzer.dependencies, extraDevDeps));
    zip.file("devvit.json", generateDevvitJson(projectSlug, Array.from(analyzer.externalDomains)));
    zip.file("tsconfig.json", tsConfig);
    zip.file(".gitignore", "node_modules\n.devvit\ndist"); 

    if (includeReadme) {
        zip.file("README.md", generateReadme(projectTitle, `https://websim.ai/p/${projectMeta.project.id}`));
    }

    zip.file("scripts/setup.js", setupScript);
    zip.file("scripts/validate.js", validateScript);

    // 3. Client Folder (src/client)
    const srcFolder = zip.folder("src");
    const clientFolder = srcFolder.folder("client");
    
    clientFolder.file("vite.config.ts", generateClientViteConfig({ 
        hasReact, 
        hasRemotion, 
        hasTailwind: analyzer.hasTailwind 
    }));

    for (const [path, content] of Object.entries(clientFiles)) {
        clientFolder.file(path, content);
    }

    // Polyfills in src/client
    let combinedPolyfills = [simpleLoggerJs, websimSocketPolyfill, websimStubsJs].join('\n\n');
    
    // Inject CDN scripts that were removed from HTML
    if (analyzer.bundledInjections.length > 0) {
        const imports = analyzer.bundledInjections.map(pkg => `import ${JSON.stringify(pkg)};`).join('\n');
        combinedPolyfills = imports + '\n\n' + combinedPolyfills;
    }

    clientFolder.file("websim_polyfills.js", combinedPolyfills);
    clientFolder.file("websim_package.js", websimPackageJs);
    clientFolder.file("jsx-dev-proxy.js", jsxDevProxy);

    if (hasRemotion) {
        clientFolder.file("remotion_bridge.js", `
export * from 'remotion';
export { Player } from '@remotion/player';
        `.trim());
    }

    // 4. Server Folder (src/server)
    const serverFolder = srcFolder.folder("server");
    serverFolder.file("index.ts", getMainTs(projectTitle));
    serverFolder.file("vite.config.ts", generateServerViteConfig());
    
    const blob = await zip.generateAsync({ type: "blob" });
    return { blob, filename: `${projectSlug}-devvit.zip` };
}

