const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');

// Configurar el cliente con autenticación local y puppeteer
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: path.resolve(__dirname, './whatsapp-session') // Usar ruta absoluta para mayor compatibilidad
  }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// Definir los eventos a escuchar
const eventos = [
  'qr', 'authenticated', 'auth_failure', 'ready', 
  'message', 'message_create', 'message_revoke_everyone',
  'disconnected', 'change_state', 'loading_screen'
];

// Función para manejar los eventos de manera eficiente
const manejarEvento = (evento, ...args) => {
  switch (evento) {
    case 'qr':
      console.log('QR recibido. Escanéalo con tu app de WhatsApp.');
      break;
    case 'authenticated':
      console.log('Autenticación exitosa');
      break;
    case 'auth_failure':
      console.log('Error de autenticación, intenta nuevamente');
      break;
    case 'ready':
      console.log('Cliente listo para usar');
      break;
    case 'message':
      console.log(`Nuevo mensaje de ${args[0].from}: ${args[0].body}`);
      break;
    case 'message_create':
      console.log(`Mensaje creado: ${args[0].body}`);
      break;
    case 'message_revoke_everyone':
      console.log(`Mensaje revocado por todos: ${args[0].body}`);
      break;
    case 'disconnected':
      console.log('Desconectado de WhatsApp');
      break;
    case 'change_state':
      console.log(`Estado cambiado: ${args[0]}`);
      break;
    case 'loading_screen':
      console.log('Pantalla de carga...');
      break;
    default:
      console.log(`Evento desconocido: ${evento}`);
  }

  // Limitar la cantidad de datos que se muestran para no saturar la consola
  console.log('Datos del evento:', JSON.stringify(args, null, 2).substring(0, 500));
};

// Suscribirse a los eventos
eventos.forEach(evento => {
  client.on(evento, (...args) => manejarEvento(evento, ...args));
});

// Inicializar cliente
client.initialize();

// Verificar el estado después de 2 minutos sin recibir "ready"
setTimeout(() => {
  console.log('\nHan pasado 2 minutos sin "ready". Estado de los eventos:');
  eventos.forEach(evento => {
    console.log(`Evento: ${evento}`);
  });
}, 120000);

// Intentar reconectar automáticamente en caso de desconexión
client.on('disconnected', () => {
  console.log('Intentando reconectar...');
  client.initialize(); // Reconectar automáticamente
});
