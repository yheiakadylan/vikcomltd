/**
 * Convert Firebase Storage download URL to public URL (without expiring token)
 * 
 * @param downloadUrl - The download URL from Firebase Storage (with token)
 * @returns Public URL without token (永久有效 / không hết hạn)
 * 
 * @example
 * const downloadUrl = "https://firebasestorage.googleapis.com/v0/b/bucket/o/path%2Ffile.jpg?alt=media&token=abc123";
 * const publicUrl = getPublicStorageUrl(downloadUrl);
 * // Returns: "https://firebasestorage.googleapis.com/v0/b/bucket/o/path%2Ffile.jpg?alt=media"
 */
export function getPublicStorageUrl(downloadUrl: string): string {
    try {
        const url = new URL(downloadUrl);
        // Remove token parameter to make URL permanent
        url.searchParams.delete('token');
        return url.toString();
    } catch (error) {
        console.error('Invalid URL:', downloadUrl);
        return downloadUrl; // Return original if parsing fails
    }
}

/**
 * Convert Firebase Storage path to Google Cloud Storage direct URL
 * 
 * @param storagePath - Firebase Storage path (e.g., "folder/file.jpg")
 * @param bucketName - Firebase Storage bucket name (e.g., "dashboard-13ec8.firebasestorage.app")
 * @returns Google Cloud Storage direct URL
 * 
 * @example
 * const directUrl = getDirectStorageUrl("PINK_POD_SYSTEM/FULFILL/2026/01/file.jpg", "dashboard-13ec8.firebasestorage.app");
 * // Returns: "https://storage.googleapis.com/dashboard-13ec8.firebasestorage.app/PINK_POD_SYSTEM/FULFILL/2026/01/file.jpg"
 */
export function getDirectStorageUrl(storagePath: string, bucketName: string): string {
    return `https://storage.googleapis.com/${bucketName}/${storagePath}`;
}

/**
 * Get bucket name from Firebase Storage download URL
 * 
 * @param downloadUrl - The download URL from Firebase Storage
 * @returns Bucket name or null if not found
 */
export function getBucketNameFromUrl(downloadUrl: string): string | null {
    try {
        const match = downloadUrl.match(/\/b\/([^\/]+)\/o\//);
        return match ? match[1] : null;
    } catch (error) {
        return null;
    }
}

/**
 * Get storage path from Firebase Storage download URL
 * 
 * @param downloadUrl - The download URL from Firebase Storage
 * @returns Decoded storage path or null if not found
 */
export function getStoragePathFromUrl(downloadUrl: string): string | null {
    try {
        const match = downloadUrl.match(/\/o\/([^?]+)/);
        return match ? decodeURIComponent(match[1]) : null;
    } catch (error) {
        return null;
    }
}
