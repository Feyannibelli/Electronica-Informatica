// Cliente MQTT
const mqtt = require('mqtt');
const mqttConfig = require('../config/mqtt');
const winston = require('winston');

// Configurar logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'mqtt-client.log' })
  ]
});

// Cargar los manejadores de eventos
const orderHandler = require('./handlers/orders');
const paymentHandler = require('./handlers/payments');
const inventoryHandler = require('./handlers/inventory');
const reportHandler = require('./handlers/reports');

// Crear cliente MQTT
const client = mqtt.connect(mqttConfig.broker.url, {
  port: mqttConfig.broker.port,
  clientId: mqttConfig.broker.clientId,
  username: mqttConfig.broker.username,
  password: mqttConfig.broker.password,
  keepalive: mqttConfig.broker.keepalive,
  reconnectPeriod: mqttConfig.broker.reconnectPeriod,
  clean: mqttConfig.broker.clean
});

// Evento de conexión
client.on('connect', () => {
  logger.info('Conectado al broker MQTT');
  
  // Suscribirse a los tópicos
  Object.values(mqttConfig.topics).forEach(topic => {
    client.subscribe(topic, (err) => {
      if (!err) {
        logger.info(`Suscrito al tópico: ${topic}`);
      } else {
        logger.error(`Error al suscribirse al tópico ${topic}: ${err.message}`);
      }
    });
  });
});

// Evento de mensaje recibido
client.on('message', (topic, message) => {
  const messageStr = message.toString();
  logger.info(`Mensaje recibido en tópico ${topic}: ${messageStr}`);
  
  try {
    // Convertir mensaje a JSON si es posible
    const messageData = JSON.parse(messageStr);
    
    // Enrutar el mensaje al manejador correspondiente según el tópico
    switch(topic) {
      case mqttConfig.topics.orders:
        orderHandler.handleOrder(messageData, client);
        break;
      case mqttConfig.topics.payments:
        paymentHandler.handlePayment(messageData, client);
        break;
      case mqttConfig.topics.inventory:
        inventoryHandler.handleInventory(messageData, client);
        break;
      case mqttConfig.topics.reports:
        reportHandler.handleReport(messageData, client);
        break;
      case mqttConfig.topics.status:
        // Manejar mensajes de estado general
        logger.info(`Estado de la máquina: ${JSON.stringify(messageData)}`);
        break;
      default:
        logger.warn(`Tópico no manejado: ${topic}`);
    }
  } catch (error) {
    logger.error(`Error al procesar mensaje: ${error.message}`);
  }
});

// Evento de error
client.on('error', (error) => {
  logger.error(`Error de cliente MQTT: ${error.message}`);
});

// Evento de reconexión
client.on('reconnect', () => {
  logger.info('Intentando reconectar al broker MQTT');
});

// Evento de desconexión
client.on('close', () => {
  logger.info('Conexión al broker MQTT cerrada');
});

// Función para publicar mensaje en un tópico
const publishMessage = (topic, message) => {
  return new Promise((resolve, reject) => {
    client.publish(topic, JSON.stringify(message), (err) => {
      if (err) {
        logger.error(`Error al publicar en ${topic}: ${err.message}`);
        reject(err);
      } else {
        logger.info(`Mensaje publicado en ${topic}: ${JSON.stringify(message)}`);
        resolve();
      }
    });
  });
};

module.exports = {
  client,
  publishMessage
};