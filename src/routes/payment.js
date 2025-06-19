const express = require('express');
const router = express.Router();
const Product = require('../db/models/product');
const Sale = require('../db/models/sale');
const { publishMessage } = require('../mqtt/client');
const mqttConfig = require('../config/mqtt');
const path = require('path');

// Almacén temporal para sesiones de pago (en producción usar Redis)
const paymentSessions = new Map();

// Servir la página de pago
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/payment.html'));
});

// Crear sesión de pago sin productId
router.post('/create-session', async (req, res) => {
    try {
        const { amount, machineId } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ status: 'error', message: 'Monto inválido' });
        }

        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        paymentSessions.set(sessionId, {
            amount,
            machineId: machineId || 'unknown',
            status: 'pending',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 5 * 60 * 1000)
        });

        res.json({
            status: 'success',
            sessionId,
            expiresIn: 300
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
});

// Obtener información del producto para la página de pago
router.get('/product-info', async (req, res) => {
    try {
        const productId = req.query.product;

        if (!productId) {
            return res.status(400).json({
                status: 'error',
                message: 'ID de producto requerido'
            });
        }

        const product = await Product.findByPk(productId);

        if (!product) {
            return res.status(404).json({
                status: 'error',
                message: 'Producto no encontrado'
            });
        }

        res.json({
            id: product.id,
            name: product.name,
            price: product.price,
            position: product.position,
            stock: product.stock
        });

    } catch (error) {
        console.error('Error getting product info:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor'
        });
    }
});

// Procesar el pago
/*router.post('/process', async (req, res) => {
    try {
        const { productId, amount, sessionId, paymentMethod } = req.body;

        // Validar sesión
        const session = paymentSessions.get(sessionId);

        if (!session) {
            return res.status(400).json({
                status: 'error',
                message: 'Sesión de pago no válida o expirada'
            });
        }

        if (session.status !== 'pending') {
            return res.status(400).json({
                status: 'error',
                message: 'Esta sesión de pago ya ha sido procesada'
            });
        }

        // Verificar que no haya expirado
        if (new Date() > session.expiresAt) {
            paymentSessions.delete(sessionId);
            return res.status(400).json({
                status: 'error',
                message: 'Sesión de pago expirada'
            });
        }

        // Obtener producto
        const product = await Product.findByPk(productId);

        if (!product) {
            return res.status(404).json({
                status: 'error',
                message: 'Producto no encontrado'
            });
        }

        // Verificar stock nuevamente
        if (product.stock <= 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Producto sin stock disponible'
            });
        }

        // Validar monto
        const paidAmount = parseFloat(amount);
        const productPrice = parseFloat(product.price);

        if (paidAmount < productPrice) {
            return res.status(400).json({
                status: 'error',
                message: 'Monto insuficiente'
            });
        }

        const change = paidAmount - productPrice;

        // Actualizar stock del producto
        product.stock -= 1;
        product.lastSold = new Date();

        if (product.stock <= product.minimumStock) {
            product.status = 'low_stock';
        }

        await product.save();

        // Registrar la venta
        const sale = await Sale.create({
            productId: product.id,
            amount: paidAmount,
            paymentMethod: paymentMethod || 'web',
            machineId: session.machineId,
            status: 'completed',
            changeGiven: change
        });

        // Actualizar estado de la sesión
        session.status = 'completed';
        session.saleId = sale.id;
        session.completedAt = new Date();

        // Enviar mensaje MQTT al ESP32 para dispensar el producto
        try {
            await publishMessage(mqttConfig.publishTopics.control, {
                action: 'dispense',
                productId: product.id,
                position: product.position,
                saleId: sale.id,
                sessionId: sessionId,
                change: change
            });
        } catch (mqttError) {
            console.error('Error sending MQTT message:', mqttError);
            // No fallar la transacción por error de MQTT
        }

        res.json({
            status: 'success',
            message: 'Pago procesado correctamente',
            saleId: sale.id,
            productId: product.id,
            productName: product.name,
            paid: paidAmount,
            change: change,
            remainingStock: product.stock
        });

        // Limpiar sesión después de un tiempo
        setTimeout(() => {
            paymentSessions.delete(sessionId);
        }, 30000); // 30 segundos

    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor'
        });
    }
});
 */

router.post('/process-payment', async (req, res) => {
    try {
        const {amount, sessionId, paymentMethod } = req.body;

        // Validar sesión
        const session = paymentSessions.get(sessionId);
        if (!session) {
            return res.status(400).json({
                status: 'error',
                message: 'Sesión de pago no válida o expirada'
            });
        }
        if (session.status !== 'pending') {
            return res.status(400).json({
                status: 'error',
                message: 'Esta sesión de pago ya ha sido procesada'
            });
        }
        if (new Date() > session.expiresAt) {
            paymentSessions.delete(sessionId);
            return res.status(400).json({
                status: 'error',
                message: 'Sesión de pago expirada'
            });
        }

        // Aquí solo marcas el pago como recibido, sin asociar producto
        session.status = 'paid';
        session.paymentMethod = paymentMethod || 'web';
        session.paidAt = new Date();

        console.log(`Pago recibido para sesión: ${sessionId}, monto: ${session.amount}`);

        // Señal al hardware
        res.json({
            status: 'success',
            message: 'Pago procesado correctamente. ¡Ahora puedes elegir tu producto!',
            paid: session.amount,
            sessionId: sessionId,
        });

        // Limpiar sesión después de un tiempo si no se elige un producto
        setTimeout(() => {
            paymentSessions.delete(sessionId);
        }, 30000);

    } catch (error) {
        console.error('Error procesando pago:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor'
        });
    }
});

// Verificar estado de sesión
router.get('/session-status/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    const session = paymentSessions.get(sessionId);

    if (!session) {
        return res.status(404).json({
            status: 'error',
            message: 'Sesión no encontrada'
        });
    }

    res.json({
        status: 'success',
        sessionStatus: session.status,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        saleId: session.saleId || null
    });
});

// Limpiar sesiones expiradas (ejecutar periódicamente)
setInterval(() => {
    const now = new Date();
    for (const [sessionId, session] of paymentSessions.entries()) {
        if (now > session.expiresAt && session.status === 'pending') {
            paymentSessions.delete(sessionId);
            console.log(`Sesión expirada eliminada: ${sessionId}`);
        }
    }
}, 60000); // Cada minuto

module.exports = router;