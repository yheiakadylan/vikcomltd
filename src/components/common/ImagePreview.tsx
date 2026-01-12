import React, { useState, useRef, useEffect } from 'react';
import { CloseOutlined, ZoomInOutlined, ZoomOutOutlined, RotateRightOutlined } from '@ant-design/icons';

interface ImagePreviewProps {
    src: string;
    visible: boolean;
    onClose: () => void;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ src, visible, onClose }) => {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [rotate, setRotate] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const imageRef = useRef<HTMLImageElement>(null);

    // Reset state when opening
    useEffect(() => {
        if (visible) {
            setScale(1);
            setPosition({ x: 0, y: 0 });
            setRotate(0);
        }
    }, [visible, src]);

    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        const delta = e.deltaY * -0.001; // Sensitivity
        const newScale = Math.min(Math.max(0.1, scale + delta), 5); // Limit zoom 0.1x to 5x
        setScale(newScale);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - startPos.x,
            y: e.clientY - startPos.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    if (!visible) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.85)',
                zIndex: 2000,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
                userSelect: 'none'
            }}
            onWheel={handleWheel}
            onClick={onClose} // Click background to close
        >
            {/* Controls */}
            <div
                style={{
                    position: 'absolute',
                    top: 24,
                    right: 24,
                    display: 'flex',
                    gap: 16,
                    zIndex: 2001
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="preview-action-btn" onClick={() => setScale(s => Math.min(s + 0.1, 5))}>
                    <ZoomInOutlined />
                </div>
                <div className="preview-action-btn" onClick={() => setScale(s => Math.max(s - 0.1, 0.1))}>
                    <ZoomOutOutlined />
                </div>
                <div className="preview-action-btn" onClick={() => setRotate(r => r + 90)}>
                    <RotateRightOutlined />
                </div>
                <div className="preview-action-btn close" onClick={onClose}>
                    <CloseOutlined />
                </div>
            </div>

            {/* Image Container */}
            <div
                style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotate}deg)`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                    cursor: isDragging ? 'grabbing' : 'grab',
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={(e) => e.stopPropagation()} // Prevent close when clicking image
            >
                <img
                    ref={imageRef}
                    src={src}
                    alt="Preview"
                    draggable={false}
                    style={{
                        maxWidth: '90vw',
                        maxHeight: '90vh',
                        display: 'block',
                        pointerEvents: 'none', // Allow mouse events to bubble to container
                    }}
                />
            </div>

            {/* Hint */}
            <div style={{
                position: 'absolute',
                bottom: 20,
                color: 'rgba(255,255,255,0.6)',
                pointerEvents: 'none'
            }}>
                Scroll to zoom • Drag to move • Click outside to close
            </div>

            <style>{`
                .preview-action-btn {
                    color: white;
                    background: rgba(255,255,255,0.1);
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 20px;
                    transition: all 0.2s;
                }
                .preview-action-btn:hover {
                    background: rgba(255,255,255,0.3);
                    transform: scale(1.1);
                }
                .preview-action-btn.close {
                   background: rgba(255, 77, 79, 0.5);
                }
                .preview-action-btn.close:hover {
                   background: rgba(255, 77, 79, 0.8);
                }
            `}</style>
        </div>
    );
};

export default ImagePreview;
