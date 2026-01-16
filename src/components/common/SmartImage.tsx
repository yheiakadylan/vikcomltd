import React, { useState, useEffect } from 'react';
import { Image, Skeleton, Button } from 'antd';
import { FileImageOutlined, LinkOutlined } from '@ant-design/icons';
import { getOptimizedImageUrl } from '../../utils/image';

interface SmartImageProps {
    src?: string; // Firebase URL
    alt?: string;
    width?: string | number;
    height?: string | number;
    style?: React.CSSProperties;
    className?: string;
    preview?: boolean | object;
    fallback?: string;
    fit?: 'cover' | 'contain' | 'inside' | 'outside';
}

const SmartImage: React.FC<SmartImageProps> = ({
    src,
    width,
    height,
    alt,
    style,
    className,
    preview = true,
    fallback = "https://placehold.co/400x300?text=No+Image",
    fit = 'cover',
}) => {
    const [hasError, setHasError] = useState(false);

    // 1. Retina/High-DPI Support
    const getTargetDimensions = () => {
        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        // Cap DPR at 3 to avoid excessive file sizes on mobile
        const finalDpr = Math.min(dpr, 3);

        const w = typeof width === 'number' ? Math.round(width * finalDpr) : 800;
        const h = typeof height === 'number' ? Math.round(height * finalDpr) : 600;
        return { w, h };
    };

    const [isUsingFallback, setIsUsingFallback] = useState(false);

    // Calculate displaySrc
    const displaySrc = React.useMemo(() => {
        // If fallback mode is active or no Image, return original
        if (isUsingFallback || !src) return src;

        const shouldOptimize = src.startsWith('http') || src.startsWith('https');
        if (!shouldOptimize) return src;

        const { w, h } = getTargetDimensions();

        return getOptimizedImageUrl(
            src,
            w,
            h,
            fit
        );
    }, [src, width, height, fit, isUsingFallback]);

    const isCached = React.useMemo(() => {
        if (typeof window === 'undefined' || !displaySrc) return false;
        const img = new window.Image();
        img.src = displaySrc;
        return img.complete;
    }, [displaySrc]);

    const [imgLoading, setImgLoading] = useState(!isCached);
    const objectFitStyle: React.CSSProperties['objectFit'] = (fit === 'inside' || fit === 'contain') ? 'contain' : 'cover';

    useEffect(() => {
        if (displaySrc) {
            // Reset error state when src changes
            if (!isUsingFallback) setHasError(false);

            if (isCached) {
                setImgLoading(false);
            } else {
                setImgLoading(true);
            }
        }
    }, [displaySrc, isCached, isUsingFallback]);

    // 2. Fail-safe Fallback
    const handleError = () => {
        if (!isUsingFallback && src && displaySrc !== src) {
            // If optimized image fails, try original
            console.warn(`SmartImage: Optimization failed for ${displaySrc}, falling back to original.`);
            setIsUsingFallback(true);
        } else {
            // If original also fails (or we were already using it), show error
            setHasError(true);
            setImgLoading(false);
        }
    };

    const handleLoad = () => {
        setImgLoading(false);
    };

    // Reset fallback if incoming src prop changes drastically
    useEffect(() => {
        setIsUsingFallback(false);
    }, [src]);

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
                {src && (
                    <Button
                        size="small"
                        type="dashed"
                        danger
                        icon={<LinkOutlined />}
                        onClick={() => window.open(src, '_blank')}
                    >
                        Image Link
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', width, height, ...style }} className={className}>
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
                key={displaySrc} // Force re-render if src changes (important for fallback switch)
                src={displaySrc}
                alt={alt || "Smart Image"}
                width="100%"
                height="100%"
                style={{ objectFit: objectFitStyle, display: 'block', opacity: imgLoading ? 0 : 1, transition: 'opacity 0.3s ease-in' }}
                onError={handleError}
                onLoad={handleLoad}
                fallback={fallback}
                preview={
                    preview ? (typeof preview === 'object' ? preview : {
                        src: src // Preview should always try to use Original High-Res
                    }) : false
                }
                placeholder={null}
                loading="lazy"
            />
        </div>
    );
};

export default SmartImage;
