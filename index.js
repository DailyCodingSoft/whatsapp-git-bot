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

let whatsappClient = null;
let isWhatsAppReady = false;

function initWhatsApp() {

  console.log('\n🔄 Inicializando WhatsApp Web...\n');

  whatsappClient = new Client({
    authStrategy: new LocalAuth({
      dataPath: './whatsapp-session'
    }),
    
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

  whatsappClient.on('qr', (qr) => {
    console.log('📱 ¡ESCANEA ESTE QR!');
    qrcode.generate(qr, { small: true });
  });

  //to do...

}
