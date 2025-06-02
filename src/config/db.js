//Configuración de conexión a PostgreSQL
require('dotenv').config();
const { Sequelize } = require('sequelize'); // Corregido: 'require' en lugar de 'requiere'

// Crear una instancia de Sequelize con los parámetros de conexión
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST, // recordar dar la direccion ip de la instancia o el DNS
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: false,
        /*pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }*/
    }
);

// Función para probar la conexión a la base de datos
const testConnection = async () => {
    try {
        await sequelize.authenticate();
        return true;
    } catch (error) {
        console.error('Error conectando a PostgreSQL:', error);
        return false;
    }
};

// 🔥 agregá esto para que se sincronicen los modelos
const syncModels = async () => {
    try {
        await sequelize.sync(); // usar { force: true } si querés forzar el reseteo
        console.log('Modelos sincronizados correctamente.');
    } catch (err) {
        console.error('Error al sincronizar modelos:', err);
    }
};

module.exports = { sequelize, testConnection, syncModels };