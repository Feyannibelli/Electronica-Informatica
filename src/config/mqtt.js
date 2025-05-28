//Configuración de conexión MQTT
require('dotenv').config(); // Corregido: 'require' en lugar de 'requestAnimationFrame'

const mqttConfig = {
    // Configuración del broker MQTT
    broker: {
        url: process.env.MQTT_BROKER_URL || 'mqtt://localhost',  // URL del broker MQTT
        port: process.env.MQTT_BROKER_PORT || 1883, 
        clientId: `mqtt_client_${Math.random().toString(16).slice(2,8)}`, // ID de cliente aleatorio
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        keepalive: 60,
        reconnectPeriod: 1000,
        clean: true
    },

    //Tópicos de suscripción (recibir mensajes del ESP32)
    topics: {
        orders: 'vending/orders', // Pedidos de latas
        payments: 'vending/payments', // Pagos recibidos
        inventory: 'vending/inventory', // Estado del inventario
        reports: 'vending/reports', // Reportes de fallos
        status: 'vending/status' // Estado general de la máquina
    },

    // Tópicos de publicación (enviar mensajes al ESP32)
    publishTopics: {
        confirmation: 'vending/confirmation', // Confirmación de pedidos
        control: 'vending/control', // Control de la máquina
        updates: 'vending/updates' // Actualizaciones de configuración
    }
};

module.exports = mqttConfig;