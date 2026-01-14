/**
 * Generates an optimized image URL using wsrv.nl global CDN.
 * This is used for "Display Only" images (thumbnails, previews) to improve performance.
 * 
 * @param url The original image URL (e.g. Dropbox URL)
 * @param width Target width
 * @param height Target height
 * @param fit Resize strategy ('cover', 'contain', 'inside', 'outside')
 * @returns The optimized URL served from wsrv.nl
 */
export const getOptimizedImageUrl = (
    url: string | undefined,
    width: number,
    height: number,
    fit: 'cover' | 'contain' = 'cover'
): string => {
    if (!url) return '';

    // 1. Convert Dropbox URL to direct link (?raw=1)
    let directUrl = url;
    if (url.includes('dropbox.com')) {
        // Strip existing params
        const clean = url.replace('?dl=0', '').replace('&dl=0', '').replace('?raw=1', '').replace('&raw=1', '');
        // Append raw=1
        directUrl = clean + (clean.includes('?') ? '&' : '?') + 'raw=1';
    }

    // 2. Encode for wsrv.nl
    const encodedUrl = encodeURIComponent(directUrl);

    // 3. Construct wsrv.nl URL
    // &we: webp (auto)
    // &il: interlaced/progressive
    // &n: number of pages (for pdf/gif, usually 1 for static thumb)
    return `https://wsrv.nl/?url=${encodedUrl}&w=${width}&h=${height}&fit=${fit}&we&il`;
};
