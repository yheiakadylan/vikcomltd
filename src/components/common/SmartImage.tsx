import React, { useState, useEffect } from 'react';
import { Image, Skeleton, Button } from 'antd';
import { FileImageOutlined, LinkOutlined } from '@ant-design/icons';
import { getOptimizedImageUrl } from '../../utils/image';

interface SmartImageProps {
    src?: string; // Firebase URL (Hot Storage)
    backupSrc?: string; // Dropbox URL (Cold Storage)
    alt?: string;
    width?: string | number;
    height?: string | number;
    style?: React.CSSProperties;
    className?: string;
    preview?: boolean | object;
    fallback?: string;
    placeholder?: React.ReactNode;
    updatedAt?: string | number | Date;
    fit?: 'cover' | 'contain' | 'inside' | 'outside';
    // Cost Optimization: Prioritize Dropbox for old/completed tasks
    taskStatus?: string; // 'done' | 'in_review' | etc.
    taskUpdatedAt?: string | number | Date; // Task last update time
    dropboxPath?: string; // For fallback UI
}

const SmartImage: React.FC<SmartImageProps> = ({
    src,
    backupSrc,
    width,
    height,
    alt,
    style,
    className,
    preview = true,
    fallback = "https://placehold.co/400x300?text=No+Image",
    updatedAt,
    fit = 'cover',
    taskStatus,
    taskUpdatedAt,
    dropboxPath
}) => {
    // Cost Optimization: Smart source selection
    const shouldPrioritizeDropbox = () => {
        if (!backupSrc) return false;

        // Priority 1: Task is done -> Always use Dropbox
        if (taskStatus === 'done') return true;

        // Priority 2: Task in_review/need_fix for > 10 days -> Use Dropbox
        if (taskStatus === 'in_review' || taskStatus === 'need_fix') {
            if (taskUpdatedAt) {
                const updatedDate = new Date(taskUpdatedAt);
                const daysSinceUpdate = (Date.now() - updatedDate.getTime()) / (1000 * 60 * 60 * 24);
                if (daysSinceUpdate > 10) return true;
            }
        }

        return false;
    };

    const preferDropbox = shouldPrioritizeDropbox();
    const initialSrc = preferDropbox ? backupSrc : (src || backupSrc);

    const [currentSrc, setCurrentSrc] = useState<string | undefined>(initialSrc);
    const [hasError, setHasError] = useState(false);
    const [imgLoading, setImgLoading] = useState(true);
    const [sourceType, setSourceType] = useState<'firebase' | 'dropbox' | 'fallback'>(preferDropbox ? 'dropbox' : 'firebase');

    // Memoize to prevent recalculation on every render
    const preferDropboxMemo = React.useMemo(() => shouldPrioritizeDropbox(), [backupSrc, taskStatus, taskUpdatedAt]);

    // Filter out 'placeholder' from props if not used, or pass it to Image if intended.
    // Since we use custom Skeleton overlay, we ignore 'placeholder' prop here.

    // Map custom fit to valid CSS object-fit
    const objectFitStyle: React.CSSProperties['objectFit'] = (fit === 'inside' || fit === 'contain') ? 'contain' : 'cover';

    useEffect(() => {
        // Use memoized value
        const shouldUseDropbox = preferDropboxMemo;

        if (shouldUseDropbox && backupSrc) {
            setCurrentSrc(backupSrc);
            setSourceType('dropbox');
            setHasError(false);
            setImgLoading(true);
        } else if (src) {
            setCurrentSrc(src);
            setSourceType('firebase');
            setHasError(false);
            setImgLoading(true);
        } else if (backupSrc) {
            setCurrentSrc(backupSrc);
            setSourceType('dropbox');
            setHasError(false);
            setImgLoading(true);
        } else {
            setImgLoading(false);
            setHasError(true);
        }

        // Safety timeout
        const timer = setTimeout(() => {
            setImgLoading(false);
        }, 8000);

        return () => clearTimeout(timer);
    }, [src, backupSrc, preferDropboxMemo]); // Only re-run when actual URLs or priority changes

    const handleError = () => {
        // Fallback chain: Try next source
        if (sourceType === 'dropbox' && src) {
            console.log("SmartImage: Dropbox failed, trying Firebase...");
            setCurrentSrc(src);
            setSourceType('firebase');
        } else if (sourceType === 'firebase' && backupSrc && currentSrc !== backupSrc) {
            console.log("SmartImage: Firebase failed, trying Dropbox...");
            setCurrentSrc(backupSrc);
            setSourceType('dropbox');
        } else {
            console.log("SmartImage: All sources failed.");
            setHasError(true);
            setImgLoading(false);
        }
    };

    const handleLoad = () => {
        setImgLoading(false);
    };

    // Optimization Logic - Memoized to prevent recalculation
    const displaySrc = React.useMemo(() => {
        const shouldOptimize = currentSrc && (currentSrc.startsWith('http') || currentSrc.startsWith('https'));

        return shouldOptimize
            ? getOptimizedImageUrl(
                currentSrc,
                typeof width === 'number' ? width : 800,
                typeof height === 'number' ? height : 600,
                fit,
                updatedAt
            )
            : currentSrc;
    }, [currentSrc, width, height, fit, updatedAt]);

    // Custom Error UI with Dropbox path fallback
    if (hasError) {
        return (
            <div
                style={{
                    width: width || '100%',
                    height: height || '100%',
                    background: '#fff1f0',
                    border: '1px dashed #ffccc7',
                    borderRadius: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ff4d4f',
                    gap: 8,
                    padding: 16,
                    ...style
                }}
                className={className}
            >
                <FileImageOutlined style={{ fontSize: 24 }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>Unable to load image</span>
                {dropboxPath && (
                    <div style={{ fontSize: 11, color: '#999', textAlign: 'center', marginTop: 4 }}>
                        Path: {dropboxPath}
                    </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {backupSrc && (
                        <Button
                            size="small"
                            type="dashed"
                            icon={<LinkOutlined />}
                            onClick={() => window.open(backupSrc, '_blank')}
                        >
                            Dropbox
                        </Button>
                    )}
                    {src && (
                        <Button
                            size="small"
                            type="dashed"
                            danger
                            icon={<LinkOutlined />}
                            onClick={() => window.open(src, '_blank')}
                        >
                            Firebase
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', width, height, ...style }} className={className}>
            {/* Skeleton Overlay */}
            {imgLoading && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 2, background: '#f5f5f5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none',
                    transition: 'opacity 0.3s'
                }}>
                    <Skeleton.Image active />
                </div>
            )}

            <Image
                key={displaySrc} // Critical: Force re-mount on src change to validly fire onLoad
                src={displaySrc}
                alt={alt || "Smart Image"}
                width="100%"
                height="100%"
                style={{ objectFit: objectFitStyle, display: 'block' }}
                onError={handleError}
                onLoad={handleLoad}
                fallback={fallback}
                preview={
                    preview ? (typeof preview === 'object' ? preview : {
                        src: currentSrc
                    }) : false
                }
                placeholder={null}
            />
        </div>
    );
};

export default SmartImage;
