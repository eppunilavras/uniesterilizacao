# 🏥 Sistema de Controle de Esterilização - Unilavras

![React](https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Firebase](https://img.shields.io/badge/Firebase-v12-039BE5?style=for-the-badge&logo=Firebase&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=Vite&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)
![License](https://img.shields.io/badge/Uso-Interno_Unilavras-green?style=for-the-badge)

> Aplicação web (PWA) para gestão do fluxo de esterilização de materiais odontológicos e médicos da Unilavras.

## 📋 Sobre o Projeto

Sistema para rastrear o ciclo de vida dos kits de materiais com auditoria completa, operação offline e uso multiplataforma (desktop, tablet, celular). Substitui processos manuais por uma plataforma única com leitura de código, etiquetas personalizadas e painéis administrativos.

**Domínio em produção:** `uniodonto.web.app`

## 🚀 Funcionalidades Principais

### 📦 Operacional — Recepção e Movimentação
* **Fluxo simplificado:** `Recebido` → `Pronto p/ Retirada` → `Retirado`, com estado paralelo `Com Ocorrência` para incidentes.
* **Recepção:** identificação do aluno por nome ou **CPF**, seleção de materiais e impressão de etiquetas em lote.
* **Movimentação:**
  * Busca unificada por nome, código, material ou **CPF** (detecção automática).
  * **Quick View:** dropdown ao vivo agrupando resultados por aluno; clique abre um modal com **todas as requisições ativas** do aluno e ações rápidas (Imprimir, Marcar Pronto, Confirmar Retirada, Registrar/Resolver Ocorrência).
  * **Lote inteligente:** atualize o status de vários itens com validação de transição (não permite retroceder etapas).
  * Filtros por status (`Todos Ativos`, `Pronto p/ Retirada`, `Com Ocorrência`) e por data de entrada.
* **Scanner integrado:** câmera do dispositivo (`@yudiel/react-qr-scanner`) ou leitor USB. Entradas são sanitizadas (apenas letras e números maiúsculos, sem acentos ou caracteres especiais).
* **Códigos gerados:** alfabeto seguro de 32 caracteres (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`) — evita ambiguidades visuais (0/O, 1/I) e exclui caracteres especiais para compatibilidade com leitores Code 39.

### 🧾 Etiquetas
* **Editor visual em tempo real:** tamanho físico (mm), margens, rotação, espelhamento, tipografia, posicionamento de cada elemento (logo, QR/barcode, datas, rodapé).
* **Conteúdo:** título customizável, código de barras (Code 39 SVG puro) ou QR Code, nome completo do aluno e material.
* **Suporte offline:** etiquetas são impressas mesmo sem conexão (sincroniza ao reconectar).

### 🔔 Notificações para Alunos
* Alunos recebem avisos automáticos sobre cada mudança de status do material e em casos de ocorrência.
* Painel `NotificationsView` no portal do aluno.

### ⚙️ Administrativo & Gestão (`AdminPortal`)
* **👥 Gestão de Usuários:** cadastro manual ou importação em massa via CSV. Perfis: Aluno, Técnico, Admin. Pesquisa por nome ou CPF.
* **📦 Catálogo de Materiais:** cadastro de tipos disponíveis na Recepção.
* **📢 Mural de Avisos:** anúncios com imagem e agendamento.
* **🛡️ Auditoria (Logs):** registro imutável de ações sensíveis (Login, Movimentação, Exclusões, Alterações de Permissão). Append-only — logs não podem ser editados ou removidos.
* **💾 Backup e Restauração:** export/import de dados do Firestore em JSON pelo próprio painel.
* **❤️ Health Check:** painel `AdminHealth` com indicadores de saúde do projeto.

### 📊 Dashboard
* Gráficos interativos (`Recharts`): fluxo de entrada por período, materiais mais utilizados, indicadores de produtividade.
* Ranking de alunos mais ativos.
* Estatísticas em tempo real via `useDashboardStats`.

### 📡 Offline-First (PWA)
* Service worker via `vite-plugin-pwa` (Workbox `generateSW`).
* Persistência local do Firestore (`persistentLocalCache` + `persistentMultipleTabManager`).
* Backup local (`localStorage`) das entradas em modo offline — sincroniza automaticamente ao reconectar.
* `ReloadPrompt` informa o usuário quando há nova versão.

## 📂 Estrutura do Projeto

```text
src/
├── components/        # UI reutilizável (Barcode, DataTable, QRCode, MainLayout, ReloadPrompt...)
├── config/            # firebase.js (inicialização e cache persistente)
├── constants/         # STATUS_CONFIG, ROLE_LABELS, LOGOS, LOG_COLORS
├── contexts/          # Toast, Dialog, Print, Theme
├── hooks/             # useScanner, useStudentsDirectory, useMaterialTypes,
│                      # useOnlineStatus, useDashboardStats, useDebounce...
├── pages/
│   ├── Admin/         # AdminPortal, AdminPanel, AdminLogs, AdminLabels,
│   │                  # AdminMaterials, AdminAnnouncements, AdminData, AdminHealth
│   ├── Dashboard.jsx
│   ├── LoginScreen.jsx
│   ├── Movement.jsx        # Movimentação + Quick View + busca por CPF
│   ├── Reception.jsx       # Recepção com offline-first
│   ├── UserManagement.jsx  # Gestão de usuários
│   ├── HistoryView.jsx
│   ├── NotificationsView.jsx
│   ├── ProfileView.jsx
│   └── SystemsPortal.jsx
├── utils/             # logger.js, audio.js, formatters.js, iconMap.js
└── App.jsx            # Roteamento e bootstrap
```

## 🛠️ Stack Técnica

| Categoria | Bibliotecas |
|-----------|-------------|
| **Core** | React 19, Vite 7, React Router 7 |
| **Estilização** | Tailwind CSS 3, Lucide React (ícones) |
| **Backend serverless** | Firebase 12 (Auth, Firestore, Analytics, Hosting) |
| **Estado / Cache** | `@tanstack/react-query`, Context API |
| **Formulários** | React Hook Form, Zod, `@hookform/resolvers` |
| **Datas** | `date-fns` |
| **Visualização** | Recharts |
| **Leitura de código** | `@yudiel/react-qr-scanner` (câmera) |
| **Etiquetas** | Code 39 SVG nativo (`components/Barcode.jsx`) + `react-qr-code` |
| **PWA** | `vite-plugin-pwa` + Workbox |
| **Áudio** | Web Audio API (`utils/audio.js`) |

## 🌳 Branches e Ambientes

| Branch | Ambiente | URL |
|--------|----------|-----|
| `main` | Produção | https://uniodonto.web.app |
| `homolog` | Homologação | Canal de preview Firebase (`firebase hosting:channel:deploy homolog`) |

**Fluxo de trabalho recomendado:**
1. Desenvolva e commite em `homolog`.
2. `firebase hosting:channel:deploy homolog` → testa no canal preview.
3. Após validação: `git checkout main && git merge homolog --ff-only && git push`.
4. `firebase deploy --only hosting` → publica em produção.

## 🔒 Regras de Segurança (Firestore)

Aplique no Console do Firebase para garantir o funcionamento dos módulos administrativos e operacionais:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // --- HELPERS ---
    function getUserData(appId) {
      return get(/databases/$(database)/documents/artifacts/$(appId)/users/$(request.auth.uid)/profile/data).data;
    }
    function isActive(appId) {
      return getUserData(appId).active != false;
    }
    function isStaff(appId) {
      let d = getUserData(appId);
      return isActive(appId) && (d.role == 'admin' || d.role == 'tech');
    }
    function isAdmin(appId) {
      let d = getUserData(appId);
      return isActive(appId) && d.role == 'admin';
    }

    match /artifacts/{appId} {
      // Perfil privado do usuário
      match /users/{userId}/profile/data {
        allow read: if request.auth != null && (request.auth.uid == userId || isStaff(appId));
        allow write: if isStaff(appId);
      }
      match /users/{userId}/notifications/{notifId} {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow write: if isStaff(appId);
      }

      // Diretório público de usuários
      match /public/data/users_directory/{userId} {
        allow read: if request.auth != null && isStaff(appId);
        allow write: if isStaff(appId);
      }

      // Itens (materiais em circulação)
      match /public/data/items/{itemId} {
        allow read: if request.auth != null && (isStaff(appId) || resource.data.studentId == request.auth.uid);
        allow create, update: if isStaff(appId);
        allow delete: if isAdmin(appId);
      }

      // Catálogos e configurações
      match /public/data/materialTypes/{typeId} {
        allow read: if request.auth != null;
        allow write: if isAdmin(appId);
      }
      match /public/data/announcements/{msgId} {
        allow read: if request.auth != null;
        allow write: if isAdmin(appId);
      }
      match /public/data/settings_labels/{configDoc} {
        allow read: if request.auth != null;
        allow write: if isAdmin(appId);
      }

      // Logs append-only
      match /public/data/system_logs/{logId} {
        allow create: if request.auth != null;
        allow read: if isAdmin(appId);
        allow update, delete: if false;
      }
    }
  }
}
```

## 🚀 Instalação e Execução

### Pré-requisitos
- Node.js 18+ e npm
- Conta Firebase com projeto criado

### Setup

```bash
# 1. Clonar
git clone https://github.com/eppunilavras/uniesterilizacao.git
cd uniesterilizacao

# 2. Instalar dependências
npm install

# 3. Criar arquivo .env na raiz com as credenciais do Firebase
cat > .env <<EOF
VITE_API_KEY=...
VITE_AUTH_DOMAIN=...
VITE_PROJECT_ID=...
VITE_STORAGE_BUCKET=...
VITE_MESSAGING_SENDER_ID=...
VITE_APP_ID=...
VITE_MEASUREMENT_ID=...
EOF

# 4. Rodar em modo dev (com host expor na rede)
npm run dev -- --host
```

### Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento (Vite) |
| `npm run build` | Build de produção (gera `dist/`) |
| `npm run preview` | Preview local do build |
| `npm run lint` | ESLint |

### Deploy

```bash
# Build
npm run build

# Produção
firebase deploy --only hosting

# Homologação (canal preview, expira em 30 dias)
firebase hosting:channel:deploy homolog --expires 30d
```

> ℹ️ Após deploy, oriente os usuários a fazer **hard refresh** (`Ctrl+Shift+R`) na primeira visita — o service worker do PWA mantém o bundle antigo em cache até atualizar.

## 🧩 Convenções do Banco

* Identificador da app: `unilavras-main` (fallback) ou via `__app_id`.
* Coleção raiz: `artifacts/{appId}/...`
* CPFs são armazenados apenas com dígitos (sem máscara).
* Códigos de itens: 6 caracteres alfanuméricos maiúsculos do alfabeto seguro.

## 📄 Licença

Desenvolvido para uso exclusivo do **Escritório de Projetos e Processos da Fundação Educacional de Lavras (Unilavras)**.
