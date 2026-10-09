import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import {
  X,
  Loader2,
  RefreshCw,
  Search,
  FileText,
  XCircle,
  PackageOpen,
  History,
  ShieldAlert,
  ChevronDown,
  CheckCircle2,
  Printer,
  UserCog,
  User,
  MessageSquare,
} from "lucide-react";

import { db, appId } from "../config/firebase";
import { useToast } from "../contexts/ToastContext";
import { useMaterialTypes } from "../hooks/useMaterialTypes";
import {
  useStudentActiveItems,
  useStudentHistory,
  useStudentRetiredCount,
  findItemByCode,
} from "../hooks/useStudentItems";
import { generateStudentReport, printTraceReport } from "../utils/studentReport";
import { canMoveTo, commitStatusChange } from "../utils/itemStatus";
import { updateUserRecord } from "../utils/userRecords";
import { formatDate, maskCPF } from "../utils/formatters";
import { STATUS_CONFIG } from "../constants";

const TABS = [
  { id: "active", label: "No setor", icon: PackageOpen },
  { id: "history", label: "Histórico", icon: History },
  { id: "report", label: "Relatório PDF", icon: FileText },
  { id: "profile", label: "Cadastro", icon: UserCog },
];

// Pelo modal o material só avança até "Pronto p/ Retirada". A retirada
// continua exclusiva da sessão de retirada (Movimentação).
const CAN_MARK_READY = ["recebido", "em_esterilizacao"];

const inputClass =
  "w-full p-2.5 border rounded-lg bg-white text-slate-900 text-sm outline-none focus:border-[#009DE0] transition-colors";
const labelClass = "text-xs font-bold text-slate-500 mb-1 block uppercase";

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`px-2 py-0.5 rounded border text-[10px] uppercase font-bold whitespace-nowrap ${cfg?.color || "bg-slate-100 text-slate-700 border-slate-200"}`}
    >
      {cfg?.label || status}
    </span>
  );
}

// Linha do tempo do material, no mesmo formato da Rastreabilidade do Histórico.
function Timeline({ item }) {
  const events = item.history ? [...item.history].reverse() : [];
  if (events.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Material sem eventos registrados no histórico.
      </p>
    );
  }
  return (
    <ol className="border-l-2 border-slate-200 ml-2 space-y-3">
      {events.map((event, index) => {
        const cfg = STATUS_CONFIG[event.status] || STATUS_CONFIG["recebido"];
        return (
          <li key={index} className="relative pl-5">
            <span
              className={`absolute -left-[7px] top-1.5 w-3 h-3 rounded-full border-2 border-white ${index === 0 ? "bg-[#009DE0]" : "bg-slate-300"}`}
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-bold text-sm text-[#021D34]">
                {cfg.label}
              </span>
              <span className="text-xs text-slate-400">
                {formatDate(event.timestamp)}
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <User size={10} /> {event.by || "Sistema"}
              </span>
            </div>
            {event.reason && (
              <p className="mt-1 text-xs text-slate-600 italic flex items-start gap-1">
                <MessageSquare size={12} className="shrink-0 mt-0.5" />
                {event.reason}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// Card de material: clique expande a linha do tempo e as ações.
function ItemCard({ item, userProfile, onChanged }) {
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const markReady = async () => {
    setSaving(true);
    try {
      // Relê o documento antes de gravar: a lista pode ter até 1 min e o
      // history[] é regravado inteiro, então nunca partimos de dado velho.
      const snap = await getDoc(
        doc(db, "artifacts", appId, "public", "data", "items", item.id),
      );
      if (!snap.exists()) {
        addToast("Material não encontrado.", "error");
        return;
      }
      const fresh = { id: snap.id, ...snap.data() };
      if (!CAN_MARK_READY.includes(fresh.status)) {
        addToast(
          `O material já está como ${STATUS_CONFIG[fresh.status]?.label || fresh.status}.`,
          "warning",
        );
        onChanged();
        return;
      }
      const validation = canMoveTo(fresh.status, "pronto");
      if (!validation.allowed) {
        addToast(`Erro: ${validation.error}`, "error");
        return;
      }
      await commitStatusChange({ item: fresh, newStatus: "pronto", userProfile });
      addToast(`${fresh.code} pronto para retirada.`, "success");
      onChanged();
    } catch (error) {
      console.error(error);
      addToast("Erro ao atualizar o status.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 py-3 text-left hover:bg-slate-50 px-2 -mx-2 rounded-lg"
      >
        <div className="min-w-0">
          <p className="font-mono font-bold text-[#021D34] tracking-wide">
            {item.code}
          </p>
          <p className="text-sm text-slate-600 truncate">{item.type}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col items-end gap-1">
            <StatusBadge status={item.status} />
            <span className="text-xs text-slate-400">
              {formatDate(item.lastUpdated || item.createdAt)}
            </span>
          </div>
          <ChevronDown
            size={16}
            className={`text-slate-400 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="pb-4 px-2 space-y-4">
          <div className="flex flex-wrap gap-2">
            {CAN_MARK_READY.includes(item.status) && (
              <button
                onClick={markReady}
                disabled={saving}
                className="px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                Marcar como Pronto p/ Retirada
              </button>
            )}
            <button
              onClick={() => printTraceReport(item, addToast)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 flex items-center gap-2"
            >
              <Printer size={14} /> Imprimir rastreabilidade
            </button>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase mb-2">
              Rastreabilidade · criado em {formatDate(item.createdAt)}
            </p>
            <Timeline item={item} />
          </div>
        </div>
      )}
    </div>
  );
}

function Empty({ children }) {
  return (
    <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl text-sm">
      {children}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex justify-center p-8 text-[#009DE0]">
      <Loader2 className="animate-spin" />
    </div>
  );
}

// --- ABA: NO SETOR ---
function ActiveTab({ active, userProfile, onChanged }) {
  const { data = [], isLoading, isError, isFetching, refetch } = active;
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <p className="text-sm text-slate-500">
          Materiais deste aluno que ainda estão no setor. Clique para ver a
          rastreabilidade e as ações.
        </p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 text-slate-500 hover:text-[#009DE0] hover:bg-slate-50 rounded-lg disabled:opacity-50"
          title="Atualizar"
        >
          <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <Empty>Erro ao carregar os materiais. Tente atualizar.</Empty>
      ) : data.length === 0 ? (
        <Empty>Nenhum material deste aluno no setor.</Empty>
      ) : (
        data.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            userProfile={userProfile}
            onChanged={onChanged}
          />
        ))
      )}
    </div>
  );
}

// --- ABA: HISTÓRICO ---
function HistoryTab({ student, userProfile, onChanged }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [code, setCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [codeResult, setCodeResult] = useState(null); // { kind, item? }

  const history = useStudentHistory(student.uid, { start, end });
  const items = history.data?.pages.flatMap((p) => p.items) ?? [];

  const searchCode = async (e) => {
    e.preventDefault();
    if (code.trim().length < 3) return;
    setSearching(true);
    try {
      const item = await findItemByCode(code);
      if (!item) setCodeResult({ kind: "not_found" });
      else if (item.studentId !== student.uid) setCodeResult({ kind: "other" });
      else setCodeResult({ kind: "found", item });
    } catch (err) {
      console.error(err);
      setCodeResult({ kind: "error" });
    } finally {
      setSearching(false);
    }
  };

  const handleChanged = () => {
    setCodeResult(null);
    onChanged();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={searchCode} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            className={`${inputClass} pl-9 uppercase`}
            placeholder="Buscar material pelo código..."
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setCodeResult(null);
            }}
          />
        </div>
        <button
          type="submit"
          disabled={searching || code.trim().length < 3}
          className="px-4 rounded-lg bg-[#021D34] text-white text-sm font-bold hover:bg-[#009DE0] disabled:opacity-50 transition-colors"
        >
          {searching ? <Loader2 size={16} className="animate-spin" /> : "Buscar"}
        </button>
      </form>

      {codeResult && (
        <div className="rounded-xl border p-3">
          {codeResult.kind === "found" && (
            <ItemCard
              item={codeResult.item}
              userProfile={userProfile}
              onChanged={handleChanged}
            />
          )}
          {codeResult.kind === "not_found" && (
            <p className="text-sm text-slate-500">Código não encontrado.</p>
          )}
          {codeResult.kind === "other" && (
            <p className="text-sm font-bold text-red-600 flex items-center gap-2">
              <ShieldAlert size={16} /> Este material pertence a outro aluno.
            </p>
          )}
          {codeResult.kind === "error" && (
            <p className="text-sm text-red-600">Erro ao buscar o código.</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>De</label>
          <input
            type="date"
            className={inputClass}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Até</label>
          <input
            type="date"
            className={inputClass}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
      </div>

      <div>
        {history.isLoading ? (
          <Loading />
        ) : history.isError ? (
          <Empty>Erro ao carregar o histórico.</Empty>
        ) : items.length === 0 ? (
          <Empty>
            {start || end
              ? "Nenhum material recebido no período."
              : "Nenhum material registrado para este aluno."}
          </Empty>
        ) : (
          <>
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                userProfile={userProfile}
                onChanged={onChanged}
              />
            ))}
            {history.hasNextPage && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => history.fetchNextPage()}
                  disabled={history.isFetchingNextPage}
                  className="bg-white border border-slate-300 text-slate-600 px-6 py-2 rounded-full text-sm font-bold hover:text-[#009DE0] hover:border-[#009DE0] transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {history.isFetchingNextPage && (
                    <Loader2 size={16} className="animate-spin" />
                  )}
                  Carregar mais
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// --- ABA: RELATÓRIO PDF ---
// Mesmos campos e mesma função do "Relatório do Aluno" do Histórico.
function ReportTab({ student, userProfile }) {
  const { addToast } = useToast();
  const { data: materialTypes = [] } = useMaterialTypes();
  const [reportMaterials, setReportMaterials] = useState([]);
  const [reportOrder, setReportOrder] = useState("desc");
  const [reportStart, setReportStart] = useState("");
  const [reportEnd, setReportEnd] = useState("");
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    if (!reportStart || !reportEnd) {
      addToast("Preencha o período.", "error");
      return;
    }
    setGenerating(true);
    try {
      await generateStudentReport({
        reportStudent: student,
        reportStart,
        reportEnd,
        reportMaterials,
        reportOrder,
        userProfile,
        addToast,
      });
    } catch (error) {
      console.error(error);
      addToast("Erro ao gerar relatório.", "error");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Materiais (opcional)</label>
          <select
            className={inputClass}
            value=""
            onChange={(e) => {
              const nome = e.target.value;
              if (nome && !reportMaterials.includes(nome))
                setReportMaterials([...reportMaterials, nome]);
            }}
          >
            <option value="">
              {reportMaterials.length
                ? "Adicionar outro material..."
                : "Todos os materiais"}
            </option>
            {materialTypes
              .filter((t) => !reportMaterials.includes(t.name))
              .map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
          </select>
          {reportMaterials.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {reportMaterials.map((nome) => (
                <span
                  key={nome}
                  className="inline-flex items-center gap-1 bg-blue-50 text-[#021D34] border border-blue-100 rounded-full pl-3 pr-2 py-1 text-xs font-bold"
                >
                  {nome}
                  <button
                    type="button"
                    aria-label={`Remover ${nome}`}
                    onClick={() =>
                      setReportMaterials(reportMaterials.filter((m) => m !== nome))
                    }
                    className="text-slate-400 hover:text-red-500"
                  >
                    <XCircle size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className={labelClass}>Ordenação</label>
          <select
            className={inputClass}
            value={reportOrder}
            onChange={(e) => setReportOrder(e.target.value)}
          >
            <option value="desc">Mais recentes primeiro</option>
            <option value="asc">Mais antigos primeiro</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Data inicial</label>
          <input
            type="date"
            className={inputClass}
            value={reportStart}
            onChange={(e) => setReportStart(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Data final</label>
          <input
            type="date"
            className={inputClass}
            value={reportEnd}
            onChange={(e) => setReportEnd(e.target.value)}
          />
        </div>
      </div>
      <button
        onClick={generate}
        disabled={!reportStart || !reportEnd || generating}
        className="w-full bg-[#021D34] text-white py-3 rounded-xl font-bold hover:bg-[#009DE0] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {generating ? <Loader2 className="animate-spin" /> : <FileText size={20} />}
        {generating ? "Gerando PDF..." : "Gerar Relatório"}
      </button>
    </div>
  );
}

// --- ABA: CADASTRO ---
// Mesma gravação e mesmas validações da edição em Usuários (updateUserRecord).
function ProfileTab({ student, userProfile, onSaved }) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: student.name || "",
    email: student.email || "",
    cpf: maskCPF(student.cpf),
    active: student.active !== false,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) =>
    setForm({
      ...form,
      [field]: field === "active" ? e.target.checked : e.target.value,
    });

  // Mesmas regras do userSchema de UserManagement.
  const validate = () => {
    const errs = {};
    if (form.name.trim().length < 3)
      errs.name = "Nome deve ter pelo menos 3 caracteres";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errs.email = "Email inválido";
    const digits = form.cpf.replace(/\D/g, "");
    if (digits !== "" && digits.length !== 11) errs.cpf = "CPF incompleto";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const save = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const data = {
        name: form.name,
        email: form.email,
        cpf: form.cpf,
        role: student.role,
        active: form.active,
      };
      const result = await updateUserRecord({
        editing: student,
        data,
        queryClient,
        userProfile,
      });
      if (!result.ok) {
        addToast(result.error, "error");
        return;
      }
      addToast("Dados atualizados!", "success");
      onSaved({ ...data, cpf: data.cpf.replace(/\D/g, "") });
    } catch (error) {
      console.error(error);
      addToast("Erro ao salvar os dados.", "error");
    } finally {
      setSaving(false);
    }
  };

  const field = (name, label, props = {}) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input className={inputClass} value={form[name]} onChange={set(name)} {...props} />
      {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name]}</p>}
    </div>
  );

  return (
    <form onSubmit={save} className="space-y-4 max-w-xl">
      {field("name", "Nome")}
      {field("email", "E-mail", { type: "email" })}
      <div>
        <label className={labelClass}>CPF</label>
        <input
          className={inputClass}
          value={form.cpf}
          onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })}
          maxLength={14}
        />
        {errors.cpf && <p className="text-xs text-red-500 mt-1">{errors.cpf}</p>}
      </div>
      <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
        <input type="checkbox" checked={form.active} onChange={set("active")} />
        Acesso ativo
      </label>
      {!form.active && student.active !== false && (
        <p className="text-xs text-slate-500">
          Ao inativar, o histórico é mantido e o login é bloqueado. Não é
          possível inativar com materiais no setor.
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="bg-[#021D34] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#009DE0] disabled:opacity-50 transition-all flex items-center gap-2"
      >
        {saving && <Loader2 size={16} className="animate-spin" />}
        Salvar alterações
      </button>
    </form>
  );
}

export default function StudentModal({ student, userProfile, onClose, onStudentUpdated }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("active");
  const active = useStudentActiveItems(student.uid);
  const retired = useStudentRetiredCount(student.uid);

  // Depois de mudar um status, recarrega só as consultas deste aluno.
  const refreshItems = () => {
    queryClient.invalidateQueries({ queryKey: ["student_active_items", student.uid] });
    queryClient.invalidateQueries({ queryKey: ["student_history", student.uid] });
  };

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Sem backdrop-blur: o desfoque em tela cheia era recalculado a cada
  // quadro de rolagem e deixava a lista de materiais lenta.
  return createPortal(
    <div
      className="fixed inset-y-0 right-0 left-0 md:left-72 z-[10005] flex items-center justify-center p-4 bg-[#021D34]/60"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="bg-[#021D34] p-5 text-white shrink-0">
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0">
              <h3 className="text-xl font-bold truncate">{student.name}</h3>
              <p className="text-sm text-white/70">
                {maskCPF(student.cpf)}
                {student.active === false && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-red-500/80 text-[10px] font-bold uppercase">
                    Inativo
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="hover:bg-white/20 p-2 rounded-full transition-colors"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex gap-6 mt-4 text-sm">
            <span>
              No setor agora:{" "}
              <strong className="text-lg">
                {active.isLoading ? "…" : (active.data?.length ?? "—")}
              </strong>
            </span>
            {!retired.isError && (
              <span>
                Retirados:{" "}
                <strong className="text-lg">
                  {retired.isLoading ? "…" : retired.data}
                </strong>
              </span>
            )}
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-1 px-4 pt-3 border-b border-slate-200 shrink-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-bold rounded-t-lg flex items-center gap-2 whitespace-nowrap transition-colors ${tab === t.id ? "bg-slate-100 text-[#009DE0]" : "text-slate-500 hover:text-slate-700"}`}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>

        {/* Conteúdo (as abas só consultam quando abertas) */}
        <div className="p-5 overflow-y-auto flex-1 overscroll-contain">
          {tab === "active" && (
            <ActiveTab
              active={active}
              userProfile={userProfile}
              onChanged={refreshItems}
            />
          )}
          {tab === "history" && (
            <HistoryTab
              student={student}
              userProfile={userProfile}
              onChanged={refreshItems}
            />
          )}
          {tab === "report" && (
            <ReportTab student={student} userProfile={userProfile} />
          )}
          {tab === "profile" && (
            <ProfileTab
              student={student}
              userProfile={userProfile}
              onSaved={onStudentUpdated}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
