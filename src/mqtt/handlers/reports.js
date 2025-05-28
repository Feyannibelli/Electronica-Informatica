// Manejo de reportes de fallo
const winston = require('winston');
const Report = require('../../db/models/report');
const Product = require('../../db/models/product');
const mqttConfig = require('../../config/mqtt');

// Configurar logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'reports.log' })
  ]
});

/**
 * Maneja los reportes de fallo recibidos del ESP32
 * @param {Object} reportData - Datos del reporte
 * @param {Object} mqttClient - Cliente MQTT para enviar respuestas
 */
const handleReport = async (reportData, mqttClient) => {
  try {
    logger.info(`Procesando reporte de fallo: ${JSON.stringify(reportData)}`);
    
    // Validar la estructura del mensaje
    if (!reportData.type) {
      throw new Error('El reporte debe incluir un tipo de fallo');
    }
    
    // Crear objeto para el nuevo reporte
    const reportObj = {
      type: reportData.type,
      description: reportData.description || '',
      machineId: reportData.machineId || 'unknown',
      reportedBy: reportData.reportedBy || 'system',
      status: 'pending'
    };
    
    // Si el reporte está asociado a un producto, verificar que exista
    if (reportData.productId) {
      const product = await Product.findByPk(reportData.productId);
      
      if (!product) {
        logger.warn(`Producto con ID ${reportData.productId} no encontrado para el reporte`);
      } else {
        reportObj.productId = product.id;
      }
    } else if (reportData.position) {
      // Si se proporciona la posición en lugar del ID, buscar el producto
      const product = await Product.findOne({ where: { position: reportData.position } });
      
      if (product) {
        reportObj.productId = product.id;
      }
    }
    
    // Guardar el reporte en la base de datos
    const report = await Report.create(reportObj);
    
    logger.info(`Reporte guardado con ID: ${report.id}`);
    
    // Enviar confirmación al ESP32
    mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
      status: 'success',
      message: 'Reporte de fallo registrado correctamente',
      reportId: report.id,
      type: report.type
    }));
    
  } catch (error) {
    logger.error(`Error al procesar reporte de fallo: ${error.message}`);
    
    // Enviar mensaje de error al ESP32
    mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
      status: 'error',
      message: `Error: ${error.message}`
    }));
  }
};

module.exports = {
  handleReport
};