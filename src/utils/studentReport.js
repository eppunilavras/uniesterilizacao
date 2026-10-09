import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db, appId } from "../config/firebase";
import { LOGOS } from "../constants";
import { maskCPF } from "./formatters";

// Dispara a impressão sem depender do window.onload. A aba criada por
// window.open("") pode já ter disparado o load antes de o document.write
// terminar; nesse caso o handler registrado no HTML nunca é chamado e o
// relatório abre sem o diálogo de impressão. O timeout é a rede de segurança
// para qualquer recurso que segure o load, como a imagem do logo.
export const SCRIPT_IMPRESSAO = `<script>(function(){var feito=false;function imprimir(){if(feito)return;feito=true;window.focus();window.print();}if(document.readyState==="complete"){imprimir();}else{window.addEventListener("load",imprimir);}setTimeout(imprimir,3000);})();</` + `script>`;

// Relatório de Movimentação de Materiais do aluno. Extraído literalmente de
// HistoryView para ser usado também pelo modal da página Alunos: o conteúdo
// do documento tem valor probatório, então qualquer mudança aqui vale para os
// dois pontos de emissão. Erros sobem para quem chama.
export async function generateStudentReport({
  reportStudent,
  reportStart,
  reportEnd,
  reportMaterials,
  reportOrder,
  userProfile,
  addToast,
}) {
  const [sY, sM, sD] = reportStart.split("-").map(Number);
  const start = new Date(sY, sM - 1, sD, 0, 0, 0, 0);

  const [eY, eM, eD] = reportEnd.split("-").map(Number);
  const end = new Date(eY, eM - 1, eD, 23, 59, 59, 999);

  const q = query(
    collection(db, "artifacts", appId, "public", "data", "items"),
    where("studentId", "==", reportStudent.uid),
    where("createdAt", ">=", start),
    where("createdAt", "<=", end),
    orderBy("createdAt", "desc"),
  );

  const snap = await getDocs(q);
  const todosItens = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // Filtro opcional por tipo de material. Quando aplicado, o documento
  // declara a restrição para não ser lido como histórico completo.
  const items = reportMaterials.length
    ? todosItens.filter((i) => reportMaterials.includes(i.type))
    : todosItens;

  // =============================================================
  // LINHAS DO RELATÓRIO
  // Uma linha por material. Cada coluna de data vem de um evento
  // distinto do history[] do item. Evento que não ocorreu imprime
  // travessão; data obtida do documento em vez do evento recebe (*).
  // Nenhuma data é estimada ou interpolada.
  // =============================================================
  const SITUACAO = {
    recebido: "Recebido",
    em_esterilizacao: "Em Esterilização",
    pronto: "Pronto p/ Retirada",
    retirado: "Entregue",
    problema: "Com Ocorrência",
  };

  const paraData = (val) => {
    if (!val) return null;
    const d = val.toDate ? val.toDate() : new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };
  const dataHora = (d) =>
    d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const primeiroEvento = (i, status) =>
    (i.history || []).find((h) => h && h.status === status && h.timestamp) ||
    null;
  const ultimoEvento = (i, status) => {
    const todos = (i.history || []).filter(
      (h) => h && h.status === status && h.timestamp,
    );
    return todos.length ? todos[todos.length - 1] : null;
  };

  // Evento repetido: "pronto" usa a primeira ocorrência (quando ficou
  // pronto), "retirado" usa a última (quando saiu definitivamente).
  const marco = (i, status, usarUltimo = false) => {
    const ev = usarUltimo
      ? ultimoEvento(i, status)
      : primeiroEvento(i, status);
    if (ev) return { valor: ev.timestamp, derivado: false };
    // Sem histórico algum: lastUpdated é a última alteração, ou seja,
    // quando o item chegou à situação em que está hoje.
    if ((i.history || []).length === 0 && i.status === status)
      return { valor: i.lastUpdated, derivado: true };
    return null;
  };

  let usouDerivado = false;
  const celulaData = (info) => {
    const d = info && paraData(info.valor);
    if (!d) return '<span class="ausente">—</span>';
    if (info.derivado) usouDerivado = true;
    return dataHora(d) + (info.derivado ? '<sup class="nota">*</sup>' : "");
  };

  const crescente = reportOrder === "asc";
  const linhas = items
    .map((i) => {
      const recebido = primeiroEvento(i, "recebido")
        ? { valor: primeiroEvento(i, "recebido").timestamp, derivado: false }
        : { valor: i.createdAt, derivado: true };
      return {
        item: i,
        recebido,
        pronto: marco(i, "pronto"),
        // Item estornado e de volta ao setor não conta como entregue.
        entregue: i.status === "retirado" ? marco(i, "retirado", true) : null,
        ordenacao: paraData(recebido.valor),
      };
    })
    .sort((a, b) => {
      const ta = a.ordenacao ? a.ordenacao.getTime() : 0;
      const tb = b.ordenacao ? b.ordenacao.getTime() : 0;
      return crescente ? ta - tb : tb - ta;
    });

  // Escapa conteúdo vindo do banco para não corromper o documento.
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );

  const contar = (st) => items.filter((i) => i.status === st).length;
  const resumo = [
    ["Materiais no período", items.length],
    ["Recebido", contar("recebido")],
    ["Em Esterilização", contar("em_esterilizacao")],
    ["Pronto p/ Retirada", contar("pronto")],
    ["Entregue", contar("retirado")],
    ["Com Ocorrência", contar("problema")],
  ].filter(([rotulo, valor]) => valor > 0 || rotulo === "Materiais no período");

  const emitidoEm = new Date();
  // Rotula "horário de Brasília" apenas quando o fuso resolvido for de
  // fato o de Brasília; caso contrário mostra o fuso real da máquina.
  const fusoResolvido = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const fusoHorario =
    fusoResolvido === "America/Sao_Paulo"
      ? "horário de Brasília"
      : fusoResolvido || "fuso local";
  const materiaisRotulo = reportMaterials.length
    ? reportMaterials.map((m) => `"${esc(m)}"`).join(", ")
    : "Todos os materiais";
  const rotuloOrdem = crescente
    ? "Mais antigos primeiro (por data de recebimento)"
    : "Mais recentes primeiro (por data de recebimento)";

  const corpo = linhas
    .map(
      (l) => `<tr>
              <td class="material">${esc(l.item.type)}</td>
              <td class="codigo">${esc(l.item.code)}</td>
              <td class="data">${celulaData(l.recebido)}</td>
              <td class="data">${celulaData(l.pronto)}</td>
              <td class="data">${celulaData(l.entregue)}</td>
              <td class="situacao">${esc(SITUACAO[l.item.status] || l.item.status)}</td>
            </tr>`,
    )
    .join("");

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    addToast("Pop-up bloqueado.", "error");
    return;
  }

  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Relatório de Movimentação de Materiais - ${esc(reportStudent.name)}</title>
<style>
  @page { size: A4; margin: 15mm 12mm 16mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10.5pt; line-height: 1.45; color: #1a1a1a; margin: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .cabecalho {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 2.5pt solid #021D34; padding-bottom: 10pt; margin-bottom: 16pt;
  }
  .cabecalho .titulo { font-size: 15pt; font-weight: bold; color: #021D34; letter-spacing: .3pt; }
  .cabecalho .sub { font-size: 9pt; color: #444; margin-top: 3pt; }
  .cabecalho img { height: 42px; }
  h2 {
    font-size: 10pt; text-transform: uppercase; letter-spacing: .6pt;
    color: #021D34; margin: 16pt 0 6pt; padding-bottom: 3pt;
    border-bottom: .75pt solid #b8c2cc;
  }
  table { width: 100%; border-collapse: collapse; }
  .identificacao td { padding: 3pt 8pt 3pt 0; vertical-align: top; font-size: 10pt; }
  .identificacao td.rotulo {
    width: 130pt; color: #555; font-size: 8.5pt; text-transform: uppercase;
    letter-spacing: .4pt; padding-top: 5pt; white-space: nowrap;
  }
  .resumo { border: .75pt solid #b8c2cc; }
  .resumo td { border: .75pt solid #b8c2cc; padding: 6pt 8pt; text-align: center; }
  .resumo .r-rotulo { font-size: 8pt; text-transform: uppercase; color: #555; letter-spacing: .3pt; }
  .resumo .r-valor { font-size: 13pt; font-weight: bold; color: #021D34; }
  .registros {
    /* Largura pelo conteúdo, centralizada. Com width:100% a sobra de
       espaço ia toda para a coluna Material, criando um vão até o código. */
    width: auto; max-width: 100%; margin: 4pt auto 0;
    border: 1pt solid #021D34; /* moldura externa contínua */
  }
  .registros thead { display: table-header-group; }
  .registros th {
    background: #021D34; color: #fff; font-size: 7pt; text-transform: uppercase;
    letter-spacing: .2pt; padding: 5pt 6pt; text-align: left; vertical-align: bottom;
    border: none; border-right: .5pt solid #33506b; white-space: normal; line-height: 1.2;
  }
  .registros th:last-child { border-right: none; }
  .registros td {
    /* 8.5pt e padding enxuto: com as tres datas em linha unica, e o que
       faz as seis colunas caberem na largura util do A4 retrato. */
    padding: 4pt 6pt; border: .5pt solid #ccd4dc; font-size: 8.5pt; vertical-align: top;
    overflow-wrap: anywhere;
  }
  /* Colunas de data nao quebram; ao faltar espaco, o navegador estreita
     estas duas, que quebram em duas linhas. */
  .registros td.material { max-width: 45mm; }
  .registros td.situacao { max-width: 26mm; }
  .registros td:first-child { border-left: none; }
  .registros td:last-child { border-right: none; }
  .registros tbody tr:last-child td { border-bottom: none; }
  .registros tr { page-break-inside: avoid; }
  .registros tbody tr:nth-child(even) { background: #f4f6f8; }
  td.data { white-space: nowrap; font-variant-numeric: tabular-nums; text-align: center; }
  td.codigo { font-family: "Courier New", monospace; font-weight: bold; letter-spacing: .5pt; }
  .ausente { color: #8c99a6; }
  .nota { color: #021D34; font-weight: bold; }
  .vazio {
    border: .75pt dashed #b8c2cc; padding: 24pt; text-align: center;
    color: #555; font-size: 10pt; margin-top: 4pt;
  }
  .observacoes { margin-top: 14pt; font-size: 8.5pt; color: #444; }
  .observacoes li { margin-bottom: 3pt; }
  .rodape {
    margin-top: 18pt; padding-top: 8pt; border-top: .75pt solid #b8c2cc;
    font-size: 8pt; color: #555; text-align: justify;
  }
</style></head><body>

<div class="cabecalho">
  <div>
    <div class="titulo">Relatório de Movimentação de Materiais</div>
    <div class="sub">Central de Esterilização — Clínica Odontológica Unilavras</div>
    <div class="sub">Período apurado: ${start.toLocaleDateString("pt-BR")} a ${end.toLocaleDateString("pt-BR")}</div>
  </div>
  <img src="${LOGOS.color}" alt="Unilavras"/>
</div>

<h2>Identificação</h2>
<table class="identificacao">
  <tr><td class="rotulo">Aluno</td><td>${esc(reportStudent.name)}</td></tr>
  <tr><td class="rotulo">CPF</td><td>${esc(maskCPF(reportStudent.cpf))}</td></tr>
  <tr><td class="rotulo">E-mail</td><td>${esc(reportStudent.email) || "—"}</td></tr>
  <tr><td class="rotulo">${reportMaterials.length > 1 ? "Materiais" : "Material"}</td><td>${materiaisRotulo}</td></tr>
  <tr><td class="rotulo">Ordenação</td><td>${rotuloOrdem}</td></tr>
  <tr><td class="rotulo">Emitido em</td><td>${dataHora(emitidoEm)} (${esc(fusoHorario)})</td></tr>
  <tr><td class="rotulo">Emitido por</td><td>${esc(userProfile.name)}</td></tr>
</table>

<h2>Resumo</h2>
<table class="resumo">
  <tr>${resumo.map(([rotulo]) => `<td class="r-rotulo">${rotulo}</td>`).join("")}</tr>
  <tr>${resumo.map(([, valor]) => `<td class="r-valor">${valor}</td>`).join("")}</tr>
</table>

<h2>Registros</h2>
${
  linhas.length > 0
    ? `<table class="registros">
  <thead>
    <tr>
      <th>Material</th>
      <th>Código</th>
      <th>Recebido</th>
      <th>Pronto p/ Retirada</th>
      <th>Entregue</th>
      <th>Situação atual</th>
    </tr>
  </thead>
  <tbody>${corpo}</tbody>
</table>`
    : `<div class="vazio">Nenhum registro localizado para o aluno no período apurado${reportMaterials.length ? ` para ${reportMaterials.length > 1 ? "os materiais" : "o material"} ${materiaisRotulo}` : ""}.</div>`
}

<div class="observacoes">
  <strong>Observações</strong>
  <ul>
    <li>Cada linha corresponde a um material, identificado pelo seu código, com as datas em que atingiu cada etapa.</li>
    <li>"Entregue" corresponde à retirada do material pelo aluno.</li>
    <li>O travessão (—) indica etapa não registrada no sistema até a emissão deste relatório. Nenhuma data foi estimada.</li>
    ${usouDerivado ? `<li>(*) Data obtida do registro do material, e não de um evento no histórico. Ocorre em materiais anteriores à adoção do histórico de eventos.</li>` : ""}
    <li>As situações "Em Esterilização" e "Com Ocorrência" não possuem coluna de data própria; constam apenas na coluna de situação atual, quando for o caso.</li>
    ${reportMaterials.length ? `<li>Este relatório está restrito ${reportMaterials.length > 1 ? "aos materiais" : "ao material"} ${materiaisRotulo}. Demais materiais do aluno no período não constam.</li>` : ""}
    <li>A seleção considera os materiais recebidos dentro do período apurado; etapas concluídas após o fim do período, referentes a esses mesmos materiais, também constam.</li>
  </ul>
</div>

<div class="rodape">
  Documento gerado eletronicamente pelo sistema UniEsterilização em ${dataHora(emitidoEm)}, a partir dos registros
  existentes na base de dados nesta data. Reproduz integralmente os lançamentos do período apurado, sem edição manual.
  Este documento não possui assinatura digital; sua conferência deve ser feita junto à Central de Esterilização.
</div>

${SCRIPT_IMPRESSAO}
</body></html>`;
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
