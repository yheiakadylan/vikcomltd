import type { ThemeConfig } from 'antd';

export const themeConfig: ThemeConfig = {
    token: {
        colorPrimary: '#1677FF', // Primary Blue
        colorSuccess: '#52C41A', // Success Green
        colorWarning: '#FAAD14', // Warning Gold
        colorError: '#F5222D',   // Urgent Red
        colorInfo: '#1677FF',    // Action Blue (Same as Primary)

        fontFamily: "'Be Vietnam Pro', 'Inter', sans-serif",

        colorText: '#1F1F1F',    // Text Primary
        colorTextSecondary: '#8C8C8C',

        borderRadius: 8,
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
    primary: '#1677FF',      // Blue-6
    bgLight: '#E6F7FF',      // Blue-1
    urgentRed: '#F5222D',
    successGreen: '#52C41A',
    warningGold: '#FAAD14',
    actionBlue: '#1677FF',
    textPrimary: '#1F1F1F',
    textSecondary: '#8C8C8C',
    border: '#D9D9D9',

    // Additional Blue Scale for custom usage
    blue1: '#E6F7FF',
    blue2: '#BAE7FF',
    blue3: '#91D5FF',
};
