import React from 'react';

/**
 * Gerador de Código de Barras Code 39 (SVG Puro)
 * @param {string} value - O texto/código a ser codificado
 */
const Barcode = ({ value }) => {
    // Mapeamento Code 39
    const code39Map = {
        '0': 'NNNwwnWnW', '1': 'WnNwNnNnW', '2': 'NnWwNnNnW', '3': 'WnWwNnNnN', '4': 'NnNwWnNnW',
        '5': 'WnNwWnNnN', '6': 'NnWwWnNnN', '7': 'NnNwNnWnW', '8': 'WnNwNnWnN', '9': 'NnWwNnWnN',
        'A': 'WnNnNwNnW', 'B': 'NnWnNwNnW', 'C': 'WnWnNwNnN', 'D': 'NnNnWwNnW', 'E': 'WnNnWwNnN',
        'F': 'NnWnWwNnN', 'G': 'NnNnNwWnW', 'H': 'WnNnNwWnN', 'I': 'NnWnNwWnN', 'J': 'NnNnWwWnN',
        'K': 'WnNnNnNwW', 'L': 'NnWnNnNwW', 'M': 'WnWnNnNwN', 'N': 'NnNnWnNwW', 'O': 'WnNnWnNwN',
        'P': 'NnWnWnNwN', 'Q': 'NnNnNnWwW', 'R': 'WnNnNnWwN', 'S': 'NnWnNnWwN', 'T': 'NnNnWnWwN',
        'U': 'WwNnNnNnW', 'V': 'NwWnNnNnW', 'W': 'WwWnNnNnN', 'X': 'NwNnWnNnW', 'Y': 'WwNnWnNnN',
        'Z': 'NwWnWnNnN', '-': 'NwNnNnWnW', '.': 'WwNnNnWnN', ' ': 'NwWnNnWnN', '*': 'NwNnWnWnN',
        '$': 'NwNwNwNnN', '/': 'NwNwNnNwN', '+': 'NwNnNwNwN', '%': 'NnNwNwNwN' 
    };

    const encoded = `*${(value || '').toUpperCase()}*`;
    let elements = [];
    let x = 0;
    
    // Configuração de largura das barras
    const narrowW = 1.2;
    const wideW = 3.6;
    const height = 100; // Usamos 100 no viewbox para facilitar a escala

    for (let i = 0; i < encoded.length; i++) {
        const char = encoded[i];
        const pattern = code39Map[char] || code39Map[' '];
        
        for (let j = 0; j < 9; j++) {
            const isBar = j % 2 === 0; 
            const width = (pattern[j] === 'W' || pattern[j] === 'w') ? wideW : narrowW;
            
            if (isBar) {
                elements.push(
                    <rect key={`${i}-${j}`} x={x} y={0} width={width} height={height} fill="black" />
                );
            }
            x += width;
        }
        x += narrowW;
    }

    return (
        <div className="flex flex-col items-center justify-center w-full h-full overflow-hidden">
            <svg 
                width="100%" 
                height="100%" 
                viewBox={`0 0 ${x} ${height}`} 
                preserveAspectRatio="none"
                style={{ maxHeight: '100%', maxWidth: '100%' }}
            >
                {elements}
            </svg>
            <span className="text-[10px] font-mono font-bold leading-none mt-0.5">
                {value}
            </span>
        </div>
    );
};

export default Barcode;