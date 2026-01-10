import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Spin } from 'antd';
import { handleAuthCallback } from '../services/dropbox';
import { colors } from '../theme/themeConfig';

const AuthCallback: React.FC = () => {
    const navigate = useNavigate();
    const [processing, setProcessing] = useState(true);

    if (!processing) return null; // Or fragment, since we are navigating away anyway

    useEffect(() => {
        const processAuth = async () => {
            try {
                const success = handleAuthCallback();
                if (success) {
                    message.success('Connected to Dropbox successfully!');
                } else {
                    // Check if error in URL
                    const hash = window.location.hash;
                    if (hash.includes('error=')) {
                        message.error('Dropbox authentication failed.');
                    } else {
                        message.warning('No access token found.');
                    }
                }
            } catch (error) {
                console.error(error);
                message.error('An error occurred during authentication.');
            } finally {
                setProcessing(false);
                navigate('/'); // Go back to dashboard
            }
        };

        processAuth();
    }, [navigate]);

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            flexDirection: 'column',
            background: colors.softPink
        }}>
            <Spin size="large" />
            <h3 style={{ marginTop: 24, color: colors.primaryPink }}>Connecting to Dropbox...</h3>
        </div>
    );
};

export default AuthCallback;
