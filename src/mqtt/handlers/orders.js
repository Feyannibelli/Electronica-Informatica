const winston = require('winston');
const Product = require('../../db/models/product');
const Report = require('../../db/models/report');
const Sale = require('../../db/models/sale');
const mqttConfig = require('../../config/mqtt');
const { Op } = require('sequelize');

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

    // Buscar un pago válido pendiente PARA ESA MÁQUINA
    let payment = await Sale.findOne({
      where: {
        machineId: orderData.machineId || 'unknown',
        status: 'pending'
      },
      order: [['createdAt', 'DESC']]
    });

    if (!payment) {
      logger.warn(`No hay pagos pendientes para esta máquina`);
      mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
        status: 'error',
        message: 'Debe realizar un pago antes de pedir un producto'
      }));
      return;
    }

    // Verificar si el producto original tiene stock
    if (product.stock <= 0) {
      logger.warn(`Producto ${product.name} sin stock disponible`);

      await Report.create({
        type: 'out_of_stock',
        description: `Se intentó pedir ${product.name} (posición ${product.position}) sin stock`,
        productId: product.id,
        machineId: orderData.machineId || 'unknown',
        reportedBy: 'system'
      });

      // Buscar producto alternativo con stock y precio <= pago
      const alternative = await Product.findOne({
        where: {
          stock: { [Op.gt]: 0 },
          price: { [Op.lte]: payment.amount }
        },
        order: [['id', 'ASC']]
      });

      if (alternative) {
        payment.productId = alternative.id;
        await payment.save();
        product = alternative;

        mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
          status: 'info',
          message: 'Se ha reemplazado el producto por otro disponible',
          productId: product.id,
          productName: product.name,
          remainingStock: product.stock
        }));
      } else {
        mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
          status: 'error',
          message: 'Sin stock y sin productos alternativos'
        }));
        return;
      }
    }

    // Verificar si el pago es suficiente para este producto
    if (payment.amount < product.price) {
      logger.warn(`Monto insuficiente para el producto ${product.name}`);
      mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
        status: 'error',
        message: 'Monto insuficiente para este producto',
        productId: product.id
      }));
      return;
    }

    // Todo bien → completar el pedido
    payment.status = 'completed';
    await payment.save();

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
