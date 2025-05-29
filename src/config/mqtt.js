//Configuración de conexión MQTT
require('dotenv').config();

const mqttConfig = {
    // Configuración del broker MQTT
    broker: {
        url: process.env.MQTT_BROKER_URL,
        port: Number(process.env.MQTT_BROKER_PORT),
        clientId: process.env.MQTT_CLIENT_ID,
        username: '',
        password: '',
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