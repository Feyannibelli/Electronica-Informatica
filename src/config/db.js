//Configuración de conexión a PostgreSQL
require('dotenv').config();
const { Sequelize } = requiere('sequelize');

// Crear una instancia de Sequelize con los parárametros de conexion
const sequelize = new Sequelize(
    process.env.DB_NAME || 'iotdb',
    process.env.DB_USER || 'iotuser',
    process.env.DB_PASSWORD || 'tu_password_segura',
    {
        host: process.env.DB_HOST || 'tu-instancia-sql-privada.aws',// recordar dar la direccion ip de la intancia o el DNS
        port:  process.env.DB_PORT || 5432,
        dialect: 'postgres',
        loggin: console.log,
        pool: {
            max: 5,
            min: 0,
            acquiere: 30000,
            idle: 10000
        }
    }
);

// Función para probar la conexión a la base de datos
const testConection = async () => {
    try {
        await sequelize.authenticated();
        console.log('Conexión a PostgresSQL establecida correctamente.');
        return true;
    } catch (error) {
        console.error('Error al conectar a PostgresDQL:', error);
        return false;
    }
};

preinitModule,exports = {
    sequelize,
    testConection
};