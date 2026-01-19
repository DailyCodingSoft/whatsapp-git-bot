//Librerias
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GITHUB_SECRET = process.env.GITHUB_SECRET || '';
const WHATSAPP_CHAT_ID = process.env.WHATSAPP_CHAT_ID || '';

//Conexión de hatsapp
let whatsappClient = null;
//Bandera para saber si Whatsapp esta conectado y listo
let isWhatsAppReady = false;

function initWhatsApp() {
  console.log('\nInicializando WhatsApp Web...\n');
  //CLiente de whatsapp
  whatsappClient = new Client({
    //LocalAuth guarda la sesión de Whatsapp
    authStrategy: new LocalAuth({
      dataPath: './whatsapp-session' //Carpeta donde se guarda la sesión
    }),
    
    //Tener un navegador invisible 
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }
  });

  //Eventos de Whatsapp
  whatsappClient.on('qr', (qr) => {
    console.log('📱 ¡ESCANEA ESTE QR!');
    qrcode.generate(qr, { small: true }); //Generación del QR
    console.log('\nPASOS PARA CONECTAR:');
    console.log('1. Abre WhatsApp en tu teléfono');
    console.log('2. Toca Menú (⋮) → Dispositivos vinculados');
    console.log('3. Toca "Vincular un dispositivo"');
    console.log('4. Escanea el QR de arriba\n');
  });

  whatsappClient.on('ready', () => {
    console.log('¡WhatsApp conectado exitosamente!');
    console.log('El bot está listo para recibir webhooks\n');
    isWhatsAppReady = true;
  });

  whatsappClient.on('authenticated', () => {
    console.log('Sesión de WhatsApp autenticada');
  });

  whatsappClient.on('auth_failure', (error) => {
    console.error('Error de autenticación:', error);
  });

  whatsappClient.on('disconnected', (reason) => {
    console.log('Desconectado:', reason);
    isWhatsAppReady = false;
  });

  //Envio de mensajes con Whatsapp
  async function sendWhatsAppMessage(message, chatId = WHATSAPP_CHAT_ID) {
    // Verificar que WhatsApp esté conectado
    if (!isWhatsAppReady) {
      console.error('WhatsApp no está listo. Espera a que se conecte.');
      return false;
    }

    // Verificar que tengamos un chat ID configurado
    if (!chatId) {
      console.error('No hay WHATSAPP_CHAT_ID en el archivo .env');
      console.log('💡 Visita http://localhost:3000/chats para obtener el ID');
      return false;
    }

    try {
      // Enviar el mensaje
      await whatsappClient.sendMessage(chatId, message);
      console.log('Mensaje enviado correctamente');
      console.log('A:', chatId);
      return true;
    } catch (error) {
      console.error('Error enviando mensaje:', error.message);
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
    const hmac = crypto.createHmac('sha256', GITHUB_SECRET);
    const digest = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');
    
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



}
