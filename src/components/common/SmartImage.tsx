import React, { useState, useEffect } from 'react';
import { Image, Skeleton, Button } from 'antd';
import { FileImageOutlined, LinkOutlined } from '@ant-design/icons';
import { getOptimizedImageUrl } from '../../utils/image';

interface SmartImageProps {
    src?: string; // Expecting firebaseUrl or whatever is in the main field
    backupSrc?: string; // Expecting dropboxUrl or backup link
    alt?: string;
    width?: string | number;
    height?: string | number;
    style?: React.CSSProperties;
    className?: string;
    preview?: boolean | object;
    fallback?: string; // This is for Ant Design Image fallback URL
    placeholder?: React.ReactNode;
    updatedAt?: string | number | Date;
    fit?: 'cover' | 'contain' | 'inside' | 'outside';
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
    fit = 'cover'
}) => {
    const [currentSrc, setCurrentSrc] = useState<string | undefined>(src);
    const [hasError, setHasError] = useState(false);
    const [imgLoading, setImgLoading] = useState(true);

    // Filter out 'placeholder' from props if not used, or pass it to Image if intended.
    // Since we use custom Skeleton overlay, we ignore 'placeholder' prop here.

    // Map custom fit to valid CSS object-fit
    const objectFitStyle: React.CSSProperties['objectFit'] = (fit === 'inside' || fit === 'contain') ? 'contain' : 'cover';

    useEffect(() => {
        // Reset state when src props change
        if (src) {
            setCurrentSrc(src);
            setHasError(false);
            setImgLoading(true);
        } else if (backupSrc) {
            setCurrentSrc(backupSrc);
            setHasError(false);
            setImgLoading(true);
        } else {
            // If NO src and NO backupSrc is provided
            setImgLoading(false);
            setHasError(true);
        }

        // Safety: Timeout to force stop loading if onLoad misses
        const timer = setTimeout(() => {
            setImgLoading(false);
        }, 8000);

        return () => clearTimeout(timer);
    }, [src, backupSrc]);

    const handleError = () => {
        if (!hasError && currentSrc === src && backupSrc) {
            console.log("SmartImage: Primary src failed, switching to backup.");
            setCurrentSrc(backupSrc);
            // Don't stop loading yet, allow backup to try loading
        } else {
            console.log("SmartImage: All sources failed.");
            setHasError(true);
            setImgLoading(false); // Stop loading if error confirms
        }
    };

    const handleLoad = () => {
        setImgLoading(false);
    };

    // Optimization Logic
    const shouldOptimize = currentSrc && (currentSrc.startsWith('http') || currentSrc.startsWith('https'));

    const displaySrc = shouldOptimize
        ? getOptimizedImageUrl(
            currentSrc,
            typeof width === 'number' ? width : 800,
            typeof height === 'number' ? height : 600,
            fit,
            updatedAt
        )
        : currentSrc;

    // Custom Error UI
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
                {currentSrc && (
                    <Button
                        size="small"
                        type="dashed"
                        danger
                        icon={<LinkOutlined />}
                        onClick={() => window.open(currentSrc, '_blank')}
                    >
                        Open Original
                    </Button>
                )}
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
