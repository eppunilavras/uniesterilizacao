import { useState } from 'react';
import { playSound } from '../utils/audio';

export function useScanner() {
    const [code, setCode] = useState('');
    const [showCamera, setShowCamera] = useState(false);

    const handleScan = (results) => {
        if (results && results.length > 0) {
            const val = results[0].rawValue;
            if (val) {
                setCode(val);
                setShowCamera(false);
                playSound('success');
            }
        }
    };

    const resetScanner = () => {
        setCode('');
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