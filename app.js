import {
  createClient
} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* =========================================
   EXPEDIENTE X — CONFIGURACIÓN
   ========================================= */

const SUPABASE_URL = "https://jahooutlfbznssyyknfi.supabase.co"
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_DVBAb6lh3emVrWKOn5VHWg_2OTAQCCr";

const isConfigured =
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_");

const db = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

const $ = (id) => document.getElementById(id);

let roomCode = null;
let pollTimer = null;
let currentState = null;
let isSubmitting = false;

/* =========================================
   INFORMACIÓN VISIBLE DEL CASO
   La solución oficial estará en Supabase.
   ========================================= */

const clues = [
  {
    id: "ev_391",
    label: "Prueba A",
    type: "Registro de acceso",
    title: "Una tarjeta fuera de lugar",
    description:
      "A las 20:12 se utilizó la tarjeta de Tomás en la puerta de servicio. El registro confirma el uso de la tarjeta, pero no identifica quién la llevaba."
  },
  {
    id: "ev_582",
    label: "Prueba B",
    type: "Fotografía",
    title: "La imagen del vestíbulo",
    description:
      "Una fotografía automática de las 20:18 muestra a Clara con un portafolio rígido cerca del corredor de restauración, después del cierre de la galería."
  },
  {
    id: "ev_147",
    label: "Prueba C",
    type: "Registro de alarma",
    title: "El sensor desactivado",
    description:
      "A las 20:11, el sensor de la sala quedó en modo de mantenimiento mediante la cuenta de curaduría. La consola está dentro del museo."
  },
  {
    id: "ev_263",
    label: "Prueba D",
    type: "Videollamada",
    title: "La coartada de Inés",
    description:
      "Inés aparece en una videollamada entre las 20:05 y las 20:24. La grabación muestra su rostro, pero no permite verificar dónde se encontraba."
  },
  {
    id: "ev_704",
    label: "Prueba E",
    type: "Libro del taller",
    title: "El préstamo de material",
    description:
      "Bruno registró la devolución de un estuche protector a las 19:58. El registro documenta la devolución, aunque no permite descartar otros movimientos posteriores."
  }
];

const suspectNames = {
  ines: "Inés Vega",
  tomas: "Tomás Ruiz",
  clara: "Clara Solís",
  bruno: "Bruno León"
};

const clueNames = Object.fromEntries(
  clues.map((clue) => [clue.id, `${clue.label} — ${clue.title}`])
);

/* =========================================
   INTERFAZ
   ========================================= */

function showMessage(message, type = "") {
  const element = $("roomMessage");

  element.textContent = message;
  element.className = "message";

  if (type) {
    element.classList.add(type);
  }
}

function showSetupError(error) {
  const message =
    error instanceof Error ? error.message : String(error);

  window.alert(message);
}

function renderClues() {
  const container = $("cluesGrid");
  container.replaceChildren();

  for (const clue of clues) {
    const card = document.createElement("article");
    card.className = "clue-card";

    const top = document.createElement("div");
    top.className = "clue-top";

    const label = document.createElement("span");
    label.className = "clue-label";
    label.textContent = clue.label;

    const type = document.createElement("span");
    type.className = "clue-type";
    type.textContent = clue.type;

    top.append(label, type);

    const heading = document.createElement("h3");
    heading.textContent = clue.title;

    const description = document.createElement("p");
    description.textContent = clue.description;

    card.append(top, heading, description);
    container.appendChild(card);
  }
}

function displayRoom() {
  $("setupPanel").hidden = true;
  $("roomPanel").hidden = false;
}

function displaySetup() {
  $("roomPanel").hidden = true;
  $("setupPanel").hidden = false;
}

/* =========================================
   CONEXIÓN Y SESIÓN DEL JUGADOR
   ========================================= */

async function ensureSession() {
  if (!db) {
    throw new Error(
      "Primero debes configurar la URL y la clave publicable de Supabase en app.js."
    );
  }

  const { data, error } = await db.auth.getSession();

  if (error) {
    throw new Error("No se pudo comprobar la sesión: " + error.message);
  }

  if (data.session) {
    return data.session;
  }

  const { data: newSession, error: signInError } =
    await db.auth.signInAnonymously();

  if (signInError) {
    throw new Error(
      "No se pudo iniciar la sesión de jugador. Revisa que hayas " +
      "activado Anonymous Sign-Ins en Supabase. " +
      signInError.message
    );
  }

  return newSession.session;
}

async function callRpc(functionName, args) {
  await ensureSession();

  const { data, error } = await db.rpc(functionName, args);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/* =========================================
   CREAR UNA PARTIDA
   ========================================= */

$("createForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = $("createName").value.trim();

  if (name.length < 2) {
    showSetupError(
      new Error("Tu nombre de detective debe tener al menos 2 caracteres.")
    );
    return;
  }

  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  button.textContent = "Creando sala…";

  try {
    const data = await callRpc("create_room", {
      p_nickname: name
    });

    if (!data || !data.code) {
      throw new Error("No recibimos el código de la nueva sala.");
    }

    await openRoom(data.code);
  } catch (error) {
    showSetupError(error);
  } finally {
    button.disabled = false;
    button.innerHTML = 'Crear partida <span>↗</span>';
  }
});

/* =========================================
   UNIRSE A UNA PARTIDA
   ========================================= */

$("joinForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = $("joinName").value.trim();
  const code = $("joinCode").value.trim().toUpperCase();

  if (name.length < 2) {
    showSetupError(
      new Error("Tu nombre de detective debe tener al menos 2 caracteres.")
    );
    return;
  }

  if (!/^[A-Z0-9]{8}$/.test(code)) {
    showSetupError(
      new Error("El código debe contener exactamente 8 letras o números.")
    );
    return;
  }

  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  button.textContent = "Entrando…";

  try {
    await callRpc("join_room", {
      p_code: code,
      p_nickname: name
    });

    await openRoom(code);
  } catch (error) {
    showSetupError(error);
  } finally {
    button.disabled = false;
    button.innerHTML = 'Entrar a la sala <span>→</span>';
  }
});

/* =========================================
   ABRIR Y RECUPERAR LA SALA
   ========================================= */

async function openRoom(code) {
  roomCode = code.toUpperCase();

  localStorage.setItem("expedienteXRoomCode", roomCode);

  $("roomCodeTitle").textContent = roomCode;
  $("lobbyCode").textContent = roomCode;
  $("roomMessage").textContent = "";

  displayRoom();

  await refreshRoom();
  startPolling();
}

async function refreshRoom() {
  if (!roomCode) {
    return;
  }

  const state = await callRpc("get_room_state", {
    p_code: roomCode
  });

  currentState = state;
  renderRoomState(state);

  if (state.status === "completed") {
    stopPolling();
  }
}

/* =========================================
   LISTA DE DETECTIVES
   ========================================= */

function renderPlayers(players = []) {
  const container = $("playersList");
  container.replaceChildren();

  for (let slot = 1; slot <= 2; slot++) {
    const player = players.find(
      (item) => Number(item.slot) === slot
    );

    const card = document.createElement("article");
    card.className = "player-card";

    const avatar = document.createElement("div");
    avatar.className = "player-avatar";
    avatar.textContent = player
      ? player.nickname.slice(0, 1).toUpperCase()
      : "?";

    const info = document.createElement("div");
    info.className = "player-info";

    const name = document.createElement("strong");
    name.textContent = player
      ? player.nickname
      : `Detective ${slot}`;

    const role = document.createElement("span");
    role.textContent = `Detective ${slot}`;

    info.append(name, role);

    const status = document.createElement("span");
    status.className = "player-state";

    if (!player) {
      status.textContent = "Esperando";
      status.style.color = "var(--muted)";
    } else if (player.submitted) {
      status.textContent = "Sellada ✓";
    } else {
      status.textContent = "Investigando";
      status.style.color = "var(--gold)";
    }

    card.append(avatar, info, status);
    container.appendChild(card);
  }
}

/* =========================================
   ESTADO DE LA PARTIDA
   ========================================= */

function renderRoomState(state) {
  if (!state || !state.status) {
    showMessage("No pudimos leer el estado de la partida.", "error");
    return;
  }

  $("roomCodeTitle").textContent = state.code || roomCode;
  $("lobbyCode").textContent = state.code || roomCode;

  renderPlayers(state.players || []);

  const waiting = state.status === "waiting";
  const active = state.status === "active";
  const completed = state.status === "completed";
  const submitted = Boolean(state.my_submitted);

  $("statusLabel").textContent = waiting
    ? "Esperando al rival"
    : active
      ? "Investigación en curso"
      : completed
        ? "Caso cerrado"
        : "Estado de la partida";

  $("lobbyPanel").hidden = !waiting;
  $("gamePanel").hidden = !(active && !submitted);
  $("submittedPanel").hidden = !(active && submitted);
  $("resultsPanel").hidden = !completed;

  if (completed) {
    renderResults(state);
  }
}

/* =========================================
   ENVIAR UNA RESPUESTA
   ========================================= */

$("answerForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isSubmitting) {
    return;
  }

  const form = event.currentTarget;
  const formData = new FormData(form);

  const suspect = String(formData.get("suspect") || "");
  const clue = String(formData.get("clue") || "");
  const theory = String(formData.get("theory") || "").trim();

  if (!suspect || !clue) {
    showMessage("Selecciona un sospechoso y una prueba.", "error");
    return;
  }

  const confirmed = window.confirm(
    "¿Confirmas tu respuesta? Después de enviarla no podrás modificarla."
  );

  if (!confirmed) {
    return;
  }

  isSubmitting = true;

  const button = $("submitAnswerButton");
  button.disabled = true;
  button.textContent = "Sellando tu respuesta…";

  try {
    await callRpc("submit_answer", {
      p_code: roomCode,
      p_suspect: suspect,
      p_clue: clue,
      p_theory: theory
    });

    showMessage(
      "Tu respuesta quedó registrada. Esperaremos al otro detective para revelar los resultados.",
      "success"
    );

    await refreshRoom();
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    isSubmitting = false;
    button.disabled = false;
    button.innerHTML = 'Presentar respuesta <span>↗</span>';
  }
});

/* =========================================
   MOSTRAR LOS RESULTADOS FINALES
   ========================================= */

function renderResults(state) {
  const results = Array.isArray(state.results)
    ? state.results
    : [];

  const solution = state.solution || {};

  $("solutionTitle").textContent =
    solution.title || "Caso resuelto";

  $("solutionText").textContent =
    solution.explanation ||
    "La resolución oficial estará disponible cuando se complete la partida.";

  const winnerTitle = $("winnerTitle");
  const winnerCopy = $("winnerCopy");

  if (results.length < 2) {
    winnerTitle.textContent = "Investigación completada";
    winnerCopy.textContent =
      "Las respuestas están registradas, pero faltan los resultados de los dos detectives.";
  } else {
    const firstScore = Number(results[0].total_points || 0);
    const secondScore = Number(results[1].total_points || 0);

    if (firstScore === secondScore) {
      winnerTitle.textContent = "¡Empate entre detectives!";
      winnerCopy.textContent =
        `Ambos detectives consiguieron ${firstScore} puntos.`;
    } else {
      const winner = results.reduce((best, item) =>
        Number(item.total_points || 0) >
        Number(best.total_points || 0)
          ? item
          : best
      );

      winnerTitle.textContent = `¡${winner.nickname} gana el caso!`;
      winnerCopy.textContent =
        `${winner.nickname} obtuvo ${winner.total_points} puntos.`;
    }
  }

  const container = $("resultsList");
  container.replaceChildren();

  results.forEach((result, index) => {
    const card = document.createElement("article");
    card.className = "result-card";

    if (index === 0 && results.length > 1) {
      const maxScore = Math.max(
        ...results.map((item) => Number(item.total_points || 0))
      );

      if (Number(result.total_points || 0) === maxScore) {
        card.classList.add("winner");
      }
    }

    const top = document.createElement("div");
    top.className = "result-top";

    const headingGroup = document.createElement("div");

    const name = document.createElement("h3");
    name.textContent = result.nickname || "Detective";

    const suspect = document.createElement("p");
    suspect.textContent =
      "Sospechoso elegido: " +
      (suspectNames[result.suspect] || "No disponible");

    headingGroup.append(name, suspect);

    const score = document.createElement("strong");
    score.className = "result-score";
    score.textContent = String(result.total_points ?? 0);

    top.append(headingGroup, score);

    const breakdown = document.createElement("div");
    breakdown.className = "score-breakdown";

    const suspectDetail = createScoreDetail(
      "Sospechoso correcto",
      `${result.suspect_points ?? 0} / 70 puntos`
    );

    const clueDetail = createScoreDetail(
      "Prueba clave",
      `${result.clue_points ?? 0} / 30 puntos`
    );

    breakdown.append(suspectDetail, clueDetail);

    const chosenClue = document.createElement("p");
    chosenClue.className = "result-theory";
    chosenClue.textContent =
      "Prueba elegida: " +
      (clueNames[result.clue] || "No disponible");

    const theory = document.createElement("p");
    theory.className = "result-theory";

    theory.textContent = result.theory
      ? `Teoría: ${result.theory}`
      : "Este detective no escribió una teoría adicional.";

    card.append(top, breakdown, chosenClue, theory);
    container.appendChild(card);
  });
}

function createScoreDetail(label, value) {
  const element = document.createElement("div");
  element.className = "score-detail";

  const title = document.createElement("span");
  title.textContent = label;

  const score = document.createElement("strong");
  score.textContent = value;

  element.append(title, score);

  return element;
}

/* =========================================
   ACTUALIZACIÓN ENTRE DISPOSITIVOS
   ========================================= */

function stopPolling() {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPolling() {
  stopPolling();

  pollTimer = setInterval(async () => {
    if (!roomCode) {
      return;
    }

    try {
      await refreshRoom();
    } catch (error) {
      console.error("Error actualizando la partida:", error);
    }
  }, 3000);
}

/* =========================================
   COPIAR EL CÓDIGO DE INVITACIÓN
   ========================================= */

$("copyCodeButton").addEventListener("click", async () => {
  if (!roomCode) {
    return;
  }

  try {
    await navigator.clipboard.writeText(roomCode);
    showMessage("Código copiado. Envíalo a tu rival.", "success");
  } catch {
    showMessage(
      `Tu código es ${roomCode}. Selecciónalo y cópialo manualmente.`,
      "error"
    );
  }
});

/* =========================================
   VOLVER AL INICIO
   ========================================= */

$("newGameButton").addEventListener("click", () => {
  stopPolling();

  roomCode = null;
  currentState = null;

  localStorage.removeItem("expedienteXRoomCode");

  $("createForm").reset();
  $("joinForm").reset();
  $("answerForm").reset();

  $("roomMessage").textContent = "";

  displaySetup();
});

/* =========================================
   INICIO Y RECUPERACIÓN DE LA SALA
   ========================================= */

async function init() {
  renderClues();

  if (!db) {
    console.warn(
      "Falta configurar SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY en app.js."
    );
    return;
  }

  try {
    await ensureSession();

    const savedCode = localStorage.getItem("expedienteXRoomCode");

    if (savedCode) {
      try {
        await openRoom(savedCode);
      } catch (error) {
        console.warn("No se pudo recuperar la sala anterior:", error);
        localStorage.removeItem("expedienteXRoomCode");
        roomCode = null;
        displaySetup();
      }
    }
  } catch (error) {
    console.error("Error iniciando Expediente X:", error);
    window.alert(error.message);
  }
}

window.addEventListener("beforeunload", stopPolling);

init();
