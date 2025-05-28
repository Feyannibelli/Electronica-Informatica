// Modelo para ventas
const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');
const Product = require('./product');

const Sale = sequelize.define('Sale', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Product,
      key: 'id'
    },
    comment: 'ID del producto vendido'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Monto pagado por el cliente'
  },
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'card', 'mobile'),
    defaultValue: 'cash',
    comment: 'Método de pago utilizado'
  },
  machineId: {
    type: DataTypes.STRING,
    comment: 'Identificador único de la máquina expendedora'
  },
  status: {
    type: DataTypes.ENUM('completed', 'cancelled', 'error'),
    defaultValue: 'completed',
    comment: 'Estado de la transacción'
  },
  changeGiven: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: 'Cambio entregado al cliente'
  }
}, {
  tableName: 'sales',
  timestamps: true // Crea automáticamente createdAt y updatedAt
});

// Definir la relación con Product
Sale.belongsTo(Product, { foreignKey: 'productId' });
Product.hasMany(Sale, { foreignKey: 'productId' });

module.exports = Sale;