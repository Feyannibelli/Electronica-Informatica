const winston = require('winston');
const Product = require('../../db/models/product');
const Sale = require('../../db/models/sale');
const Report = require('../../db/models/report');
const mqttConfig = require('../../config/mqtt');

// Logger
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

    if (!paymentData.productId || !paymentData.amount) {
      throw new Error('El pago debe incluir productId y amount');
    }

    const product = await Product.findByPk(paymentData.productId);
    if (!product) {
      logger.warn(`Producto con ID ${paymentData.productId} no encontrado`);

      await Report.create({
        type: 'payment_error',
        description: `Producto no encontrado para el pago. ID: ${paymentData.productId}`,
        productId: null,
        machineId: paymentData.machineId || 'unknown',
        reportedBy: 'system'
      });

      mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
        status: 'error',
        message: 'Producto no encontrado',
        productId: paymentData.productId
      }));
      return;
    }

    const amount = parseFloat(paymentData.amount);
    const price = parseFloat(product.price);

    if (amount < price) {
      logger.warn(`Monto insuficiente: ${amount} < ${price}`);

      await Report.create({
        type: 'payment_error',
        description: `Monto insuficiente para ${product.name}. Recibido: ${amount}, Requerido: ${price}`,
        productId: product.id,
        machineId: paymentData.machineId || 'unknown',
        reportedBy: 'system'
      });

      mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
        status: 'error',
        message: 'Monto insuficiente',
        productId: product.id,
        received: amount,
        required: price
      }));
      return;
    }

    const change = amount - price;

    const sale = await Sale.create({
      productId: product.id,
      amount,
      paymentMethod: paymentData.paymentMethod || 'cash',
      machineId: paymentData.machineId || 'unknown',
      status: 'pending',
      changeGiven: change
    });

    product.lastSold = new Date();
    await product.save();

    mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
      status: 'success',
      message: 'Pago procesado correctamente',
      saleId: sale.id,
      productId: product.id,
      productName: product.name,
      paid: amount,
      change
    }));

    logger.info(`Pago procesado: Producto ${product.name} (ID: ${product.id}). Monto: ${amount}, Cambio: ${change}`);
  } catch (error) {
    logger.error(`Error al procesar pago: ${error.message}`);

    mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
      status: 'error',
      message: `Error: ${error.message}`
    }));
  }
};

module.exports = {
  handlePayment
};
