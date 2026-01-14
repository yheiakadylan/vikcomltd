import { useState, useEffect } from 'react';

// Simplified Hook for LocalStorage
// Usage: const [value, setValue] = usePersistedState<string>('key', 'default');

export function usePersistedState<T>(key: string, initialValue: T): [T, (value: T) => void] {
    // Add prefix to avoid collisions
    const prefixedKey = `vikcom_${key}`;

    // Lazy initialization
    const [state, setState] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(prefixedKey);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(`Error reading localStorage key "${prefixedKey}":`, error);
            return initialValue;
        }
    });

    // Sync to LocalStorage
    useEffect(() => {
        try {
            window.localStorage.setItem(prefixedKey, JSON.stringify(state));
        } catch (error) {
            console.error(`Error writing localStorage key "${prefixedKey}":`, error);
        }
    }, [prefixedKey, state]);

    return [state, setState];
}
