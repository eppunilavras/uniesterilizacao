import React, { useState, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Search, RefreshCw, ChevronRight } from "lucide-react";

import DataTable from "../components/DataTable";
import StudentModal from "../components/StudentModal";
import { useStudentsDirectory } from "../hooks/useStudentsDirectory";
import { refreshDirectory } from "../hooks/useUsersDirectory";
import { maskCPF } from "../utils/formatters";

const normalize = (v) =>
  (v || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Página de atendimento ao aluno. A lista vem do diretório em cache (nenhuma
// leitura extra); os materiais só são consultados ao abrir um aluno.
export default function Students({ userProfile }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [selected, setSelected] = useState(null);

  const {
    data: students = [],
    isLoading,
    isFetching,
  } = useStudentsDirectory({ includeInactive: true });

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    const digits = search.replace(/\D/g, "");
    const isNumeric = term.length >= 2 && /^[\d.\-\s]+$/.test(search.trim());
    return students.filter((s) => {
      if (statusFilter === "active" && s.active === false) return false;
      if (statusFilter === "inactive" && s.active !== false) return false;
      if (term.length < 2) return true;
      if (isNumeric) return (s.cpf || "").replace(/\D/g, "").includes(digits);
      return normalize(s.name).includes(term);
    });
  }, [students, search, statusFilter]);

  const closeModal = useCallback(() => setSelected(null), []);

  return (
    <div className="space-y-6 transition-colors">
      <h2 className="font-bold text-[#021D34] text-2xl flex items-center gap-2 transition-colors">
        <GraduationCap className="text-[#009DE0]" /> Alunos
      </h2>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-colors">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              className="w-full pl-10 p-2 border rounded-lg outline-none focus:border-[#009DE0] bg-white text-slate-900 transition-colors"
              placeholder="Buscar por nome ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <select
              className="p-2 border rounded-lg bg-white text-slate-900 w-full md:w-auto transition-colors"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
              <option value="all">Todos</option>
            </select>
            <button
              onClick={() => refreshDirectory(queryClient)}
              disabled={isFetching}
              className="p-2 border rounded-lg bg-white text-slate-500 border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
              title="Recarregar lista do servidor"
            >
              <RefreshCw size={20} className={isFetching ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        <DataTable
          loading={isLoading}
          data={filtered}
          emptyMsg="Nenhum aluno encontrado."
          columns={[
            {
              key: "name",
              label: "Nome",
              sortable: true,
              render: (s) => (
                <button
                  onClick={() => setSelected(s)}
                  className="font-medium text-[#021D34] hover:text-[#009DE0] text-left truncate max-w-full"
                >
                  {s.name}
                </button>
              ),
            },
            { key: "cpf", label: "CPF", render: (s) => maskCPF(s.cpf) },
            {
              key: "active",
              label: "Status",
              render: (s) => (
                <span
                  className={`text-xs font-bold px-2 py-1 rounded ${s.active !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                >
                  {s.active !== false ? "Ativo" : "Inativo"}
                </span>
              ),
            },
          ]}
          mobileRender={(s) => (
            <button
              onClick={() => setSelected(s)}
              className="w-full flex justify-between items-center text-left"
            >
              <div>
                <h4 className="font-bold text-[#021D34]">{s.name}</h4>
                <p className="text-xs text-slate-500">{maskCPF(s.cpf)}</p>
              </div>
              <ChevronRight size={18} className="text-slate-400" />
            </button>
          )}
          actions={(s) => (
            <button
              onClick={() => setSelected(s)}
              className="px-3 py-1.5 text-xs font-bold text-[#009DE0] bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors"
            >
              Abrir
            </button>
          )}
        />
      </div>

      {selected && (
        <StudentModal
          student={selected}
          userProfile={userProfile}
          onClose={closeModal}
          onStudentUpdated={(changes) =>
            setSelected((prev) => (prev ? { ...prev, ...changes } : prev))
          }
        />
      )}
    </div>
  );
}
