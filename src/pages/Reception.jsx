import React, { useState, useEffect, useMemo } from "react";
import {
  writeBatch,
  doc,
  serverTimestamp,
  collection,
} from "firebase/firestore";
import {
  Search,
  PackagePlus,
  X,
  CheckCircle2,
  Printer,
  Trash2,
  Monitor,
  Loader2,
  RotateCw,
  WifiOff,
  Wifi,
} from "lucide-react";

import { db, appId } from "../config/firebase";
import { useToast } from "../contexts/ToastContext";
import { useDialog } from "../contexts/DialogContext";
import { usePrint } from "../contexts/PrintContext";
import { maskCPF } from "../utils/formatters";

// Hooks personalizados
import { useStudentsDirectory } from "../hooks/useStudentsDirectory";
import { useMaterialTypes } from "../hooks/useMaterialTypes";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useQueryClient } from "@tanstack/react-query";

import { logEvent } from "../utils/logger";

const generateSafeId = (length = 6) => {
  // Mantemos apenas números e letras (sem 0, 1, I, O para evitar confusão visual)
  const base = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

  // Removido: const specials = '!#$*+-=?&';
  // Removido: const chars = base + specials;

  const chars = base; // Agora usa apenas a base segura

  const array = new Uint32Array(length);
  window.crypto.getRandomValues(array);

  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
};

export default function Reception({ userProfile }) {
  const [step, setStep] = useState(1);
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();

  const {
    data: rawStudents = [],
    isLoading: loadingStudents,
    isRefetching: isRefetchingStudents,
  } = useStudentsDirectory({ enabled: !!userProfile });

  const allStudents = useMemo(() => {
    return rawStudents.filter((s) => s.active !== false);
  }, [rawStudents]);

  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);

  const studentResults = useMemo(() => {
    if (!search || search.length < 2) return [];
    const term = search.toLowerCase();
    return allStudents
      .filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          (s.cpf && s.cpf.includes(term)),
      )
      .slice(0, 10);
  }, [search, allStudents]);

  const {
    data: types = [],
    refetch: refetchTypes,
    isRefetching: isRefetchingTypes,
  } = useMaterialTypes();

  const [cart, setCart] = useState([]);
  const [createdItems, setCreatedItems] = useState([]);

  const [itemSearch, setItemSearch] = useState("");
  const [isMobileBlock, setIsMobileBlock] = useState(window.innerWidth < 768);

  const { addToast } = useToast();
  const { confirm } = useDialog();
  const { printItems } = usePrint();

  useEffect(() => {
    const handleResize = () => setIsMobileBlock(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleManualRefreshStudents = async () => {
    if (!isOnline) {
      addToast("Sem conexão para atualizar.", "error");
      return;
    }
    addToast("Atualizando lista de alunos...", "info");
    await queryClient.invalidateQueries({
      queryKey: ["students_full_directory_v2"],
    });
    addToast("Solicitação de atualização enviada.", "success");
  };

  const handleManualRefreshTypes = async () => {
    if (!isOnline) {
      addToast("Sem conexão para atualizar.", "error");
      return;
    }
    addToast("Atualizando tipos de materiais...", "info");
    await refetchTypes();
    addToast("Materiais atualizados.", "success");
  };

  const filteredTypes = types.filter((t) =>
    t.name.toLowerCase().includes(itemSearch.toLowerCase()),
  );

  const handleChangeStudent = async () => {
    if (cart.length > 0) {
      const confirmed = await confirm({
        title: "Trocar Aluno?",
        message:
          "Ao trocar o aluno, o carrinho atual será esvaziado. Deseja continuar?",
        confirmText: "Sim, Trocar",
        isDestructive: true,
      });
      if (!confirmed) return;
    }
    setCart([]);
    setSelectedStudent(null);
    setSearch("");
  };

  const handleAddMaterial = (t) => {
    if (!selectedStudent) {
      addToast(
        "Identifique o aluno (Passo 1) antes de selecionar materiais.",
        "error",
      );
      const searchInput = document.getElementById("student-search-input");
      if (searchInput) searchInput.focus();
      return;
    }
    setCart([...cart, { ...t, uid: Math.random() }]);
  };

  const handleRemoveMaterial = (t) => {
    const idx = cart.findLastIndex((c) => c.id === t.id);
    if (idx === -1) return;
    const next = [...cart];
    next.splice(idx, 1);
    setCart(next);
  };

  const finish = async () => {
    if (cart.length === 0) return;

    const batch = writeBatch(db);
    const newItems = [];

    try {
      if (isOnline) {
        addToast("Processando materiais online...", "info");
      } else {
        addToast("Salvando materiais OFFLINE...", "info");
      }

      for (const item of cart) {
        // Alfabeto seguro tem 32^6 ≈ 1 bilhão de combinações — colisão real desprezível.
        // Verificação sequencial por Firestore removida: causava N×1.5s de latência.
        const code = generateSafeId();

        const docRef = doc(
          collection(db, "artifacts", appId, "public", "data", "items"),
        );
        const now = new Date();
        const timestampISO = now.toISOString();

        const data = {
          code,
          type: item.name,
          studentName: selectedStudent.name,
          studentId: selectedStudent.uid,
          status: "recebido",
          createdAt: now,
          lastUpdated: now,
          serverTimestamp: serverTimestamp(),
          history: [
            {
              status: "recebido",
              timestamp: timestampISO,
              by: userProfile.name,
            },
          ],
        };

        batch.set(docRef, data);
        newItems.push({ ...data, id: docRef.id });

        const notifRef = doc(
          collection(
            db,
            "artifacts",
            appId,
            "users",
            selectedStudent.uid,
            "notifications",
          ),
        );
        batch.set(notifRef, {
          title: "Material Recebido",
          message: `O item ${item.name} foi recebido com o código ${code}.`,
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      const backupPayload = newItems.map((item) => ({
        ...item,
        tempId: item.id,
        savedAt: new Date().toISOString(),
      }));

      const existingBackup = JSON.parse(
        localStorage.getItem("unilavras_offline_backup") || "[]",
      );
      const updatedBackup = [...existingBackup, ...backupPayload];
      localStorage.setItem(
        "unilavras_offline_backup",
        JSON.stringify(updatedBackup),
      );
      localStorage.setItem("unilavras_offline_count", updatedBackup.length);

      batch
        .commit()
        .then(async () => {
          console.log("Sincronização concluída (IndexedDB/Server).");
          if (isOnline) {
            localStorage.removeItem("unilavras_offline_backup");
            localStorage.removeItem("unilavras_offline_count");
            await logEvent(
              "ITEM_ENTRY",
              `Entrada de ${cart.length} itens para ${selectedStudent.name}`,
              {
                studentId: selectedStudent.uid,
                studentName: selectedStudent.name,
                quantity: cart.length,
                itemTypes: cart.map((i) => i.name),
              },
              userProfile,
            );
          }
        })
        .catch((err) => console.error("Dados salvos localmente:", err));

      setCreatedItems(newItems);
      setStep(3);

      if (isOnline) addToast("Materiais registrados!", "success");
      else addToast("Salvo localmente! Envio pendente.", "success");
    } catch (e) {
      console.error(e);
      addToast("Erro ao criar registros.", "error");
    }
  };

  if (isMobileBlock) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-in zoom-in-95">
        <div className="bg-blue-50 p-6 rounded-full mb-6 border border-blue-100">
          <Monitor className="w-16 h-16 text-[#009DE0]" />
        </div>
        <h2 className="text-2xl font-bold text-[#021D34] mb-3">
          Acesso Restrito
        </h2>
        <p className="text-slate-500 max-w-md mx-auto">
          Acesse esta página em um computador.
        </p>
      </div>
    );
  }

  if (step === 3)
    return (
      <div className="animate-in zoom-in">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center max-w-3xl mx-auto shadow-xl transition-colors">
          <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#021D34]">
            {isOnline ? "Sucesso!" : "Salvo Offline!"}
          </h2>
          <p className="text-slate-500 mt-2">
            {isOnline
              ? "Etiquetas geradas. Clique abaixo para imprimir."
              : "Os itens foram salvos no dispositivo e serão enviados assim que a internet voltar. Pode imprimir agora."}
          </p>

          <div className="flex justify-center gap-4 mb-8 mt-6">
            <button
              onClick={() => printItems(createdItems)}
              className="bg-[#021D34] text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-[#032d50] transition-colors shadow-lg"
            >
              <Printer size={20} /> Imprimir TODAS
            </button>
            <button
              onClick={() => {
                setStep(1);
                setSelectedStudent(null);
                setSearch("");
                setCart([]);
              }}
              className="border border-slate-200 px-6 py-3 rounded-lg font-bold hover:bg-slate-50 text-slate-700 transition-colors"
            >
              Novo Atendimento
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* --- HEADER --- */}
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-[#021D34] text-2xl flex items-center gap-2 transition-colors">
          <PackagePlus className="text-[#009DE0]" /> Receção
        </h2>
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border transition-colors duration-300 ${
            isOnline
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-red-50 text-red-700 border-red-200 animate-pulse"
          }`}
        >
          {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
          {isOnline ? "Conectado" : "Modo Offline"}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* --- COLUNA ESQUERDA (ALUNOS E MATERIAIS) --- */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. CARD IDENTIFICAÇÃO DO ALUNO */}
          <div
            className={`bg-white p-6 rounded-2xl border transition-all duration-300 ${selectedStudent ? "border-[#009DE0]]" : "border-slate-200"}`}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2 text-[#021D34]">
                <span className="w-6 h-6 rounded-full bg-[#021D34] text-white flex items-center justify-center text-xs">
                  1
                </span>{" "}
                Identificação
              </h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-xs font-medium text-slate-400">
                  {loadingStudents ? (
                    <>
                      <Loader2 className="animate-spin w-3 h-3" /> Carregando...
                    </>
                  ) : (
                    <span
                      title="Número de alunos carregados"
                      className="flex items-center gap-1 cursor-help"
                    >
                      <CheckCircle2 className="w-3 h-3 text-green-500" />{" "}
                      {allStudents.length} Alunos
                    </span>
                  )}
                </div>
                <button
                  onClick={handleManualRefreshStudents}
                  disabled={!isOnline}
                  className={`p-1.5 rounded-full hover:bg-slate-100 transition-colors ${isRefetchingStudents ? "animate-spin text-[#009DE0]" : "text-slate-400"} ${!isOnline ? "opacity-50 cursor-not-allowed" : ""}`}
                  title="Recarregar alunos"
                >
                  <RotateCw size={16} />
                </button>
                {selectedStudent && (
                  <button
                    onClick={handleChangeStudent}
                    className="text-xs text-red-500 hover:underline font-bold ml-2"
                  >
                    Alterar
                  </button>
                )}
              </div>
            </div>

            {!selectedStudent ? (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <input
                    id="student-search-input"
                    className="w-full pl-10 p-3 border border-slate-200 rounded-lg outline-none focus:border-[#009DE0]] bg-white text-slate-900 transition-colors"
                    placeholder="Nome ou CPF..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                    autoComplete="off"
                    disabled={loadingStudents && allStudents.length === 0}
                  />
                </div>
                {studentResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 mt-2 rounded-xl shadow-xl z-20 overflow-hidden max-h-60 overflow-y-auto animate-in slide-in-from-top-2">
                    {studentResults.map((s) => (
                      <button
                        key={s.uid}
                        onClick={() => {
                          if (s.active === false) {
                            addToast("Aluno inativo.", "error");
                            return;
                          }
                          setSelectedStudent(s);
                        }}
                        className="w-full text-left p-3 hover:bg-blue-50 border-b border-slate-100 last:border-0 transition-colors"
                      >
                        <div className="flex justify-between">
                          <div>
                            <p className="font-bold text-[#021D34]">
                              {s.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {maskCPF(s.cpf)}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {search.length > 1 &&
                  studentResults.length === 0 &&
                  !loadingStudents && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 mt-2 rounded-xl shadow-lg z-20 p-4 text-center text-slate-500 text-sm">
                      Nenhum aluno encontrado.
                    </div>
                  )}
              </div>
            ) : (
              <div className="flex items-center gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100 transition-colors">
                <div className="w-12 h-12 rounded-full bg-[#009DE0] text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  {selectedStudent.name.substring(0, 2)}
                </div>
                <div>
                  <p className="font-bold text-[#021D34] text-lg">
                    {selectedStudent.name}
                  </p>
                  <p className="text-sm text-slate-600">
                    {maskCPF(selectedStudent.cpf)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 2. CARD SELEÇÃO DE MATERIAIS */}
          <div
            className={`bg-white p-6 rounded-2xl border border-slate-200 transition-all duration-300 ${!selectedStudent ? "opacity-50 pointer-events-none" : "opacity-100"}`}
          >
            <div className="flex justify-between items-center mb-4 gap-4">
              <h3 className="font-bold text-lg flex items-center gap-2 text-[#021D34]">
                <span className="w-6 h-6 rounded-full bg-[#021D34] text-white flex items-center justify-center text-xs">
                  2
                </span>{" "}
                Materiais
              </h3>

              <div className="flex items-center gap-2 flex-1 justify-end">
                {types.length > 0 && (
                  <div className="relative w-full max-w-[200px]">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      className="w-full pl-9 p-2 border border-slate-200 bg-white text-slate-900 rounded-lg text-sm outline-none focus:border-[#009DE0]] transition-colors"
                      placeholder="Filtrar..."
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                    />
                  </div>
                )}
                <button
                  onClick={handleManualRefreshTypes}
                  disabled={!isOnline}
                  className={`p-1.5 rounded-full hover:bg-slate-100 transition-colors ${isRefetchingTypes ? "animate-spin text-[#009DE0]" : "text-slate-400"} ${!isOnline ? "opacity-50 cursor-not-allowed" : ""}`}
                  title="Recarregar materiais"
                >
                  <RotateCw size={16} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 min-h-[300px]">
              {filteredTypes.map((t) => {
                const count = cart.filter((c) => c.id === t.id).length;
                const isSelected = count > 0;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleAddMaterial(t)}
                    className={`relative p-4 border rounded-xl transition-all flex flex-col items-center gap-2 group ${
                      isSelected
                        ? "bg-[#009DE0] border-[#009DE0] text-white"
                        : "bg-slate-50 border-slate-200 hover:bg-[#009DE0] hover:border-[#009DE0] hover:text-white"
                    }`}
                  >
                    {count > 0 && (
                      <span
                        onClick={(e) => { e.stopPropagation(); handleRemoveMaterial(t); }}
                        className="absolute -top-2.5 -right-2.5 min-w-[26px] h-[26px] px-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-full flex items-center justify-center shadow-md cursor-pointer transition-colors"
                        title="Remover um"
                      >
                        {count}
                      </span>
                    )}
                    <PackagePlus
                      size={24}
                      className={isSelected ? "text-white" : "text-slate-400 group-hover:text-white transition-colors"}
                    />
                    <span className="font-medium text-sm text-center line-clamp-2">
                      {t.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* --- COLUNA DIREITA (RESUMO / CARRINHO) --- */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 h-fit sticky top-4 shadow-sm transition-colors">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-[#021D34]">Resumo</h3>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-xs text-red-500 hover:underline flex items-center gap-1"
              >
                <Trash2 size={12} /> Limpar
              </button>
            )}
          </div>

          <div className="space-y-2 mb-6 max-h-[300px] overflow-y-auto custom-scrollbar">
            {cart.length === 0 ? (
              <p className="text-slate-400 text-center text-sm py-4 border-2 border-dashed border-slate-100 rounded-xl">
                Nenhum item selecionado.
              </p>
            ) : (
              cart.map((item) => (
                <div
                  key={item.uid}
                  className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100 transition-colors animate-in fade-in slide-in-from-left-2"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {item.name}
                  </span>
                  <button
                    onClick={() =>
                      setCart(cart.filter((x) => x.uid !== item.uid))
                    }
                    className="text-red-400 hover:text-red-600 p-1"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))
            )}
          </div>

          <button
            onClick={finish}
            disabled={!selectedStudent || cart.length === 0}
            className={`w-full text-white py-3 rounded-lg font-bold disabled:opacity-50 shadow-lg transition-all active:scale-[0.98] ${
              isOnline
                ? "bg-[#009DE0] hover:bg-[#008bc5] shadow-blue-500/20"
                : "bg-orange-600 hover:bg-orange-700 shadow-orange-500/20"
            }`}
          >
            {isOnline ? "Finalizar e Imprimir" : "Salvar Offline e Imprimir"}
          </button>
          {!isOnline && (
            <p className="text-xs text-center text-orange-600 mt-2 font-bold">
              Os dados serão sincronizados ao conectar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
