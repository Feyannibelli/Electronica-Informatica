// Manejo de pedidos (orders)
const winston = require('winston');
const Product = require('../../db/models/product');
const Report = require('../../db/models/report');
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

    // Buscar un pago válido y pendiente
    let payment = await Sale.findOne({
      where: {
        productId: product.id,
        machineId: orderData.machineId || 'unknown',
        status: 'pending'
      },
      order: [['createdAt', 'DESC']]
    });

    // Si no hay stock, buscar otro producto con stock y precio <= pago
    if (product.stock <= 0) {
      logger.warn(`Producto ${product.name} sin stock disponible`);

      await Report.create({
        type: 'out_of_stock',
        description: `Se intentó pedir ${product.name} (posición ${product.position}) sin stock` ,
        productId: product.id,
        machineId: orderData.machineId || 'unknown',
        reportedBy: 'system'
      });

      if (payment) {
        const alternative = await Product.findOne({
          where: {
            stock: { [require('sequelize').Op.gt]: 0 },
            price: { [require('sequelize').Op.lte]: payment.amount }
          },
          order: [['id', 'ASC']]
        });

        if (alternative) {
          payment.productId = alternative.id;
          await payment.save();
          product = alternative;

          logger.info(`Pago redirigido a ${product.name} (ID: ${product.id})`);

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
            message: 'Sin stock disponible y no hay productos alternativos'
          }));
          return;
        }
      } else {
        mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
          status: 'error',
          message: 'Sin stock disponible',
          productId: product.id
        }));
        return;
      }
    }

    if (!payment || payment.amount < product.price) {
      logger.warn(`No se encontró un pago válido para el producto ${product.name}`);

      mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
        status: 'error',
        message: 'Pago no registrado o insuficiente',
        productId: product.id
      }));
      return;
    }

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
