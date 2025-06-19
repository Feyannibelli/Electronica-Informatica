const winston = require('winston');
const Product = require('../../db/models/product');
const Sale = require('../../db/models/sale');
const mqttConfig = require('../../config/mqtt');
const { pendingTransactions, completeTransaction, cancelTransaction } = require('../../routes/payment');

// Configurar logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'payments-enhanced.log' })
    ]
});

/**
 * Maneja los pagos desde diferentes fuentes (web, efectivo, tarjeta)
 * @param {Object} paymentData - Datos del pago
 * @param {Object} mqttClient - Cliente MQTT para enviar respuestas
 */
const handlePayment = async (paymentData, mqttClient) => {
    try {
        logger.info(`Procesando pago: ${JSON.stringify(paymentData)}`);

        // Caso 1: Pago con transactionId (desde la web)
        if (paymentData.transactionId) {
            await handleWebPayment(paymentData, mqttClient);
        }
        // Caso 2: Pago directo (efectivo/tarjeta en la máquina)
        else if (paymentData.productId && paymentData.amount) {
            await handleDirectPayment(paymentData, mqttClient);
        }
        else {
            throw new Error('Formato de pago no reconocido');
        }

    } catch (error) {
        logger.error(`Error al procesar pago: ${error.message}`);

        // Enviar mensaje de error al ESP32
        mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
            status: 'error',
            message: `Error: ${error.message}`,
            transactionId: paymentData.transactionId
        }));
    }
};

/**
 * Maneja pagos que vienen de la página web (con transactionId)
 */
const handleWebPayment = async (paymentData, mqttClient) => {
    const { transactionId, productId, position } = paymentData;

    // Buscar la transacción pendiente
    const transaction = pendingTransactions.get(transactionId);

    if (!transaction) {
        throw new Error(`Transacción ${transactionId} no encontrada o expirada`);
    }

    // Verificar que no haya expirado
    if (new Date() > transaction.expiresAt) {
        pendingTransactions.delete(transactionId);
        throw new Error('Transacción expirada');
    }

    // Buscar el producto
    let product;
    if (productId) {
        product = await Product.findByPk(productId);
    } else if (position) {
        product = await Product.findOne({ where: { position } });
    } else {
        throw new Error('Debe especificar productId o position');
    }

    if (!product) {
        cancelTransaction(transactionId, 'Producto no encontrado');
        throw new Error('Producto no encontrado');
    }

    // Verificar stock
    if (product.stock <= 0) {
        cancelTransaction(transactionId, 'Sin stock disponible');
        throw new Error('Sin stock disponible');
    }

    // Verificar que el monto sea suficiente
    const amount = transaction.amount;
    const price = parseFloat(product.price);

    if (amount < price) {
        cancelTransaction(transactionId, `Monto insuficiente: $${amount} < $${price}`);
        throw new Error(`Monto insuficiente: $${amount} < $${price}`);
    }

    // Calcular cambio
    const change = amount - price;

    // Reducir stock
    product.stock -= 1;
    if (product.stock <= product.minimumStock) {
        product.status = 'low_stock';
    }
    product.lastSold = new Date();
    await product.save();

    // Registrar la venta
    const sale = await Sale.create({
        productId: product.id,
        amount: amount,
        paymentMethod: transaction.paymentMethod,
        machineId: transaction.machineId,
        status: 'completed',
        changeGiven: change
    });

    // Completar la transacción
    completeTransaction(transactionId, sale);

    logger.info(`Pago web completado: ${transactionId}, Producto: ${product.name}, Cambio: $${change}`);

    // Enviar confirmación al ESP32 para dispensar el producto
    mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
        status: 'success',
        action: 'dispense_product',
        transactionId: transactionId,
        saleId: sale.id,
        productId: product.id,
        productName: product.name,
        position: product.position,
        paid: amount,
        change: change,
        message: 'Pago completado - Dispensar producto'
    }));
};

/**
 * Maneja pagos directos (efectivo/tarjeta en la máquina)
 */
const handleDirectPayment = async (paymentData, mqttClient) => {
    const { productId, position, amount, paymentMethod, machineId } = paymentData;

    // Buscar el producto
    let product;
    if (productId) {
        product = await Product.findByPk(productId);
    } else if (position) {
        product = await Product.findOne({ where: { position } });
    } else {
        throw new Error('Debe especificar productId o position');
    }

    if (!product) {
        throw new Error('Producto no encontrado');
    }

    // Verificar stock
    if (product.stock <= 0) {
        throw new Error('Sin stock disponible');
    }

    // Verificar monto
    const paidAmount = parseFloat(amount);
    const price = parseFloat(product.price);

    if (paidAmount < price) {
        throw new Error(`Monto insuficiente: $${paidAmount} < $${price}`);
    }

    // Calcular cambio
    const change = paidAmount - price;

    // Reducir stock
    product.stock -= 1;
    if (product.stock <= product.minimumStock) {
        product.status = 'low_stock';
    }
    product.lastSold = new Date();
    await product.save();

    // Registrar la venta
    const sale = await Sale.create({
        productId: product.id,
        amount: paidAmount,
        paymentMethod: paymentMethod || 'cash',
        machineId: machineId || 'unknown',
        status: 'completed',
        changeGiven: change
    });

    logger.info(`Pago directo completado: Producto ${product.name}, Monto: $${paidAmount}, Cambio: $${change}`);

    // Enviar confirmación al ESP32
    mqttClient.publish(mqttConfig.publishTopics.confirmation, JSON.stringify({
        status: 'success',
        action: 'dispense_product',
        saleId: sale.id,
        productId: product.id,
        productName: product.name,
        position: product.position,
        paid: paidAmount,
        change: change,
        message: 'Pago completado - Dispensar producto'
    }));
};

/**
 * Maneja la confirmación de que el producto fue dispensado
 */
const handleDispenseConfirmation = async (confirmationData, mqttClient) => {
    try {
        const { saleId, transactionId, success, error } = confirmationData;

        if (success) {
            logger.info(`Producto dispensado exitosamente. Sale ID: ${saleId}`);

            // Si hay transactionId, marcar como completada
            if (transactionId) {
                const transaction = pendingTransactions.get(transactionId);
                if (transaction) {
                    transaction.status = 'dispensed';
                }
            }
        } else {
            logger.error(`Error al dispensar producto: ${error}`);

            // Si hay error, podrías implementar lógica de reembolso
            if (saleId) {
                const sale = await Sale.findByPk(saleId);
                if (sale) {
                    sale.status = 'error';
                    await sale.save();

                    // Devolver stock
                    const product = await Product.findByPk(sale.productId);
                    if (product) {
                        product.stock += 1;
                        await product.save();
                    }
                }
            }

            if (transactionId) {
                cancelTransaction(transactionId, `Error al dispensar: ${error}`);
            }
        }

    } catch (error) {
        logger.error(`Error al procesar confirmación de dispensado: ${error.message}`);
    }
};

module.exports = {
    handlePayment,
    handleDispenseConfirmation
};