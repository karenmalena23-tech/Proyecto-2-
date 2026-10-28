import { createClient } from
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* ==================================================
   EXPEDIENTE X 3.0 — INVESTIGACIÓN COOPERATIVA
   ================================================== */

// Conserva la URL y la clave publicable de tu proyecto.
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
let refreshing = false;

/* ==================================================
   LUGARES DEL MUSEO
   ================================================== */

const locations = [
  {
    id: "gallery",
    icon: "▧",
    title: "Galería principal",
    summary: "La sala donde estaba expuesta La Última Luz.",
    detail:
      "El marco sigue en la pared. No hay cristales rotos. Una cámara fotografió el corredor a las 20:18.",
    clues: ["ev_582"]
  },
  {
    id: "security",
    icon: "⌁",
    title: "Sala de seguridad",
    summary: "Monitores, tarjetas y controles de alarma.",
    detail:
      "El registro muestra un cambio del sensor a las 20:11 y el uso de una tarjeta a las 20:12.",
    clues: ["ev_147", "ev_391"]
  },
  {
    id: "workshop",
    icon: "⚒",
    title: "Taller de restauración",
    summary: "Herramientas y registros del equipo técnico.",
    detail:
      "El libro de préstamos permite reconstruir parte de los movimientos del personal.",
    clues: ["ev_704"]
  }
];

/* ==================================================
   PRUEBAS
   ================================================== */

const clues = {
  ev_391: {
    id: "ev_391",
    label: "PRUEBA A",
    type: "Registro de acceso",
    title: "Una tarjeta fuera de lugar",
    description:
      "A las 20:12 se utilizó la tarjeta de Tomás en la puerta de servicio. El registro confirma el uso, pero no identifica quién llevaba la tarjeta."
  },

  ev_582: {
    id: "ev_582",
    label: "PRUEBA B",
    type: "Fotografía",
    title: "La imagen del vestíbulo",
    description:
      "Una fotografía de las 20:18 muestra a Clara con un portafolio cerca del corredor de restauración. La fotografía no permite ver qué llevaba dentro."
  },

  ev_147: {
    id: "ev_147",
    label: "PRUEBA C",
    type: "Registro de alarma",
    title: "El sensor desactivado",
    description:
      "A las 20:11 el sensor cambió a modo de mantenimiento mediante la cuenta de curaduría."
  },

  ev_263: {
    id: "ev_263",
    label: "PRUEBA D",
    type: "Videollamada",
    title: "La coartada de Inés",
    description:
      "Inés aparece en una videollamada entre las 20:05 y las 20:24, pero la grabación no confirma su ubicación física."
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

/* ==================================================
   SOSPECHOSOS E INTERROGATORIOS
   ================================================== */

const suspects = [
  {
    id: "ines",
    name: "Inés Vega",
    role: "Curadora",
    icon: "♙",
    bio:
      "Conoce los horarios del museo y tiene acceso a la consola de curaduría.",

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
    bio:
      "Conoce las entradas de servicio y las tarjetas de acceso.",

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
    bio:
      "Se quedó tomando fotografías tras el cierre de la exposición.",

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
    bio:
      "Trabaja con obras de arte y materiales de protección.",

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
          "No tengo una cuenta para la consola. Puedo trabajar con la obra, pero no cambiar el sensor."
      }
    ]
  }
];

const suspectNames = Object.fromEntries(
  suspects.map((suspect) => [
    suspect.id,
    suspect.name
  ])
);

const methodNames = {
  alarm_disabled:
    "Desactivó el sensor con la cuenta de curaduría",

  borrowed_keycard:
    "Usó una tarjeta de acceso ajena",

  window_entry:
    "Entró por una ventana",

  painting_swap:
    "Sustituyó la pintura antes del cierre"
};

const clueNames = Object.fromEntries(
  Object.values(clues).map((clue) => [
    clue.id,
    clue.title
  ])
);

/* ==================================================
   RELACIONES ENTRE PRUEBAS
   ================================================== */

const deductionNotes = {
  "ev_147|ev_263": {
    title: "Coartada bajo revisión",
    text:
      "La videollamada demuestra que Inés participó en una llamada, pero no confirma dónde estaba físicamente. Comparen la coartada con el registro del sensor."
  },

  "ev_147|ev_391": {
    title: "Dos minutos decisivos",
    text:
      "El sensor cambió de modo a las 20:11 y una tarjeta se utilizó a las 20:12. El registro de acceso no identifica quién llevaba la tarjeta."
  },

  "ev_391|ev_582": {
    title: "La cámara no cuenta toda la historia",
    text:
      "La tarjeta se utilizó antes de la fotografía. La imagen no demuestra que Clara transportara la pintura."
  },

  "ev_147|ev_582": {
    title: "Oportunidad y pruebas",
    text:
      "La fotografía sitúa a Clara en el corredor, pero no demuestra que tuviera acceso al sistema de alarma."
  },

  "ev_263|ev_391": {
    title: "Dos coartadas incompletas",
    text:
      "La videollamada y el registro de la tarjeta aportan indicios, pero ninguno identifica por sí solo al responsable."
  },

  "ev_263|ev_704": {
    title: "El registro del taller",
    text:
      "La devolución del estuche ocurrió antes de la videollamada. La cronología ayuda a ordenar los hechos, pero no demuestra culpabilidad."
  },

  "ev_391|ev_704": {
    title: "Material y acceso",
    text:
      "El estuche se devolvió antes del uso de la tarjeta. La secuencia temporal no demuestra que Bruno utilizara la tarjeta."
  },

  "ev_582|ev_704": {
    title: "El corredor de restauración",
    text:
      "La fotografía y el libro del taller aportan información sobre los movimientos del personal, pero no identifican por sí solos al responsable."
  },

  "ev_147|ev_704": {
    title: "Acceso y material",
    text:
      "El registro del sensor y el registro del taller se refieren a personas y sistemas diferentes. Comparen quién tenía acceso a cada uno."
  }
};

/* ==================================================
   ERRORES Y MENSAJES
   ================================================== */

function showMessage(message, type = "") {
  const element = $("roomMessage");

  element.textContent = message || "";
  element.className = "message";

  if (type) {
    element.classList.add(type);
  }
}

function errorMessage(error) {
  const parts = [
    error?.message,
    error?.details,
    error?.hint,
    error?.code ? `Código: ${error.code}` : ""
  ].filter(Boolean);

  let message = parts.join(" | ");

  if (!message) {
    try {
      message = JSON.stringify(error);
    } catch {
      message = String(error);
    }
  }

  showMessage(
    message || "Ocurrió un error desconocido.",
    "error"
  );

  console.error("Expediente X:", error);
}

/* ==================================================
   CONEXIÓN CON SUPABASE
   ================================================== */

async function ensureSession() {
  const {
    data,
    error
  } = await db.auth.getSession();

  if (error) {
    throw error;
  }

  if (data.session) {
    return data.session;
  }

  const {
    data: result,
    error: signInError
  } = await db.auth.signInAnonymously();

  if (signInError) {
    throw signInError;
  }

  return result.session;
}

async function rpc(functionName, args) {
  await ensureSession();

  const {
    data,
    error
  } = await db.rpc(functionName, args);

  if (error) {
    throw error;
  }

  return data;
}

function saveRoom(code, nickname) {
  roomCode = code.toUpperCase();

  localStorage.setItem(
    "expedienteXRoomCode",
    roomCode
  );

  if (nickname) {
    localStorage.setItem(
      "expedienteXNickname",
      nickname
    );
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

/* ==================================================
   CREAR SALA
   ================================================== */

$("createForm").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const name = $("createName").value.trim();

    if (name.length < 2 || name.length > 20) {
      showMessage(
        "El nombre debe tener entre 2 y 20 caracteres.",
        "error"
      );
      return;
    }

    const button =
      event.currentTarget.querySelector("button");

    button.disabled = true;
    showMessage("Creando la sala...", "");

    try {
      const result = await rpc("create_room", {
        p_nickname: name
      });

      if (!result?.code) {
        throw new Error(
          "No se recibió el código de la sala."
        );
      }

      saveRoom(result.code, name);

      await openRoom(result.code);

      showMessage(
        "Sala creada. Comparte el código con tu compañero.",
        "success"
      );
    } catch (error) {
      errorMessage(error);
    } finally {
      button.disabled = false;
    }
  }
);

/* ==================================================
   UNIRSE A SALA
   ================================================== */

$("joinForm").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const name = $("joinName").value.trim();
    const code = $("joinCode")
      .value.trim()
      .toUpperCase();

    if (name.length < 2 || name.length > 20) {
      showMessage(
        "El nombre debe tener entre 2 y 20 caracteres.",
        "error"
      );
      return;
    }

    if (!/^[A-Z0-9]{8}$/.test(code)) {
      showMessage(
        "El código debe tener exactamente ocho letras o números.",
        "error"
      );
      return;
    }

    const button =
      event.currentTarget.querySelector("button");

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
  }
);

/* ==================================================
   ABRIR Y ACTUALIZAR SALA
   ================================================== */

async function openRoom(code) {
  roomCode = code.toUpperCase();

  $("roomCodeTitle").textContent = roomCode;
  $("lobbyCode").textContent = roomCode;

  showRoom();

  await refreshRoom();

  startPolling();
}

async function refreshRoom() {
  if (!roomCode || refreshing) {
    return;
  }

  refreshing = true;

  try {
    const state = await rpc(
      "get_room_state",
      {
        p_code: roomCode
      }
    );

    roomState = state;

    renderRoom(state);
  } finally {
    refreshing = false;
  }
}

function startPolling() {
  stopPolling();

  // Actualiza la investigación cada dos segundos.
  pollTimer = setInterval(async () => {
    try {
      await refreshRoom();
    } catch (error) {
      console.error(
        "No se pudo sincronizar la investigación:",
        error
      );
    }
  }, 2000);
}

function stopPolling() {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/* ==================================================
   DIBUJAR LA SALA
   ================================================== */

function renderRoom(state) {
  $("roomCodeTitle").textContent =
    state.code || roomCode;

  $("lobbyCode").textContent =
    state.code || roomCode;

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

/* ==================================================
   JUGADORES CONECTADOS
   ================================================== */

function renderPlayers(players) {
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
    name.textContent =
      player?.nickname || `Detective ${slot}`;

    const role = document.createElement("span");
    role.textContent = player
      ? "Conectado a la investigación"
      : "Esperando invitación";

    info.append(name, role);

    const badge = document.createElement("span");
    badge.className = "player-state";
    badge.textContent = player
      ? "En sala"
      : "Esperando";

    card.append(avatar, info, badge);

    container.appendChild(card);
  }
}

/* ==================================================
   GUARDAR UNA ACCIÓN COMPARTIDA
   ================================================== */

async function recordEvent(kind, payload) {
  return rpc(
    "record_room_event",
    {
      p_code: roomCode,
      p_kind: kind,
      p_payload: payload
    }
  );
}

/* ==================================================
   CONTADORES DE INVESTIGACIÓN
   ================================================== */

function renderProgress(events) {
  const visits = new Set(
    events
      .filter((event) => event.kind === "visit")
      .map((event) => event.payload.location_id)
  );

  const found = new Set(
    events
      .filter((event) => event.kind === "clue")
      .map((event) => event.payload.clue_id)
  );

  const interviewed = new Set(
    events
      .filter((event) => event.kind === "interview")
      .map((event) => event.payload.suspect_id)
  );

  const connections = events.filter(
    (event) => event.kind === "connection"
  ).length;

  const items = [
    ["Lugares", `${visits.size}/3`],
    ["Pruebas", `${found.size}/5`],
    ["Interrogatorios", `${interviewed.size}/4`],
    ["Relaciones", String(connections)]
  ];

  const container = $("progressSummary");
  container.replaceChildren();

  items.forEach(([label, value]) => {
    const pill = document.createElement("span");
    pill.className = "progress-pill";

    const strong = document.createElement("strong");
    strong.textContent = value;

    pill.append(
      strong,
      document.createTextNode(label)
    );

    container.appendChild(pill);
  });
}

/* ==================================================
   EXPLORAR LUGARES
   ================================================== */

function renderLocations(events) {
  const visited = new Set(
    events
      .filter((event) => event.kind === "visit")
      .map((event) => event.payload.location_id)
  );

  const container = $("locationsGrid");
  container.replaceChildren();

  for (const place of locations) {
    const done = visited.has(place.id);

    const card = document.createElement("article");
    card.className =
      "location-card" + (done ? " visited" : "");

    const icon = document.createElement("div");
    icon.className = "location-symbol";
    icon.textContent = place.icon;

    const status = document.createElement("span");
    status.className = "location-status";
    status.textContent = done
      ? "Zona investigada ✓"
      : "Zona sin explorar";

    const title = document.createElement("h3");
    title.textContent = place.title;

    const summary = document.createElement("p");
    summary.textContent = place.summary;

    const detail = document.createElement("p");
    detail.textContent = done
      ? place.detail
      : "Investiga este lugar para descubrir nuevas evidencias.";

    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "button " +
      (done ? "button-quiet" : "button-secondary");

    button.textContent = done
      ? "Ya investigado"
      : "Investigar lugar";

    button.disabled = done;

    button.addEventListener("click", async () => {
      button.disabled = true;

      try {
        await recordEvent(
          "visit",
          { location_id: place.id }
        );

        await refreshRoom();

        showMessage(
          `El equipo investigó: ${place.title}. Revisa las nuevas pistas.`,
          "success"
        );
      } catch (error) {
        errorMessage(error);
      } finally {
        button.disabled = false;
      }
    });

    card.append(
      icon,
      status,
      title,
      summary,
      detail,
      button
    );

    container.appendChild(card);
  }
}

/* ==================================================
   INTERROGAR SOSPECHOSOS
   ================================================== */

function renderInterviews(events) {
  const interviews = events.filter(
    (event) => event.kind === "interview"
  );

  const asked = new Set(
    interviews.map((event) =>
      `${event.payload.suspect_id}:${event.payload.question_id}`
    )
  );

  const container = $("interviewGrid");
  container.replaceChildren();

  for (const suspect of suspects) {
    const suspectInterviews = interviews.filter(
      (event) =>
        event.payload.suspect_id === suspect.id
    );

    const card = document.createElement("article");

    card.className =
      "suspect-card" +
      (suspectInterviews.length ? " interviewed" : "");

    const icon = document.createElement("div");
    icon.className = "suspect-symbol";
    icon.textContent = suspect.icon;

    const meta = document.createElement("div");
    meta.className = "suspect-meta";

    const role = document.createElement("span");
    role.textContent = suspect.role;

    const count = document.createElement("span");
    count.textContent =
      `${suspectInterviews.length} pregunta(s)`;

    meta.append(role, count);

    const title = document.createElement("h3");
    title.textContent = suspect.name;

    const bio = document.createElement("p");
    bio.textContent = suspect.bio;

    const questionList = document.createElement("div");
    questionList.className = "question-list";

    suspect.questions.forEach((question) => {
      const key =
        `${suspect.id}:${question.id}`;

      const alreadyAsked = asked.has(key);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "question-button";
      button.disabled = alreadyAsked;

      button.textContent = alreadyAsked
        ? "✓ " + question.label
        : "Preguntar: " + question.label;

      button.addEventListener("click", async () => {
        button.disabled = true;

        try {
          await recordEvent(
            "interview",
            {
              suspect_id: suspect.id,
              question_id: question.id
            }
          );

          await refreshRoom();

          showMessage(
            `Declaración de ${suspect.name} guardada para el equipo.`,
            "success"
          );
        } catch (error) {
          errorMessage(error);
        } finally {
          button.disabled = false;
        }
      });

      questionList.appendChild(button);
    });

    card.append(
      icon,
      meta,
      title,
      bio,
      questionList
    );

    container.appendChild(card);
  }

  renderInterviewFeed(interviews);
}

function renderInterviewFeed(interviews) {
  const container = $("interviewFeed");
  container.replaceChildren();

  const label = document.createElement("span");
  label.className = "feed-label";
  label.textContent =
    "REGISTRO COMPARTIDO DE DECLARACIONES";

  container.appendChild(label);

  if (!interviews.length) {
    const empty = document.createElement("p");
    empty.textContent =
      "Todavía no hay interrogatorios. Elijan una pregunta para empezar.";

    container.appendChild(empty);
    return;
  }

  [...interviews].reverse().forEach((event) => {
    const suspect = suspects.find(
      (item) => item.id === event.payload.suspect_id
    );

    const question = suspect?.questions.find(
      (item) => item.id === event.payload.question_id
    );

    const entry = document.createElement("div");
    entry.className = "interview-entry";

    const title = document.createElement("strong");

    title.textContent =
      `${suspect?.name || "Sospechoso"} · ` +
      `${question?.label || "Pregunta"}`;

    const response = document.createElement("p");

    response.textContent =
      "«" +
      (event.payload.response || question?.response || "") +
      "»";

    const author = document.createElement("p");
    author.className = "muted-small";
    author.textContent =
      "Investigado por " + event.nickname;

    entry.append(title, response, author);
    container.appendChild(entry);
  });
}

/* ==================================================
   TABLERO DE EVIDENCIAS
   ================================================== */

function renderEvidence(events) {
  const clueEvents = events.filter(
    (event) => event.kind === "clue"
  );

  const found = new Set(
    clueEvents.map((event) => event.payload.clue_id)
  );

  // Guardar la selección antes de reconstruir el menú.
  const previousClue = $("clueAnswer").value;

  selectedEvidence = selectedEvidence.filter(
    (id) => found.has(id)
  );

  const container = $("evidenceGrid");
  container.replaceChildren();

  const select = $("clueAnswer");
  select.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = found.size
    ? "Elegir una prueba encontrada..."
    : "Exploren el museo para encontrar pruebas...";

  select.appendChild(placeholder);

  [...found].forEach((id) => {
    const clue = clues[id];

    if (!clue) return;

    const option = document.createElement("option");
    option.value = id;
    option.textContent =
      `${clue.label} — ${clue.title}`;

    select.appendChild(option);

    const tile = document.createElement("button");
    tile.type = "button";

    tile.className =
      "evidence-tile" +
      (selectedEvidence.includes(id) ? " selected" : "");

    const label = document.createElement("span");
    label.className = "clue-label";
    label.textContent = `${clue.label} · ${clue.type}`;

    const title = document.createElement("h3");
    title.textContent = clue.title;

    const description = document.createElement("p");
    description.textContent = clue.description;

    const discovery = clueEvents.find(
      (event) => event.payload.clue_id === id
    );

    const source = document.createElement("p");
    source.className = "muted-small";
    source.textContent = discovery
      ? `Descubierta por ${discovery.nickname}`
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
      "El tablero está vacío. Exploren el museo o interroguen sospechosos para encontrar pruebas.";

    container.appendChild(empty);
  }

  // Restaurar la prueba seleccionada durante las actualizaciones.
  if (found.has(previousClue)) {
    select.value = previousClue;
  }

  $("selectedEvidenceLabel").textContent =
    `${selectedEvidence.length} de 2 pruebas seleccionadas.`;

  $("connectEvidenceButton").disabled =
    selectedEvidence.length !== 2;

  renderConnections(events);
}

function toggleEvidence(id, found) {
  if (!found.has(id)) return;

  if (selectedEvidence.includes(id)) {
    selectedEvidence = selectedEvidence.filter(
      (item) => item !== id
    );
  } else {
    if (selectedEvidence.length >= 2) {
      selectedEvidence.shift();
    }

    selectedEvidence.push(id);
  }

  renderEvidence(roomState?.events || []);
}

/* ==================================================
   RELACIONAR PRUEBAS
   ================================================== */

$("connectEvidenceButton").addEventListener(
  "click",
  async () => {
    if (selectedEvidence.length !== 2 || busy) {
      return;
    }

    const [clueA, clueB] =
      [...selectedEvidence].sort();

    const button = $("connectEvidenceButton");
    button.disabled = true;

    busy = true;

    try {
      await recordEvent(
        "connection",
        {
          clue_a: clueA,
          clue_b: clueB
        }
      );

      selectedEvidence = [];

      await refreshRoom();

      showMessage(
        "Las dos pruebas se relacionaron en el tablero compartido.",
        "success"
      );
    } catch (error) {
      errorMessage(error);
    } finally {
      busy = false;
      button.disabled = false;
    }
  }
);

function renderConnections(events) {
  const container = $("connectionsList");
  container.replaceChildren();

  const connections = events.filter(
    (event) => event.kind === "connection"
  );

  connections.forEach((event) => {
    const clueA = clues[event.payload.clue_a];
    const clueB = clues[event.payload.clue_b];

    const pair = [
      event.payload.clue_a,
      event.payload.clue_b
    ].sort();

    const key = pair.join("|");
    const note = deductionNotes[key];

    const card = document.createElement("article");
    card.className = "deduction-card";

    const title = document.createElement("strong");

    title.textContent =
      `${clueA?.label || "Prueba"} + ` +
      `${clueB?.label || "Prueba"} · ` +
      (note?.title || "Relación descubierta");

    const text = document.createElement("p");
    text.textContent =
      note?.text ||
      event.payload.note ||
      "Comparen los horarios y los detalles de ambas pruebas.";

    const author = document.createElement("p");
    author.className = "muted-small";
    author.textContent =
      "Relacionadas por " + event.nickname;

    card.append(title, text, author);
    container.appendChild(card);
  });
}

/* ==================================================
   CHAT ENTRE DETECTIVES
   ================================================== */

function renderChat(events) {
  const container = $("chatMessages");
  container.replaceChildren();

  const messages = events.filter(
    (event) => event.kind === "chat"
  );

  if (!messages.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent =
      "Todavía no hay mensajes. Comparte tu primera teoría.";

    container.appendChild(empty);
    return;
  }

  const myName =
    localStorage.getItem("expedienteXNickname") || "";

  messages.forEach((event) => {
    const bubble = document.createElement("article");

    bubble.className =
      "chat-message" +
      (event.nickname === myName ? " mine" : "");

    const author = document.createElement("strong");
    author.textContent = event.nickname || "Detective";

    const text = document.createElement("p");
    text.textContent = event.payload.message || "";

    const time = document.createElement("time");
    time.textContent = event.created_at
      ? new Date(event.created_at).toLocaleTimeString(
          [],
          {
            hour: "2-digit",
            minute: "2-digit"
          }
        )
      : "";

    bubble.append(author, text, time);
    container.appendChild(bubble);
  });

  container.scrollTop = container.scrollHeight;
}

$("chatForm").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    if (busy) return;

    const input = $("chatInput");
    const message = input.value.trim();

    if (!message) return;

    busy = true;

    const button =
      event.currentTarget.querySelector("button");

    button.disabled = true;

    try {
      await recordEvent(
        "chat",
        { message }
      );

      input.value = "";

      await refreshRoom();
    } catch (error) {
      errorMessage(error);
    } finally {
      busy = false;
      button.disabled = false;
    }
  }
);

/* ==================================================
   CRONOLOGÍA
   ================================================== */

function getTimeline() {
  return [
    $("timeline1").value,
    $("timeline2").value,
    $("timeline3").value
  ];
}

function validateTimeline() {
  const timeline = getTimeline();

  if (timeline.some((item) => !item)) {
    showMessage(
      "Completen los tres acontecimientos de la cronología.",
      "error"
    );
    return false;
  }

  if (new Set(timeline).size !== 3) {
    showMessage(
      "No pueden repetir acontecimientos en la cronología.",
      "error"
    );
    return false;
  }

  return true;
}

/* ==================================================
   PROPUESTA DE ACUSACIÓN CONJUNTA
   ================================================== */

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

  // Una vez propuesta, ambos ven la misma acusación.
  // El segundo jugador puede confirmarla.
  form.hidden = true;

  $("proposalTitle").textContent =
    "Acusación propuesta por " +
    (proposal.proposed_by || "un detective");

  $("proposalDetails").textContent =
    "Sospechoso: " +
    (suspectNames[proposal.suspect] || proposal.suspect) +
    ". Método: " +
    (methodNames[proposal.method_answer] ||
      proposal.method_answer) +
    ". Prueba decisiva: " +
    (clueNames[proposal.clue] || proposal.clue) +
    ".";

  $("proposalTheory").textContent =
    proposal.theory ||
    "El equipo no ha añadido una explicación escrita.";

  if (proposal.confirmed) {
    $("proposalStatus").textContent =
      "Acusación confirmada. El caso está cerrado.";
  } else if (state.can_confirm) {
    $("proposalStatus").textContent =
      "Revisa esta deducción. Si estás de acuerdo, confirma para revelar los resultados.";
  } else {
    $("proposalStatus").textContent =
      "Esperando a que el otro detective revise y confirme la acusación.";
  }

  confirmButton.hidden =
    !state.can_confirm || proposal.confirmed;

  // Mostrar la propuesta en los selectores como referencia.
  const timeline = proposal.timeline_order || [];

  [
    "timeline1",
    "timeline2",
    "timeline3"
  ].forEach((id, index) => {
    if (timeline[index]) {
      $(id).value = timeline[index];
    }
  });

  if (
    !Array.from($("clueAnswer").options).some(
      (option) => option.value === proposal.clue
    )
  ) {
    const option = document.createElement("option");

    option.value = proposal.clue;
    option.textContent =
      clueNames[proposal.clue] || proposal.clue;

    $("clueAnswer").appendChild(option);
  }

  $("suspectAnswer").value = proposal.suspect;
  $("methodAnswer").value = proposal.method_answer;
  $("clueAnswer").value = proposal.clue;
  $("theoryAnswer").value = proposal.theory || "";
}

$("proposalForm").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    if (busy) return;

    const suspect = $("suspectAnswer").value;
    const method = $("methodAnswer").value;
    const clue = $("clueAnswer").value;
    const theory = $("theoryAnswer").value.trim();

    if (!suspect || !method || !clue) {
      showMessage(
        "Seleccionen el sospechoso, el método y la prueba decisiva.",
        "error"
      );
      return;
    }

    if (!validateTimeline()) {
      return;
    }

    const confirmed = window.confirm(
      "¿Compartir esta propuesta con tu compañero para que la revise?"
    );

    if (!confirmed) return;

    busy = true;

    const button =
      event.currentTarget.querySelector("button");

    button.disabled = true;

    try {
      await rpc(
        "propose_coop_solution",
        {
          p_code: roomCode,
          p_suspect: suspect,
          p_method: method,
          p_clue: clue,
          p_timeline: getTimeline(),
          p_theory: theory
        }
      );

      await refreshRoom();

      showMessage(
        "La acusación se ha compartido. Tu compañero debe revisarla.",
        "success"
      );
    } catch (error) {
      errorMessage(error);
    } finally {
      busy = false;
      button.disabled = false;
    }
  }
);

/* ==================================================
   CONFIRMAR LA ACUSACIÓN
   ================================================== */

$("confirmProposalButton").addEventListener(
  "click",
  async () => {
    if (busy) return;

    const confirmed = window.confirm(
      "¿Confirmas la acusación conjunta y cierras el caso?"
    );

    if (!confirmed) return;

    busy = true;

    const button = $("confirmProposalButton");
    button.disabled = true;

    try {
      await rpc(
        "confirm_coop_solution",
        {
          p_code: roomCode
        }
      );

      await refreshRoom();

      showMessage(
        "Caso cerrado. La puntuación del equipo está disponible.",
        "success"
      );
    } catch (error) {
      errorMessage(error);
    } finally {
      busy = false;
      button.disabled = false;
    }
  }
);

/* ==================================================
   RESULTADOS FINALES
   ================================================== */

function renderResults(state) {
  const proposal = state.proposal || {};
  const solution = state.solution || {};

  $("winnerTitle").textContent =
    "¡Investigación completada!";

  $("winnerCopy").textContent =
    "Los dos detectives han confirmado la resolución conjunta.";

  $("solutionTitle").textContent =
    solution.title || "Caso cerrado";

  $("solutionText").textContent =
    solution.explanation ||
    "La solución oficial está registrada.";

  const score = Number(proposal.total_points || 0);

  $("teamScore").textContent =
    score + "/100";

  $("teamScoreDetails").textContent =
    "Culpable: " +
    Number(proposal.culprit_points || 0) +
    "/40 · Método: " +
    Number(proposal.method_points || 0) +
    "/20 · Prueba: " +
    Number(proposal.proof_points || 0) +
    "/25 · Cronología: " +
    Number(proposal.timeline_points || 0) +
    "/15.";
}

/* ==================================================
   EVENTOS COMPARTIDOS
   ================================================== */

function renderSharedEvents(events) {
  renderProgress(events);
  renderLocations(events);
  renderInterviews(events);
  renderEvidence(events);
  renderChat(events);
}

/* ==================================================
   COPIAR CÓDIGO
   ================================================== */

$("copyCodeButton").addEventListener(
  "click",
  async () => {
    if (!roomCode) return;

    try {
      await navigator.clipboard.writeText(roomCode);

      showMessage(
        "Código copiado. Envíalo a tu compañero.",
        "success"
      );
    } catch {
      showMessage(
        "El código de tu sala es: " + roomCode,
        "success"
      );
    }
  }
);

/* ==================================================
   VOLVER AL INICIO
   ================================================== */

$("newGameButton").addEventListener(
  "click",
  () => {
    stopPolling();

    roomCode = null;
    roomState = null;
    selectedEvidence = [];

    localStorage.removeItem(
      "expedienteXRoomCode"
    );

    $("createForm").reset();
    $("joinForm").reset();

    showMessage("", "");
    showSetup();
  }
);

/* ==================================================
   INICIO Y RECUPERACIÓN DE LA SALA
   ================================================== */

async function init() {
  try {
    await ensureSession();

    const savedCode = localStorage.getItem(
      "expedienteXRoomCode"
    );

    const savedName = localStorage.getItem(
      "expedienteXNickname"
    );

    if (savedName) {
      $("createName").value = savedName;
      $("joinName").value = savedName;
    }

    if (savedCode) {
      try {
        await openRoom(savedCode);
      } catch (error) {
        console.warn(
          "No se pudo recuperar la sala anterior:",
          error
        );

        localStorage.removeItem(
          "expedienteXRoomCode"
        );

        roomCode = null;
        showSetup();
      }
    }
  } catch (error) {
    errorMessage(error);
  }
}

window.addEventListener(
  "beforeunload",
  stopPolling
);

init();
