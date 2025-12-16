/**
 * Gera um ID curto aleatório (ex: "X7Z9A1")
 */
export const generateUniqueId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

/**
 * Formata datas (Objeto Date, String ISO ou Firestore Timestamp) para PT-BR
 */
export const formatDate = (val) => {
    if (!val) return '-';
    // Verifica se é Timestamp do Firestore (possui método toDate) ou data padrão
    const date = val.toDate ? val.toDate() : new Date(val);
    
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleString('pt-BR', { 
        day:'2-digit', 
        month:'2-digit', 
        year: '2-digit', 
        hour:'2-digit', 
        minute:'2-digit' 
    });
};

/**
 * Aplica máscara de CPF (000.000.000-00)
 */
export const maskCPF = (value) => {
  if(!value) return '';
  return value
    .replace(/\D/g, '') // Remove tudo o que não é dígito
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

/**
 * Traduz códigos de erro do Firebase Auth para mensagens amigáveis em PT-BR
 */
export const translateFirebaseError = (error) => {
    const code = error.code || '';
    
    // Erros de Autenticação
    if(code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        return 'E-mail ou senha incorretos. Verifique suas credenciais.';
    }
    if(code === 'auth/too-many-requests') {
        return 'Muitas tentativas falhas. O acesso foi bloqueado temporariamente. Tente novamente mais tarde.';
    }
    if(code === 'auth/network-request-failed') {
        return 'Falha na conexão. Verifique sua internet e tente novamente.';
    }
    if(code === 'auth/weak-password') {
        return 'A senha é muito fraca. Escolha uma senha com pelo menos 6 caracteres.';
    }
    if(code === 'auth/email-already-in-use') {
        return 'Este e-mail já está em uso por outro usuário.';
    }
    if(code === 'auth/account-inactive') {
        return 'Sua conta foi desativada. Entre em contato com a coordenação.';
    }
    if(code === 'permission-denied') {
        return 'Você não tem permissão para realizar esta ação.';
    }
    
    // Fallback genérico
    return `Erro inesperado. Tente novamente. (${code})`;
};