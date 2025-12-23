export const generateReadme = (title, url) => `
# ${title}

Converted from WebSim: ${url}

## Quick Start

1. **Setup**: Install dependencies and register the app.
   \`\`\`bash
   npm run setup
   \`\`\`
   *Note: Requires Node.js and the Devvit CLI (\`npm i -g devvit\`).*

2. **Run**: Start the emulator.
   \`\`\`bash
   npm run dev
   \`\`\`
   *Access the emulator at http://localhost:5173 (or as indicated in terminal).*

## How it Works

- **Client Files**: The \`src/client/\` directory contains the game files. These are built and served from \`dist/client/\` inside a webview in the Reddit app.
- **Server Files**: The \`src/server/\` directory contains the Express.js server that handles Reddit API calls and Redis storage.
- **Logging**: Console logs from the game are piped to your terminal. Look for lines starting with \`[Web]\`.
- **Validation**: The \`npm run setup\` command runs \`scripts/validate.js\` to check for common issues (CSP violations, missing files).

## Project Structure

\`\`\`
├── src/
│   ├── client/          # Web view files (HTML, JS, CSS, assets)
│   │   ├── index.html   # Main entry point
│   │   ├── vite.config.ts
│   │   └── ...
│   └── server/          # Express.js server
│       ├── index.ts     # Server entry point
│       └── vite.config.ts
├── dist/                # Build output (generated)
│   ├── client/          # Built web view files
│   └── server/          # Server build artifact (for validation)
├── scripts/             # Build and validation scripts
├── devvit.json          # Devvit configuration
└── package.json
\`\`\`

## Troubleshooting

- **"App doesn't exist"**: Run \`npx devvit upload\` manually.
- **"Invalid token/syntax"**: Ensure your Node version is up to date (v18+).
- **"config is not allowed to have the additional property"**: Check that devvit.json follows the correct schema. Don't add unsupported properties.
- **White Screen/Loading Forever**: Check the terminal for JS errors.
  - If you see "Content Security Policy" warnings, some external resources might be blocked by Reddit's strict security rules.
  - Verify \`dist/client/index.html\` exists after build and has content.
- **Large Bundle Warning**: Your client bundle is large. Consider code-splitting with dynamic imports if the app feels slow.

## Modifications

To modify the game:
- Edit files in \`src/client/\`
- Run \`npm run build:client\` to rebuild

To modify the Reddit server wrapper:
- Edit \`src/server/index.ts\`
- Run \`npm run build:server\` to rebuild

To modify configuration:
- Edit \`devvit.json\` for app permissions, triggers, and menu items
- Edit \`package.json\` for dependencies

## Common Development Commands

\`\`\`bash
npm run dev          # Start local emulator
npm run build        # Build both client and server
npm run validate     # Check for common issues
npm run register     # Register/upload app to Reddit
devvit logs          # View production logs
\`\`\`

## Feedback & Debugging

If you encounter bugs, please include the full logs from the terminal in your report.
Check the console in the emulator web interface and your terminal for error messages.
`;

