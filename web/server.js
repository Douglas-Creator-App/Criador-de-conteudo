const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const projectRoot = path.join(root, "..");
const port = Number(process.env.PORT || 4173);
const geminiModel = "gemini-2.5-flash";
const calendarPath = path.join(projectRoot, "config", "calendar.json");
const pipelineStatePath = path.join(projectRoot, "config", "pipeline-state.json");
const boraPostarBase = "https://xxhixkptbggbjqdmebwc.supabase.co/functions/v1/carousel-api";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload, null, 2));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body too large"));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function slugify(value) {
  return String(value || "briefing")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "briefing";
}

function loadConfig() {
  const configPath = path.join(projectRoot, "config", "content-machine-config.json");
  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return {};
  }
}

function saveConfigPatch(patch) {
  const configDir = path.join(projectRoot, "config");
  const configPath = path.join(configDir, "content-machine-config.json");
  const examplePath = path.join(configDir, "content-machine-config.example.json");
  fs.mkdirSync(configDir, { recursive: true });

  let config = {};
  if (fs.existsSync(configPath)) {
    config = loadConfig();
  } else if (fs.existsSync(examplePath)) {
    config = JSON.parse(fs.readFileSync(examplePath, "utf8"));
  }

  const allowedFields = [
    "borapostar_api_key",
    "instagram_username",
    "gemini_api_key",
    "youtube_channel_id",
    "scrapecreators_api_key",
    "apify_token",
  ];

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      config[field] = String(patch[field] || "").trim();
    }
  }

  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return config;
}

function maskSecret(value) {
  if (!value) {
    return "";
  }

  if (value.length <= 8) {
    return "configurada";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function buildBriefingMarkdown(data) {
  return `# Briefing ViralRadar

Status: rascunho
Tema: ${data.topic}
Plataforma: ${data.platform}
Publico: ${data.audience}
Intensidade viral: ${data.viralLevel}/10
Exigir aprovacao: ${data.approvalRequired ? "sim" : "nao"}

## Angulo

${data.angle}

## DNA viral

- Case real: pesquisar e validar fonte
- Estrategia contraintuitiva: mostrar o que o mercado faz errado
- Dado concreto: buscar numero, prova ou benchmark
- Por que alguem compartilharia: utilidade + surpresa + status

## Estrutura sugerida

1. Hook com dado ou contraste forte
2. Contexto do erro comum
3. Virada contraintuitiva
4. Mecanismo pratico
5. Exemplo ou case
6. Licao aplicavel
7. CTA natural

## Proximos passos

- Validar fontes
- Escrever versao final
- Pedir aprovacao
- Gerar/publicar somente apos aprovacao
`;
}

function extractGeminiText(payload) {
  return (payload.candidates || [])
    .flatMap((candidate) => (candidate.content && candidate.content.parts) || [])
    .map((part) => part.text || "")
    .join("\n")
    .trim();
}

async function callGemini(apiKey, prompt) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [
          {
            text: "Voce e o motor de conteudo do ViralRadar. Crie carrosseis em portugues do Brasil com estrategia contraintuitiva, dados a validar, slides curtos e CTA natural. Nunca afirme dado inventado como fato; quando necessario, marque como dado a validar.",
          },
        ],
      },
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.75,
        maxOutputTokens: 2200,
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload.error && payload.error.message ? payload.error.message : "Gemini API error";
    throw new Error(message);
  }

  return extractGeminiText(payload);
}

function buildCarouselPrompt(data) {
  return `Crie um carrossel para o ViralRadar.

Tema: ${data.topic}
Publico: ${data.audience}
Angulo: ${data.angle}
Intensidade viral: ${data.viralLevel}/10

Formato obrigatorio:

# Carrossel

## Slide 1
Hook forte com contraste, dado ou promessa concreta.

## Slide 2
Contexto do erro comum.

## Slide 3
Virada contraintuitiva.

## Slide 4
Mecanismo pratico.

## Slide 5
Case real ou exemplo aplicavel, marcando "validar fonte" se nao houver fonte.

## Slide 6
Licao aplicavel.

## Slide 7
CTA natural.

## Legenda
Legenda com quebras de linha.

## Checklist de validacao
Liste os dados/fatos que precisam ser verificados antes de publicar.`;
}

function titleFromMarkdown(markdown, fileName) {
  const titleMatch = markdown.match(/^Tema:\s*(.+)$/m) || markdown.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  return fileName
    .replace(/^\d{8}-\d{6}-/, "")
    .replace(/\.md$/, "")
    .replace(/-/g, " ");
}

function getOutputItems() {
  const pipelineState = loadPipelineState();
  const outputsDir = path.join(projectRoot, "outputs");
  if (!fs.existsSync(outputsDir)) {
    return [];
  }

  return fs.readdirSync(outputsDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const filePath = path.join(outputsDir, name);
      const stat = fs.statSync(filePath);
      const markdown = fs.readFileSync(filePath, "utf8");
      const isCarousel = name.includes("carousel") || /^# Carrossel/m.test(markdown);
      const statusMatch = markdown.match(/^Status:\s*(.+)$/m);
      const fallbackStatus = statusMatch ? statusMatch[1].trim() : isCarousel ? "gerado" : "rascunho";
      return {
        name,
        title: titleFromMarkdown(markdown, name),
        type: isCarousel ? "Carrossel" : "Briefing",
        status: pipelineState[name] || fallbackStatus,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
        preview: markdown.replace(/\s+/g, " ").trim().slice(0, 160),
      };
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

async function callBoraPostar(apiKey, pathName, options = {}) {
  const response = await fetch(`${boraPostarBase}${pathName}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new Error(payload.error || payload.message || `BoraPostar HTTP ${response.status}`);
  }

  return payload;
}

function loadPipelineState() {
  if (!fs.existsSync(pipelineStatePath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(pipelineStatePath, "utf8"));
  } catch {
    return {};
  }
}

function savePipelineState(state) {
  fs.mkdirSync(path.dirname(pipelineStatePath), { recursive: true });
  fs.writeFileSync(pipelineStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function safeOutputPath(fileName) {
  const outputsDir = path.join(projectRoot, "outputs");
  const safeName = path.basename(String(fileName || ""));
  if (!safeName.endsWith(".md")) {
    return null;
  }
  return path.join(outputsDir, safeName);
}

function loadCalendar() {
  const fallback = [
    ["Seg", "Radar de noticias + 1 carrossel"],
    ["Ter", "LinkedIn opinativo + comentario"],
    ["Qua", "Shorts/Reels com case real"],
    ["Qui", "Carrossel de dado concreto"],
    ["Sex", "Post de bastidor/prova"],
    ["Sab", "Teste de angulo"],
    ["Dom", "Revisao de metricas"],
  ].map(([day, task]) => ({ day, task }));

  if (!fs.existsSync(calendarPath)) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(calendarPath, "utf8"));
    return Array.isArray(parsed.days) ? parsed.days : fallback;
  } catch {
    return fallback;
  }
}

function saveCalendar(days) {
  fs.mkdirSync(path.dirname(calendarPath), { recursive: true });
  const cleanDays = days.map((item) => ({
    day: String(item.day || "").trim().slice(0, 24),
    task: String(item.task || "").trim().slice(0, 240),
  })).filter((item) => item.day);
  fs.writeFileSync(calendarPath, `${JSON.stringify({ days: cleanDays }, null, 2)}\n`, "utf8");
  return cleanDays;
}

async function handleApi(request, response, requestUrl) {
  if (request.method === "GET" && requestUrl.pathname === "/api/status") {
    const config = loadConfig();
    const outputItems = getOutputItems();

    sendJson(response, 200, {
      app: "ViralRadar",
      supabaseProjectRef: "qoveugouqjpmihslaeqk",
      borapostarApiKey: Boolean(config.borapostar_api_key),
      instagramUsername: config.instagram_username || "",
      geminiApiKey: Boolean(config.gemini_api_key),
      geminiApiKeyMasked: maskSecret(config.gemini_api_key),
      apifyToken: Boolean(config.apify_token),
      apifyTokenMasked: maskSecret(config.apify_token),
      outputCount: outputItems.length,
    });
    return true;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/outputs") {
    sendJson(response, 200, { items: getOutputItems() });
    return true;
  }

  if (request.method === "GET" && requestUrl.pathname.startsWith("/api/outputs/")) {
    const fileName = decodeURIComponent(requestUrl.pathname.replace("/api/outputs/", ""));
    const filePath = safeOutputPath(fileName);
    if (!filePath || !fs.existsSync(filePath)) {
      sendJson(response, 404, { error: "Arquivo nao encontrado" });
      return true;
    }

    sendJson(response, 200, {
      name: path.basename(filePath),
      markdown: fs.readFileSync(filePath, "utf8"),
    });
    return true;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/calendar") {
    sendJson(response, 200, { days: loadCalendar() });
    return true;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/calendar") {
    try {
      const payload = JSON.parse(await readBody(request));
      const days = saveCalendar(Array.isArray(payload.days) ? payload.days : []);
      sendJson(response, 200, { saved: true, days });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return true;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/config") {
    try {
      const payload = JSON.parse(await readBody(request));
      const config = saveConfigPatch(payload);
      sendJson(response, 200, {
        saved: true,
        borapostarApiKey: Boolean(config.borapostar_api_key),
        instagramUsername: config.instagram_username || "",
        geminiApiKey: Boolean(config.gemini_api_key),
        geminiApiKeyMasked: maskSecret(config.gemini_api_key),
        apifyToken: Boolean(config.apify_token),
        apifyTokenMasked: maskSecret(config.apify_token),
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return true;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/apify/status") {
    try {
      const config = loadConfig();
      if (!config.apify_token) {
        sendJson(response, 400, { error: "Apify token nao configurado" });
        return true;
      }

      const apifyResponse = await fetch("https://api.apify.com/v2/users/me", {
        headers: { Authorization: `Bearer ${config.apify_token}` },
      });
      const payload = await apifyResponse.json();

      if (!apifyResponse.ok) {
        sendJson(response, apifyResponse.status, { error: payload.error && payload.error.message ? payload.error.message : "Apify API error" });
        return true;
      }

      sendJson(response, 200, {
        connected: true,
        username: payload.data && payload.data.username ? payload.data.username : "",
        email: payload.data && payload.data.email ? payload.data.email : "",
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return true;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/borapostar/list") {
    try {
      const config = loadConfig();
      if (!config.borapostar_api_key) {
        sendJson(response, 400, { error: "BoraPostar API key nao configurada" });
        return true;
      }

      const payload = await callBoraPostar(config.borapostar_api_key, "/agent/listar", { method: "GET" });
      sendJson(response, 200, payload);
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return true;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/borapostar/latest") {
    try {
      const config = loadConfig();
      if (!config.borapostar_api_key) {
        sendJson(response, 400, { error: "BoraPostar API key nao configurada" });
        return true;
      }

      const payload = await callBoraPostar(config.borapostar_api_key, "/agent/ultimo", { method: "GET" });
      sendJson(response, 200, payload);
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return true;
  }

  if (request.method === "PATCH" && requestUrl.pathname.startsWith("/api/outputs/")) {
    try {
      const fileName = decodeURIComponent(requestUrl.pathname.replace("/api/outputs/", ""));
      const filePath = safeOutputPath(fileName);
      if (!filePath || !fs.existsSync(filePath)) {
        sendJson(response, 404, { error: "Arquivo nao encontrado" });
        return true;
      }

      const payload = JSON.parse(await readBody(request));
      const status = String(payload.status || "").trim();
      if (!status) {
        sendJson(response, 400, { error: "Status obrigatorio" });
        return true;
      }

      const state = loadPipelineState();
      state[path.basename(filePath)] = status;
      savePipelineState(state);
      sendJson(response, 200, { saved: true, name: path.basename(filePath), status });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return true;
  }

  if (request.method === "DELETE" && requestUrl.pathname.startsWith("/api/outputs/")) {
    try {
      const fileName = decodeURIComponent(requestUrl.pathname.replace("/api/outputs/", ""));
      const filePath = safeOutputPath(fileName);
      if (!filePath || !fs.existsSync(filePath)) {
        sendJson(response, 404, { error: "Arquivo nao encontrado" });
        return true;
      }

      fs.unlinkSync(filePath);
      const state = loadPipelineState();
      delete state[path.basename(filePath)];
      savePipelineState(state);
      sendJson(response, 200, { deleted: true, name: path.basename(filePath) });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return true;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/briefings") {
    try {
      const payload = JSON.parse(await readBody(request));
      const topic = String(payload.topic || "").trim();
      if (!topic) {
        sendJson(response, 400, { error: "Tema obrigatorio" });
        return true;
      }

      const data = {
        topic,
        platform: String(payload.platform || "Instagram carrossel").trim(),
        audience: String(payload.audience || "creators, agencias e infoprodutores").trim(),
        angle: String(payload.angle || "Case real + estrategia contraintuitiva + dado concreto").trim(),
        viralLevel: Number(payload.viralLevel || 8),
        approvalRequired: payload.approvalRequired !== false,
      };

      const outputsDir = path.join(projectRoot, "outputs");
      fs.mkdirSync(outputsDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
      const fileName = `${stamp}-viralradar-${slugify(topic)}.md`;
      const filePath = path.join(outputsDir, fileName);
      const markdown = buildBriefingMarkdown(data);
      fs.writeFileSync(filePath, markdown, "utf8");

      sendJson(response, 201, {
        fileName,
        filePath,
        markdown,
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return true;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/carousels/generate") {
    try {
      const config = loadConfig();
      if (!config.gemini_api_key) {
        sendJson(response, 400, { error: "Gemini API key nao configurada" });
        return true;
      }

      const payload = JSON.parse(await readBody(request));
      const topic = String(payload.topic || "").trim();
      if (!topic) {
        sendJson(response, 400, { error: "Tema obrigatorio" });
        return true;
      }

      const data = {
        topic,
        audience: String(payload.audience || "creators, agencias e infoprodutores").trim(),
        angle: String(payload.angle || "Case real + estrategia contraintuitiva + dado concreto").trim(),
        viralLevel: Number(payload.viralLevel || 8),
      };

      const markdown = await callGemini(config.gemini_api_key, buildCarouselPrompt(data));
      const outputsDir = path.join(projectRoot, "outputs");
      fs.mkdirSync(outputsDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
      const fileName = `${stamp}-gemini-carousel-${slugify(topic)}.md`;
      const filePath = path.join(outputsDir, fileName);
      fs.writeFileSync(filePath, `${markdown}\n`, "utf8");

      sendJson(response, 201, {
        fileName,
        filePath,
        markdown,
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return true;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/borapostar/generate") {
    try {
      const config = loadConfig();
      if (!config.borapostar_api_key) {
        sendJson(response, 400, { error: "BoraPostar API key nao configurada" });
        return true;
      }

      const payload = JSON.parse(await readBody(request));
      const topic = String(payload.topic || "").trim();
      if (!topic) {
        sendJson(response, 400, { error: "Tema obrigatorio" });
        return true;
      }

      const briefing = buildBriefingMarkdown({
        topic,
        platform: String(payload.platform || "Instagram carrossel"),
        audience: String(payload.audience || "creators, agencias e infoprodutores"),
        angle: String(payload.angle || "Case real + estrategia contraintuitiva + dado concreto"),
        viralLevel: Number(payload.viralLevel || 8),
        approvalRequired: true,
      });

      const result = await callBoraPostar(config.borapostar_api_key, "/agent/gerar", {
        method: "POST",
        body: JSON.stringify({ topic: briefing }),
      });

      sendJson(response, 201, {
        submitted: true,
        result,
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return true;
  }

  return false;
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://localhost:${port}`);

  handleApi(request, response, requestUrl).then((handled) => {
    if (handled) {
      return;
    }

    const safePath = path.normalize(decodeURIComponent(requestUrl.pathname)).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(root, safePath === path.sep || safePath === "/" ? "index.html" : safePath);

    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      response.writeHead(200, {
        "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(data);
    });
  }).catch((error) => {
    sendJson(response, 500, { error: error.message });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`ViralRadar running at http://127.0.0.1:${port}`);
});
