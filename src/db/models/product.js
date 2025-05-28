//Modelo para latas/productos
const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db')

const Product = sequelize.define('Product', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.String,
        allowNull: false,
        comment: 'nombre del producto/lata'
    },
    price: {
        type: DataType.decimal(10,2),
        allowNull: false,
        comment: 'precio del producto en la moneda local'
    },
    stock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaaultValue: 0,
        comment: 'Cantidad disponible en la máquina'
    },
    position: {
        type: DataTypes.STRING,
        comment: 'Posición en la máquina (ej: A1, B2, etc.)'
      },
      lastSold: {
        type: DataTypes.DATE,
        comment: 'Fecha y hora de la última venta'
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'low_stock'),
        defaultValue: 'active',
        comment: 'Estado del producto en la máquina'
      },
      minimumStock: {
        type: DataTypes.INTEGER,
        defaultValue: 5,
        comment: 'Cantidad mínima antes de generar alerta'
      }
}, {
      tableName: 'products',
      timestamps: true // Crea automáticamente createdAt y updatedAt
});

module.exports = Product;