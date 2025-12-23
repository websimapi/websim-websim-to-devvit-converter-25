// WebSim API Integration
// Re-using the logic provided in the prompt, structured as an ES Module

const API_BASE = '/api/v1';

async function makeRequest(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
    }
    
    return response.json();
}

export function getProjectById(projectId) {
    return makeRequest(`/projects/${projectId}`);
}

export function getProjectBySlug(username, slug) {
    return makeRequest(`/users/${username}/slugs/${slug}`);
}

export function getProjectRevisions(projectId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return makeRequest(`/projects/${projectId}/revisions?${query}`);
}

export async function getAllProjectRevisions(projectId) {
    let allRevisions = [];
    let hasNextPage = true;
    let afterCursor = null;

    // Safety limit to prevent infinite loops on massive histories
    let pageCount = 0;
    const MAX_PAGES = 10;

    while (hasNextPage && pageCount < MAX_PAGES) {
        const params = { first: 50 };
        if (afterCursor) {
            params.after = afterCursor;
        }

        try {
            const response = await getProjectRevisions(projectId, params);
            if (response.revisions && response.revisions.data) {
                allRevisions = allRevisions.concat(response.revisions.data);
            }
            
            hasNextPage = response.revisions?.meta?.has_next_page || false;
            afterCursor = response.revisions?.meta?.end_cursor;
            
            if (!afterCursor) hasNextPage = false;
        } catch (e) {
            console.warn("Error fetching revision page", e);
            hasNextPage = false;
        }
        pageCount++;
    }

    return allRevisions;
}

export function getAssets(projectId, version) {
    return makeRequest(`/projects/${projectId}/revisions/${version}/assets`);
}

export function parseProjectIdentifier(input) {
    if (!input) return null;
    
    try {
        const url = new URL(input.startsWith('http') ? input : `https://${input}`);
        const pathname = url.pathname;

        const projectMatch = pathname.match(/^\/p\/([a-z0-9_-]{20})/);
        if (projectMatch) return { type: 'id', value: projectMatch[1] };

        const slugMatch = pathname.match(/^\/(@[^/]+)\/([^/]+)/);
        if (slugMatch) return { type: 'slug', username: slugMatch[1].substring(1), slug: slugMatch[2] };
        
        const cMatch = pathname.match(/^\/c\/([a-z0-9_-]{20})/);
        if (cMatch) return { type: 'id', value: cMatch[1] };

    } catch (e) { /* Not a URL */ }

    const atSlugMatch = input.match(/^@([^/]+)\/([^/]+)/);
    if (atSlugMatch) return { type: 'slug', username: atSlugMatch[1], slug: atSlugMatch[2] };

    const slugMatch = input.match(/^([a-zA-Z0-9_]{3,32})\/([a-zA-Z0-9-]{3,50})$/);
    if (slugMatch) return { type: 'slug', username: slugMatch[1], slug: slugMatch[2] };

    if (/^[a-z0-9_-]{20}$/.test(input)) return { type: 'id', value: input };

    throw new Error(`Invalid project identifier: "${input}".`);
}

export async function fetchProjectMetadata(identifier) {
    if (identifier.type === 'id') {
        return getProjectById(identifier.value);
    } else {
        return getProjectBySlug(identifier.username, identifier.slug);
    }
}

// Minimal 1x1 Transparent PNG
const EMPTY_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82
]);

// Minimal Silence WAV (44 bytes)
const EMPTY_WAV = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
  0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x44, 0xac, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00,
  0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00
]);

export async function processAssets(assetList) {
    const files = {};
    const encoder = new TextEncoder();

    if (!assetList || !Array.isArray(assetList)) {
        return files;
    }

    const promises = assetList.map(async (asset) => {
        if (!asset.path) return;
        
        const path = asset.path.replace(/^(\.|\/)+/, ''); // Clean path
        if (path.endsWith('/')) return; // Skip explicitly marked directories

        // Skip items that have neither content nor URL (likely directories in API response)
        if (asset.content === undefined && !asset.url) return;

        if (typeof asset.content === 'string') {
            files[path] = encoder.encode(asset.content);
            return;
        }
        
        if (!asset.content && asset.url) {
            try {
                // Handle relative URLs by resolving against current origin
                const fetchUrl = new URL(asset.url, window.location.origin).href;
                const res = await fetch(fetchUrl);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const blob = await res.arrayBuffer();
                
                // Validate content to avoid saving HTML error pages as binary assets
                if (/\.(mp3|wav|ogg|glb|gltf|png|jpg|jpeg|gif)$/i.test(path)) {
                    // 1. Content-Type Check
                    const contentType = res.headers.get('content-type');
                    // Some servers return text/plain for everything, so we trust signature more, 
                    // but text/html is almost always wrong for these extensions.
                    if (contentType && (contentType.includes('text/html') || contentType.includes('application/json'))) {
                        throw new Error(`Received invalid content-type: ${contentType}`);
                    }

                    // 2. Sniff content for text/json signatures
                    const header = new Uint8Array(blob.slice(0, 50));
                    const textHeader = new TextDecoder().decode(header).trim();
                    
                    // Check for common text file starts
                    if (textHeader.startsWith('<!DOCTYPE') || 
                        textHeader.startsWith('<html') || 
                        textHeader.startsWith('{') || // JSON start
                        textHeader.startsWith('Error') ||
                        textHeader.includes('AccessDenied') ||
                        textHeader.includes('NoSuchKey') ||
                        textHeader.includes('Cannot GET') ||
                        textHeader.includes('<head>') ||
                        textHeader.includes('<body>')) {
                            throw new Error(`Content sniffer detected text/error signature: "${textHeader.substring(0, 15)}..."`);
                    }
                    
                    // 3. Size check (too small = suspicious for media, unless it's pixel art/tiny sound)
                    if (blob.byteLength < 5) {
                        throw new Error('Asset too small to be valid.');
                    }
                }

                files[path] = new Uint8Array(blob);
            } catch (e) {
                console.warn(`[Asset Warning] Failed to load ${path}:`, e.message);
                
                // Provide fallback assets to prevent runtime crashes (e.g. EncodingError on decodeAudioData)
                if (/\.(mp3|wav|ogg)$/i.test(path)) {
                    console.log(`   -> Using fallback silence for ${path}`);
                    files[path] = EMPTY_WAV;
                } else if (/\.(png|jpg|jpeg|gif)$/i.test(path)) {
                    console.log(`   -> Using fallback transparent pixel for ${path}`);
                    files[path] = EMPTY_PNG;
                }
            }
            return;
        }

        if (asset.content && typeof asset.content === 'object') {
            files[path] = encoder.encode(JSON.stringify(asset.content));
            return;
        }

        // If we got here, we have a weird asset type, skip or mark empty
        // But to avoid validation errors, let's skip if it's truly empty/unknown
        if (!asset.content && !asset.url) return;

        files[path] = new Uint8Array(0);
    });

    await Promise.all(promises);
    return files;
}

