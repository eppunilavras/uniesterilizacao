import { useState, useCallback } from 'react';
import { playSound } from '../utils/audio';

// Mantém apenas letras e números (remove acentos, espaços e caracteres especiais)
const sanitizeCode = (raw) =>
    (raw || '').toString().normalize('NFD').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

export function useScanner() {
    const [code, setCodeRaw] = useState('');
    const [showCamera, setShowCamera] = useState(false);

    const setCode = useCallback((val) => {
        setCodeRaw(sanitizeCode(val));
    }, []);

    const handleScan = (results) => {
        if (results && results.length > 0) {
            const val = results[0].rawValue;
            if (val) {
                setCodeRaw(sanitizeCode(val));
                setShowCamera(false);
                playSound('success');
            }
        }
    };

    const resetScanner = () => {
        setCodeRaw('');
        setShowCamera(false);
    };

    return {
        code,
        setCode,
        showCamera,
        setShowCamera,
        handleScan,
        resetScanner
    };
}
