const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const projectRoot = path.join(root, "..");
const port = Number(process.env.PORT || 4173);

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
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
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

async function handleApi(request, response, requestUrl) {
  if (request.method === "GET" && requestUrl.pathname === "/api/status") {
    const config = loadConfig();
    const outputsDir = path.join(projectRoot, "outputs");
    const outputFiles = fs.existsSync(outputsDir)
      ? fs.readdirSync(outputsDir).filter((name) => name.endsWith(".md"))
      : [];

    sendJson(response, 200, {
      app: "ViralRadar",
      supabaseProjectRef: "qoveugouqjpmihslaeqk",
      borapostarApiKey: Boolean(config.borapostar_api_key),
      instagramUsername: config.instagram_username || "",
      geminiApiKey: Boolean(config.gemini_api_key),
      geminiApiKeyMasked: maskSecret(config.gemini_api_key),
      outputCount: outputFiles.length,
    });
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
      });
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

      response.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream" });
      response.end(data);
    });
  }).catch((error) => {
    sendJson(response, 500, { error: error.message });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`ViralRadar running at http://127.0.0.1:${port}`);
});
