// Nome com o máximo de nomes que couberem: primeiro e último obrigatórios, meio por extenso ou abreviado (MARIA C. G. LIMA).
// Conectivos (DE, DA, DOS...) são omitidos; JUNIOR/FILHO/NETO ficam por extenso junto do último sobrenome.
const CONNECTIVES = ['DE', 'DA', 'DO', 'DAS', 'DOS', 'E'];
const NAME_SUFFIXES = ['JUNIOR', 'JÚNIOR', 'JR', 'FILHO', 'NETO', 'SOBRINHO'];

// Caracteres que cabem na largura do código de barras (acima disso o texto é comprimido)
export const LABEL_NAME_FIT_CHARS = 29;

export const formatStudentNameForLabel = (fullName) => {
    if (!fullName) return 'NOME';
    const parts = fullName.trim().toUpperCase().split(/\s+/).filter(Boolean);
    // Cabe na largura do código de barras: mantém o nome completo
    if (parts.length <= 2 || parts.join(' ').length <= LABEL_NAME_FIT_CHARS) return parts.join(' ');

    const hasSuffix = parts.length >= 3 && NAME_SUFFIXES.includes(parts[parts.length - 1].replace('.', ''));
    const tailCount = hasSuffix ? 2 : 1;
    const first = parts[0];
    const tail = parts.slice(-tailCount);
    const middle = parts.slice(1, parts.length - tailCount).filter(p => !CONNECTIVES.includes(p));
    const build = (mid) => [first, ...mid, ...tail].join(' ');

    // Começa com todos os nomes do meio abreviados e expande por extenso, da esquerda para a direita,
    // enquanto couber em LABEL_NAME_FIT_CHARS.
    const mid = middle.map(p => `${p.charAt(0)}.`);
    for (let i = 0; i < middle.length; i++) {
        const trial = [...mid];
        trial[i] = middle[i];
        if (build(trial).length <= LABEL_NAME_FIT_CHARS) mid[i] = middle[i];
    }
    // Nem abreviados cabem: descarta nomes do meio a partir do fim (primeiro e último são obrigatórios)
    while (mid.length && build(mid).length > LABEL_NAME_FIT_CHARS) mid.pop();
    return build(mid);
};

// Fator horizontal (<=1) para o nome nunca passar da largura do código de barras
export const labelNameScale = (text) => Math.min(1, LABEL_NAME_FIT_CHARS / Math.max(text.length, 1));
