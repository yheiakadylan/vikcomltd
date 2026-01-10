import type { ThemeConfig } from 'antd';

export const themeConfig: ThemeConfig = {
    token: {
        colorPrimary: '#EB2F96', // Primary Pink
        colorSuccess: '#52C41A', // Success Green
        colorWarning: '#FAAD14', // Warning Gold
        colorError: '#F5222D',   // Urgent Red
        colorInfo: '#1890FF',    // Action Blue

        fontFamily: "'Be Vietnam Pro', 'Inter', sans-serif",

        colorText: '#1F1F1F',    // Text Primary
        colorTextSecondary: '#8C8C8C',

        borderRadius: 8,

        // Custom vars (using CSS variables if needed, but Antd maps these well)
    },
    components: {
        Button: {
            borderRadius: 8,
        },
        Input: {
            borderRadius: 8,
        },
        Card: {
            borderRadius: 8,
        },
        Modal: {
            borderRadius: 12,
        },
    },
};

export const colors = {
    primaryPink: '#EB2F96',
    softPink: '#FFF0F6',
    urgentRed: '#F5222D',
    successGreen: '#52C41A',
    warningGold: '#FAAD14',
    actionBlue: '#1890FF',
    textPrimary: '#1F1F1F',
    textSecondary: '#8C8C8C',
    border: '#D9D9D9',
};
