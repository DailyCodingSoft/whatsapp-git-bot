//Librerias
const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const crypto = require("crypto");
const { log } = require("console");
require("dotenv").config();

console.log('✅ Paso 1: Librerías cargadas');

const app = express();
app.use(express.json());

console.log('✅ Paso 2: Express configurado');

const PORT = process.env.PORT || 3000;
const GITHUB_SECRET = process.env.GITHUB_SECRET || "";
const WHATSAPP_CHAT_ID = process.env.WHATSAPP_CHAT_ID || "";

console.log('✅ Paso 3: Variables cargadas');
console.log('   PORT:', PORT);
console.log('   GITHUB_SECRET:', GITHUB_SECRET ? 'Configurado' : 'Vacío');
console.log('   WHATSAPP_CHAT_ID:', WHATSAPP_CHAT_ID ? 'Configurado' : 'Vacío');

//Conexión de WhatsApp
let whatsappClient = null;
//Bandera para saber si Whatsapp esta conectado y listo
let isWhatsAppReady = false;

function initWhatsApp() {
  console.log("\nInicializando WhatsApp Web...\n");
  //Cliente de whatsapp
  whatsappClient = new Client({
    //LocalAuth guarda la sesión de Whatsapp
    authStrategy: new LocalAuth({
      dataPath: "./whatsapp-session", //Carpeta donde se guarda la sesión
    }),

    //Tener un navegador invisible
    puppeteer: {
      headless: false,
      executablePath: undefined,
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
    setTimeout(() => {
      console.log("✅ Marcando WhatsApp como listo...");
      isWhatsAppReady = true;
      console.log("✅ ¡Bot listo para usar!");
    }, 15000); // Reducido a 15 segundos
  });

  whatsappClient.on("auth_failure", (error) => {
    console.error("Error de autenticación:", error);
  });

  whatsappClient.on("disconnected", (reason) => {
    console.log("Desconectado:", reason);
    isWhatsAppReady = false;
  });

  // EVENTO PARA DETECTAR MENSAJES (CORREGIDO - YA NO ESTÁ ANIDADO)
 whatsappClient.on('message_create', async (msg) => {
    try {
      const chat = await msg.getChat();
      
      // Solo mostrar info si es un grupo
      if (chat.isGroup) {
        console.log('\n' + '═'.repeat(60));
        console.log('🎯 GRUPO DETECTADO');
        console.log('═'.repeat(60));
        console.log('📌 Nombre:', chat.name);
        console.log('🆔 ID:', chat.id._serialized);
        console.log('📝 Mensaje:', msg.body.substring(0, 50));
        console.log('═'.repeat(60) + '\n');
        console.log('👉 COPIA ESTE ID Y PÉGALO EN .env:');
        console.log('   WHATSAPP_CHAT_ID=' + chat.id._serialized);
        console.log('\n');
      }
    } catch (error) {
      // Ignorar errores silenciosamente
    }
  });

  // Inicializar WhatsApp
  whatsappClient.initialize();
}

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
    console.log("💡 Envía un mensaje en tu grupo para ver su ID");
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

//Formatear el mensaje del commit
function formatCommitMessage(payload) {
  // Extraer información del payload (datos del webhook)
  const repoName = payload.repository.full_name; // Nombre del repo
  const pusher = payload.pusher.name; // Quién hizo push
  const commits = payload.commits; // Array de commits
  const branch = payload.ref.split("/").pop(); // Nombre del branch
  const repoUrl = payload.repository.html_url; // URL del repo (CORREGIDO)
  const compareUrl = payload.compare; // URL para ver diferencias

  // Construir el mensaje con formato WhatsApp
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
    const shortSha = commit.id.substring(0, 7);
    const commitMsg = commit.message.split("\n")[0].substring(0, 70);
    const author = commit.author.name;
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

//Endpoint para webhook de github
app.post('/webhook/github', async (req, res) => {
  console.log('WEBHOOK RECIBIDO DE GITHUB\n');

  const signature = req.headers['x-hub-signature-256'];
  const eventType = req.headers['x-github-event'];
  const delivery = req.headers['x-github-delivery'];

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
  const message = formatCommitMessage(payload);

  // Enviar a WhatsApp
  console.log('\n📤 Enviando mensaje a WhatsApp...');
  const sent = await sendWhatsAppMessage(message);

  if (sent) {
    console.log('✅ Notificación enviada exitosamente\n');
    return res.json({ 
      status: 'success',
      message: 'Notificación enviada a WhatsApp'
    });
  } else {
    console.error('❌ No se pudo enviar la notificación\n');
    return res.status(500).json({ 
      status: 'error',
      message: 'No se pudo enviar a WhatsApp'
    });
  }
});

//Endpoint para obtener chats (DESHABILITADO POR BUG)
app.get('/chats', async (req, res) => {
  res.json({
    error: 'Endpoint deshabilitado',
    mensaje: 'Envía un mensaje en tu grupo para ver su ID en la terminal'
  });
});

//Endpoint de prueba
app.post('/test', async (req, res) => {
  console.log('Enviando mensaje de prueba');
  
  const testMessage = `✅ *PRUEBA DEL BOT*\n\n` +
    `¡El bot está funcionando correctamente!\n` +
    `${new Date().toLocaleString('es-CO')}\n\n` +
    `Ahora puedes configurar el webhook en GitHub.`;

  const sent = await sendWhatsAppMessage(testMessage);
  
  if (sent) {
    res.json({ 
      status: 'success',
      message: 'Mensaje de prueba enviado'
    });
  } else {
    res.status(500).json({ 
      status: 'error',
      message: 'No se pudo enviar el mensaje de prueba'
    });
  }
});

//Verificar si el servidor esta vivo
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    whatsapp: isWhatsAppReady ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

console.log('\n✅ Paso Final: Iniciando servidor...\n');

//Inicio del servidor
app.listen(PORT, () => {
  console.log('\n' + '═'.repeat(50));
  console.log('SERVIDOR INICIADO');
  console.log('═'.repeat(50));
  console.log(`Puerto: ${PORT}`);
  console.log(`URL local: http://localhost:${PORT}`);
  console.log(`Endpoints disponibles:`);
  console.log(`   - POST /webhook/github (para GitHub)`);
  console.log(`   - POST /test (mensaje de prueba)`);
  console.log(`   - GET  /health (estado del servidor)`);
  console.log('═'.repeat(50) + '\n');
  initWhatsApp();
});

//Manejo de errores
process.on('unhandledRejection', (error) => {
  console.error('❌ Error no manejado:', error);
});

// Cerrar cuando se termina el proceso
process.on('SIGINT', async () => {
  console.log('\n\n👋 Cerrando bot...');
  
  if (whatsappClient) {
    await whatsappClient.destroy();
    console.log('WhatsApp desconectado');
  }
  
  console.log('Servidor cerrado');
  process.exit(0);
});