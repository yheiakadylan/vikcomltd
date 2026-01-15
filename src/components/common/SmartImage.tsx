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
    const [imgLoading, setImgLoading] = useState(true);

    const objectFitStyle: React.CSSProperties['objectFit'] = (fit === 'inside' || fit === 'contain') ? 'contain' : 'cover';

    useEffect(() => {
        if (src) {
            setHasError(false);
            setImgLoading(true);
        } else {
            setImgLoading(false);
            setHasError(true);
        }
    }, [src]);

    const handleError = () => {
        setHasError(true);
        setImgLoading(false);
    };

    const handleLoad = () => {
        setImgLoading(false);
    };

    const displaySrc = React.useMemo(() => {
        const shouldOptimize = src && (src.startsWith('http') || src.startsWith('https'));

        return shouldOptimize
            ? getOptimizedImageUrl(
                src,
                typeof width === 'number' ? width : 800,
                typeof height === 'number' ? height : 600,
                fit
            )
            : src;
    }, [src, width, height, fit]);

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
                key={displaySrc}
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
                        src: src
                    }) : false
                }
                placeholder={null}
            />
        </div>
    );
};

export default SmartImage;
