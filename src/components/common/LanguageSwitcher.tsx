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

    return (
        <div
            onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')}
            className="lang-switcher-compact"
            title={language === 'en' ? "Switch to Vietnamese" : "Switch to English"}
        >
            {language === 'en' ? <USFlag /> : <VNFlag />}
            <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
                {language === 'en' ? 'EN' : 'VN'}
            </span>
        </div>
    );
};

export default LanguageSwitcher;
