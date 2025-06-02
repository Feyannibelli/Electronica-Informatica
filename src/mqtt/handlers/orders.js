// Manejo de pedidos (orders)
const winston = require('winston');
const Product = require('../../db/models/product');
const Sale = require('../../db/models/sale');
const Report = require('../../db/models/report');
const Payment = require('../../db/models/payment');
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

      // Crear reporte automático de tipo 'out_of_stock'
      await Report.create({
        type: 'out_of_stock',
        description: `Se intentó pedir ${product.name} (posición ${product.position}) sin stock` ,
        productId: product.id,
        machineId: orderData.machineId || 'unknown',
        reportedBy: 'system'
      });

      mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
        status: 'error',
        message: 'Sin stock disponible',
        productId: product.id
      }));

      return;
    }

    // Buscar un pago válido y pendiente
    const payment = await Payment.findOne({
      where: {
        productId: product.id,
        machineId: orderData.machineId || 'unknown',
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

    // Actualizar el pago a completado
    payment.status = 'completed';
    await payment.save();

    // Crear registro de venta
    await Sale.create({
      productId: product.id,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      machineId: payment.machineId
    });

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
