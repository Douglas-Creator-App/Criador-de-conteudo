const trends = [
  {
    title: "IA esta virando departamento, nao ferramenta",
    platform: "instagram",
    score: 94,
    angle: "Todo mundo vende prompt. Empresas grandes estao criando squads inteiros de agentes.",
    tags: ["IA", "operacao", "carrossel"],
  },
  {
    title: "Creators pequenos estao vencendo com formatos feios",
    platform: "tiktok",
    score: 89,
    angle: "Producao polida perdeu espaco para prova real, tela gravada e narrativa crua.",
    tags: ["creator", "shorts", "prova"],
  },
  {
    title: "O novo funil e comentario fixado",
    platform: "youtube",
    score: 86,
    angle: "CTA no video cai. Comentario com contexto e UTM esta capturando clique mais quente.",
    tags: ["youtube", "utm", "conversao"],
  },
  {
    title: "Agencias estao empacotando radar de tendencias",
    platform: "linkedin",
    score: 83,
    angle: "O servico nao e postar. E saber o que postar antes do cliente pedir.",
    tags: ["agencia", "saas", "b2b"],
  },
  {
    title: "Afiliados migraram de oferta para narrativa",
    platform: "instagram",
    score: 81,
    angle: "O produto aparece depois. A historia e o mecanismo fazem o clique parecer inevitavel.",
    tags: ["afiliados", "story", "copy"],
  },
  {
    title: "Shorts longos estao segurando mais retencao",
    platform: "youtube",
    score: 78,
    angle: "Videos de 45-58 segundos dao mais tempo para provar o ponto sem virar tutorial.",
    tags: ["shorts", "retencao", "roteiro"],
  },
];

const state = {
  activeFilter: "all",
  theme: localStorage.getItem("viralradar-theme") || "dark",
  toastTimer: null,
};

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => [...document.querySelectorAll(selector)];

function setTheme(theme) {
  state.theme = theme;
  document.body.classList.toggle("light", theme === "light");
  qs("#themeIcon").textContent = theme === "light" ? "☀" : "☾";
  localStorage.setItem("viralradar-theme", theme);
}

function showToast(message) {
  const toast = qs("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Erro na API local");
  }

  return data;
}

async function refreshStatus() {
  try {
    const status = await apiRequest("/api/status");
    qs("#carouselStatus").textContent = status.geminiApiKey ? "Pronto via Gemini" : "Aguardando Gemini";
    qs("#geminiStatus").textContent = status.geminiApiKey ? status.geminiApiKeyMasked : "Aguardando API key";
    qs("#geminiSavedNote").textContent = status.geminiApiKey
      ? `Gemini salva: ${status.geminiApiKeyMasked}. O campo fica vazio por seguranca.`
      : "Cole a chave e salve. Depois ela fica mascarada por seguranca.";
    qs("#instagramUsername").value = status.instagramUsername || "";
    qs("#draftCount").textContent = String(status.outputCount);
    qs("#supabaseStatus").textContent = status.supabaseProjectRef ? "Conectado" : "Nao conectado";
    qs("#readyCount").textContent = String(status.outputCount);
  } catch (error) {
    showToast(`Status indisponivel: ${error.message}`);
  }
}

async function saveConfig(event) {
  event.preventDefault();

  const geminiKey = qs("#geminiApiKey").value.trim();
  const instagramUsername = qs("#instagramUsername").value.trim();

  try {
    const payload = {};
    if (geminiKey) {
      payload.gemini_api_key = geminiKey;
    }
    payload.instagram_username = instagramUsername;

    const result = await apiRequest("/api/config", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    qs("#geminiApiKey").value = "";
    qs("#geminiStatus").textContent = result.geminiApiKey ? result.geminiApiKeyMasked : "Aguardando API key";
    qs("#geminiSavedNote").textContent = result.geminiApiKey
      ? `Gemini salva: ${result.geminiApiKeyMasked}. O campo fica vazio por seguranca.`
      : "Cole a chave e salve. Depois ela fica mascarada por seguranca.";
    qs("#carouselStatus").textContent = result.borapostarApiKey ? "Configurada" : "Aguardando API key";
    showToast("Configuracao salva localmente.");
  } catch (error) {
    showToast(`Nao consegui salvar: ${error.message}`);
  }
}

function renderTrends() {
  const grid = qs("#trendGrid");
  const items = trends.filter((trend) => state.activeFilter === "all" || trend.platform === state.activeFilter);

  grid.innerHTML = items.map((trend) => `
    <article class="trend-card" data-platform="${trend.platform}">
      <header>
        <h3>${trend.title}</h3>
        <span class="score-pill">${trend.score}</span>
      </header>
      <p>${trend.angle}</p>
      <div class="tag-row">
        <span class="tag">${trend.platform}</span>
        ${trend.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
      </div>
      <div class="card-actions">
        <button class="secondary-button trend-brief-button" data-title="${trend.title}" data-platform="${trend.platform}" data-angle="${trend.angle}" type="button">Criar briefing</button>
      </div>
    </article>
  `).join("");

  qsa(".trend-brief-button").forEach((button) => {
    button.addEventListener("click", () => {
      qs("#briefTopic").value = button.dataset.title;
      qs("#briefPlatform").value = platformLabel(button.dataset.platform);
      qs("#briefAngle").value = button.dataset.angle;
      setView("composer");
      showToast("Tendencia enviada para o briefing.");
    });
  });
}

function platformLabel(platform) {
  const labels = {
    instagram: "Instagram carrossel",
    linkedin: "LinkedIn post",
    youtube: "YouTube Shorts",
    tiktok: "TikTok",
  };

  return labels[platform] || "Instagram carrossel";
}

async function renderPipeline() {
  const board = qs("#pipelineBoard");
  board.innerHTML = `<section class="kanban-column"><h3>Carregando</h3></section>`;

  try {
    const { items } = await apiRequest("/api/outputs");
    const groups = {
      "Briefings": items.filter((item) => item.type === "Briefing"),
      "Carrosseis": items.filter((item) => item.type === "Carrossel"),
      "Aprovacao": items.filter((item) => /aprov/i.test(item.status)),
      "Recentes": items.slice(0, 6),
    };

    board.innerHTML = Object.entries(groups).map(([column, cards]) => `
      <section class="kanban-column">
        <h3>${column}</h3>
        ${cards.length ? cards.map((card) => `
          <article class="pipeline-card">
            <h3>${card.title}</h3>
            <p>${card.preview}</p>
            <div class="tag-row">
              <span class="tag">${card.type}</span>
              <span class="tag">${card.status}</span>
            </div>
            <div class="card-actions">
              <button class="secondary-button view-output-button" data-file="${card.name}" type="button">Visualizar</button>
            </div>
          </article>
        `).join("") : `<p class="empty-column">Nada aqui ainda.</p>`}
      </section>
    `).join("");

    qsa(".view-output-button").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        openOutput(button.dataset.file);
      });
    });
  } catch (error) {
    board.innerHTML = `<section class="kanban-column"><h3>Erro</h3><p class="empty-column">${error.message}</p></section>`;
  }
}

async function renderCalendar() {
  try {
    const { days } = await apiRequest("/api/calendar");
    qs("#calendarGrid").innerHTML = days.map(({ day, task }) => `
      <article class="calendar-day">
        <strong>${day}</strong>
        <textarea data-calendar-day="${day}" aria-label="Agenda de ${day}">${task}</textarea>
      </article>
    `).join("");
  } catch (error) {
    showToast(`Calendario indisponivel: ${error.message}`);
  }
}

async function saveCalendar() {
  const days = qsa("[data-calendar-day]").map((field) => ({
    day: field.dataset.calendarDay,
    task: field.value,
  }));

  try {
    await apiRequest("/api/calendar", {
      method: "POST",
      body: JSON.stringify({ days }),
    });
    showToast("Calendario salvo.");
  } catch (error) {
    showToast(`Nao consegui salvar calendario: ${error.message}`);
  }
}

async function openOutput(fileName) {
  try {
    const output = await apiRequest(`/api/outputs/${encodeURIComponent(fileName)}`);
    qs("#dialogTitle").textContent = output.name;
    qs("#dialogContent").textContent = output.markdown;
    qs("#contentDialog").showModal();
  } catch (error) {
    showToast(`Nao consegui abrir: ${error.message}`);
  }
}

function setView(viewName) {
  qsa(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === viewName));
  qsa(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${viewName}`));
}

async function buildBrief(event) {
  event.preventDefault();

  const topic = qs("#briefTopic").value.trim();
  const platform = qs("#briefPlatform").value;
  const audience = qs("#briefAudience").value.trim() || "creators, agencias e infoprodutores";
  const angle = qs("#briefAngle").value.trim() || "Case real + estrategia contraintuitiva + dado concreto";
  const level = qs("#viralLevel").value;
  const approval = qs("#approvalToggle").checked ? "Sim" : "Nao";

  const preview = `
    <p class="eyebrow">Briefing gerado</p>
    <h3>${topic}</h3>
    <p><strong>Plataforma:</strong> ${platform}</p>
    <p><strong>Publico:</strong> ${audience}</p>
    <p><strong>Angulo:</strong> ${angle}</p>
    <ol>
      <li>Hook com promessa clara e dado concreto.</li>
      <li>Contexto mostrando o erro comum do mercado.</li>
      <li>Virada contraintuitiva com exemplo aplicavel.</li>
      <li>Mecanismo pratico para transformar em conteudo.</li>
      <li>CTA natural com aprovacao antes de gerar/publicar.</li>
    </ol>
    <p><strong>Intensidade viral:</strong> ${level}/10</p>
    <p><strong>Exigir aprovacao:</strong> ${approval}</p>
  `;

  qs("#briefPreview").innerHTML = preview;

  try {
    const result = await apiRequest("/api/briefings", {
      method: "POST",
      body: JSON.stringify({
        topic,
        platform,
        audience,
        angle,
        viralLevel: level,
        approvalRequired: qs("#approvalToggle").checked,
      }),
    });

    qs("#briefPreview").innerHTML = `${preview}<p><strong>Arquivo salvo:</strong> ${result.fileName}</p>`;
    showToast("Briefing salvo em outputs.");
    refreshStatus();
    renderPipeline();
  } catch (error) {
    showToast(`Nao consegui salvar: ${error.message}`);
  }
}

async function generateCarousel() {
  const topic = qs("#briefTopic").value.trim();
  const audience = qs("#briefAudience").value.trim() || "creators, agencias e infoprodutores";
  const angle = qs("#briefAngle").value.trim() || "Case real + estrategia contraintuitiva + dado concreto";
  const viralLevel = qs("#viralLevel").value;

  if (!topic) {
    showToast("Informe um tema antes de gerar o carrossel.");
    setView("composer");
    qs("#briefTopic").focus();
    return;
  }

  const button = qs("#generateCarouselButton");
  button.disabled = true;
  button.textContent = "Gerando...";
  showToast("Gerando carrossel com Gemini.");

  try {
    const result = await apiRequest("/api/carousels/generate", {
      method: "POST",
      body: JSON.stringify({ topic, audience, angle, viralLevel }),
    });

    qs("#briefPreview").innerHTML = `
      <p class="eyebrow">Carrossel gerado</p>
      <h3>${topic}</h3>
      <p><strong>Arquivo salvo:</strong> ${result.fileName}</p>
      <pre class="generated-output">${escapeHtml(result.markdown)}</pre>
      <div class="preview-actions">
        <button class="secondary-button" id="generateCarouselButton" type="button">Gerar outra versao</button>
      </div>
    `;
    qs("#generateCarouselButton").addEventListener("click", generateCarousel);
    showToast("Carrossel salvo em outputs.");
    refreshStatus();
    renderPipeline();
  } catch (error) {
    showToast(`Gemini falhou: ${error.message}`);
  } finally {
    const freshButton = qs("#generateCarouselButton");
    if (freshButton) {
      freshButton.disabled = false;
      if (freshButton.textContent === "Gerando...") {
        freshButton.textContent = "Gerar carrossel com Gemini";
      }
    }
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function drawRadar() {
  const canvas = qs("#radarCanvas");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  let tick = 0;

  function frame() {
    tick += 0.008;
    ctx.clearRect(0, 0, width, height);

    const cx = width * 0.66;
    const cy = height * 0.52;
    const radius = Math.min(width, height) * 0.42;

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#160c06");
    gradient.addColorStop(1, "#2a180e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255, 138, 61, 0.24)";
    ctx.lineWidth = 1;
    for (let ring = 1; ring <= 4; ring += 1) {
      ctx.beginPath();
      ctx.arc(cx, cy, (radius / 4) * ring, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (let spoke = 0; spoke < 12; spoke += 1) {
      const angle = (Math.PI * 2 * spoke) / 12;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      ctx.stroke();
    }

    const sweep = tick * Math.PI * 2;
    const sweepGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    sweepGradient.addColorStop(0, "rgba(255, 138, 61, 0.38)");
    sweepGradient.addColorStop(1, "rgba(255, 138, 61, 0)");
    ctx.fillStyle = sweepGradient;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, sweep - 0.45, sweep);
    ctx.closePath();
    ctx.fill();

    const dots = [
      [0.18, 0.72, "#ff8a3d"],
      [0.48, 0.35, "#ffcc66"],
      [0.73, 0.62, "#5bb7ff"],
      [0.58, 0.78, "#ff6b7a"],
      [0.84, 0.38, "#ff8a3d"],
    ];

    dots.forEach(([x, y, color], index) => {
      const pulse = 2 + Math.sin(tick * 8 + index) * 1.8;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(width * x, height * y, 4 + pulse, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(frame);
  }

  frame();
}

qsa(".nav-item").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

qsa("[data-view-jump]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.viewJump));
});

qsa(".segment").forEach((button) => {
  button.addEventListener("click", () => {
    qsa(".segment").forEach((segment) => segment.classList.remove("active"));
    button.classList.add("active");
    state.activeFilter = button.dataset.filter;
    renderTrends();
  });
});

qs("#briefForm").addEventListener("submit", buildBrief);
qs("#configForm").addEventListener("submit", saveConfig);
qs("#generateCarouselButton").addEventListener("click", generateCarousel);
qs("#themeToggle").addEventListener("click", () => setTheme(state.theme === "dark" ? "light" : "dark"));
qs("#saveCalendarButton").addEventListener("click", saveCalendar);
qs("#closeDialogButton").addEventListener("click", () => qs("#contentDialog").close());

setTheme(state.theme);
renderTrends();
renderPipeline();
renderCalendar();
refreshStatus();
drawRadar();
