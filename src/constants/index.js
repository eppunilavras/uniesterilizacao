import { 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  CheckSquare,
  AlertTriangle // <--- NOVO IMPORT
} from 'lucide-react';

// URLs dos Logos
export const LOGOS = {
  color: 'https://i.ibb.co/MxXMmxS0/Logo-Unilavras-Oficial-2019.png',
  white: 'https://i.ibb.co/bMqtX9Ln/Logo-Unilavras-Oficial-2019-mono-full-white.png',
};

// Configuração de Status dos Materiais (Cores, Ícones e Labels)
export const STATUS_CONFIG = {
  'recebido': { 
      label: 'Recebido', 
      // Adicionado suporte dark: fundo mais escuro e texto mais claro
      color: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700', 
      icon: Clock 
  },
  'em_esterilizacao': { 
      label: 'Em Esterilização', 
      // Adicionado suporte dark: laranja suave
      color: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800', 
      icon: AlertCircle 
  },
  'pronto': { 
      label: 'Pronto p/ Retirada', 
      // Adicionado suporte dark: verde suave
      color: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800', 
      icon: CheckCircle2 
  },
  'retirado': { 
      label: 'Retirado', 
      // CORREÇÃO: Trocado text-[#021D34] por azul claro (blue-300) no modo dark
      color: 'bg-[#009DE0]/10 text-[#021D34] border-[#009DE0]/20 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800', 
      icon: CheckSquare 
  },
  'problema': { 
      label: 'Com Ocorrência', 
      // Adicionado suporte dark: vermelho suave
      color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800', 
      icon: AlertTriangle 
  },
};

// Cores das Tags de Log (Auditoria)
export const LOG_COLORS = {
    'LOGIN': 'bg-blue-100 text-blue-800',
    'LOGOUT': 'bg-slate-100 text-slate-800',
    'ITEM_ENTRY': 'bg-green-100 text-green-800',
    'ITEM_MOVE': 'bg-orange-100 text-orange-800',
    'ITEM_DELETE': 'bg-red-100 text-red-800',
    'USER_MGMT': 'bg-purple-100 text-purple-800',
    'ADMIN_OPT': 'bg-yellow-100 text-yellow-800',
    'DATA_OP': 'bg-indigo-100 text-indigo-800',
    'LOGIN_FAIL': 'bg-red-50 text-red-600'
};

// Labels Humanas para os Tipos de Log
export const LOG_TYPES = {
    'LOGIN': 'Login',
    'LOGOUT': 'Logout',
    'ITEM_ENTRY': 'Entrada',
    'ITEM_MOVE': 'Movimentação',
    'ITEM_DELETE': 'Exclusão',
    'USER_MGMT': 'Usuários',
    'ADMIN_OPT': 'Admin',
    'DATA_OP': 'Sistema',
    'LOGIN_FAIL': 'Falha Login'
};

// Labels para os Papéis de Usuário
export const ROLE_LABELS = {
    'student': 'Aluno',
    'tech': 'Técnico',
    'admin': 'Administrador'
};