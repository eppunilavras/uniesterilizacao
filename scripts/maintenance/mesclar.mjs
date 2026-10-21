// Mescla o cadastro duplicado <de> no cadastro definitivo <para>.
// Sem --aplicar, apenas simula e mostra o que seria feito.
// Uso: node mesclar.mjs <chave.json> <uidAntigo> <uidNovo> [--aplicar]
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const [keyPath, from, to, flag] = process.argv.slice(2);
const apply = flag === "--aplicar";
if (!keyPath || !from || !to || from === to) {
  console.error("Uso: node mesclar.mjs <chave.json> <uidAntigo> <uidNovo> [--aplicar]");
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
const db = admin.firestore();
const { FieldValue } = admin.firestore;
const base = db.collection("artifacts").doc("unilavras-main");
const pub = base.collection("public").doc("data");

const dirFrom = await pub.collection("users_directory").doc(from).get();
const dirTo = await pub.collection("users_directory").doc(to).get();
if (!dirFrom.exists || !dirTo.exists) {
  console.error("Um dos uids não existe em users_directory. Nada foi feito.");
  process.exit(1);
}
const a = dirFrom.data(), b = dirTo.data();
if (a.mergedInto) {
  console.error(`O cadastro ${from} já foi mesclado em ${a.mergedInto}. Nada foi feito.`);
  process.exit(1);
}

const items = await pub.collection("items").where("studentId", "==", from).get();
console.log(`\nDE   (desativar): ${a.name} | CPF ${a.cpf} | ${from}`);
console.log(`PARA (definitivo): ${b.name} | CPF ${b.cpf} | ${to}`);
console.log(`Itens a transferir: ${items.size}`);
for (const d of items.docs) {
  const i = d.data();
  console.log(`  ${i.code} | ${i.type} | ${i.status} | ${i.createdAt?.toDate?.().toLocaleDateString("pt-BR") ?? "-"}`);
}

if (!apply) {
  console.log("\nSIMULAÇÃO: nada foi gravado. Rode com --aplicar para executar.");
  process.exit(0);
}

// 1. Itens: troca o dono e deixa rastro de onde vieram (lotes de 400).
for (let i = 0; i < items.docs.length; i += 400) {
  const batch = db.batch();
  for (const d of items.docs.slice(i, i + 400)) {
    batch.update(d.ref, { studentId: to, mergedFrom: from, mergedAt: FieldValue.serverTimestamp() });
  }
  await batch.commit();
}

// 2. Cadastro antigo: inativo e apontando para o definitivo (nada é apagado).
const mark = { active: false, mergedInto: to, mergedAt: FieldValue.serverTimestamp() };
const batch = db.batch();
batch.update(pub.collection("users_directory").doc(from), mark);
const profileRef = base.collection("users").doc(from).collection("profile").doc("data");
if ((await profileRef.get()).exists) batch.update(profileRef, mark);

// 3. Log de auditoria no mesmo formato do logEvent do app.
batch.set(pub.collection("system_logs").doc(), {
  type: "USER_MGMT",
  message: `Mesclagem de cadastros: ${a.name} -> ${b.name}`,
  details: {
    fromUid: from, fromName: a.name, fromCpf: a.cpf,
    toUid: to, toName: b.name, toCpf: b.cpf,
    itemIds: items.docs.map((d) => d.id),
    itemCount: items.size,
    reason: "Cadastro duplicado por CPF digitado errado antes da importação da planilha",
  },
  userId: "SYSTEM",
  userName: "Script de mesclagem (manutenção)",
  timestamp: FieldValue.serverTimestamp(),
  createdAt: new Date().toISOString(),
});
await batch.commit();

const left = await pub.collection("items").where("studentId", "==", from).get();
const now = await pub.collection("items").where("studentId", "==", to).get();
console.log(`\nAPLICADO. Itens restantes no antigo: ${left.size} | itens no definitivo: ${now.size}`);
process.exit(0);
