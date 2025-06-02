// src/mqtt/handlers/orders.js

const winston = require('winston');
const Product = require('../../db/models/product');
const Report = require('../../db/models/report');
const Sale = require('../../db/models/sale');
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

    const machineId = orderData.machineId || 'unknown';

    // Buscar un pago válido y pendiente
    const payment = await Sale.findOne({
      where: {
        productId: product.id,
        machineId,
        status: 'pending'
      },
      order: [['createdAt', 'DESC']]
    });

    if (!payment || payment.amount < product.price) {
      logger.warn(`No se encontró un pago válido para el producto ${product.name}`);

      mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
        status: 'error',
        message: 'Pago no registrado o insuficiente',
        productId: product.id
      }));

      return;
    }

    if (product.stock <= 0) {
      logger.warn(`Producto ${product.name} sin stock disponible`);

      // Reporte automático
      await Report.create({
        type: 'out_of_stock',
        description: `Intento de pedido sin stock: ${product.name} (${product.position})`,
        productId: product.id,
        machineId,
        reportedBy: 'system'
      });

      mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
        status: 'warning',
        message: `No hay más stock de ${product.name}. Puede elegir otro producto.`,
        productId: product.id,
        productName: product.name
      }));

      return;
    }

    // Marcar pago como completado
    payment.status = 'completed';
    await payment.save();

    // Descontar stock
    product.stock -= 1;
    if (product.stock <= product.minimumStock) {
      product.status = 'low_stock';
    }
    await product.save();

    mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
      status: 'success',
      message: 'Pedido procesado correctamente',
      productId: product.id,
      productName: product.name,
      price: product.price,
      remainingStock: product.stock
    }));

    logger.info(`Pedido completado: ${product.name} (ID: ${product.id}). Stock restante: ${product.stock}`);

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
