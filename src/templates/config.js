export const generatePackageJson = (slug, dependencies = {}, devDependencies = {}) => JSON.stringify({
  "name": slug,
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "devvit playtest",
    "build:client": "cd src/client && vite build",
    "build:server": "cd src/server && vite build",
    "build": "npm run build:server && npm run build:client",
    "setup": "node scripts/setup.js", 
    "register": "devvit upload",
    "upload": "devvit upload",
    "validate": "node scripts/validate.js"
  },
  "dependencies": {
    "@devvit/public-api": "latest",
    "@devvit/kit": "latest",
    "@devvit/web": "latest",
    "@devvit/redis": "latest",
    "express": "^4.18.2",
    ...dependencies
  },
  "devDependencies": {
    "devvit": "latest",
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "terser": "^5.19.0",
    "@vitejs/plugin-react": "^4.2.0",
    "@babel/core": "^7.23.0",
    "@babel/preset-react": "^7.23.0",
    ...devDependencies
  }
}, null, 2);

export const generateDevvitJson = (slug, externalDomains = []) => JSON.stringify({
  "$schema": "https://developers.reddit.com/schema/config-file.v1.json",
  "name": slug,
  "post": {
    "dir": "dist/client",
    "entrypoints": {
      "default": {
        "entry": "index.html",
        "height": "tall"
      }
    }
  },
  "server": {
    "entry": "index.cjs"
  },
  "permissions": {
    "redis": true,
    "reddit": {
      "enable": true,
      "asUser": ["SUBMIT_POST", "SUBMIT_COMMENT"]
    },
    "http": {
        "enable": externalDomains.length > 0,
        "domains": externalDomains
    }
  },
  "triggers": {
    "onAppInstall": "/internal/onInstall"
  },
  "menu": {
    "items": [
      {
        "label": "Add Game Post",
        "location": "subreddit",
        "forUserType": "moderator",
        "endpoint": "/internal/createPost"
      }
    ]
  }
}, null, 2);

export const generateClientViteConfig = ({ hasReact = false, hasRemotion = false, hasTailwind = false } = {}) => `
import { defineConfig } from 'vite';
${hasReact ? "import react from '@vitejs/plugin-react';" : ""}
${hasTailwind ? "import tailwindcss from '@tailwindcss/vite';" : ""}

export default defineConfig({
  mode: 'production',
  base: './',
  plugins: [
    ${hasTailwind ? "tailwindcss()," : ""}
    ${hasReact ? `react({
      jsxRuntime: 'automatic', 
      // Force production runtime even if code tries to import dev
      jsxImportSource: 'react',
      include: "**/*.{jsx,tsx,js,ts}",
      babel: {
        babelrc: false,
        configFile: false,
        plugins: []
      }
    }),` : ''}
  ],
  resolve: {
    alias: {
      // CRITICAL: Remotion and some React libs might try to import jsx-dev-runtime in 'dev' mode.
      // We alias to a local proxy that implements jsxDEV using the production jsx runtime.
      'react/jsx-dev-runtime': '/jsx-dev-proxy.js',
      'react-dom/jsx-dev-runtime': '/jsx-dev-proxy.js',
      'react/jsx-runtime': 'react/jsx-runtime',
      'react-dom/jsx-runtime': 'react-dom/jsx-runtime',
      'remotion': 'remotion',
      'websim': '/websim_package.js'
    },
    // Ensure we prioritize browser builds
    mainFields: ['browser', 'module', 'main'],
  },
  assetsInclude: ['**/*.mp3', '**/*.wav', '**/*.ogg', '**/*.glb', '**/*.gltf', '**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif'],
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
    target: 'es2020',
    minify: 'esbuild',
    // Increase the chunk size warning limit to 1000 KB to reduce noise
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]",
        // Manual chunking to split large dependencies
        manualChunks(id) {
          // Split Three.js into its own chunk if present
          if (id.includes('node_modules/three')) {
            return 'three';
          }
          // Split Remotion into its own chunk if present
          if (id.includes('node_modules/remotion') || id.includes('node_modules/@remotion')) {
            return 'remotion';
          }
          // Split React into its own chunk if present
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
        }
      },
      external: [], 
    },
  },
  define: {
    // Hardcode production environment to prevent libs from taking dev paths
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.platform": JSON.stringify("browser"),
    // Remotion specific flags if needed
    "process.env.REMOTION_ENV": JSON.stringify("production"),
  },
  optimizeDeps: {
    include: [${hasReact ? "'react', 'react-dom', 'react/jsx-runtime'" : ""}, ${hasRemotion ? "'remotion', '@remotion/player'" : ""}]
  }
});
`;

export const tsConfig = JSON.stringify({
  "compilerOptions": {
    "target": "es2020",
    "module": "es2020",
    "moduleResolution": "node",
    "lib": ["es2020", "dom"],
    "jsx": "react",
    "jsxFactory": "Devvit.createElement",
    "jsxFragmentFactory": "Devvit.Fragment",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "noImplicitAny": false,
    "allowJs": true
  },
  "include": [
    "src"
  ]
}, null, 2);

export const generateServerViteConfig = () => `
import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';

export default defineConfig({
  ssr: {
    noExternal: true,
  },
  build: {
    ssr: 'index.ts',
    outDir: '../../dist/server',
    target: 'node22',
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      external: [...builtinModules],
      output: {
        format: 'cjs',
        entryFileNames: 'index.cjs',
        inlineDynamicImports: true,
      },
    },
  },
});
`;

