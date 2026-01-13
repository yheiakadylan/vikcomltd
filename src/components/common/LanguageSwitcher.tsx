import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const USFlag = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 30" width="30" height="18">
        <rect width="50" height="30" fill="#b22234" />
        <rect width="50" y="3.8" fill="#fff" height="2.3" />
        <rect width="50" y="7.7" fill="#fff" height="2.3" />
        <rect width="50" y="11.5" fill="#fff" height="2.3" />
        <rect width="50" y="15.4" fill="#fff" height="2.3" />
        <rect width="50" y="19.2" fill="#fff" height="2.3" />
        <rect width="50" y="23" fill="#fff" height="2.3" />
        <rect width="20" height="15.4" fill="#3c3b6e" />
        {/* Simplified stars representation for small icon size */}
        <g fill="#fff">
            <circle cx="2" cy="2" r="0.8" /><circle cx="5" cy="2" r="0.8" /><circle cx="8" cy="2" r="0.8" /><circle cx="11" cy="2" r="0.8" /><circle cx="14" cy="2" r="0.8" /><circle cx="17" cy="2" r="0.8" />
            <circle cx="3.5" cy="4" r="0.8" /><circle cx="6.5" cy="4" r="0.8" /><circle cx="9.5" cy="4" r="0.8" /><circle cx="12.5" cy="4" r="0.8" /><circle cx="15.5" cy="4" r="0.8" />
            <circle cx="2" cy="6" r="0.8" /><circle cx="5" cy="6" r="0.8" /><circle cx="8" cy="6" r="0.8" /><circle cx="11" cy="6" r="0.8" /><circle cx="14" cy="6" r="0.8" /><circle cx="17" cy="6" r="0.8" />
            <circle cx="3.5" cy="8" r="0.8" /><circle cx="6.5" cy="8" r="0.8" /><circle cx="9.5" cy="8" r="0.8" /><circle cx="12.5" cy="8" r="0.8" /><circle cx="15.5" cy="8" r="0.8" />
            <circle cx="2" cy="10" r="0.8" /><circle cx="5" cy="10" r="0.8" /><circle cx="8" cy="10" r="0.8" /><circle cx="11" cy="10" r="0.8" /><circle cx="14" cy="10" r="0.8" /><circle cx="17" cy="10" r="0.8" />
            <circle cx="3.5" cy="12" r="0.8" /><circle cx="6.5" cy="12" r="0.8" /><circle cx="9.5" cy="12" r="0.8" /><circle cx="12.5" cy="12" r="0.8" /><circle cx="15.5" cy="12" r="0.8" />
            <circle cx="2" cy="14" r="0.8" /><circle cx="5" cy="14" r="0.8" /><circle cx="8" cy="14" r="0.8" /><circle cx="11" cy="14" r="0.8" /><circle cx="14" cy="14" r="0.8" /><circle cx="17" cy="14" r="0.8" />
        </g>
    </svg>
);

const VNFlag = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 30" width="30" height="18">
        <rect width="50" height="30" fill="#da251d" />
        <polygon points="25,4 27.5,12 36,12 29,17.5 31.5,25.5 25,20.5 18.5,25.5 21,17.5 14,12 22.5,12" fill="#ffcd00" />
    </svg>
);

const LanguageSwitcher: React.FC = () => {
    const { language, setLanguage } = useLanguage();

    const switchStyle = (isActive: boolean) => ({
        cursor: 'pointer',
        opacity: isActive ? 1 : 0.4,
        transform: isActive ? 'scale(1.1)' : 'scale(1)',
        transition: 'all 0.2s ease',
        border: isActive ? '2px solid #eb2f96' : '1px solid #d9d9d9',
        borderRadius: 4,
        padding: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: isActive ? '0 2px 4px rgba(235, 47, 150, 0.2)' : 'none'
    });

    return (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div
                onClick={() => setLanguage('en')}
                style={switchStyle(language === 'en')}
                title="English"
            >
                <USFlag />
            </div>
            <div
                onClick={() => setLanguage('vi')}
                style={switchStyle(language === 'vi')}
                title="Tiếng Việt"
            >
                <VNFlag />
            </div>
        </div>
    );
};

export default LanguageSwitcher;
