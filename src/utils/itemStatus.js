import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db, appId } from "../config/firebase";
import { logEvent } from "./logger";
import { STATUS_CONFIG } from "../constants";

// Transição de status de um material, compartilhada entre a Movimentação e o
// modal da página Alunos. Movida sem alteração de Movement.jsx.

// --- DEFINIÇÃO DA ORDEM RIGOROSA ---
// 'em_esterilizacao' mantido para compatibilidade com itens legados (DB ainda pode ter).
export const STATUS_ORDER = ["recebido", "em_esterilizacao", "pronto", "retirado"];

// --- HELPER: VALIDAÇÃO DE TRANSIÇÃO ---
// Fluxo simplificado: Recebido → Pronto → Retirado (Em Esterilização aceita como legado).
export const canMoveTo = (currentStatus, nextStatus) => {
  if (nextStatus === "problema") return { allowed: true };
  if (currentStatus === "problema") return { allowed: true };

  const currIndex = STATUS_ORDER.indexOf(currentStatus);
  const nextIndex = STATUS_ORDER.indexOf(nextStatus);

  if (currIndex === -1 || nextIndex === -1) {
    return {
      allowed: false,
      error: "O status atual do item é inválido. Contate o suporte.",
    };
  }
  if (currIndex === nextIndex) {
    return { allowed: false, error: "O item já está neste status." };
  }
  if (nextIndex < currIndex) {
    return {
      allowed: false,
      error: "O fluxo é contínuo. Não é permitido retroceder etapas.",
    };
  }

  return { allowed: true };
};

// Grava a mudança (item + notificação ao aluno) e registra no log. Quem chama
// valida antes com canMoveTo.
export async function commitStatusChange({ item, newStatus, reason = null, userProfile }) {
  const batch = writeBatch(db);
  const ref = doc(db, "artifacts", appId, "public", "data", "items", item.id);

  const previousStatus = item.status;
  const historyEntry = {
    status: newStatus,
    timestamp: new Date().toISOString(),
    by: userProfile.name,
  };
  if (reason) historyEntry.reason = reason;

  const history = [...(item.history || []), historyEntry];
  batch.update(ref, {
    status: newStatus,
    history,
    lastUpdated: serverTimestamp(),
  });

  if (item.studentId) {
    const nRef = doc(
      collection(
        db,
        "artifacts",
        appId,
        "users",
        item.studentId,
        "notifications",
      ),
    );
    let title = "Atualização de Material";
    let message = `Seu item ${item.code} - ${item.type} mudou para: ${STATUS_CONFIG[newStatus].label}`;

    if (newStatus === "problema" && reason) {
      title = "⚠️ Atenção: Ocorrência com Material";
      message = `Houve uma ocorrência com seu item ${item.code} (${item.type}): "${reason}". Por favor, procure a central.`;
    } else if (reason && reason.startsWith("Resolução:")) {
      title = "✅ Ocorrência Resolvida";
      message = `O problema com seu item ${item.code} foi resolvido e ele retornou para: ${STATUS_CONFIG[newStatus].label}.`;
    }

    batch.set(nRef, {
      title,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });
  }

  await batch.commit();

  await logEvent("ITEM_MOVE", `Item ${item.code} movido para ${newStatus}`, {
    itemId: item.id,
    code: item.code,
    studentName: item.studentName,
    previousStatus: previousStatus,
    newStatus: newStatus,
    reason: reason || "Fluxo normal",
  });
}
