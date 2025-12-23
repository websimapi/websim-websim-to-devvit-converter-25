export const validateScript = `
import fs from 'fs';
import path from 'path';

const WEBROOT = './dist/client';

function walk(dir, callback) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filepath = path.join(dir, file);
    const stats = fs.statSync(filepath);
    if (stats.isDirectory()) {
      walk(filepath, callback);
    } else {
      callback(filepath, stats);
    }
  });
}

console.log('🔍 Verifying Project Integrity...');

const SERVER_BUILD = './dist/server/index.cjs';
if (!fs.existsSync(SERVER_BUILD)) {
    console.error('❌ Server build missing at ' + SERVER_BUILD);
    console.error('   Expected: dist/server/index.cjs');
    if (fs.existsSync('./dist/server')) {
        console.log('   Contents of ./dist/server:', fs.readdirSync('./dist/server'));
    } else {
        console.log('   Folder ./dist/server does not exist.');
    }
    console.error('   The app will fail to upload. Check "npm run build:server" output.');
} else {
    console.log('✅ Server build found at dist/server/index.cjs');
}

console.log('🔍 Verifying Webroot Integrity...');

if (!fs.existsSync(WEBROOT)) {
    console.error('❌ Webroot folder missing!');
    process.exit(1);
}

const files = [];
walk(WEBROOT, (f, s) => files.push({ path: f, size: s.size }));
console.log(\`   Found \${files.length} files in webroot.\`);

let hasIndex = false;
let issues = 0;

files.forEach(fileObj => {
    const f = fileObj.path;
    if (f.endsWith('index.html')) hasIndex = true;
    
    // Check for 0 byte files
    if (fileObj.size === 0) {
        console.warn(\`⚠️  Empty file detected: \${f}\`);
        issues++;
    }

    // Check for text content in audio/binary files (common conversion error)
    if (/\\.(mp3|wav|ogg|glb|gltf)$/i.test(f)) {
        try {
            const buffer = fs.readFileSync(f);
            // Check first few bytes for common text signatures or error messages
            const head = buffer.subarray(0, 50).toString('utf8');
            if (head.includes('Error fetching asset') || head.trim().startsWith('<!DOCTYPE') || head.trim().startsWith('<html>')) {
                 console.error(\`❌ Corrupted Binary File: \${f}\`);
                 console.error(\`   It contains text/HTML. This will cause runtime errors (e.g. EncodingError).\`);
                 issues++;
            }
        } catch(e) {}
    }
    
    // Check content for remote URLs (CSP violators)
    if (f.endsWith('.html') || f.endsWith('.js')) {
        const content = fs.readFileSync(f, 'utf8');

        // Warning for .mjs usage
        if (f.endsWith('.mjs')) {
            console.warn(\`⚠️  .mjs file detected: \${f}. Devvit might serve this with wrong MIME type.\`);
            issues++;
        }
        
        // Check for http/https usage in imports/scripts
        // Only warn if it looks like a script source or import, avoiding common XML namespaces
        // We look for 'from "http' or 'src="http' specifically.
        // We use a regex that avoids matching "http://www.w3.org..." or redditstatic
        // Updated to handle https and be robust against replacement strings
        const remoteMatch = content.match(/src\\s*=\\s*['"](https?:\\/\\/(?!(www\\.w3\\.org|(\\w+\\.)?redditstatic\\.com|images\\.websim\\.ai|images\\.websim\\.com))[^'"]+)['"]/i);
        const importMatch = content.match(/from\\s+['"](http[^'"]+)/i);

        if (importMatch || remoteMatch) {
            console.warn(\`⚠️  Possible remote import in \${f}. Devvit may block this.\`);
            const match = importMatch || remoteMatch;
            if (match) console.warn(\`   Target: \${match[1]}\`);
            issues++;
        }

        // Check for inline scripts in HTML
        if (f.endsWith('.html')) {
             const scriptRegex = new RegExp('<script[^>]*>[^<]+</script>', 'i');
             // Ignore type="application/json" etc
             if (scriptRegex.test(content) && !content.includes('type="application/json"')) {
                 if (content.includes('console.log') || content.includes('function') || content.includes('var ') || content.includes('const ')) {
                     console.warn(\`⚠️  Potential inline script remaining in \${f}\`);
                     issues++;
                 }
             }
        }

        // Check for eval()
        if (content.includes('eval(')) {
             console.warn(\`⚠️  Dangerous 'eval()' usage detected in \${f}. This will likely be blocked by CSP.\`);
             issues++;
        }
    }
});

if (!hasIndex) {
    console.error('❌ No index.html found! The game will not load.');
    process.exit(1);
}

if (issues > 0) {
    console.log(\`\\n⚠️  Found \${issues} potential issues. See above warnings.\`);
    console.log('   Devvit Webviews are strict. External scripts must be downloaded locally.');
} else {
    console.log('✅ Webroot looks good!');
}
`;

export const setupScript = `
import { execSync } from 'child_process';
import fs from 'fs';
import readline from 'readline';

console.log('🚀 Setting up your Reddit Game...');

const ask = (q) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(r => rl.question(q, a => { rl.close(); r(a); }));
};

async function checkRemotion() {
    try {
        if (!fs.existsSync('package.json')) return;
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (Object.keys(deps).some(d => d.includes('remotion'))) {
            console.log('\\n🎥 \\x1b[36mRemotion Video Engine detected!\\x1b[0m');
            console.log('   Please select your usage type for licensing:');
            console.log('   1) Individual / Small Team (1-3 people) - Free/Indie');
            console.log('   2) Company / Large Team (4+ people) - Commercial License');
            const ans = await ask('   Select (1/2) [default: 1] > ');
            if (ans.trim() === '2') {
                const key = await ask('   Enter your Remotion License Key > ');
                if (key.trim()) {
                    fs.appendFileSync('.env', \`\\nREMOTION_LICENSE=\${key.trim()}\\n\`);
                    console.log('   ✅ License key saved to .env');
                } else console.warn('   ⚠️  No key entered. You may need to configure REMOTION_LICENSE later.');
            } else {
                console.log('   ✅ Configuring for Indie/Free usage (Prop injected automatically).');
            }
            console.log('');
        }
    } catch(e) {}
}



// 1. Check CLI
try {
    console.log('Checking for Devvit CLI...');
    execSync('devvit --version', { stdio: 'ignore' });
} catch (e) {
    console.error('❌ Devvit CLI not found.');
    console.log('Please install it globally: npm install -g devvit');
    process.exit(1);
}

// Check Remotion License
await checkRemotion();

// 2. Install Dependencies
console.log('📦 Installing dependencies...');
try {
    execSync('npm install', { stdio: 'inherit' });
} catch(e) {
    console.warn('⚠️ npm install had some issues, but continuing...');
    console.warn('   If the build fails, try running "npm install" manually.');
}

// 3. Build Project (Server & Client)
console.log('🔨 Building Project...');
try {
    execSync('npm run build', { stdio: 'inherit' });
    
    // Verify build output immediately
    if (!fs.existsSync('dist/server/index.cjs')) {
        console.error('❌ Server build validation failed!');
        console.log('   The local build (npm run build:server) failed to produce output.');
        console.log('   This usually means there is a syntax error in the server code.');
        process.exit(1);
    }

    // Verify Config
    if (fs.existsSync('devvit.json')) {
        const config = fs.readFileSync('devvit.json', 'utf8');
        if (!config.includes('"entry": "index.cjs"')) {
             console.warn('⚠️  devvit.json might have incorrect server entry path (expected "index.cjs").');
        }
    } else {
        console.warn('⚠️  devvit.json not found');
    }

} catch(e) {
    console.error('❌ Build failed!');
    process.exit(1);
}

// 4. Validation
console.log('🧐 Validating assets...');
try {
    execSync('node scripts/validate.js', { stdio: 'inherit' });
} catch(e) {
    console.warn('⚠️ Validation found issues.');
}

// 5. Check Login
console.log('🔒 Checking Devvit login status...');
try {
    execSync('devvit whoami', { stdio: 'ignore' });
} catch (e) {
    console.log('⚠️  You are not logged in to Devvit.');
    console.log('👉 Please run: npx devvit login');
    console.log('   Then run: npm run setup');
    process.exit(1);
}

// 6. Register App
console.log('✨ Registering App on Reddit...');
console.log('   IMPORTANT: If asked to create the app, please type "y" and press Enter!');
try {
    // Force upload to register
    execSync('npx devvit upload', { stdio: 'inherit' });
    console.log('✅ App registered successfully!');
} catch (e) {
    console.log('\\n⚠️  Registration process encountered an issue.');
    console.log('   If you saw a config error, the project structure might be invalid.');
    console.log('   If you simply declined the creation, run "npm run register" to try again.');
}

console.log('\\n🎮 Setup complete!');
console.log('To start the game emulator, run: npm run dev');
`;

