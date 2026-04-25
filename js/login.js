import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const form = document.getElementById("loginForm");
const msg = document.getElementById("loginMessage");

async function loadPublicConfig(){
  try{
    const snap = await getDoc(doc(db, "configuracion", "general"));
    if(snap.exists()){
      const cfg = snap.data();
      document.getElementById("loginBusinessName").textContent = cfg.negocio || "AUTO LAVADO MONTANA";
      document.title = `${cfg.negocio || "AUTO LAVADO MONTANA"} | Login`;
    }
  }catch(error){
    console.warn("No se pudo cargar configuración pública", error);
  }
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "Ingresando...";
  try{
    await signInWithEmailAndPassword(auth, email.value.trim(), password.value.trim());
    msg.textContent = "Ingreso correcto.";
    window.location.href = "panel.html";
  }catch(err){
    console.error(err);
    msg.textContent = "Correo o contraseña incorrectos.";
  }
});

loadPublicConfig();
