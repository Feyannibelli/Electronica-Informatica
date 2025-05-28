// Manejo de inventario
const winston = require('winston');
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
    new winston.transports.File({ filename: 'inventory.log' })
  ]
});

/**
 * Maneja las actualizaciones de inventario recibidas del ESP32
 * @param {Object} inventoryData - Datos del inventario
 * @param {Object} mqttClient - Cliente MQTT para enviar respuestas
 */
const handleInventory = async (inventoryData, mqttClient) => {
  try {
    logger.info(`Procesando actualización de inventario: ${JSON.stringify(inventoryData)}`);
    
    // Caso 1: Actualización de un producto específico
    if (inventoryData.productId && (inventoryData.stock !== undefined || inventoryData.lowStock !== undefined)) {
      const product = await Product.findByPk(inventoryData.productId);
      
      if (!product) {
        throw new Error(`Producto con ID ${inventoryData.productId} no encontrado`);
      }
      
      // Actualizar stock si viene en el mensaje
      if (inventoryData.stock !== undefined) {
        product.stock = inventoryData.stock;
      }
      
      // Actualizar estado si se indica que hay poco stock
      if (inventoryData.lowStock === true) {
        product.status = 'low_stock';
      } else if (inventoryData.stock > product.minimumStock) {
        product.status = 'active';
      }
      
      await product.save();
      
      logger.info(`Inventario actualizado para producto ${product.name} (ID: ${product.id}). Stock: ${product.stock}`);
      
      // Enviar confirmación al ESP32
      mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
        status: 'success',
        message: 'Inventario actualizado correctamente',
        productId: product.id,
        currentStock: product.stock
      }));
    }
    // Caso 2: Señal de falta de latas (poco stock)
    else if (inventoryData.lowStockAlert && inventoryData.positions) {
      // Actualizar el estado de los productos en las posiciones indicadas
      for (const position of inventoryData.positions) {
        const product = await Product.findOne({ where: { position } });
        
        if (product) {
          product.status = 'low_stock';
          await product.save();
          
          logger.info(`Alerta de poco stock para producto en posición ${position} (${product.name})`);
        }
      }
      
      // Enviar confirmación al ESP32
      mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
        status: 'success',
        message: 'Alertas de stock bajo registradas',
        positions: inventoryData.positions
      }));
    }
    // Caso 3: Reporte de tiempo sin ventas
    else if (inventoryData.noSalesAlert && inventoryData.productIds) {
      const currentTime = new Date();
      const productDetails = [];
      
      // Obtener detalles de los productos sin ventas recientes
      for (const productId of inventoryData.productIds) {
        const product = await Product.findByPk(productId);
        
        if (product) {
          // Calcular tiempo sin ventas si hay fecha de última venta
          let daysSinceLastSale = null;
          if (product.lastSold) {
            daysSinceLastSale = Math.floor((currentTime - new Date(product.lastSold)) / (1000 * 60 * 60 * 24));
          }
          
          productDetails.push({
            id: product.id,
            name: product.name,
            position: product.position,
            daysSinceLastSale
          });
          
          logger.info(`Alerta de producto sin ventas: ${product.name} (${daysSinceLastSale || 'nunca'} días)`);
        }
      }
      
      // Enviar confirmación al ESP32 con detalles
      mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
        status: 'success',
        message: 'Alertas de productos sin ventas registradas',
        products: productDetails
      }));
    }
    else {
      throw new Error('Formato de mensaje de inventario no reconocido');
    }
    
  } catch (error) {
    logger.error(`Error al procesar actualización de inventario: ${error.message}`);
    
    // Enviar mensaje de error al ESP32
    mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
      status: 'error',
      message: `Error: ${error.message}`
    }));
  }
};

module.exports = {
  handleInventory
};