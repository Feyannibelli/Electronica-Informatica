const winston = require('winston');
const Product = require('../../db/models/product');
const Sale = require('../../db/models/sale');
const Report = require('../../db/models/report'); // 🆕
const mqttConfig = require('../../config/mqtt');

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

const handlePayment = async (paymentData, mqttClient) => {
  try {
    logger.info(`Procesando pago: ${JSON.stringify(paymentData)}`);

    if (!paymentData.productId || !paymentData.amount) {
      throw new Error('El pago debe incluir productId y amount');
    }

    const product = await Product.findByPk(paymentData.productId);

    if (!product) {
      throw new Error(`Producto con ID ${paymentData.productId} no encontrado`);
    }

    const amount = parseFloat(paymentData.amount);
    const price = parseFloat(product.price);

    if (amount < price) {
      logger.warn(`Monto insuficiente: ${amount} < ${price}`);

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
      amount: amount,
      paymentMethod: paymentData.paymentMethod || 'cash',
      machineId: paymentData.machineId || 'unknown',
      status: 'completed',
      changeGiven: change
    });

    product.lastSold = new Date();
    await product.save();

    // 🆕 Reporte automático por pago exitoso
    await Report.create({
      type: 'payment',
      description: `Pago registrado: ${product.name}, Monto: ${amount}`,
      productId: product.id,
      machineId: paymentData.machineId || 'unknown',
      reportedBy: 'system',
      status: 'completed'
    });

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

    mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
      status: 'error',
      message: `Error: ${error.message}`
    }));
  }
};

module.exports = {
  handlePayment
};
