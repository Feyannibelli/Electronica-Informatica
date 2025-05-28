// Manejo de pedidos
const winston = require('winston');
const Product = require('../../db/models/product');
const Sale = require('../../db/models/sale');
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
    new winston.transports.File({ filename: 'orders.log' })
  ]
});

/**
 * Maneja los pedidos recibidos del ESP32
 * @param {Object} orderData - Datos del pedido
 * @param {Object} mqttClient - Cliente MQTT para enviar respuestas
 */
const handleOrder = async (orderData, mqttClient) => {
  try {
    logger.info(`Procesando pedido: ${JSON.stringify(orderData)}`);
    
    // Validar la estructura del mensaje
    if (!orderData.productId && !orderData.position) {
      throw new Error('El pedido debe incluir productId o position');
    }
    
    // Buscar el producto en la base de datos
    let product;
    if (orderData.productId) {
      product = await Product.findByPk(orderData.productId);
    } else if (orderData.position) {
      product = await Product.findOne({ where: { position: orderData.position } });
    }
    
    if (!product) {
      throw new Error('Producto no encontrado');
    }
    
    // Verificar si hay stock disponible
    if (product.stock <= 0) {
      logger.warn(`Producto ${product.name} sin stock disponible`);
      
      // Enviar mensaje de error al ESP32
      mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
        status: 'error',
        message: 'Sin stock disponible',
        productId: product.id
      }));
      
      return;
    }
    
    // Reservar el producto (reducir stock)
    product.stock -= 1;
    
    // Si el stock llega al mínimo, actualizar el estado
    if (product.stock <= product.minimumStock) {
      product.status = 'low_stock';
    }
    
    await product.save();
    
    // Enviar confirmación al ESP32
    mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
      status: 'success',
      message: 'Pedido procesado correctamente',
      productId: product.id,
      productName: product.name,
      price: product.price,
      remainingStock: product.stock
    }));
    
    logger.info(`Pedido procesado: ${product.name} (ID: ${product.id}). Stock restante: ${product.stock}`);
    
  } catch (error) {
    logger.error(`Error al procesar pedido: ${error.message}`);
    
    // Enviar mensaje de error al ESP32
    mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
      status: 'error',
      message: `Error: ${error.message}`
    }));
  }
};

module.exports = {
  handleOrder
};