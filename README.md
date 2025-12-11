# 🏥 Sistema de Controle de Esterilização - Unilavras

![React](https://img.shields.io/badge/React-18.x-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Firebase](https://img.shields.io/badge/Firebase-v10-039BE5?style=for-the-badge&logo=Firebase&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-4.x-646CFF?style=for-the-badge&logo=Vite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

> **Versão Atualizada:** Gerada em 10/12/2025

## 📋 Sobre o Projeto

Este sistema é uma Aplicação Web completa desenvolvida para gerenciar o fluxo de esterilização de materiais odontológicos e médicos da Unilavras. O objetivo é rastrear todo o ciclo de vida dos kits de materiais com segurança, auditoria e facilidade de uso em dispositivos móveis e desktops.

O diferencial deste sistema é sua capacidade de personalização (editor de etiquetas integrado), auditoria completa de ações (quem fez o quê e quando) e operação offline-first (PWA capability).

## 🚀 Funcionalidades Principais

### 📦 Operacional
* **Rastreamento em Tempo Real:** Monitoramento de status (*Recebido* -> *Em Esterilização* -> *Pronto* -> *Retirado*).
* **Movimentação em Lote:** Atualize o status de dezenas de itens de uma vez na tela de Movimentação.
* **Scanner Integrado:** Utiliza a câmera do dispositivo ou leitores de código de barras USB para entrada e saída rápida.
* **Notificações:** Alunos recebem avisos visuais sobre o status de seus materiais.

### ⚙️ Administrativo & Gestão
* **🎨 Editor de Etiquetas Visual:** Configure o tamanho (mm), margens, rotação e posição dos elementos (Logo, QR Code, Textos) com sliders em tempo real. Sem necessidade de drivers complexos.
* **👥 Gestão Avançada de Usuários:** * Cadastro manual ou **Importação em Massa via CSV**.
    * Controle de acesso granular (Aluno, Técnico, Admin).
* **🛡️ Auditoria e Logs:** Registro imutável de todas as ações sensíveis (Login, Exclusão de Item, Alteração de Permissão) visível no painel administrativo.
* **💾 Backup e Restauração:** Exporte todos os dados do Firestore para JSON e restaure em caso de emergência diretamente pelo painel.
* **📢 Mural de Avisos:** Sistema de comunicados com suporte a imagens e agendamento de exibição.

### 📊 Dashboard
* Gráficos interativos (`Recharts`) mostrando fluxo de entrada por período.
* Indicadores de produtividade e materiais mais utilizados.
* Ranking de alunos mais ativos.

## 📂 Estrutura do Projeto

A arquitetura segue os princípios de *feature-first* e componentes reutilizáveis.

```text
src/
├── assets/            # Imagens e vetores estáticos
├── components/        # Componentes UI reutilizáveis
│   ├── Barcode.jsx    # Gerador SVG de Código de Barras
│   ├── DataTable.jsx  # Tabela responsiva com ordenação
│   └── ...
├── config/            # Inicialização do Firebase
├── constants/         # Textos estáticos, configurações de cores e tipos
├── contexts/          # Gerenciamento de Estado Global (Toast, Dialog, Print)
├── pages/             # Telas da Aplicação
│   ├── Admin/         # Módulos Administrativos (Logs, Labels, Data, etc.)
│   ├── Dashboard.jsx
│   ├── Movement.jsx
│   └── ...
├── utils/             # Funções Auxiliares
│   ├── audio.js       # Feedback sonoro (Web Audio API)
│   ├── logger.js      # Sistema de Auditoria centralizado
│   └── ...
└── App.jsx            # Roteamento e Inicialização
```

## 🛠️ Tecnologias e Bibliotecas

* **Core:** React.js, Vite
* **Estilização:** Tailwind CSS, Lucide React (Ícones)
* **Backend (Serverless):** Firebase Authentication, Firestore Database
* **Visualização de Dados:** Recharts
* **Hardware/Integração:** * `react-qr-code` (Geração de etiquetas)
    * `@yudiel/react-qr-scanner` (Leitura de câmera)
    * Web Audio API (Feedback sonoro nativo)

## 🔒 Regras de Segurança (Firestore Rules)

Para garantir o funcionamento dos novos módulos (Logs e Etiquetas), aplique as regras abaixo no Console do Firebase:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // --- FUNÇÕES AUXILIARES ---
    function getUserData(appId) {
       return get(/databases/$(database)/documents/artifacts/$(appId)/users/$(request.auth.uid)/profile/data).data;
    }
    
    function isActive(appId) {
       let data = getUserData(appId);
       return data.active != false; 
    }

    function isStaff(appId) {
       let data = getUserData(appId);
       return isActive(appId) && (data.role == 'admin' || data.role == 'tech');
    }
    
    function isAdmin(appId) {
       let data = getUserData(appId);
       return isActive(appId) && data.role == 'admin';
    }

    // --- REGRAS DO APLICATIVO ---
    match /artifacts/{appId} {

        // 1. PERFIL E DADOS PRIVADOS
        match /users/{userId}/profile/data {
          allow read: if request.auth != null && (request.auth.uid == userId || isStaff(appId));
          allow write: if isStaff(appId); // Staff gerencia usuários
        }
        
        match /users/{userId}/notifications/{notifId} {
          allow read: if request.auth != null && request.auth.uid == userId;
          allow write: if isStaff(appId); // Apenas staff envia notificações
        }

        // 2. DADOS PÚBLICOS / DIRETÓRIO
        match /public/data/users_directory/{userId} {
          allow read: if request.auth != null && isStaff(appId);
          allow write: if isStaff(appId);
        }

        // 3. ITENS (Materiais)
        match /public/data/items/{itemId} {
          allow read: if request.auth != null && (isStaff(appId) || resource.data.studentId == request.auth.uid);
          allow create: if isStaff(appId);
          allow update: if isStaff(appId); // Validações de campo são feitas no front/cloud functions se necessário
          allow delete: if isAdmin(appId); // Apenas admin deleta
        }

        // 4. CONFIGURAÇÕES E AUDITORIA (Admin Only)
        match /public/data/materialTypes/{typeId} {
          allow read: if request.auth != null;
          allow write: if isAdmin(appId);
        }
        
        match /public/data/announcements/{msgId} {
          allow read: if request.auth != null;
          allow write: if isAdmin(appId);
        }
        
        // CRUCIAL: Configuração de Etiquetas
        match /public/data/settings_labels/{configDoc} {
          allow read: if request.auth != null;
          allow write: if isAdmin(appId);
        }

        // CRUCIAL: Logs de Sistema (Append-only para usuários, Full access para Admin)
        match /public/data/system_logs/{logId} {
          allow create: if request.auth != null; // Qualquer user autenticado pode gerar log de sua ação
          allow read: if isAdmin(appId);
          allow update, delete: if false; // Logs são imutáveis
        }
    }
  }
}
```

## 🚀 Instalação e Execução

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/SEU_USER/uniesterilizacao.git](https://github.com/SEU_USER/uniesterilizacao.git)
    cd uniesterilizacao
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Configure o Ambiente:**
    Crie um arquivo `.env` na raiz com suas credenciais do Firebase:
    ```env
    VITE_API_KEY=...
    VITE_AUTH_DOMAIN=...
    VITE_PROJECT_ID=...
    VITE_STORAGE_BUCKET=...
    VITE_MESSAGING_SENDER_ID=...
    VITE_APP_ID=...
    ```

4.  **Execute:**
    ```bash
    npm run dev
    ```

## 📄 Licença

Desenvolvido para uso exclusivo do **Escritório de Projetos e Processos da Fundação Educacional de Lavras (Unilavras)**.
