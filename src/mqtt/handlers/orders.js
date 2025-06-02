const winston = require('winston');
const Product = require('../../db/models/product');
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
    new winston.transports.File({ filename: 'orders.log' })
  ]
});

const handleOrder = async (orderData, mqttClient) => {
  try {
    logger.info(`Procesando pedido: ${JSON.stringify(orderData)}`);

    if (!orderData.productId && !orderData.position) {
      throw new Error('El pedido debe incluir productId o position');
    }

    let product;
    if (orderData.productId) {
      product = await Product.findByPk(orderData.productId);
    } else if (orderData.position) {
      product = await Product.findOne({ where: { position: orderData.position } });
    }

    if (!product) {
      throw new Error('Producto no encontrado');
    }

    if (product.stock <= 0) {
      logger.warn(`Producto ${product.name} sin stock disponible`);

      // 🆕 Reporte automático por falta de stock
      await Report.create({
        type: 'stock_error',
        description: `Intento de pedido sin stock: ${product.name}`,
        productId: product.id,
        machineId: orderData.machineId || 'unknown',
        reportedBy: 'system',
        status: 'registered'
      });

      mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
        status: 'error',
        message: 'Sin stock disponible',
        productId: product.id
      }));

      return;
    }

    product.stock -= 1;

    if (product.stock <= product.minimumStock) {
      product.status = 'low_stock';
    }

    await product.save();

    // 🆕 Reporte automático por pedido exitoso
    await Report.create({
      type: 'order',
      description: `Pedido procesado: ${product.name}`,
      productId: product.id,
      machineId: orderData.machineId || 'unknown',
      reportedBy: 'system',
      status: 'completed'
    });

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

    mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
      status: 'error',
      message: `Error: ${error.message}`
    }));
  }
};

module.exports = {
  handleOrder
};
