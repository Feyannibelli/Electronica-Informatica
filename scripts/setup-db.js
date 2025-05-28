// Script para inicializar la base de datos
require('dotenv').config();
const { sequelize } = require('../src/config/db');
const Product = require('../src/db/models/product');
const Sale = require('../src/db/models/sale');
const Report = require('../src/db/models/report');

// Datos de ejemplo para productos iniciales
const initialProducts = [
  {
    name: 'Coca-Cola',
    price: 1.50,
    stock: 20,
    position: 'A1',
    minimumStock: 5,
    status: 'active'
  },
  {
    name: 'Pepsi',
    price: 1.50,
    stock: 15,
    position: 'A2',
    minimumStock: 5,
    status: 'active'
  },
  {
    name: 'Sprite',
    price: 1.25,
    stock: 18,
    position: 'A3',
    minimumStock: 5,
    status: 'active'
  },
  {
    name: 'Fanta',
    price: 1.25,
    stock: 12,
    position: 'B1',
    minimumStock: 5,
    status: 'active'
  },
  {
    name: 'Agua Mineral',
    price: 1.00,
    stock: 25,
    position: 'B2',
    minimumStock: 5,
    status: 'active'
  },
  {
    name: 'Jugo de Naranja',
    price: 1.75,
    stock: 10,
    position: 'B3',
    minimumStock: 5,
    status: 'active'
  },
  {
    name: 'Café',
    price: 2.00,
    stock: 8,
    position: 'C1',
    minimumStock: 5,
    status: 'active'
  },
  {
    name: 'Té Verde',
    price: 1.80,
    stock: 7,
    position: 'C2',
    minimumStock: 5,
    status: 'active'
  }
];

// Función para inicializar la base de datos
const initDatabase = async () => {
  try {
    console.log('Sincronizando modelos con la base de datos...');
    
    // Sincronizar todos los modelos con la base de datos
    // ADVERTENCIA: { force: true } eliminará todas las tablas existentes
    // Usar solo en desarrollo o primera inicialización
    await sequelize.sync({ force: process.env.NODE_ENV === 'development' });
    
    console.log('Base de datos sincronizada correctamente');
    
    // Si estamos en desarrollo o es la primera ejecución, insertar datos de ejemplo
    if (process.env.NODE_ENV === 'development' || process.env.INIT_DATA === 'true') {
      console.log('Insertando datos iniciales...');
      
      // Insertar productos
      await Product.bulkCreate(initialProducts);
      
      console.log('Datos iniciales insertados correctamente');
    }
    
    console.log('Inicialización de la base de datos completada');
    process.exit(0);
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
    process.exit(1);
  }
};

// Ejecutar la función de inicialización
initDatabase();