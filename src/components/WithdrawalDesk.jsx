import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Scanner } from "@yudiel/react-qr-scanner";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import {
  ScanBarcode,
  Camera,
  XCircle,
  Loader2,
  X,
  CheckCircle2,
  ShoppingCart,
  ShieldAlert,
  PackageCheck,
  Hash,
} from "lucide-react";

import { db, appId } from "../config/firebase";
import { useToast } from "../contexts/ToastContext";
import { useDialog } from "../contexts/DialogContext";
import { logEvent } from "../utils/logger";
import { formatDate, maskCPF } from "../utils/formatters";
import { playSound } from "../utils/audio";
import { STATUS_CONFIG } from "../constants";
import { useScanner } from "../hooks/useScanner";
import { useStudentsDirectory } from "../hooks/useStudentsDirectory";

// Status que ainda estão "no setor" (aparecem na sessão do aluno).
const ACTIVE_STATUSES = ["recebido", "em_esterilizacao", "pronto", "problema"];

const itemsCollection = () =>
  collection(db, "artifacts", appId, "public", "data", "items");

/**
 * Balcão de retirada: uma sessão por aluno.
 * 1. Aluno digita o CPF no teclado numérico.
 * 2. Técnico confirma o usuário.
 * 3. Técnico bipa os itens; só entram no carrinho itens prontos DESTE aluno.
 * 4. Despacho único em transação (revalida dono e status no banco).
 */
export default function WithdrawalDesk({ userProfile }) {
  const [phase, setPhase] = useState("cpf"); // cpf | session
  const [cpf, setCpf] = useState("");
  const [student, setStudent] = useState(null);
  const [lastDispatch, setLastDispatch] = useState(null);

  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [cart, setCart] = useState([]); // ids
  const [blocked, setBlocked] = useState(null); // { code, message }
  const [checking, setChecking] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const { code, setCode, showCamera, setShowCamera, handleScan } = useScanner();
  const { addToast } = useToast();
  const { confirm } = useDialog();

  const cpfRef = useRef(null);
  const scanRef = useRef(null);
  const scanTimeout = useRef(null);

  const { data: studentsDirectory = [], isLoading: loadingDirectory } =
    useStudentsDirectory({ enabled: !!userProfile });

  // --- ITENS DO ALUNO DA SESSÃO (tempo real) ---
  useEffect(() => {
    if (phase !== "session" || !student) return;
    setLoadingItems(true);
    const q = query(
      itemsCollection(),
      where("studentId", "==", student.uid),
      where("status", "in", ACTIVE_STATUSES),
    );
    const unsub = onSnapshot(
      q,
      (s) => {
        const list = s.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(list);
        // Item que deixou de estar pronto (ou saiu do setor) sai do carrinho.
        setCart((prev) =>
          prev.filter((id) =>
            list.some((i) => i.id === id && i.status === "pronto"),
          ),
        );
        setLoadingItems(false);
      },
      (err) => {
        console.error(err);
        addToast("Erro ao carregar os materiais do aluno.", "error");
        setLoadingItems(false);
      },
    );
    return () => unsub();
  }, [phase, student, addToast]);

  // Mantém o foco no campo certo para o teclado numérico / leitor.
  useEffect(() => {
    if (blocked) return;
    const target = phase === "cpf" ? cpfRef.current : scanRef.current;
    if (target) setTimeout(() => target.focus(), 50);
  }, [phase, blocked]);

  // --- ETAPA 1: CPF ---
  // Busca a partir do 3º dígito, pelo início do CPF.
  const MIN_CPF_DIGITS = 3;
  const MAX_MATCHES = 8;
  const matches =
    cpf.length >= MIN_CPF_DIGITS
      ? studentsDirectory.filter((s) =>
          (s.cpf || "").replace(/\D/g, "").startsWith(cpf),
        )
      : null;

  const openSession = (s) => {
    setStudent(s);
    setItems([]);
    setCart([]);
    setCode("");
    setLastDispatch(null);
    setPhase("session");
  };

  const resetToCpf = () => {
    setPhase("cpf");
    setStudent(null);
    setItems([]);
    setCart([]);
    setCpf("");
    setCode("");
    setShowCamera(false);
    setBlocked(null);
  };

  const cancelSession = async () => {
    if (cart.length > 0) {
      const ok = await confirm({
        title: "Encerrar sem despachar?",
        message: `${cart.length} ${cart.length === 1 ? "item está" : "itens estão"} no carrinho e não ${cart.length === 1 ? "será retirado" : "serão retirados"}.`,
        confirmLabel: "Encerrar",
        isDestructive: true,
      });
      if (!ok) return;
    }
    resetToCpf();
  };

  // --- ETAPA 2: BIPAGEM ---
  const block = (scanned, message) => {
    playSound("error");
    setTimeout(() => playSound("error"), 250);
    setBlocked({ code: scanned, message });
  };

  const addToCart = (item) => {
    if (cart.includes(item.id)) return;
    playSound("success");
    setCart((prev) => [...prev, item.id]);
    scanRef.current?.focus();
  };

  const processCode = async (raw) => {
    const scanned = (raw || "").toUpperCase();
    if (!scanned || checking) return;
    setCode("");

    const local = items.find((i) => (i.code || "").toUpperCase() === scanned);

    if (local) {
      if (cart.includes(local.id)) {
        playSound("error");
        addToast(`${local.code} já está no carrinho.`, "warning");
        return;
      }
      if (local.status !== "pronto") {
        const label = STATUS_CONFIG[local.status]?.label || local.status;
        block(scanned, `Este material ainda não pode sair: ${label}.`);
        return;
      }
      addToCart(local);
      return;
    }

    // Não está entre os itens ativos deste aluno: descobre o motivo.
    setChecking(true);
    try {
      const snap = await getDocs(
        query(itemsCollection(), where("code", "==", scanned)),
      );
      if (snap.empty) {
        block(scanned, "Código não encontrado no sistema.");
      } else {
        const it = snap.docs[0].data();
        if (it.studentId !== student.uid) {
          block(
            scanned,
            `Este material NÃO pertence a ${student.name}. Ele não pode sair nesta retirada.`,
          );
        } else if (it.status === "retirado") {
          block(scanned, "Este material já foi retirado anteriormente.");
        } else {
          block(scanned, "Este material não está disponível para retirada.");
        }
      }
    } catch (err) {
      console.error(err);
      addToast("Erro ao verificar o código. Tente novamente.", "error");
    } finally {
      setChecking(false);
    }
  };

  // Leitor que não envia Enter (ou câmera): processa após pausa na digitação.
  useEffect(() => {
    if (scanTimeout.current) clearTimeout(scanTimeout.current);
    if (phase !== "session" || code.length < 6 || blocked) return;
    scanTimeout.current = setTimeout(() => processCode(code), 500);
    return () => clearTimeout(scanTimeout.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, phase, blocked]);

  const dismissBlock = () => {
    setBlocked(null);
    setCode("");
  };

  useEffect(() => {
    if (!blocked) return;
    const onKey = (e) => {
      if (e.key === "Escape") dismissBlock();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked]);

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((x) => x !== id));
    scanRef.current?.focus();
  };

  // --- ETAPA 3: DESPACHO ---
  const dispatch = async () => {
    if (cart.length === 0 || dispatching) return;
    const cartItems = items.filter((i) => cart.includes(i.id));

    const ok = await confirm({
      title: "Despachar retirada",
      message: `Confirmar a retirada de ${cartItems.length} ${cartItems.length === 1 ? "item" : "itens"} por ${student.name}?`,
      confirmLabel: "Despachar",
    });
    if (!ok) return;

    setDispatching(true);
    try {
      const now = new Date().toISOString();
      await runTransaction(db, async (tx) => {
        const refs = cartItems.map((i) =>
          doc(db, "artifacts", appId, "public", "data", "items", i.id),
        );
        const snaps = await Promise.all(refs.map((r) => tx.get(r)));

        for (const s of snaps) {
          const d = s.data();
          if (!s.exists() || d.studentId !== student.uid) {
            throw new Error(`O item ${d?.code || s.id} não pertence a este aluno.`);
          }
          if (d.status !== "pronto") {
            throw new Error(`O item ${d.code} não está mais pronto para retirada.`);
          }
        }

        snaps.forEach((s, idx) => {
          const d = s.data();
          tx.update(refs[idx], {
            status: "retirado",
            history: [
              ...(d.history || []),
              { status: "retirado", timestamp: now, by: userProfile.name },
            ],
            lastUpdated: serverTimestamp(),
          });
        });

        const lista = cartItems.map((i) => `${i.code} - ${i.type}`).join(", ");
        tx.set(
          doc(collection(db, "artifacts", appId, "users", student.uid, "notifications")),
          {
            title: "Materiais Retirados",
            message:
              cartItems.length === 1
                ? `Seu item ${lista} foi retirado.`
                : `Você retirou ${cartItems.length} itens: ${lista}.`,
            read: false,
            createdAt: serverTimestamp(),
          },
        );
      });

      await logEvent(
        "ITEM_MOVE",
        `Retirada de ${cartItems.length} ${cartItems.length === 1 ? "item" : "itens"} por ${student.name}`,
        {
          studentId: student.uid,
          studentName: student.name,
          codes: cartItems.map((i) => i.code),
          itemIds: cartItems.map((i) => i.id),
          previousStatus: "pronto",
          newStatus: "retirado",
          reason: "Sessão de retirada",
        },
      );

      playSound("success");
      addToast(`${cartItems.length} ${cartItems.length === 1 ? "item despachado" : "itens despachados"}!`, "success");
      const done = { name: student.name, count: cartItems.length };
      resetToCpf();
      setLastDispatch(done);
    } catch (err) {
      console.error(err);
      playSound("error");
      addToast(err.message || "Erro ao despachar. Nada foi alterado.", "error");
    } finally {
      setDispatching(false);
    }
  };

  // ======================= RENDER =======================

  if (phase === "cpf") {
    return (
      <div className="max-w-xl mx-auto space-y-6 py-8 animate-in zoom-in-95 duration-300">
        {lastDispatch && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 p-4 rounded-xl text-sm transition-colors">
            <PackageCheck size={20} className="shrink-0" />
            <span>
              Última retirada: <strong>{lastDispatch.name}</strong> —{" "}
              {lastDispatch.count} {lastDispatch.count === 1 ? "item" : "itens"}.
            </span>
          </div>
        )}

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-lg text-center transition-colors">
          <Hash className="w-14 h-14 text-[#009DE0] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#021D34] mb-2">Retirada de Materiais</h2>
          <p className="text-slate-500 mb-6 text-sm">
            Aluno: digite seu CPF no teclado numérico.
          </p>
          <div className="relative">
            <input
              ref={cpfRef}
              inputMode="numeric"
              autoComplete="off"
              className="w-full text-center font-mono text-3xl tracking-[0.15em] p-4 border-2 border-slate-200 rounded-xl focus:border-[#009DE0] outline-none bg-white text-black transition-colors"
              placeholder="000.000.000-00"
              value={maskCPF(cpf)}
              onChange={(e) =>
                setCpf(e.target.value.replace(/\D/g, "").slice(0, 11))
              }
              disabled={loadingDirectory}
            />
            {loadingDirectory && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-[#009DE0] animate-spin" size={22} />
            )}
          </div>
          {cpf.length > 0 && cpf.length < MIN_CPF_DIGITS && (
            <p className="text-xs text-slate-400 mt-3">
              Digite ao menos {MIN_CPF_DIGITS} dígitos.
            </p>
          )}
        </div>

        {matches && matches.length === 0 && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm text-center font-semibold transition-colors">
            Nenhum aluno ativo com este CPF.
          </div>
        )}

        {matches && matches.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden animate-in slide-in-from-bottom-4 transition-colors">
            <p className="px-4 py-2 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
              Técnico: confirme o aluno
            </p>
            {matches.slice(0, MAX_MATCHES).map((s) => (
              <button
                key={s.uid}
                onClick={() => openSession(s)}
                className="w-full text-left p-4 hover:bg-blue-50 border-b border-slate-100 last:border-0 transition-colors flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-full bg-[#009DE0] text-white flex items-center justify-center font-bold text-lg shrink-0">
                  {(s.name || "?").substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#021D34] text-lg break-words">{s.name}</p>
                  <p className="text-sm text-slate-500">{maskCPF(s.cpf)}</p>
                </div>
                <span className="text-xs font-bold text-[#009DE0] whitespace-nowrap">Abrir sessão →</span>
              </button>
            ))}
            {matches.length > MAX_MATCHES && (
              <p className="px-4 py-2 text-[11px] text-center text-slate-400 border-t border-slate-100">
                + {matches.length - MAX_MATCHES} aluno
                {matches.length - MAX_MATCHES === 1 ? "" : "s"} — continue digitando o CPF
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- SESSÃO ---
  const ready = items.filter((i) => i.status === "pronto" && !cart.includes(i.id));
  const notReady = items.filter((i) => i.status !== "pronto");
  const cartItems = cart.map((id) => items.find((i) => i.id === id)).filter(Boolean);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* BLOQUEIO — portal no body para cobrir a tela inteira, independente do scroll */}
      {blocked &&
        createPortal(
          <div className="fixed inset-0 z-[10006] flex flex-col items-center justify-start bg-red-600 text-white px-6 pt-16 pb-8 overflow-y-auto">
            <ShieldAlert className="w-24 h-24 mb-6 shrink-0" />
            <p className="text-sm uppercase font-bold tracking-widest text-white/80 mb-2">
              Material bloqueado
            </p>
            <p className="font-mono text-4xl font-bold tracking-wider mb-4 break-all text-center">
              {blocked.code}
            </p>
            <h3 className="text-2xl md:text-3xl font-bold text-center max-w-3xl mb-10">
              {blocked.message}
            </h3>
            <button
              onClick={dismissBlock}
              className="px-10 py-4 bg-white text-red-700 text-lg font-bold rounded-xl hover:bg-red-50 transition-colors shadow-lg"
            >
              Entendi (Esc)
            </button>
          </div>,
          document.body,
        )}

      {/* CABEÇALHO DA SESSÃO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#021D34] text-white p-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-full bg-[#009DE0] flex items-center justify-center font-bold shrink-0">
            {(student.name || "?").substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase font-bold text-white/60">Sessão de retirada</p>
            <p className="font-bold text-lg break-words leading-tight">{student.name}</p>
            <p className="text-xs text-white/70">{maskCPF(student.cpf)}</p>
          </div>
        </div>
        <button
          onClick={cancelSession}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors"
        >
          <X size={16} /> Encerrar sessão
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
        {/* COLUNA ESQUERDA: LEITURA + MATERIAIS */}
        <div className="space-y-4 min-w-0">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-colors">
            {!showCamera ? (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <ScanBarcode className="absolute left-3 top-3.5 w-5 h-5 text-[#009DE0]" />
                  <input
                    ref={scanRef}
                    className="w-full pl-11 pr-3 py-3 font-mono text-xl uppercase tracking-[0.15em] border-2 border-slate-200 rounded-xl focus:border-[#009DE0] outline-none bg-white text-black transition-colors"
                    placeholder="BIPE O CÓDIGO"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        clearTimeout(scanTimeout.current);
                        processCode(code);
                      }
                    }}
                    disabled={!!blocked}
                  />
                  {checking && (
                    <Loader2 className="absolute right-3 top-3.5 w-5 h-5 text-[#009DE0] animate-spin" />
                  )}
                </div>
                <button
                  onClick={() => setShowCamera(true)}
                  className="px-4 bg-[#021D34] text-white rounded-xl hover:bg-[#009DE0] transition-colors"
                  title="Usar câmera"
                >
                  <Camera size={20} />
                </button>
              </div>
            ) : (
              <div className="relative bg-black rounded-xl overflow-hidden aspect-square max-w-sm mx-auto">
                <Scanner onScan={handleScan} components={{ audio: false }} />
                <button
                  onClick={() => setShowCamera(false)}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-md border border-white/30 text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-white/30 z-20"
                >
                  <XCircle size={18} /> Cancelar
                </button>
              </div>
            )}
          </div>

          {loadingItems ? (
            <div className="flex justify-center py-12 text-[#009DE0]">
              <Loader2 className="animate-spin" size={28} />
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-sm transition-colors">
              Este aluno não tem materiais no setor.
            </div>
          ) : (
            <>
              <CardSection
                title={`Prontos para retirada (${ready.length})`}
                items={ready}
                onSelect={addToCart}
                empty={cart.length > 0 ? "Todos os itens prontos já estão no carrinho." : "Nenhum item pronto."}
              />
              {notReady.length > 0 && (
                <CardSection
                  title={`Ainda não podem sair (${notReady.length})`}
                  items={notReady}
                  muted
                />
              )}
            </>
          )}
        </div>

        {/* COLUNA DIREITA: CARRINHO */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm lg:sticky lg:top-4 flex flex-col max-h-[calc(100vh-8rem)] transition-colors">
          <div className="flex items-center gap-2 p-4 border-b border-slate-100">
            <ShoppingCart size={18} className="text-[#009DE0]" />
            <h3 className="font-bold text-[#021D34]">Carrinho</h3>
            <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-[#009DE0]/10 text-[#009DE0]">
              {cartItems.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[120px]">
            {cartItems.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">
                Bipe ou clique nos materiais prontos para adicioná-los.
              </p>
            ) : (
              cartItems.map((i) => (
                <div
                  key={i.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-200 animate-in slide-in-from-left-2 transition-colors"
                >
                  <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-bold text-sm text-[#021D34]">{i.code}</p>
                    <p className="text-xs text-slate-600 truncate">{i.type}</p>
                  </div>
                  <button
                    onClick={() => removeFromCart(i.id)}
                    className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                    title="Tirar do carrinho"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="p-3 border-t border-slate-100">
            <button
              onClick={dispatch}
              disabled={cartItems.length === 0 || dispatching}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#009DE0] text-white font-bold rounded-xl hover:bg-[#008bc5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {dispatching ? <Loader2 className="animate-spin" size={18} /> : <PackageCheck size={18} />}
              Despachar {cartItems.length > 0 ? `${cartItems.length} ${cartItems.length === 1 ? "item" : "itens"}` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardSection({ title, items, empty, muted = false, onSelect }) {
  return (
    <div>
      <p className="text-[11px] uppercase font-bold text-slate-400 mb-2">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl p-4 text-center transition-colors">
          {empty}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
          {items.map((i) => {
            const c = STATUS_CONFIG[i.status] || STATUS_CONFIG.recebido;
            return (
              <div
                key={i.id}
                role={onSelect ? "button" : undefined}
                tabIndex={onSelect ? 0 : undefined}
                onClick={onSelect ? () => onSelect(i) : undefined}
                onKeyDown={
                  onSelect
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelect(i);
                        }
                      }
                    : undefined
                }
                title={onSelect ? "Adicionar ao carrinho" : undefined}
                className={`p-3 rounded-xl border bg-white transition-colors ${muted ? "opacity-60 border-slate-200" : "border-green-200 shadow-sm"} ${onSelect ? "cursor-pointer hover:border-[#009DE0] hover:bg-blue-50 active:scale-[0.98]" : ""}`}
              >
                <p className="font-mono font-bold text-[#009DE0] text-sm tracking-wider">{i.code}</p>
                <p className="text-xs font-semibold text-slate-800 truncate" title={i.type}>
                  {i.type}
                </p>
                <div className="flex items-center justify-between mt-2 gap-1">
                  <span className="text-[10px] text-slate-400">{formatDate(i.createdAt)}</span>
                  {muted && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${c.color}`}>
                      {c.label}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
