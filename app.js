import { createClient } from
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// CONFIGURACION: usa los valores de tu proyecto.
const SUPABASE_URL =
  "https://jahooutlfbznssyyknfi.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_DVBAb6lh3emVrWKOn5VHWg_2OTAQCCr";

const db = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const $ = (id) => document.getElementById(id);

let roomCode = null;
let roomState = null;
let selectedEvidence = [];
let pollTimer = null;
let busy = false;

const locations = [
  {
    id: "gallery",
    icon: "▧",
    title: "Galería principal",
    summary: "La sala donde estaba expuesta La Última Luz.",
    detail: "El marco sigue en la pared. No hay cristales rotos.",
    clues: ["ev_582"]
  },
  {
    id: "security",
    icon: "⌁",
    title: "Sala de seguridad",
    summary: "Monitores, tarjetas y controles de alarma.",
    detail: "Dos registros muestran movimientos a las 20:11 y 20:12.",
    clues: ["ev_147", "ev_391"]
  },
  {
    id: "workshop",
    icon: "⚒",
    title: "Taller de restauración",
    summary: "Herramientas y registros del equipo técnico.",
    detail: "El libro de préstamos permite reconstruir los movimientos.",
    clues: ["ev_704"]
  }
];

const clues = {
  ev_391: {
    id: "ev_391",
    label: "PRUEBA A",
    type: "Registro de acceso",
    title: "Una tarjeta fuera de lugar",
    description:
      "A las 20:12 se utilizó la tarjeta de Tomás en la puerta de servicio. El registro no identifica quién la llevaba."
  },
  ev_582: {
    id: "ev_582",
    label: "PRUEBA B",
    type: "Fotografía",
    title: "La imagen del vestíbulo",
    description:
      "Una fotografía de las 20:18 muestra a Clara con un portafolio cerca del corredor de restauración."
  },
  ev_147: {
    id: "ev_147",
    label: "PRUEBA C",
    type: "Registro de alarma",
    title: "El sensor desactivado",
    description:
      "A las 20:11, el sensor cambió a modo de mantenimiento mediante la cuenta de curaduría."
  },
  ev_263: {
    id: "ev_263",
    label: "PRUEBA D",
    type: "Videollamada",
    title: "La coartada de Inés",
    description:
      "Inés aparece en una videollamada entre las 20:05 y las 20:24, pero la grabación no confirma su ubicación."
  },
  ev_704: {
    id: "ev_704",
    label: "PRUEBA E",
    type: "Libro del taller",
    title: "El préstamo de material",
    description:
      "Bruno registró la devolución de un estuche protector a las 19:58."
  }
};

const suspects = [
  {
    id: "ines",
    name: "Inés Vega",
    role: "Curadora",
    icon: "♙",
    bio: "Conoce el museo y tiene acceso a la consola de curaduría.",
    questions: [
      {
        id: "ines_alibi",
        label: "¿Dónde estabas a las 20:11?",
        response:
          "Estaba en una videollamada de 20:05 a 20:24. La grabación muestra mi cara, pero no verifica mi ubicación.",
        clue: "ev_263"
      },
      {
        id: "ines_access",
        label: "¿Quién puede cambiar el sensor?",
        response:
          "La consola usa una cuenta de curaduría. Esa noche yo estaba a cargo de la exposición."
      }
    ]
  },
  {
    id: "tomas",
    name: "Tomás Ruiz",
    role: "Guardia de seguridad",
    icon: "♜",
    bio: "Conoce las entradas de servicio y las tarjetas de acceso.",
    questions: [
      {
        id: "tomas_card",
        label: "¿Usaste tu tarjeta después del cierre?",
        response:
          "El registro marca mi tarjeta a las 20:12. La dejé en el casillero al comenzar el turno.",
        clue: "ev_391"
      },
      {
        id: "tomas_patrol",
        label: "¿Qué viste durante la ronda?",
        response:
          "Revisé la entrada principal y el corredor. No vi una ventana rota."
      }
    ]
  },
  {
    id: "clara",
    name: "Clara Solís",
    role: "Fotógrafa",
    icon: "▣",
    bio: "Se quedó tomando fotografías tras el cierre de la exposición.",
    questions: [
      {
        id: "clara_bag",
        label: "¿Qué llevabas en el portafolio?",
        response:
          "Equipo fotográfico y fondos plegables. La fotografía no muestra qué había dentro.",
        clue: "ev_582"
      },
      {
        id: "clara_photo",
        label: "¿Cuándo terminaste de fotografiar?",
        response:
          "Terminé después de las 20:20. No recuerdo haber visto la pintura fuera del marco."
      }
    ]
  },
  {
    id: "bruno",
    name: "Bruno León",
    role: "Restaurador",
    icon: "⚒",
    bio: "Trabaja con obras y materiales de protección.",
    questions: [
      {
        id: "bruno_case",
        label: "¿Para qué era el estuche protector?",
        response:
          "Lo usé la semana pasada y lo devolví a las 19:58. Es material común del taller.",
        clue: "ev_704"
      },
      {
        id: "bruno_access",
        label: "¿Tenías acceso al sistema de alarma?",
        response:
          "No tengo una cuenta de la consola. Puedo trabajar con la obra, pero no cambiar el sensor."
      }
    ]
  }
];

const suspectNames = Object.fromEntries(
  suspects.map((s) => [s.id, s.name])
);

const methodNames = {
  alarm_disabled: "Desactivó el sensor con la cuenta de curaduría",
  borrowed_keycard: "Usó una tarjeta de acceso ajena",
  window_entry: "Entró por una ventana",
  painting_swap: "Sustituyó la pintura antes del cierre"
};

const clueNames = Object.fromEntries(
  Object.values(clues).map((c) => [c.id, c.title])
);

const correctTimeline = ["ev_147", "ev_391", "ev_582"];

/* ==========================================
   UTILIDADES
   ========================================== */

function showMessage(message, type = "") {
  const el = $("roomMessage");
  el.textContent = message || "";
  el.className = "message";
  if (type) el.classList.add(type);
}

function errorMessage(error) {
  const message = error instanceof Error
    ? error.message
    : String(error);

  showMessage(message, "error");
}

async function ensureSession() {
  const { data, error } = await db.auth.getSession();

  if (error) throw error;
  if (data.session) return data.session;

  const { data: result, error: signInError } =
    await db.auth.signInAnonymously();

  if (signInError) throw signInError;
  return result.session;
}

async function rpc(name, args) {
  await ensureSession();

  const { data, error } = await db.rpc(name, args);

  if (error) throw error;
  return data;
}

function saveRoom(code, nickname) {
  roomCode = code.toUpperCase();

  localStorage.setItem("expedienteXRoomCode", roomCode);

  if (nickname) {
    localStorage.setItem("expedienteXNickname", nickname);
  }
}

function showRoom() {
  $("setupPanel").hidden = true;
  $("roomPanel").hidden = false;
}

function showSetup() {
  $("roomPanel").hidden = true;
  $("setupPanel").hidden = false;
}

/* ==========================================
   CREAR Y UNIRSE A SALAS
   ========================================== */

$("createForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = $("createName").value.trim();
  if (name.length < 2) {
    showMessage("Escribe un nombre de al menos dos caracteres.", "error");
    return;
  }

  const button = event.currentTarget.querySelector("button");
  button.disabled = true;

  try {
    const result = await rpc("create_room", {
      p_nickname: name
    });

    if (!result?.code) throw new Error("No se recibió el código de la sala.");

    saveRoom(result.code, name);
    await openRoom(result.code);
  } catch (error) {
    errorMessage(error);
  } finally {
    button.disabled = false;
  }
});

$("joinForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = $("joinName").value.trim();
  const code = $("joinCode").value.trim().toUpperCase();

  if (!/^[A-Z0-9]{8}$/.test(code)) {
    showMessage("El código debe contener ocho letras o números.", "error");
    return;
  }

  const button = event.currentTarget.querySelector("button");
  button.disabled = true;

  try {
    await rpc("join_room", {
      p_code: code,
      p_nickname: name
    });

    saveRoom(code, name);
    await openRoom(code);
  } catch (error) {
    errorMessage(error);
  } finally {
    button.disabled = false;
  }
});

/* ==========================================
   CONSULTAR Y SINCRONIZAR LA SALA
   ========================================== */

async function openRoom(code) {
  roomCode = code.toUpperCase();

  $("roomCodeTitle").textContent = roomCode;
  $("lobbyCode").textContent = roomCode;

  showRoom();
  await refreshRoom();
  startPolling();
}

async function refreshRoom() {
  if (!roomCode) return;

  const state = await rpc("get_room_state", {
    p_code: roomCode
  });

  roomState = state;
  renderRoom(state);
}

function startPolling() {
  stopPolling();

  // Consulta el estado compartido cada tres segundos.
  pollTimer = setInterval(async () => {
    try {
      await refreshRoom();
    } catch (error) {
      console.error("No se pudo actualizar la investigación:", error);
    }
  }, 3000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/* ==========================================
   ESTADO GENERAL
   ========================================== */

function renderRoom(state) {
  $("roomCodeTitle").textContent = state.code || roomCode;
  $("lobbyCode").textContent = state.code || roomCode;

  const waiting = state.status === "waiting";
  const active = state.status === "active";
  const completed = state.status === "completed";

  $("statusLabel").textContent = waiting
    ? "Esperando al compañero"
    : active
      ? "Investigación en curso"
      : "Caso cerrado";

  $("lobbyPanel").hidden = !waiting;
  $("gamePanel").hidden = !active;
  $("resultsPanel").hidden = !completed;

  renderPlayers(state.players || []);

  if (active || completed) {
    renderSharedEvents(state.events || []);
    renderProposal(state);
  }

  if (completed) {
    stopPolling();
    renderResults(state);
  }
}

function renderPlayers(players) {
  const container = $("playersList");
  container.replaceChildren();

  for (let slot = 1; slot <= 2; slot++) {
    const player = players.find((p) => Number(p.slot) === slot);

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
    name.textContent = player?.nickname || `Detective ${slot}`;

    const role = document.createElement("span");
    role.textContent = player ? "Conectado a la investigación" : "Esperando invitación";

    info.append(name, role);

    const badge = document.createElement("span");
    badge.className = "player-state";
    badge.textContent = player ? "En sala" : "Esperando";

    card.append(avatar, info, badge);
    container.appendChild(card);
  }
}

/* ==========================================
   REGISTRAR ACCIONES COMPARTIDAS
   ========================================== */

async function recordEvent(kind, payload) {
  return rpc("record_room_event", {
    p_code: roomCode,
    p_kind: kind,
    p_payload: payload
  });
}

/* ==========================================
   EXPLORAR EL MUSEO
   ========================================== */

function renderLocations(events) {
  const visited = new Set(
    events
      .filter((e) => e.kind === "visit")
      .map((e) => e.payload.location_id)
  );

  const container = $("locationsGrid");
  container.replaceChildren();

  for (const place of locations) {
    const done = visited.has(place.id);

    const card = document.createElement("article");
    card.className = "location-card" + (done ? " visited" : "");

    const icon = document.createElement("div");
    icon.className = "location-symbol";
    icon.textContent = place.icon;

    const status = document.createElement("span");
    status.className = "location-status";
    status.textContent = done ? "Zona investigada ✓" : "Zona sin explorar";

    const title = document.createElement("h3");
    title.textContent = place.title;

    const description = document.createElement("p");
    description.textContent = place.summary;

    const detail = document.createElement("p");
    detail.textContent = done
      ? place.detail
      : "Examina este lugar para descubrir evidencias.";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "button " + (done ? "button-quiet" : "button-secondary");
    button.textContent = done ? "Ya investigado" : "Investigar lugar";
    button.disabled = done;

    button.addEventListener("click", async () => {
      button.disabled = true;

      try {
        await recordEvent("visit", { location_id: place.id });
        await refreshRoom();
        showMessage("El equipo ha investigado: " + place.title, "success");
      } catch (error) {
        errorMessage(error);
      } finally {
        button.disabled = false;
      }
    });

    card.append(icon, status, title, description, detail, button);
    container.appendChild(card);
  }
}

/* ==========================================
   INTERROGATORIOS COMPARTIDOS
   ========================================== */

function renderInterviews(events) {
  const interviews = events.filter((e) => e.kind === "interview");

  const asked = new Set(
    interviews.map((e) =>
      `${e.payload.suspect_id}:${e.payload.question_id}`
    )
  );

  const container = $("interviewGrid");
  container.replaceChildren();

  for (const suspect of suspects) {
    const card = document.createElement("article");
    card.className = "suspect-card" +
      (interviews.some((e) => e.payload.suspect_id === suspect.id)
        ? " interviewed"
        : "");

    const icon = document.createElement("div");
    icon.className = "suspect-symbol";
    icon.textContent = suspect.icon;

    const meta = document.createElement("div");
    meta.className = "suspect-meta";

    const role = document.createElement("span");
    role.textContent = suspect.role;

    const count = document.createElement("span");
    count.textContent = interviews.filter(
      (e) => e.payload.suspect_id === suspect.id
    ).length + " pregunta(s)";

    meta.append(role, count);

    const title = document.createElement("h3");
    title.textContent = suspect.name;

    const bio = document.createElement("p");
    bio.textContent = suspect.bio;

    const questions = document.createElement("div");
    questions.className = "question-list";

    suspect.questions.forEach((question) => {
      const key = `${suspect.id}:${question.id}`;
      const askedAlready = asked.has(key);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "question-button";
      button.disabled = askedAlready;
      button.textContent = askedAlready
        ? "✓ " + question.label
        : "Preguntar: " + question.label;

      button.addEventListener("click", async () => {
        button.disabled = true;

        try {
          await recordEvent("interview", {
            suspect_id: suspect.id,
            question_id: question.id
          });

          await refreshRoom();
          showMessage(
            "Declaración registrada para los dos detectives.",
            "success"
          );
        } catch (error) {
          errorMessage(error);
        } finally {
          button.disabled = false;
        }
      });

      questions.appendChild(button);
    });

    card.append(icon, meta, title, bio, questions);
    container.appendChild(card);
  }

  renderInterviewFeed(interviews);
}

function renderInterviewFeed(interviews) {
  const container = $("interviewFeed");
  container.replaceChildren();

  const label = document.createElement("span");
  label.className = "feed-label";
  label.textContent = "REGISTRO COMPARTIDO DE DECLARACIONES";
  container.appendChild(label);

  if (!interviews.length) {
    const empty = document.createElement("p");
    empty.textContent = "Todavía no hay interrogatorios.";
    container.appendChild(empty);
    return;
  }

  [...interviews].reverse().forEach((event) => {
    const suspect = suspects.find(
      (s) => s.id === event.payload.suspect_id
    );

    const question = suspect?.questions.find(
      (q) => q.id === event.payload.question_id
    );

    const entry = document.createElement("div");
    entry.className = "interview-entry";

    const title = document.createElement("strong");
    title.textContent =
      (suspect?.name || "Sospechoso") + " · " +
      (question?.label || "Pregunta");

    const response = document.createElement("p");
    response.textContent = "«" + (event.payload.response || question?.response || "") + "»";

    const author = document.createElement("p");
    author.className = "muted-small";
    author.textContent = "Investigado por " + event.nickname;

    entry.append(title, response, author);
    container.appendChild(entry);
  });
}

/* ==========================================
   EVIDENCIAS DESCUBIERTAS
   ========================================== */

function renderEvidence(events) {
  const clueEvents = events.filter((e) => e.kind === "clue");
  const found = new Set(clueEvents.map((e) => e.payload.clue_id));

  // Guardar la selección si ambas pruebas siguen disponibles.
  selectedEvidence = selectedEvidence.filter((id) => found.has(id));

  const container = $("evidenceGrid");
  container.replaceChildren();

  $("clueAnswer").replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = found.size
    ? "Elegir una prueba encontrada..."
    : "Exploren el museo para encontrar pruebas...";
  $("clueAnswer").appendChild(placeholder);

  [...found].forEach((id) => {
    const clue = clues[id];
    if (!clue) return;

    const option = document.createElement("option");
    option.value = id;
    option.textContent = clue.label + " — " + clue.title;
    $("clueAnswer").appendChild(option);

    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "evidence-tile" +
      (selectedEvidence.includes(id) ? " selected" : "");

    const label = document.createElement("span");
    label.className = "clue-label";
    label.textContent = clue.label + " · " + clue.type;

    const title = document.createElement("h3");
    title.textContent = clue.title;

    const description = document.createElement("p");
    description.textContent = clue.description;

    const source = document.createElement("p");
    source.className = "muted-small";

    const discovery = clueEvents.find(
      (event) => event.payload.clue_id === id
    );

    source.textContent = discovery
      ? "Descubierta por " + discovery.nickname
      : "";

    tile.append(label, title, description, source);

    tile.addEventListener("click", () => {
      toggleEvidence(id, found);
    });

    container.appendChild(tile);
  });

  if (!found.size) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent =
      "El tablero está vacío. Exploren lugares o interroguen sospechosos para descubrir pruebas.";
    container.appendChild(empty);
  }

  $("selectedEvidenceLabel").textContent =
    selectedEvidence.length + " de 2 pruebas seleccionadas.";

  $("connectEvidenceButton").disabled =
    selectedEvidence.length !== 2;

  renderConnections(events);
}

function toggleEvidence(id, found) {
  if (!found.has(id)) return;

  if (selectedEvidence.includes(id)) {
    selectedEvidence = selectedEvidence.filter((item) => item !== id);
  } else {
    if (selectedEvidence.length >= 2) {
      selectedEvidence.shift();
    }
    selectedEvidence.push(id);
  }

  renderEvidence(roomState?.events || []);
}

$("connectEvidenceButton").addEventListener("click", async () => {
  if (selectedEvidence.length !== 2) return;

  const [a, b] = [...selectedEvidence].sort();

  $("connectEvidenceButton").disabled = true;

  try {
    await recordEvent("connection", {
      clue_a: a,
      clue_b: b
    });

    selectedEvidence = [];
    await refreshRoom();
    showMessage("Relación añadida al tablero compartido.", "success");
  } catch (error) {
    errorMessage(error);
  } finally {
    $("connectEvidenceButton").disabled = false;
  }
});

function renderConnections(events) {
  const container = $("connectionsList");
  container.replaceChildren();

  const connections = events.filter((e) => e.kind === "connection");

  connections.forEach((event) => {
    const a = clues[event.payload.clue_a];
    const b = clues[event.payload.clue_b];

    const card = document.createElement("article");
    card.className = "deduction-card";

    const title = document.createElement("strong");
    title.textContent =
      (a?.label || "Prueba") + " + " +
      (b?.label || "Prueba") +
      " · Relación descubierta";

    const note = document.createElement("p");
    note.textContent = event.payload.note || "";

    const author = document.createElement("p");
    author.className = "muted-small";
    author.textContent = "Relacionadas por " + event.nickname;

    card.append(title, note, author);
    container.appendChild(card);
  });
}

/* ==========================================
   CHAT ENTRE LOS DETECTIVES
   ========================================== */

function renderChat(events) {
  const container = $("chatMessages");
  container.replaceChildren();

  const messages = events.filter((e) => e.kind === "chat");

  if (!messages.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Todavía no hay mensajes. Comparte tu primera teoría.";
    container.appendChild(empty);
    return;
  }

  const myName = localStorage.getItem("expedienteXNickname") || "";

  messages.forEach((event) => {
    const bubble = document.createElement("article");

    bubble.className = "chat-message" +
      (event.nickname === myName ? " mine" : "");

    const author = document.createElement("strong");
    author.textContent = event.nickname || "Detective";

    const text = document.createElement("p");
    text.textContent = event.payload.message || "";

    const time = document.createElement("time");
    time.textContent = event.created_at
      ? new Date(event.created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        })
      : "";

    bubble.append(author, text, time);
    container.appendChild(bubble);
  });

  container.scrollTop = container.scrollHeight;
}

$("chatForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const input = $("chatInput");
  const message = input.value.trim();

  if (!message || busy) return;

  busy = true;

  const button = event.currentTarget.querySelector("button");
  button.disabled = true;

  try {
    await recordEvent("chat", { message });
    input.value = "";
    await refreshRoom();
  } catch (error) {
    errorMessage(error);
  } finally {
    busy = false;
    button.disabled = false;
  }
});

/* ==========================================
   PROPUESTA Y CONFIRMACION CONJUNTA
   ========================================== */

function renderProposal(state) {
  const proposal = state.proposal;
  const panel = $("proposalPanel");
  const form = $("proposalForm");
  const confirmButton = $("confirmProposalButton");

  panel.hidden = !proposal;

  if (!proposal) {
    form.hidden = false;
    confirmButton.hidden = true;
    return;
  }

  $("proposalTitle").textContent =
    "Acusación de " + (proposal.proposed_by || "un detective");

  $("proposalDetails").textContent =
    "Sospechoso: " +
    (suspectNames[proposal.suspect] || proposal.suspect) +
    ". Método: " +
    (methodNames[proposal.method_answer] || proposal.method_answer) +
    ". Prueba: " +
    (clueNames[proposal.clue] || proposal.clue) +
    ".";

  $("proposalTheory").textContent =
    proposal.theory || "El equipo no añadió una explicación escrita.";

  if (proposal.confirmed) {
    $("proposalStatus").textContent =
      "Acusación confirmada por " +
      (proposal.confirmed_by || "el segundo detective") + ".";
  } else {
    $("proposalStatus").textContent = state.can_confirm
      ? "Revisa la deducción con tu compañero. Si estás de acuerdo, confirma para cerrar el caso."
      : "Tu compañero todavía debe revisar y confirmar la acusación.";
  }

  // El segundo detective puede confirmar; no puede confirmar su propia propuesta.
  confirmButton.hidden = !state.can_confirm || proposal.confirmed;
  form.hidden = Boolean(state.can_confirm);

  // Presentar al otro jugador la cronología propuesta.
  const timeline = proposal.timeline_order || [];

  ["timeline1", "timeline2", "timeline3"].forEach((id, index) => {
    if (timeline[index]) $(id).value = timeline[index];
  });

  if (!Array.from($("clueAnswer").options).some(
    (option) => option.value === proposal.clue
  )) {
    const option = document.createElement("option");
    option.value = proposal.clue;
    option.textContent = clueNames[proposal.clue] || proposal.clue;
    $("clueAnswer").appendChild(option);
  }

  $("suspectAnswer").value = proposal.suspect;
  $("methodAnswer").value = proposal.method_answer;
  $("clueAnswer").value = proposal.clue;
  $("theoryAnswer").value = proposal.theory || "";
}

$("proposalForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (busy) return;

  const timeline = [
    $("timeline1").value,
    $("timeline2").value,
    $("timeline3").value
  ];

  if (timeline.some((value) => !value) ||
      new Set(timeline).size !== 3) {
    showMessage(
      "Seleccionen los tres acontecimientos sin repetirlos.",
      "error"
    );
    return;
  }

  if (!window.confirm(
    "¿Compartir esta acusación con tu compañero para que la revise?"
  )) {
    return;
  }

  busy = true;

  const button = event.currentTarget.querySelector("button");
  button.disabled = true;

  try {
    await rpc("propose_coop_solution", {
      p_code: roomCode,
      p_suspect: $("suspectAnswer").value,
      p_method: $("methodAnswer").value,
      p_clue: $("clueAnswer").value,
      p_timeline: timeline,
      p_theory: $("theoryAnswer").value.trim()
    });

    await refreshRoom();

    showMessage(
      "Acusación compartida. Tu compañero debe revisarla y confirmarla.",
      "success"
    );
  } catch (error) {
    errorMessage(error);
  } finally {
    busy = false;
    button.disabled = false;
  }
});

$("confirmProposalButton").addEventListener("click", async () => {
  if (busy) return;

  if (!window.confirm(
    "¿Confirmas la acusación conjunta y cierras el caso?"
  )) {
    return;
  }

  busy = true;
  $("confirmProposalButton").disabled = true;

  try {
    await rpc("confirm_coop_solution", {
      p_code: roomCode
    });

    await refreshRoom();
  } catch (error) {
    errorMessage(error);
  } finally {
    busy = false;
    $("confirmProposalButton").disabled = false;
  }
});

/* ==========================================
   RESULTADOS DEL EQUIPO
   ========================================== */

function renderResults(state) {
  const proposal = state.proposal || {};
  const solution = state.solution || {};

  $("winnerTitle").textContent = "¡Investigación completada!";
  $("winnerCopy").textContent =
    "Los dos detectives han confirmado la misma resolución.";

  $("solutionTitle").textContent =
    solution.title || "Caso cerrado";

  $("solutionText").textContent =
    solution.explanation || "La resolución está registrada.";

  const score = Number(proposal.total_points || 0);
  $("teamScore").textContent = score + "/100";

  $("teamScoreDetails").textContent =
    "Culpable: " + (proposal.culprit_points || 0) + "/40 · " +
    "Método: " + (proposal.method_points || 0) + "/20 · " +
    "Prueba: " + (proposal.proof_points || 0) + "/25 · " +
    "Cronología: " + (proposal.timeline_points || 0) + "/15.";
}

/* ==========================================
   CODIGO DE INVITACION Y REINICIO DE PANTALLA
   ========================================== */

$("copyCodeButton").addEventListener("click", async () => {
  if (!roomCode) return;

  try {
    await navigator.clipboard.writeText(roomCode);
    showMessage("Código copiado. Envíalo a tu compañero.", "success");
  } catch {
    showMessage("El código de tu sala es " + roomCode, "success");
  }
});

$("newGameButton").addEventListener("click", () => {
  stopPolling();
  roomCode = null;
  roomState = null;
  selectedEvidence = [];

  localStorage.removeItem("expedienteXRoomCode");
  showMessage("", "");
  showSetup();
});

/* ==========================================
   ACTUALIZACION VISUAL DE LAS PRUEBAS
   ========================================== */

function renderSharedEvents(events) {
  renderProgress(events);
  renderLocations(events);
  renderInterviews(events);
  renderEvidence(events);
  renderChat(events);
}

function renderProgress(events) {
  const visits = new Set(
    events.filter((e) => e.kind === "visit")
      .map((e) => e.payload.location_id)
  );

  const cluesFound = new Set(
    events.filter((e) => e.kind === "clue")
      .map((e) => e.payload.clue_id)
  );

  const suspectsAsked = new Set(
    events.filter((e) => e.kind === "interview")
      .map((e) => e.payload.suspect_id)
  );

  const connections = events.filter((e) => e.kind === "connection").length;

  const values = [
    ["Lugares", visits.size + "/3"],
    ["Pruebas", cluesFound.size + "/5"],
    ["Interrogatorios", suspectsAsked.size + "/4"],
    ["Relaciones", String(connections)]
  ];

  const container = $("progressSummary");
  container.replaceChildren();

  values.forEach(([label, value]) => {
    const pill = document.createElement("span");
    pill.className = "progress-pill";

    const strong = document.createElement("strong");
    strong.textContent = value;

    pill.append(strong, document.createTextNode(label));
    container.appendChild(pill);
  });
}

/* ==========================================
   RECUPERAR SALA
   ========================================== */

async function init() {
  try {
    await ensureSession();

    const savedCode =
      localStorage.getItem("expedienteXRoomCode");

    const savedName =
      localStorage.getItem("expedienteXNickname");

    if (savedName) {
      $("createName").value = savedName;
      $("joinName").value = savedName;
    }

    if (savedCode) {
      try {
        await openRoom(savedCode);
      } catch (error) {
        console.warn("No se pudo recuperar la sala anterior:", error);
        showSetup();
      }
    }
  } catch (error) {
    showMessage(
      "No se pudo conectar con Supabase: " + error.message,
      "error"
    );
  }
}

window.addEventListener("beforeunload", stopPolling);
init();
