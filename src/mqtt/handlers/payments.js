// Manejo de pagos
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
    new winston.transports.File({ filename: 'payments.log' })
  ]
});

/**
 * Maneja los pagos recibidos del ESP32
 * @param {Object} paymentData - Datos del pago
 * @param {Object} mqttClient - Cliente MQTT para enviar respuestas
 */
const handlePayment = async (paymentData, mqttClient) => {
  try {
    logger.info(`Procesando pago: ${JSON.stringify(paymentData)}`);
    
    // Validar la estructura del mensaje
    if (!paymentData.productId || !paymentData.amount) {
      throw new Error('El pago debe incluir productId y amount');
    }
    
    // Buscar el producto en la base de datos
    const product = await Product.findByPk(paymentData.productId);
    
    if (!product) {
      throw new Error(`Producto con ID ${paymentData.productId} no encontrado`);
    }
    
    // Verificar si el monto es suficiente
    const amount = parseFloat(paymentData.amount);
    const price = parseFloat(product.price);
    
    if (amount < price) {
      logger.warn(`Monto insuficiente: ${amount} < ${price}`);
      
      // Enviar mensaje de error al ESP32
      mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
        status: 'error',
        message: 'Monto insuficiente',
        productId: product.id,
        received: amount,
        required: price
      }));
      
      return;
    }
    
    // Calcular el cambio
    const change = amount - price;
    
    // Registrar la venta en la base de datos
    const sale = await Sale.create({
      productId: product.id,
      amount: amount,
      paymentMethod: paymentData.paymentMethod || 'cash',
      machineId: paymentData.machineId || 'unknown',
      status: 'completed',
      changeGiven: change
    });
    
    // Actualizar la fecha de última venta del producto
    product.lastSold = new Date();
    await product.save();
    
    // Enviar confirmación al ESP32
    mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
      status: 'success',
      message: 'Pago procesado correctamente',
      saleId: sale.id,
      productId: product.id,
      productName: product.name,
      paid: amount,
      change: change
    }));
    
    logger.info(`Pago procesado: Producto ${product.name} (ID: ${product.id}). Monto: ${amount}, Cambio: ${change}`);
    
  } catch (error) {
    logger.error(`Error al procesar pago: ${error.message}`);
    
    // Enviar mensaje de error al ESP32
    mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
      status: 'error',
      message: `Error: ${error.message}`
    }));
  }
};

module.exports = {
  handlePayment
};