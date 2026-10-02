// Nome completo com os nomes do meio abreviados (MARIA CLARA GOMES LIMA -> MARIA C. G. LIMA).
// Conectivos (DE, DA, DOS...) são omitidos; JUNIOR/FILHO/NETO ficam por extenso junto do último sobrenome.
const CONNECTIVES = ['DE', 'DA', 'DO', 'DAS', 'DOS', 'E'];
const NAME_SUFFIXES = ['JUNIOR', 'JÚNIOR', 'JR', 'FILHO', 'NETO', 'SOBRINHO'];

// Caracteres que cabem na largura do código de barras (acima disso o texto é comprimido)
export const LABEL_NAME_FIT_CHARS = 26;

export const formatStudentNameForLabel = (fullName) => {
    if (!fullName) return 'NOME';
    const parts = fullName.trim().toUpperCase().split(/\s+/).filter(Boolean);
    if (parts.length <= 2) return parts.join(' ');

    const hasSuffix = parts.length >= 3 && NAME_SUFFIXES.includes(parts[parts.length - 1].replace('.', ''));
    const tailCount = hasSuffix ? 2 : 1;
    const first = parts[0];
    const tail = parts.slice(-tailCount);
    const middle = parts
        .slice(1, parts.length - tailCount)
        .filter(p => !CONNECTIVES.includes(p))
        .map(p => `${p.charAt(0)}.`);
    return [first, ...middle, ...tail].join(' ');
};

// Fator horizontal (<=1) para o nome nunca passar da largura do código de barras
export const labelNameScale = (text) => Math.min(1, LABEL_NAME_FIT_CHARS / Math.max(text.length, 1));
