import React, { useState, useEffect } from 'react';
import { Image } from 'antd';
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
    fallback?: string;
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
    placeholder,
    updatedAt,
    fit = 'cover'
}) => {
    const [currentSrc, setCurrentSrc] = useState<string | undefined>(src);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        // Reset state when src props change
        if (src) {
            setCurrentSrc(src);
            setHasError(false);
        } else if (backupSrc) {
            setCurrentSrc(backupSrc);
        }
    }, [src, backupSrc]);

    const handleError = () => {
        if (!hasError && currentSrc === src && backupSrc) {
            console.log("SmartImage: Primary src failed, switching to backup.");
            setCurrentSrc(backupSrc);
            setHasError(true);
        }
    };

    // Optimization Logic
    const shouldOptimize = currentSrc && (currentSrc.startsWith('http') || currentSrc.startsWith('https'));

    const displaySrc = shouldOptimize
        ? getOptimizedImageUrl(
            currentSrc,
            typeof width === 'number' ? width : 400,
            typeof height === 'number' ? height : 300,
            fit,
            updatedAt
        )
        : currentSrc;

    return (
        <Image
            src={displaySrc}
            alt={alt || "Smart Image"}
            width={width}
            height={height}
            style={{ objectFit: 'cover', ...style }}
            className={className}
            onError={handleError}
            fallback={fallback}
            placeholder={placeholder}
            preview={
                preview ? (typeof preview === 'object' ? preview : {
                    src: currentSrc // Preview usually wants full res?
                }) : false
            }
        />
    );
};

export default SmartImage;
