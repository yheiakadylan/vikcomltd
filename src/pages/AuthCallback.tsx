import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { App, Spin } from 'antd';
import { handleDropboxCallback } from '../services/dropbox';
import { saveSystemSettings } from '../services/firebase'; // Added
import { colors } from '../theme/themeConfig';

const AuthCallback: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { message } = App.useApp();
    const processed = React.useRef(false); // Ref to track if code has been processed

    useEffect(() => {
        const processAuth = async () => {
            const code = searchParams.get('code');

            if (!code) {
                message.error('No authorization code found.');
                navigate('/admin');
                return;
            }

            if (processed.current) return;
            processed.current = true; // Mark as processed

            try {
                const result = await handleDropboxCallback(code);

                // Save tokens to Firestore for persistence across devices/sessions
                if (result) {
                    const { access_token, refresh_token, expires_in } = result as any;
                    const expiresAt = Date.now() + (expires_in * 1000);

                    await saveSystemSettings({
                        dropbox: {
                            access_token,
                            refresh_token,
                            expires_at: expiresAt
                        }
                    });
                    message.success('Connected to Dropbox & Global Settings Saved!');
                }

                navigate('/admin');
            } catch (error) {
                console.error(error);
                message.error('Dropbox connection failed.');
                navigate('/admin');
            }
        };

        processAuth();
    }, [navigate, searchParams, message]);

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
