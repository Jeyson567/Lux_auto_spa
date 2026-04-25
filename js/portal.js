import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

const form = document.getElementById("portalForm");
const msg = document.getElementById("portalMessage");

async function list(name){
  const snap = await getDocs(collection(db, name));
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}

async function loadConfig(){
  try{
    const snap = await getDoc(doc(db, "configuracion", "general"));
    if(snap.exists()){
      const cfg = snap.data();
      portalBusinessName.textContent = cfg.negocio || "AUTO LAVADO MONTANA";
      document.title = `${cfg.negocio || "AUTO LAVADO MONTANA"} | Portal Cliente`;
    }
  }catch(error){
    console.warn(error);
  }
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "Consultando...";
  const clients = await list("clientes");
  const client = clients.find(c => String(c.telefono || "").trim() === String(portalPhone.value || "").trim());
  if(!client){
    msg.textContent = "No encontré un cliente con ese teléfono.";
    return;
  }
  const rewards = (await list("recompensas")).filter(r => Number(r.puntosRequeridos || 0) <= Number(client.puntosActuales || 0));
  const history = (await list("servicios")).filter(s => String(s.clienteId || "") === String(client.id));

  pcName.textContent = client.nombre || "Cliente";
  pcPhone.textContent = client.telefono || "";
  pcPoints.textContent = client.puntosActuales || 0;
  pcVisits.textContent = client.visitas || 0;
  pcSub.textContent = client.suscripcionNombre || "Sin plan";
  pcVehicles.innerHTML = (client.vehiculos || []).length
    ? (client.vehiculos || []).map(v => `<div class="list-card"><strong>${v.placa || "Sin placa"}</strong><p>${v.marca || ""} ${v.modelo || ""}</p></div>`).join("")
    : `<p class="muted">Sin vehículos.</p>`;
  pcRewards.innerHTML = rewards.length
    ? rewards.map(r => `<div class="list-card"><strong>${r.nombre}</strong><p>${r.puntosRequeridos} pts</p></div>`).join("")
    : `<p class="muted">No tienes recompensas disponibles.</p>`;
  pcHistory.innerHTML = history.length
    ? history.map(h => `<div class="list-card"><strong>${h.servicio}</strong><p>${h.vehiculo || ""}</p></div>`).join("")
    : `<p class="muted">Sin historial.</p>`;
  portalResult.classList.remove("hidden");
  msg.textContent = "";
});

loadConfig();
