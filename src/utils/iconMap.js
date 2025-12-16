import { 
  Globe, Database, FileText, Monitor, 
  Activity, Calendar, Shield, Link,
  LayoutDashboard, Server, Smartphone, Syringe,
  Stethoscope, Microscope, BookOpen, 
  Cloud, Mail, Phone, Video, 
  ClipboardList, Wrench, UserCheck, 
  GraduationCap, Building, Search,
  // --- NOVOS ÍCONES ---
  User, Users, Baby, Heart, 
  Hospital, Ambulance, Pill, Thermometer, 
  Smile, BriefcaseMedical, UserPlus, Star
} from 'lucide-react';

// Mapeamento: Nome no Banco -> Componente Visual
export const ICON_MAP = {
  // --- GERAL / TECNOLOGIA ---
  'globe': Globe,
  'database': Database,
  'file': FileText,
  'monitor': Monitor,
  'calendar': Calendar,
  'link': Link,
  'layout': LayoutDashboard,
  'server': Server,
  'mobile': Smartphone,
  'cloud': Cloud,
  'mail': Mail,
  'phone': Phone,
  'video': Video,
  'search': Search,
  'star': Star,
  'wrench': Wrench,

  // --- SAÚDE / CLÍNICA ---
  'health': Activity,       // Batimento cardíaco
  'heart': Heart,           // Cardiologia / Cuidado
  'hospital': Hospital,     // Prédio Hospitalar
  'ambulance': Ambulance,   // Emergência
  'pill': Pill,             // Medicamentos / Farmácia
  'thermometer': Thermometer, // Triagem / Febre
  'case': BriefcaseMedical, // Maleta Médica / Primeiros Socorros
  'syringe': Syringe,       // Vacina / Anestesia
  'stethoscope': Stethoscope, // Exame Clínico
  'microscope': Microscope,   // Laboratório / Pesquisa
  
  // --- ODONTOLOGIA / SORRISO ---
  'smile': Smile,           // Odontologia (Sorriso)
  
  // --- PESSOAS / ACADÊMICO ---
  'user': User,             // Pessoa Individual
  'users': Users,           // Grupo / Equipe
  'user-add': UserPlus,     // Cadastro / Novo Paciente
  'user-check': UserCheck,  // Presença / Verificado
  'baby': Baby,             // Pediatria
  'grad': GraduationCap,    // Acadêmico / Formatura
  'book': BookOpen,         // Biblioteca / Estudo
  'clipboard': ClipboardList, // Prontuário / Lista
  'shield': Shield,         // Segurança / Admin
  'building': Building,     // Campus / Institucional
};

export const AVAILABLE_ICONS = Object.keys(ICON_MAP);