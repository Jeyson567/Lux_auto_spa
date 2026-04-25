import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const COLL = {
  usuarios:"usuarios",
  clientes:"clientes",
  catalogo:"catalogo_servicios",
  servicios:"servicios",
  suscripciones:"suscripciones",
  pagos:"pagos",
  recompensas:"recompensas",
  objetivos:"objetivos",
  canjes:"canjes",
  auditoria:"auditoria",
  alertas:"alertas",
  configuracion:"configuracion"
};

const DEFAULT_CONFIG = {
  negocio: "AUTO LAVADO MONTANA",
  dominio: "autolavadomontana.store",
  whatsappNegocio: "",
  moneda: "GTQ",
  puntosBase: 0
};

const state = {
  user:null,
  profile:null,
  config:{...DEFAULT_CONFIG}
};

const $ = (id) => document.getElementById(id);
const qsa = (s) => [...document.querySelectorAll(s)];
const safe = (v) => String(v ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const lines = (t) => String(t || "").split("\n").map(x => x.trim()).filter(Boolean);
const normPhone = (p) => String(p || "").replace(/\D/g, "");
const daysRemaining = (d) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;

function subStatus(d){
  const x = daysRemaining(d);
  if(x === null) return { text:"Sin plan", cls:"yellow" };
  if(x <= 0) return { text:"Vencida", cls:"red" };
  if(x <= 5) return { text:`Por vencer (${x} días)`, cls:"yellow" };
  return { text:`Activa (${x} días)`, cls:"green" };
}

async function list(name){
  const snap = await getDocs(collection(db, name));
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}

async function create(name, data){
  return addDoc(collection(db, name), { ...data, createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
}

async function patch(name, id, data){
  return updateDoc(doc(db, name, id), { ...data, updatedAt:serverTimestamp() });
}

async function byId(name, id){
  const snap = await getDoc(doc(db, name, id));
  return snap.exists() ? { id:snap.id, ...snap.data() } : null;
}

async function singleton(id, data){
  return setDoc(doc(db, COLL.configuracion, id), { ...data, updatedAt:serverTimestamp() }, { merge:true });
}

async function audit(modulo, accion, detalle){
  return create(COLL.auditoria, { modulo, accion, detalle, usuario: state.profile?.correo || "" });
}

async function loadConfig(){
  try{
    const snap = await getDoc(doc(db, COLL.configuracion, "general"));
    if(snap.exists()){
      state.config = { ...DEFAULT_CONFIG, ...snap.data() };
    }else{
      state.config = { ...DEFAULT_CONFIG };
    }
  }catch(error){
    console.warn("No se pudo cargar configuración", error);
    state.config = { ...DEFAULT_CONFIG };
  }
  applyBranding();
}

function applyBranding(){
  const business = state.config.negocio || DEFAULT_CONFIG.negocio;
  document.title = `${business} | Panel`;
  if($("sidebarBusinessName")) $("sidebarBusinessName").textContent = business;
  if($("configBusinessName")) $("configBusinessName").value = state.config.negocio || DEFAULT_CONFIG.negocio;
  if($("configDomain")) $("configDomain").value = state.config.dominio || DEFAULT_CONFIG.dominio;
  if($("configWhatsapp")) $("configWhatsapp").value = state.config.whatsappNegocio || "";
  if($("configCurrency")) $("configCurrency").value = state.config.moneda || DEFAULT_CONFIG.moneda;
  if($("configBasePoints")) $("configBasePoints").value = state.config.puntosBase ?? 0;
}

function portalTail(){
  const domain = state.config.dominio || DEFAULT_CONFIG.dominio;
  return `Puedes entrar a ${domain}, ingresar donde dice cliente e ingresar tu número de celular.`;
}

function businessName(){
  return state.config.negocio || DEFAULT_CONFIG.negocio;
}

function whatsapp(phone, message){
  const p = normPhone(phone);
  if(!p){
    alert("Este cliente no tiene teléfono.");
    return;
  }
  window.open(`https://wa.me/${p}?text=${encodeURIComponent(message + " " + portalTail())}`, "_blank");
}

function setupNavigation(){
  qsa(".menu button").forEach(btn => {
    btn.onclick = () => {
      qsa(".menu button").forEach(b => b.classList.remove("active"));
      qsa(".page").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      $(btn.dataset.page).classList.add("active");
      pageTitle.textContent = btn.textContent.trim();
    };
  });
}

function lockEmployeeViews(){
  if(state.profile?.rol === "admin") return;
  ["usuarios","reportes","configuracion"].forEach(id => {
    const btn = document.querySelector(`button[data-page='${id}']`);
    if(btn) btn.classList.add("hidden");
  });
  serviceAdminBox.classList.add("hidden");
  serviceAdminNotice.classList.remove("hidden");
  subscriptionAdminBox.classList.add("hidden");
  subscriptionAdminNotice.classList.remove("hidden");
  rewardAdminBox.classList.add("hidden");
  rewardAdminNotice.classList.remove("hidden");
  goalAdminBox.classList.add("hidden");
  goalAdminNotice.classList.remove("hidden");
}

async function refreshDashboard(){
  const [clientes, servicios, pagos, canjes, alertas, auditoria] = await Promise.all([
    list(COLL.clientes), list(COLL.servicios), list(COLL.pagos),
    list(COLL.canjes), list(COLL.alertas), list(COLL.auditoria)
  ]);

  kpiClientes.textContent = clientes.length;
  kpiServicios.textContent = servicios.length;
  kpiIngresos.textContent = `Q${pagos.reduce((a,b) => a + Number(b.monto || 0), 0)}`;
  kpiPuntos.textContent = clientes.reduce((a,b) => a + Number(b.puntosActuales || 0), 0);
  kpiSubs.textContent = clientes.filter(c => c.estadoSuscripcion === "activa").length;
  kpiCanjes.textContent = canjes.length;
  alertsBadge.textContent = `${alertas.filter(a => a.atendida !== true).length} alertas`;

  activityList.innerHTML = auditoria.length
    ? auditoria.slice(0,10).map(a => `<div class="list-card"><strong>${safe(a.accion || "Actividad")}</strong><p>${safe(a.detalle || "")}</p></div>`).join("")
    : `<p class="muted">Sin actividad.</p>`;

  alertsList.innerHTML = alertas.length
    ? alertas.map(a => `<div class="list-card"><strong>${safe(a.nivel || "normal")}</strong><p>${safe(a.mensaje || "")}</p></div>`).join("")
    : `<p class="muted">Sin alertas.</p>`;
}

async function fillClientSelectors(ids){
  const clients = await list(COLL.clientes);
  ids.forEach(id => {
    const node = $(id);
    if(node){
      node.innerHTML = clients.map(c => `<option value="${c.id}" data-name="${safe(c.nombre)}" data-phone="${safe(c.telefono || "")}">${c.nombre}</option>`).join("");
    }
  });
  return clients;
}

async function renderClientes(){
  const clients = await list(COLL.clientes);
  const term = String(clienteSearch.value || "").trim().toLowerCase();

  const filtered = !term ? clients : clients.filter(c => {
    const base = `${c.nombre || ""} ${c.telefono || ""}`.toLowerCase();
    const vv = (c.vehiculos || []).map(v => `${v.placa || ""} ${v.marca || ""} ${v.modelo || ""} ${v.color || ""}`.toLowerCase()).join(" ");
    return `${base} ${vv}`.includes(term);
  });

  clientesList.innerHTML = filtered.length ? filtered.map(c => {
    const st = subStatus(c.fechaFinSuscripcion);
    return `
      <div class="list-card">
        <strong>${safe(c.nombre)}</strong>
        <p>Teléfono: ${safe(c.telefono || "Sin teléfono")}</p>
        <p>Puntos: ${c.puntosActuales || 0} | Visitas: ${c.visitas || 0}</p>
        <p>Suscripción: ${safe(c.suscripcionNombre || "Sin plan")} <span class="badge ${st.cls}">${st.text}</span></p>

        <div class="actions">
          <button class="success wa-client" data-phone="${safe(c.telefono || "")}" data-name="${safe(c.nombre)}">WhatsApp</button>
          ${state.profile?.rol === "admin" ? `<button class="danger del-client" data-id="${c.id}">Eliminar</button>` : ""}
        </div>

        <div class="list-card" style="margin-top:12px">
          <strong>Vehículos</strong>
          ${(c.vehiculos || []).length ? (c.vehiculos || []).map(v => `
            <div class="list-card">
              <strong>${safe(v.placa || "Sin placa")}</strong>
              <p>${safe(v.marca || "")} ${safe(v.modelo || "")} ${v.color ? `| ${safe(v.color)}` : ""}</p>
              <div class="actions">
                <button class="danger del-veh" data-client="${c.id}" data-vehicle="${v.id}">Quitar</button>
              </div>
            </div>
          `).join("") : `<p class="muted">Sin vehículos.</p>`}

          <form class="veh-form stack" data-client="${c.id}" style="margin-top:10px">
            <input name="placa" placeholder="Placa" required>
            <input name="marca" placeholder="Marca">
            <input name="modelo" placeholder="Modelo">
            <input name="color" placeholder="Color">
            <button class="btn-secondary" type="submit">Agregar vehículo</button>
          </form>
        </div>
      </div>
    `;
  }).join("") : `<p class="muted">Sin clientes.</p>`;

  qsa(".del-client").forEach(b => b.onclick = async () => {
    if(!confirm("¿Eliminar cliente?")) return;
    await deleteDoc(doc(db, COLL.clientes, b.dataset.id));
    await audit("clientes","eliminar",`Cliente ${b.dataset.id} eliminado`);
    await fullRefresh();
  });

  qsa(".veh-form").forEach(f => f.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    const client = await byId(COLL.clientes, f.dataset.client);
    const vehicles = [...(client.vehiculos || []), {
      id:`${Date.now()}`,
      placa: fd.get("placa"),
      marca: fd.get("marca"),
      modelo: fd.get("modelo"),
      color: fd.get("color")
    }];
    await patch(COLL.clientes, f.dataset.client, { vehiculos: vehicles });
    await audit("vehiculos","agregar",`Vehículo agregado a ${f.dataset.client}`);
    await fullRefresh();
  });

  qsa(".del-veh").forEach(b => b.onclick = async () => {
    if(!confirm("¿Quitar vehículo?")) return;
    const client = await byId(COLL.clientes, b.dataset.client);
    const vehicles = (client.vehiculos || []).filter(v => v.id !== b.dataset.vehicle);
    await patch(COLL.clientes, b.dataset.client, { vehiculos: vehicles });
    await audit("vehiculos","quitar",`Vehículo ${b.dataset.vehicle} quitado`);
    await fullRefresh();
  });

  qsa(".wa-client").forEach(b => b.onclick = () => {
    whatsapp(b.dataset.phone, `Hola ${b.dataset.name}, gracias por ser cliente de ${businessName()}.`);
  });
}

async function renderServicios(){
  const catalog = await list(COLL.catalogo);
  servicesCatalogList.innerHTML = catalog.length
    ? catalog.map(s => `<div class="list-card"><strong>${safe(s.nombre)}</strong><p>Q${s.precio} | ${s.puntos} pts</p></div>`).join("")
    : `<p class="muted">Sin servicios.</p>`;

  serviceTypeSelect.innerHTML = catalog.map(s => `<option value="${s.id}" data-name="${safe(s.nombre)}" data-price="${s.precio}" data-points="${s.puntos}">${s.nombre}</option>`).join("");

  if(catalog.length){
    servicePriceInput.value = serviceTypeSelect.selectedOptions[0].dataset.price;
    servicePointsInput.value = serviceTypeSelect.selectedOptions[0].dataset.points;
  }

  const history = await list(COLL.servicios);
  servicesHistoryList.innerHTML = history.length
    ? history.map(h => `<div class="list-card"><strong>${safe(h.clienteNombre)}</strong><p>${safe(h.servicio)} | ${safe(h.vehiculo || "")}</p><p>Q${h.precio} | ${h.puntos} pts</p></div>`).join("")
    : `<p class="muted">Sin historial.</p>`;

  const clients = await fillClientSelectors(["serviceClientSelect"]);

  const syncVehicles = () => {
    const client = clients.find(c => c.id === serviceClientSelect.value);
    const vehicles = client?.vehiculos || [];
    serviceVehicleSelect.innerHTML = vehicles.length
      ? vehicles.map(v => `<option value="${safe(v.placa)}">${v.placa}${v.marca ? ` | ${v.marca}` : ""}</option>`).join("")
      : `<option value="">Sin vehículos</option>`;
  };

  serviceClientSelect.onchange = syncVehicles;
  syncVehicles();

  serviceTypeSelect.onchange = () => {
    const o = serviceTypeSelect.selectedOptions[0];
    if(!o) return;
    servicePriceInput.value = o.dataset.price || 0;
    servicePointsInput.value = o.dataset.points || 0;
  };
}

async function renderSuscripciones(){
  const plans = await list(COLL.suscripciones);
  subscriptionsList.innerHTML = plans.length
    ? plans.map(p => `<div class="list-card"><strong>${safe(p.nombre)}</strong><p>Q${p.precio}/mes</p><p>${(p.beneficios || []).join(", ") || "Sin beneficios"}</p></div>`).join("")
    : `<p class="muted">Sin suscripciones.</p>`;

  subscriptionPlanSelect.innerHTML = plans.map(p => `<option value="${p.id}" data-name="${safe(p.nombre)}">${p.nombre}</option>`).join("");

  const clients = await fillClientSelectors(["subscriptionClientSelect"]);

  subscriptionAssignmentsList.innerHTML = clients.length
    ? clients.map(c => {
      const st = subStatus(c.fechaFinSuscripcion);
      const d = daysRemaining(c.fechaFinSuscripcion);
      return `
        <div class="list-card">
          <strong>${safe(c.nombre)}</strong>
          <p>Plan: ${safe(c.suscripcionNombre || "Sin plan")}</p>
          <p><span class="badge ${st.cls}">${st.text}</span></p>
          <p>Días restantes: ${d === null ? "-" : d}</p>
          <div class="actions">
            ${d !== null && d > 0 && d <= 5 ? `<button class="warning wa-sub" data-phone="${safe(c.telefono || "")}" data-name="${safe(c.nombre)}" data-plan="${safe(c.suscripcionNombre || "suscripción")}" data-days="${d}">Avisar WhatsApp</button>` : ""}
          </div>
        </div>
      `;
    }).join("")
    : `<p class="muted">Sin clientes.</p>`;

  qsa(".wa-sub").forEach(b => b.onclick = () => {
    whatsapp(b.dataset.phone, `Hola ${b.dataset.name}, tu suscripción mensual ${b.dataset.plan} en ${businessName()} está por vencer en ${b.dataset.days} días.`);
  });
}

async function renderPagos(){
  const payments = await list(COLL.pagos);
  paymentsList.innerHTML = payments.length
    ? payments.map(p => `<div class="list-card"><strong>${safe(p.clienteNombre || "Sin cliente")}</strong><p>${safe(p.concepto || "")}</p><p>${safe(p.metodoPago || "")} | Q${p.monto}</p></div>`).join("")
    : `<p class="muted">Sin pagos.</p>`;

  await fillClientSelectors(["paymentClientSelect"]);
}

async function renderRecompensas(){
  const rewards = await list(COLL.recompensas);
  rewardsList.innerHTML = rewards.length
    ? rewards.map(r => `<div class="list-card"><strong>${safe(r.nombre)}</strong><p>${r.puntosRequeridos} pts</p><p>${safe(r.descripcion || "")}</p></div>`).join("")
    : `<p class="muted">Sin recompensas.</p>`;

  const clients = await list(COLL.clientes);
  clientsRewardsList.innerHTML = clients.length
    ? clients.map(c => `<div class="list-card"><strong>${safe(c.nombre)}</strong><p>Puntos actuales: ${c.puntosActuales || 0}</p></div>`).join("")
    : `<p class="muted">Sin clientes.</p>`;
}

async function renderObjetivos(){
  const goals = await list(COLL.objetivos);
  goalsList.innerHTML = goals.length
    ? goals.map(g => `<div class="list-card"><strong>${safe(g.nombre)}</strong><p>Meta: ${g.metaVisitas} visitas</p><p>Recompensa: ${safe(g.recompensa || "")}</p></div>`).join("")
    : `<p class="muted">Sin objetivos.</p>`;

  const clients = await list(COLL.clientes);
  goalProgressList.innerHTML = clients.length
    ? clients.map(c => {
      const done = goals.filter(g => Number(c.visitas || 0) >= Number(g.metaVisitas || 0));
      return `<div class="list-card"><strong>${safe(c.nombre)}</strong><p>Visitas: ${c.visitas || 0}</p><p>Objetivos cumplidos: ${done.length ? done.map(g => safe(g.nombre)).join(", ") : "Ninguno"}</p></div>`;
    }).join("")
    : `<p class="muted">Sin datos.</p>`;
}

async function renderCanjes(){
  const redeems = await list(COLL.canjes);
  redeemsList.innerHTML = redeems.length
    ? redeems.map(r => `<div class="list-card"><strong>${safe(r.clienteNombre)}</strong><p>${safe(r.recompensaNombre)} | ${r.puntosUsados} pts</p></div>`).join("")
    : `<p class="muted">Sin canjes.</p>`;

  await fillClientSelectors(["redeemClientSelect"]);
  const rewards = await list(COLL.recompensas);
  redeemRewardSelect.innerHTML = rewards.map(r => `<option value="${r.id}" data-name="${safe(r.nombre)}" data-points="${r.puntosRequeridos}">${r.nombre} (${r.puntosRequeridos} pts)</option>`).join("");
}

async function renderUsuarios(){
  const users = await list(COLL.usuarios);
  usersList.innerHTML = users.length
    ? users.map(u => `<div class="list-card"><strong>${safe(u.nombre)}</strong><p>${safe(u.correo)}</p><p>${safe(u.rol)} | ${u.activo === false ? "Inactivo" : "Activo"}</p></div>`).join("")
    : `<p class="muted">Sin perfiles.</p>`;
}

async function renderReportes(){
  const [clientes, pagos, servicios] = await Promise.all([
    list(COLL.clientes), list(COLL.pagos), list(COLL.servicios)
  ]);

  const byMethod = pagos.reduce((a,p) => {
    a[p.metodoPago] = (a[p.metodoPago] || 0) + Number(p.monto || 0);
    return a;
  }, {});

  reportsSummary.innerHTML = `
    <div class="list-card"><strong>Clientes</strong><p>Total: ${clientes.length} | Activos: ${clientes.filter(c => c.activo !== false).length} | Con suscripción: ${clientes.filter(c => c.estadoSuscripcion === "activa").length}</p></div>
    <div class="list-card"><strong>Pagos</strong><p>Total ingresado: Q${pagos.reduce((a,b)=>a+Number(b.monto||0),0)}</p><p>${Object.entries(byMethod).map(([k,v]) => `${k}: Q${v}`).join(" | ") || "Sin pagos"}</p></div>
    <div class="list-card"><strong>Servicios</strong><p>Total registrados: ${servicios.length}</p></div>
  `;
}

async function renderConfig(){
  configPreview.innerHTML = `
    <div class="list-card">
      <strong>${safe(state.config.negocio || DEFAULT_CONFIG.negocio)}</strong>
      <p>Dominio: ${safe(state.config.dominio || DEFAULT_CONFIG.dominio)}</p>
      <p>WhatsApp negocio: ${safe(state.config.whatsappNegocio || "No configurado")}</p>
      <p>Moneda: ${safe(state.config.moneda || "GTQ")}</p>
      <p>Puntos base: ${Number(state.config.puntosBase || 0)}</p>
    </div>
  `;
}

async function fullRefresh(){
  await loadConfig();
  await refreshDashboard();
  await renderClientes();
  await renderServicios();
  await renderSuscripciones();
  await renderPagos();
  await renderRecompensas();
  await renderObjetivos();
  await renderCanjes();
  if(state.profile?.rol === "admin"){
    await renderUsuarios();
    await renderReportes();
    await renderConfig();
  }
}

function setupForms(){
  clienteForm.onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      nombre: clienteNombre.value.trim(),
      telefono: clienteTelefono.value.trim(),
      activo: true,
      puntosActuales: 0,
      puntosAcumulados: 0,
      puntosCanjeados: 0,
      visitas: 0,
      vehiculos: [],
      suscripcionNombre: "",
      fechaInicioSuscripcion: "",
      fechaFinSuscripcion: "",
      estadoSuscripcion: "sin_plan",
      creadoPor: state.profile?.correo || ""
    };
    await create(COLL.clientes, payload);
    await audit("clientes", "crear", `Cliente ${payload.nombre} creado`);
    whatsapp(payload.telefono, `Hola ${payload.nombre}, te damos la bienvenida a ${businessName()}. Ya estás registrado en nuestro sistema de clientes.`);
    clienteForm.reset();
    await fullRefresh();
  };

  clienteSearch.oninput = () => renderClientes();

  serviceForm.onsubmit = async (e) => {
    e.preventDefault();
    if(state.profile?.rol !== "admin"){
      alert("Solo el admin puede crear servicios nuevos.");
      return;
    }
    await create(COLL.catalogo, {
      nombre: serviceNombre.value.trim(),
      precio: Number(servicePrecio.value || 0),
      puntos: Number(servicePuntos.value || 0),
      activa: true
    });
    await audit("servicios","crear_catalogo",`Servicio ${serviceNombre.value.trim()} creado`);
    serviceForm.reset();
    await fullRefresh();
  };

  registerServiceForm.onsubmit = async (e) => {
    e.preventDefault();
    const clients = await list(COLL.clientes);
    const client = clients.find(c => c.id === serviceClientSelect.value);
    if(!client){
      alert("Selecciona un cliente válido.");
      return;
    }

    const option = serviceTypeSelect.selectedOptions[0];
    const serviceName = option?.dataset.name || "";
    const price = Number(servicePriceInput.value || 0);
    const points = Number(servicePointsInput.value || 0);

    await create(COLL.servicios, {
      clienteId: client.id,
      clienteNombre: client.nombre,
      vehiculo: serviceVehicleSelect.value,
      servicio: serviceName,
      precio: price,
      puntos: points
    });

    await patch(COLL.clientes, client.id, {
      puntosActuales: Number(client.puntosActuales || 0) + points,
      puntosAcumulados: Number(client.puntosAcumulados || 0) + points,
      visitas: Number(client.visitas || 0) + 1
    });

    await audit("servicios","registrar",`${client.nombre} recibió ${serviceName}`);

    const updatedPoints = Number(client.puntosActuales || 0) + points;
    whatsapp(client.telefono, `Hola ${client.nombre}, registramos tu servicio ${serviceName} en ${businessName()}. Ganaste ${points} puntos y ahora tienes ${updatedPoints} puntos.`);

    registerServiceForm.reset();
    await fullRefresh();
  };

  subscriptionForm.onsubmit = async (e) => {
    e.preventDefault();
    if(state.profile?.rol !== "admin"){
      alert("Solo el admin puede crear suscripciones nuevas.");
      return;
    }
    await create(COLL.suscripciones, {
      nombre: subscriptionName.value.trim(),
      precio: Number(subscriptionPrice.value || 0),
      beneficios: lines(subscriptionBenefits.value),
      activa: true
    });
    await audit("suscripciones","crear",`Suscripción ${subscriptionName.value.trim()} creada`);
    subscriptionForm.reset();
    await fullRefresh();
  };

  assignSubscriptionForm.onsubmit = async (e) => {
    e.preventDefault();
    const clients = await list(COLL.clientes);
    const plans = await list(COLL.suscripciones);
    const client = clients.find(c => c.id === subscriptionClientSelect.value);
    const plan = plans.find(p => p.id === subscriptionPlanSelect.value);
    if(!client || !plan){
      alert("Selecciona cliente y plan.");
      return;
    }

    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + 30);

    await patch(COLL.clientes, client.id, {
      suscripcionId: plan.id,
      suscripcionNombre: plan.nombre,
      fechaInicioSuscripcion: start.toISOString(),
      fechaFinSuscripcion: end.toISOString(),
      estadoSuscripcion: "activa"
    });

    await audit("suscripciones","asignar",`${client.nombre} -> ${plan.nombre}`);
    whatsapp(client.telefono, `Hola ${client.nombre}, tu suscripción mensual ${plan.nombre} fue activada o renovada correctamente en ${businessName()}. Días restantes: ${daysRemaining(end.toISOString())}.`);
    assignSubscriptionForm.reset();
    await fullRefresh();
  };

  paymentForm.onsubmit = async (e) => {
    e.preventDefault();
    const opt = paymentClientSelect.selectedOptions[0];
    await create(COLL.pagos, {
      clienteId: paymentClientSelect.value,
      clienteNombre: opt?.dataset.name || "",
      concepto: paymentConcept.value.trim(),
      monto: Number(paymentAmount.value || 0),
      metodoPago: paymentMethod.value,
      registradoPor: state.profile?.correo || ""
    });
    await audit("pagos","registrar",`Pago ${paymentConcept.value.trim()} Q${paymentAmount.value}`);
    whatsapp(opt?.dataset.phone || "", `Hola ${opt?.dataset.name || ""}, registramos tu pago en ${businessName()}. Concepto: ${paymentConcept.value.trim()}. Monto: Q${paymentAmount.value}. Método: ${paymentMethod.value}.`);
    paymentForm.reset();
    await fullRefresh();
  };

  rewardForm.onsubmit = async (e) => {
    e.preventDefault();
    if(state.profile?.rol !== "admin"){
      alert("Solo el admin puede crear recompensas nuevas.");
      return;
    }
    await create(COLL.recompensas, {
      nombre: rewardName.value.trim(),
      puntosRequeridos: Number(rewardPoints.value || 0),
      descripcion: rewardDescription.value.trim(),
      activa: true
    });
    await audit("recompensas","crear",`Recompensa ${rewardName.value.trim()} creada`);
    rewardForm.reset();
    await fullRefresh();
  };

  goalForm.onsubmit = async (e) => {
    e.preventDefault();
    if(state.profile?.rol !== "admin"){
      alert("Solo el admin puede crear objetivos nuevos.");
      return;
    }
    await create(COLL.objetivos, {
      nombre: goalName.value.trim(),
      metaVisitas: Number(goalTarget.value || 0),
      recompensa: goalReward.value.trim(),
      activa: true
    });
    await audit("objetivos","crear",`Objetivo ${goalName.value.trim()} creado`);
    goalForm.reset();
    await fullRefresh();
  };

  redeemForm.onsubmit = async (e) => {
    e.preventDefault();
    const clients = await list(COLL.clientes);
    const rewards = await list(COLL.recompensas);
    const client = clients.find(c => c.id === redeemClientSelect.value);
    const reward = rewards.find(r => r.id === redeemRewardSelect.value);
    if(!client || !reward){
      alert("Selecciona cliente y recompensa.");
      return;
    }

    const need = Number(reward.puntosRequeridos || 0);
    const have = Number(client.puntosActuales || 0);
    if(have < need){
      alert("Puntos insuficientes.");
      return;
    }

    const remain = have - need;

    await patch(COLL.clientes, client.id, {
      puntosActuales: remain,
      puntosCanjeados: Number(client.puntosCanjeados || 0) + need
    });

    await create(COLL.canjes, {
      clienteId: client.id,
      clienteNombre: client.nombre,
      recompensaId: reward.id,
      recompensaNombre: reward.nombre,
      puntosUsados: need,
      realizadoPor: state.profile?.correo || ""
    });

    await audit("canjes","registrar",`${client.nombre} canjeó ${reward.nombre}`);
    whatsapp(client.telefono, `Hola ${client.nombre}, registramos tu canje en ${businessName()}. Recompensa: ${reward.nombre}. Tu saldo actual es ${remain} puntos.`);
    redeemForm.reset();
    await fullRefresh();
  };

  userProfileForm.onsubmit = async (e) => {
    e.preventDefault();
    await create(COLL.usuarios, {
      nombre: userProfileName.value.trim(),
      correo: userProfileEmail.value.trim(),
      rol: userProfileRole.value,
      activo: userProfileActive.value === "true"
    });
    await audit("usuarios","crear_perfil",`Perfil ${userProfileEmail.value.trim()} creado`);
    userProfileForm.reset();
    await fullRefresh();
  };

  exportJsonBtn.onclick = async () => {
    const payload = {};
    for(const c of Object.values(COLL)){
      payload[c] = await list(c);
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "auto_lavado_montana_backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  exportCsvBtn.onclick = async () => {
    const rows = await list(COLL.pagos);
    const headers = ["clienteNombre","concepto","monto","metodoPago"];
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g,'""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pagos_auto_lavado_montana.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  configForm.onsubmit = async (e) => {
    e.preventDefault();
    await singleton("general", {
      negocio: configBusinessName.value.trim() || DEFAULT_CONFIG.negocio,
      dominio: configDomain.value.trim() || DEFAULT_CONFIG.dominio,
      whatsappNegocio: configWhatsapp.value.trim(),
      moneda: configCurrency.value.trim() || DEFAULT_CONFIG.moneda,
      puntosBase: Number(configBasePoints.value || 0)
    });
    await audit("configuracion","guardar","Configuración actualizada");
    await fullRefresh();
  };

  logoutBtn.onclick = async () => {
    await signOut(auth);
    window.location.href = "index.html";
  };
}

onAuthStateChanged(auth, async (user) => {
  if(!user){
    window.location.href = "index.html";
    return;
  }

  state.user = user;
  await loadConfig();

  const users = await list(COLL.usuarios);
  const profile = users.find(u => String(u.correo || "").trim().toLowerCase() === String(user.email || "").trim().toLowerCase());

  if(!profile || profile.activo === false){
    window.location.href = "index.html";
    return;
  }

  state.profile = profile;
  userInfo.textContent = `${profile.nombre} | ${profile.rol} | ${profile.correo}`;

  if(profile.rol !== "admin"){
    lockEmployeeViews();
  }

  setupNavigation();
  setupForms();
  await fullRefresh();
});
