// Na etiqueta 50x30 cabem ~24 caracteres por linha; "ALUNO: " ocupa 7.
// Acima disso a impressora corta o início do nome. O nome completo continua no sistema.
const LABEL_NAME_MAX_CHARS = 17;
const NAME_SUFFIXES = ['JUNIOR', 'JÚNIOR', 'JR', 'FILHO', 'NETO', 'SOBRINHO'];

export const formatStudentNameForLabel = (fullName) => {
    if (!fullName) return 'NOME';
    const parts = fullName.trim().toUpperCase().split(/\s+/).filter(Boolean);
    const full = parts.join(' ');
    if (full.length <= LABEL_NAME_MAX_CHARS || parts.length < 2) return full;

    // Nomes grandes: primeiro + último sobrenome (mantendo JUNIOR/FILHO/NETO junto do sobrenome)
    const first = parts[0];
    const hasSuffix = parts.length >= 3 && NAME_SUFFIXES.includes(parts[parts.length - 1].replace('.', ''));
    const lastParts = hasSuffix ? parts.slice(-2) : parts.slice(-1);
    const short = `${first} ${lastParts.join(' ')}`;
    if (short.length <= LABEL_NAME_MAX_CHARS) return short;

    // Ainda grande: abrevia o sobrenome (mantém o sufixo por extenso)
    const [surname, ...suffix] = lastParts;
    return [first, `${surname.charAt(0)}.`, ...suffix].join(' ');
};
