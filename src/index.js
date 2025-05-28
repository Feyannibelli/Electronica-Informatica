// Punto de entrada de la aplicación
require('dotenv').config();
const express = require('express');
const winston = require('winston');
const { testConnection } = require('./config/db');
const mqttClient = require('./mqtt/client');

// Configurar logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' })
  ]
});

// Inicializar Express (para monitoreo y posible API REST)
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para procesar JSON
app.use(express.json());

// Ruta de salud para monitoreo
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Ruta para obtener estado del cliente MQTT
app.get('/mqtt/status', (req, res) => {
  const connected = mqttClient.client.connected;
  res.status(200).json({ 
    connected,
    clientId: mqttClient.client.options.clientId
  });
});

// Iniciar la aplicación
const startApp = async () => {
  try {
    // Probar conexión a la base de datos
    logger.info('Probando conexión a PostgreSQL...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      logger.error('No se pudo conectar a PostgreSQL. Verifique la configuración.');
      process.exit(1);
    }
    
    logger.info('Conexión a PostgreSQL establecida correctamente.');
    
    // Iniciar servidor Express
    app.listen(PORT, () => {
      logger.info(`Servidor Express iniciado en el puerto ${PORT}`);
    });
    
    logger.info('La aplicación se ha iniciado correctamente.');
    logger.info('Cliente MQTT conectado y escuchando mensajes...');
    
  } catch (error) {
    logger.error(`Error al iniciar la aplicación: ${error.message}`);
    process.exit(1);
  }
};

// Manejar terminación del proceso
process.on('SIGINT', () => {
  logger.info('Cerrando aplicación...');
  mqttClient.client.end();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Cerrando aplicación...');
  mqttClient.client.end();
  process.exit(0);
});

// Iniciar la aplicación
startApp();