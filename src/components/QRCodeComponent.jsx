import React from 'react';
import QRCode from 'react-qr-code';

/**
 * Componente Wrapper para QR Code.
 * Responsivo: Ajusta-se à altura/largura do container pai (essencial para impressão).
 * @param {string} value - O texto/código a ser codificado
 */
const QRCodeComponent = ({ value }) => {
    return (
        <div className="flex items-center justify-center w-full h-full p-1">
            <div style={{ height: "100%", width: "100%", maxWidth: "100%" }}>
                <QRCode
                    size={256}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    value={value || "ERROR"} // Fallback caso value seja nulo
                    viewBox={`0 0 256 256`}
                />
            </div>
        </div>
    );
};

export default QRCodeComponent;