/**
 * Generates an optimized image URL using wsrv.nl global CDN.
 * This is used for "Display Only" images (thumbnails, previews) to improve performance.
 * 
 * @param url The original image URL (e.g. Firebase Storage URL)
 * @param width Target width
 * @param height Target height
 * @param fit Resize strategy ('cover', 'contain', 'inside', 'outside')
 * @returns The optimized URL served from wsrv.nl
 */
export const getOptimizedImageUrl = (
    url: string | undefined,
    width: number,
    height: number,
    fit: 'cover' | 'contain' | 'inside' | 'outside' = 'cover',
    version?: string | number | Date
): string => {
    if (!url) return '';

    // 1. Convert specific URLs if needed (e.g. Google Drive, etc.) - Currently none for Firebase

    // 2. Encode for wsrv.nl
    const encodedUrl = encodeURIComponent(url);

    // 3. Construct wsrv.nl URL
    // &we: WebP support
    // &il: Interlaced (progressive)
    // &q: Quality (80 is good balance)
    // &output: Force format (optional, rely on &we usually)
    let finalUrl = `https://wsrv.nl/?url=${encodedUrl}&w=${width}&h=${height}&fit=${fit}&we&il&q=80`;

    // 4. Append Version for Cache Busting (if provided)
    if (version) {
        // Simple timestamp format: YYYYMMDD_HHmm or just raw timestamp
        const vParams = version instanceof Date ? version.getTime() : version;
        finalUrl += `&v=${vParams}`;
    }

    return finalUrl;
};


