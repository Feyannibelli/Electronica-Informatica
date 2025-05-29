//Configuración de conexión a PostgreSQL
require('dotenv').config();
const { Sequelize } = require('sequelize'); // Corregido: 'require' en lugar de 'requiere'

// Crear una instancia de Sequelize con los parámetros de conexión
const sequelize = new Sequelize(
    process.env.DB_NAME || 'iotdb',
    process.env.DB_USER || 'iotuser',
    process.env.DB_PASSWORD || 'tu_password_segura_123',
    {
        host: process.env.DB_HOST || 'tu-instancia-sql-privada.aws', // recordar dar la direccion ip de la instancia o el DNS
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: console.log,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

// Función para probar la conexión a la base de datos
const testConnection = async () => { 
    try {
        await sequelize.authenticate(); 
        console.log('Conexión a PostgreSQL establecida correctamente.');
        return true;
    } catch (error) {
        console.error('Error al conectar a PostgreSQL:', error); 
        return false;
    }
};

module.exports = { 
    sequelize,
    testConnection
};