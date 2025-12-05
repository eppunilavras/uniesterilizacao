# 🏥 Sistema de Controle de Esterilização - Unilavras

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=Firebase&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=Vite&logoColor=white)

## 📋 Sobre o Projeto

Este sistema é uma Aplicação Web Progressiva (PWA) desenvolvida para gerenciar o fluxo de esterilização de materiais odontológicos e médicos da Unilavras. O objetivo é rastrear todo o ciclo de vida dos kits de materiais, desde a entrega pelo aluno na recepção, passando pelo processo de autoclave, até a devolução/retirada.

O sistema conta com controle de acesso baseado em níveis (Aluno, Técnico, Admin), geração de etiquetas com Código de Barras/QR Code e relatórios gerenciais, garantindo rastreabilidade total.

---

## 🚀 Funcionalidades Principais

*   **🔐 Autenticação e Perfis:** Login seguro e recuperação de senha. Perfis distintos para Alunos, Técnicos e Administradores (RBAC).
*   **📦 Recepção de Materiais:** Interface ágil para registrar a entrada de múltiplos kits vinculados a um aluno.
*   **🏷️ Geração de Etiquetas:** Sistema de impressão personalizado (50x30mm) com suporte a Barcode (Code 39) e QR Code.
*   **🔍 Rastreamento e Movimentação:** Atualização de status visual (*Recebido* -> *Em Esterilização* -> *Pronto* -> *Retirado*) via leitura de código ou manual.
*   **📊 Dashboard Gerencial:** Gráficos em tempo real sobre o fluxo de entrada, materiais mais comuns e produtividade.
*   **📜 Histórico e Logs:** Auditoria completa e imutável de todas as ações realizadas no sistema.
*   **💾 Backup e Restauração:** Ferramentas administrativas para exportação (JSON) e segurança dos dados.

---

## 🛠️ Tecnologias Utilizadas

*   **Frontend:** React.js + Vite
*   **Backend/Infra:** Firebase (Authentication, Firestore Database, Hosting)
*   **Estilização:** Tailwind CSS
*   **UI/UX:** Lucide React (Ícones), Recharts (Gráficos)
*   **Utils:** React QR Code

---

## ☁️ Configuração do Backend (Firebase) - CRUCIAL

Para que o projeto funcione, o backend no Firebase precisa estar configurado corretamente para aceitar as consultas complexas e as regras de segurança.

### 1. Setup Inicial
1.  Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
2.  Vá em **Authentication > Sign-in method** e ative o provedor **Email/Password**.
3.  Vá em **Firestore Database** e clique em "Criar banco de dados" (inicie em modo de produção).

### 2. Estrutura de Dados (Data Model)
O sistema utiliza uma estrutura aninhada para permitir *multi-tenancy*. Todos os dados públicos residem em:
`artifacts/{appId}/public/data/{collectionName}`
> Onde `{appId}` padrão no código é `unilavras-main`.

### 3. Índices Compostos (Firestore Indexes)
O sistema realiza consultas complexas. Se você não criar os índices, o Firebase bloqueará as consultas.
**Dica:** Ao rodar localmente (`npm run dev`), abra o console do navegador (F12). Quando uma consulta falhar, o Firebase fornecerá um link direto para criar o índice.

**Lista de Índices Obrigatórios:**

| Coleção ID | Campos Indexados (Ordem Importante) | Motivo |
| :--- | :--- | :--- |
| `items` | `studentId` (Asc) + `createdAt` (Desc) | Histórico filtrado do aluno |
| `items` | `studentId` (Asc) + `type` (Asc) | Busca de material do aluno |
| `items` | `studentName` (Asc) + `code` (Asc) | Busca global por nome/código |
| `users_directory` | `role` (Asc) + `name` (Asc) | Listagem de usuários por perfil |
| `users_directory` | `role` (Asc) + `cpf` (Asc) | Busca de alunos por CPF |

### 4. Regras de Segurança (Firestore Rules)
Copie e cole estas regras na aba **Rules** do Firestore. Elas garantem a integridade dos dados e impedem que alunos alterem dados uns dos outros.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // --- FUNÇÕES AUXILIARES ---
    
    // Lê os dados completos do perfil
    function getUserData(appId) {
       return get(/databases/$(database)/documents/artifacts/$(appId)/users/$(request.auth.uid)/profile/data).data;
    }

    // Verifica se o usuário está marcado como ATIVO
    function isActive(appId) {
       let data = getUserData(appId);
       return data.active != false; 
    }

    // Verifica cargo + atividade da conta
    function isAdmin(appId) {
       let data = getUserData(appId);
       return isActive(appId) && data.role == 'admin';
    }

    function isStaff(appId) {
       let data = getUserData(appId);
       return isActive(appId) && (data.role == 'admin' || data.role == 'tech');
    }
    
    function isValidStatus() {
       return request.resource.data.status in ['recebido', 'em_esterilizacao', 'pronto', 'retirado'];
    }

    // --- REGRAS DO APLICATIVO ---
    match /artifacts/{appId} {

        // 1. PERFIL DO USUÁRIO
        match /users/{userId}/profile/data {
          allow read: if request.auth != null && (request.auth.uid == userId || isStaff(appId));
          allow create: if isStaff(appId);
          allow update: if isAdmin(appId) || (
            isStaff(appId) && 
            request.resource.data.role == resource.data.role && // Não pode mudar cargo
            request.resource.data.active == resource.data.active // Não pode se reativar
          );
        }

        // 2. DIRETÓRIO DE USUÁRIOS (Recepção/Gestão)
        match /public/data/users_directory/{userId} {
          allow read: if request.auth != null && isStaff(appId);
          allow create: if isStaff(appId);
          allow update: if isAdmin(appId) || (isStaff(appId) && request.resource.data.role == resource.data.role);
          allow delete: if isAdmin(appId);
        }

        // 3. NOTIFICAÇÕES
        match /users/{userId}/notifications/{notifId} {
          allow read: if request.auth != null && request.auth.uid == userId;
          allow write: if request.auth != null && (isStaff(appId) || request.auth.uid == userId);
        }

        // 4. ITENS/MATERIAIS
        match /public/data/items/{itemId} {
          allow read: if request.auth != null && (isStaff(appId) || resource.data.studentId == request.auth.uid);
          allow create: if isStaff(appId);
          
          // UPDATE SEGURO: Staff Ativo, Status Válido, Campos imutáveis protegidos
          allow update: if isStaff(appId) 
            && isValidStatus()
            && request.resource.data.code == resource.data.code
            && request.resource.data.studentId == resource.data.studentId
            && request.resource.data.type == resource.data.type
            && request.resource.data.createdAt == resource.data.createdAt;
          
          allow delete: if isAdmin(appId);
        }

        // 5. CONFIGURAÇÕES GERAIS
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

        // 6. LOGS (Auditoria)
        match /public/data/system_logs/{logId} {
          // Garante que o usuário só possa assinar o log com seu próprio ID
          allow create: if request.auth != null 
            && request.resource.data.message.size() < 2000
            && request.resource.data.userId == request.auth.uid;
            
          allow read, update, delete: if isAdmin(appId);
        }
    }
  }
}
```

---

## 📦 Instalação e Execução Local

1.  **Clonar e Instalar**
    ```bash
    git clone https://github.com/SEU_USUARIO/uniesterilizacao-web.git
    cd uniesterilizacao-web
    npm install
    ```

2.  **Variáveis de Ambiente (.env)**
    Crie um arquivo `.env` na raiz do projeto:
    ```env
    VITE_API_KEY=sua_api_key_do_firebase
    VITE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
    VITE_PROJECT_ID=seu_projeto_id
    VITE_STORAGE_BUCKET=seu_bucket
    VITE_MESSAGING_SENDER_ID=seu_sender_id
    VITE_APP_ID=seu_app_id
    ```

3.  **Rodar**
    ```bash
    npm run dev
    ```

---

## 🔄 Workflow de Manutenção e Produção

Guia destinado à equipe técnica para atualizações seguras.

### 1. Testando sem Quebrar a Produção (Preview Channels)
Antes de atualizar o link oficial, crie um link temporário para validação.
1.  Faça alterações locais e gere o build: `npm run build`
2.  Rode o comando:
    ```bash
    firebase hosting:channel:deploy teste
    ```
3.  Acesse o link temporário gerado no terminal.

### 2. Atualizando a Produção (Deploy Oficial)
Somente após aprovação dos testes:
```bash
git pull origin main
npm run build
firebase deploy
```

### 3. Rollback (Voltar Versão)
Se algo der errado em produção (ex: bug crítico):
1.  Acesse o [Firebase Console > Hosting](https://console.firebase.google.com/).
2.  Na tabela "Histórico de versões", encontre a versão anterior estável.
3.  Clique nos três pontos (⋮) e selecione **Reverter (Rollback)**.

---

## 🖨️ Configuração de Impressora (Térmica)

O sistema possui um módulo de impressão (`Admin > Etiquetas`).

*   **Tamanho Recomendado:** 50mm x 30mm.
*   **Ajustes:** Caso a impressão saia cortada, utilize as configurações de **Margem** e **Rotação** no painel do sistema, sem necessidade de alterar drivers do Windows.

---

## 📄 Licença

Desenvolvido pelo **Escritório de Projetos e Processos da Fundação Educacional de Lavras (Unilavras)**.
