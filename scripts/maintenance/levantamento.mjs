// SOMENTE LEITURA. Procura cadastros pelos nomes e mostra os itens de cada um.
// Uso: node levantamento.mjs <chave-servico.json> "Nome 1" "Nome 2" ...
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const [keyPath, ...names] = process.argv.slice(2);
if (!keyPath || names.length === 0) {
  console.error('Uso: node levantamento.mjs <chave.json> "Nome" ...');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
const db = admin.firestore();
const base = db.collection("artifacts").doc("unilavras-main");
const pub = base.collection("public").doc("data");

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const fmt = (t) => (t?.toDate ? t.toDate().toLocaleString("pt-BR") : t ? String(t) : "-");
const validCpf = (c) => {
  if (!/^\d{11}$/.test(c || "") || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (n) => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(c[i]) * (n + 1 - i);
    return ((sum * 10) % 11) % 10;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
};
const maskCpf = (c) => (c && c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : c || "-");

const dir = await pub.collection("users_directory").get();

for (const name of names) {
  // Casa pelo primeiro e último nome para pegar variações de grafia.
  const parts = norm(name).split(" ");
  const first = parts[0], last = parts[parts.length - 1];
  const matches = dir.docs.filter((d) => {
    const n = norm(d.data().name);
    return n.startsWith(first) && n.includes(last);
  });

  console.log(`\n=== ${name} — ${matches.length} cadastro(s) ===`);
  for (const d of matches) {
    const u = d.data();
    const items = await pub.collection("items").where("studentId", "==", d.id).get();
    const list = items.docs.map((i) => i.data());
    const dates = list.map((i) => i.createdAt?.toMillis?.()).filter(Boolean).sort((a, b) => a - b);
    const pending = list.filter((i) => i.status !== "retirado");
    const profile = await base.collection("users").doc(d.id).collection("profile").doc("data").get();

    console.log(`
  uid        : ${d.id}
  nome       : ${u.name}
  cpf        : ${maskCpf(u.cpf)} (${validCpf(u.cpf) ? "válido" : "INVÁLIDO"})
  email      : ${u.email || "-"}
  ativo      : ${u.active !== false ? "sim" : "não"}
  criado em  : ${fmt(u.createdAt)}
  perfil priv: ${profile.exists ? "existe" : "NÃO existe"}
  itens      : ${list.length} (${pending.length} fora de "retirado")
  período    : ${dates.length ? `${new Date(dates[0]).toLocaleDateString("pt-BR")} a ${new Date(dates[dates.length - 1]).toLocaleDateString("pt-BR")}` : "-"}`);
    for (const p of pending) console.log(`    pendente: ${p.code} | ${p.type} | ${p.status}`);
  }
}
process.exit(0);
