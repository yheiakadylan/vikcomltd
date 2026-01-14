import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { url, filename } = req.query;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid "url" parameter' });
    }

    try {
        const fileResponse = await fetch(url);

        if (!fileResponse.ok) {
            return res.status(fileResponse.status).json({ error: `Failed to fetch file: ${fileResponse.statusText}` });
        }

        // Set Content-Disposition to force download
        const downloadFilename = (typeof filename === 'string' && filename) ? filename : 'downloaded-file';
        // Content-Disposition: attachment; filename="safe_name.ext"; filename*=UTF-8''encoded_name.ext
        // We must ensure the "fallback" filename is ASCII only to prevent invalid character errors
        const safeFilename = downloadFilename.replace(/[^\x20-\x7E]/g, '_');
        const encodedFilename = encodeURIComponent(downloadFilename);

        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`);
        res.setHeader('Content-Type', fileResponse.headers.get('content-type') || 'application/octet-stream');

        // Stream the response
        if (fileResponse.body) {
            // @ts-ignore - node-fetch body is compatible with node stream
            fileResponse.body.pipe(res);
        } else {
            res.end();
        }
    } catch (error) {
        console.error('Proxy download error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
