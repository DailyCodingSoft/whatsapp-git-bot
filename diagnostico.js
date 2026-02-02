const { Client, LocalAuth } = require("whatsapp-web.js");

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: "./whatsapp-session"
  }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});


const eventos = [
  'qr', 'authenticated', 'auth_failure', 'ready', 
  'message', 'message_create', 'message_revoke_everyone',
  'disconnected', 'change_state', 'loading_screen'
];

eventos.forEach(evento => {
  client.on(evento, (...args) => {
    console.log(`\n🔔 EVENTO: ${evento}`);
    console.log('Datos:', JSON.stringify(args, null, 2).substring(0, 500));
  });
});

client.initialize();

setTimeout(() => {
  console.log('\nHan pasado 2 minutos sin "ready"');
  console.log('Estado actual de los eventos recibidos arriba ↑');
}, 120000);