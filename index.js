//Librerias
const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GITHUB_SECRET = process.env.GITHUB_SECRET || "";
const WHATSAPP_CHAT_ID = process.env.WHATSAPP_CHAT_ID || "";

//Conexión de hatsapp
let whatsappClient = null;
//Bandera para saber si Whatsapp esta conectado y listo
let isWhatsAppReady = false;

function initWhatsApp() {
  console.log("\nInicializando WhatsApp Web...\n");
  //CLiente de whatsapp
  whatsappClient = new Client({
    //LocalAuth guarda la sesión de Whatsapp
    authStrategy: new LocalAuth({
      dataPath: "./whatsapp-session", //Carpeta donde se guarda la sesión
    }),

    //Tener un navegador invisible
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    },
  });

  //Eventos de Whatsapp
  whatsappClient.on("qr", (qr) => {
    console.log("📱 ¡ESCANEA ESTE QR!");
    qrcode.generate(qr, { small: true }); //Generación del QR
    console.log("\nPASOS PARA CONECTAR:");
    console.log("1. Abre WhatsApp en tu teléfono");
    console.log("2. Toca Menú (⋮) → Dispositivos vinculados");
    console.log('3. Toca "Vincular un dispositivo"');
    console.log("4. Escanea el QR de arriba\n");
  });

  whatsappClient.on("ready", () => {
    console.log("¡WhatsApp conectado exitosamente!");
    console.log("El bot está listo para recibir webhooks\n");
    isWhatsAppReady = true;
  });

  whatsappClient.on("authenticated", () => {
    console.log("Sesión de WhatsApp autenticada");
  });

  whatsappClient.on("auth_failure", (error) => {
    console.error("Error de autenticación:", error);
  });

  whatsappClient.on("disconnected", (reason) => {
    console.log("Desconectado:", reason);
    isWhatsAppReady = false;
  });

  //Envio de mensajes con Whatsapp
  async function sendWhatsAppMessage(message, chatId = WHATSAPP_CHAT_ID) {
    // Verificar que WhatsApp esté conectado
    if (!isWhatsAppReady) {
      console.error("WhatsApp no está listo. Espera a que se conecte.");
      return false;
    }

    // Verificar que tengamos un chat ID configurado
    if (!chatId) {
      console.error("No hay WHATSAPP_CHAT_ID en el archivo .env");
      console.log("💡 Visita http://localhost:3000/chats para obtener el ID");
      return false;
    }

    try {
      // Enviar el mensaje
      await whatsappClient.sendMessage(chatId, message);
      console.log("Mensaje enviado correctamente");
      console.log("A:", chatId);
      return true;
    } catch (error) {
      console.error("Error enviando mensaje:", error.message);
      return false;
    }
  }

  //Verificar firma de gitHub con firma de cada webhook
  function verifyGitHubSignature(payload, signature) {
    if (!GITHUB_SECRET) {
      return true;
    }

    // Verificar que exista la firma
    if (!signature) {
      return false;
    }

    // Crear un hash HMAC con nuestro secret
    const hmac = crypto.createHmac("sha256", GITHUB_SECRET);
    const digest =
      "sha256=" + hmac.update(JSON.stringify(payload)).digest("hex");

    // Comparar de forma segura
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(digest)
      );
    } catch (error) {
      return false;
    }
  }

  //Función de IA modificada
  //Formatear el mensaje del commit
  function formatCommitMessage(payload) {
    // Extraer información del payload (datos del webhook)
    const repoName = payload.repository.full_name; // Nombre del repo
    const pusher = payload.pusher.name; // Quién hizo push
    const commits = payload.commits; // Array de commits
    const branch = payload.ref.split("/").pop(); // Nombre del branch
    const compareUrl = payload.compare; // URL para ver diferencias

    // Construir el mensaje con formato WhatsApp
    // Se uso * * para negrilla
    let message = `🚀 *NUEVO PUSH EN ${repoName.toUpperCase()}*\n`;
    message += `${"═".repeat(40)}\n\n`;

    message += `📌 *Branch:* ${branch}\n`;
    message += `👤 *Pusheado por:* ${pusher}\n`;
    message += `📊 *Total commits:* ${commits.length}\n`;
    message += `🕒 *Fecha:* ${new Date().toLocaleString("es-CO")}\n\n`;

    message += `${"─".repeat(40)}\n`;
    message += `📝 *COMMITS:*\n`;
    message += `${"─".repeat(40)}\n\n`;

    // Mostrar hasta 5 commits
    commits.slice(0, 5).forEach((commit, index) => {
      // Hash corto del commit (primeros 7 caracteres)
      const shortSha = commit.id.substring(0, 7);

      // Primera línea del mensaje del commit (máximo 70 caracteres)
      const commitMsg = commit.message.split("\n")[0].substring(0, 70);

      // Autor del commit
      const author = commit.author.name;

      // Timestamp del commit
      const timestamp = new Date(commit.timestamp).toLocaleTimeString("es-CO");

      message += `${index + 1}. *${shortSha}*\n`;
      message += `   💬 _"${commitMsg}"_\n`;
      message += `   👨‍💻 Autor: ${author}\n`;
      message += `   ⏰ Hora: ${timestamp}\n`;

      // Mostrar archivos modificados
      if (commit.added && commit.added.length > 0) {
        message += `   ➕ Agregados: ${commit.added.length} archivo(s)\n`;
      }
      if (commit.modified && commit.modified.length > 0) {
        message += `   ✏️ Modificados: ${commit.modified.length} archivo(s)\n`;
      }
      if (commit.removed && commit.removed.length > 0) {
        message += `   ➖ Eliminados: ${commit.removed.length} archivo(s)\n`;
      }

      message += `\n`;
    });

    // Si hay más de 5 commits, indicarlo
    if (commits.length > 5) {
      message += `   ... y ${commits.length - 5} commit(s) más\n\n`;
    }

    // Enlaces útiles
    message += `${"═".repeat(40)}\n`;
    message += `🔗 *ENLACES:*\n`;
    message += `📦 Repositorio: ${repoUrl}\n`;
    message += `👀 Ver cambios: ${compareUrl}\n`;
    message += `${"═".repeat(40)}`;

    return message;
  }

  //Endpoint para weebhook de github
  app.post('/webhook/github', async (req, res) => {
    console.log('WEBHOOK RECIBIDO DE GITHUB\n');

    // Obtener información del header con headers de gitHub
    const signature = req.headers['x-hub-signature-256'];
    const eventType = req.headers['x-github-event']; // Tipo de evento tomado, "Commits por lo general en este proyecto"
    const delivery = req.headers['x-github-delivery']; // Id unico del weebhook

    console.log(`Evento: ${eventType}`);
    console.log(`Delivery ID: ${delivery}`);

    // Verificar la firma de seguridad
    if (!verifyGitHubSignature(req.body, signature)) {
      console.error('❌ FIRMA INVÁLIDA - Webhook rechazado');
      return res.status(403).json({ 
        error: 'Firma inválida',
        message: 'El webhook no viene de GitHub o el secret es incorrecto'
      });
    }

    console.log('✅ Firma verificada correctamente');

    // Solo procesar eventos de tipo "push"
    if (eventType !== 'push') {
      console.log(`ℹ️ Evento ignorado: ${eventType}`);
      return res.json({ 
        status: 'ignored',
        message: `Solo procesamos eventos "push", recibido: "${eventType}"`
      });
    }

    const payload = req.body;

    // Formatear el mensaje
    const message = formatCommitMessage(payload);

    // Enviar a WhatsApp
    console.log('\n📤 Enviando mensaje a WhatsApp...');
    const sent = await sendWhatsAppMessage(message);

    if (sent) {
      console.log('✅ Notificación enviada exitosamente');
      console.log('═'.repeat(50) + '\n');
      return res.json({ 
        status: 'success',
        message: 'Notificación enviada a WhatsApp'
      });
    } else {
      console.error('❌ No se pudo enviar la notificación');
      console.log('═'.repeat(50) + '\n');
      return res.status(500).json({ 
        status: 'error',
        message: 'No se pudo enviar a WhatsApp'
      });
    }
  });

}
