import {
  collection,
  query,
  where,
  getDocs,
  doc,
  writeBatch,
} from "firebase/firestore";
import { db, appId } from "../config/firebase";
import { logEvent } from "./logger";
import { upsertDirectoryEntry } from "../hooks/useUsersDirectory";

// Regras de cadastro compartilhadas entre a tela de Usuários e o modal da
// página Alunos. Movidas sem alteração de UserManagement.jsx.

export const checkCpfExists = async (cpf, excludeUid = null) => {
  const cleanCpf = cpf.replace(/\D/g, "");
  const q = query(
    collection(db, "artifacts", appId, "public", "data", "users_directory"),
    where("cpf", "==", cleanCpf),
  );
  const snap = await getDocs(q);

  if (snap.empty) return false;

  if (excludeUid) {
    return snap.docs.some((d) => d.id !== excludeUid);
  }

  return true;
};

// Edição de um usuário existente (perfil privado + diretório público).
// Retorna { ok: false, error } nas mesmas validações que antes viravam toast.
export async function updateUserRecord({ editing, data, queryClient, userProfile }) {
  const cleanCpf = data.cpf.replace(/\D/g, "");
  const batch = writeBatch(db);

  if (!data.active) {
    const q = query(
      collection(db, "artifacts", appId, "public", "data", "items"),
      where("studentId", "==", editing.uid),
      where("status", "!=", "retirado"),
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return {
        ok: false,
        error: `Não é possível inativar. Utilizador tem itens pendentes.`,
      };
    }
  }

  if (await checkCpfExists(cleanCpf, editing.uid)) {
    return { ok: false, error: "Este CPF já está a ser usado." };
  }

  const updates = {
    name: data.name,
    email: data.email,
    cpf: cleanCpf,
    role: data.role,
    active: data.active,
  };

  // --- DETECÇÃO DE MUDANÇAS PARA LOG (MELHORIA) ---
  const changesDetected = [];
  if (editing.role !== data.role)
    changesDetected.push(`Perfil: ${editing.role} -> ${data.role}`);
  if (editing.active !== data.active)
    changesDetected.push(
      `Status: ${editing.active ? "Ativo" : "Inativo"} -> ${data.active ? "Ativo" : "Inativo"}`,
    );
  if (editing.name !== data.name) changesDetected.push(`Nome alterado`);
  if (editing.email !== data.email)
    changesDetected.push(`Email alterado`);
  if (editing.cpf !== cleanCpf) changesDetected.push(`CPF alterado`);
  // ------------------------------------------------

  batch.update(
    doc(db, "artifacts", appId, "users", editing.uid, "profile", "data"),
    updates,
  );
  batch.update(
    doc(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "users_directory",
      editing.uid,
    ),
    updates,
  );

  await batch.commit();

  upsertDirectoryEntry(queryClient, editing.uid, updates);

  // --- LOG MELHORADO COM DETALHES ---
  await logEvent("USER_MGMT", `Utilizador atualizado: ${data.name}`, {
    targetUid: editing.uid,
    updates: updates,
    changesSummary:
      changesDetected.join(", ") || "Atualização de dados cadastrais",
    executor: userProfile.email,
  });
  return { ok: true };
}
