// Modelo para reportes de fallo
const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');
const Product = require('./product');

const Report = sequelize.define('Report', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  type: {
    type: DataTypes.ENUM('out_of_stock', 'machine_error', 'product_stuck', 'payment_error', 'other'),
    allowNull: false,
    comment: 'Tipo de fallo reportado'
  },
  description: {
    type: DataTypes.TEXT,
    comment: 'Descripción detallada del problema'
  },
  productId: {
    type: DataTypes.INTEGER,
    references: {
      model: Product,
      key: 'id'
    },
    comment: 'ID del producto relacionado (si aplica)'
  },
  machineId: {
    type: DataTypes.STRING,
    comment: 'Identificador único de la máquina expendedora'
  },
  status: {
    type: DataTypes.ENUM('pending', 'in_progress', 'resolved'),
    defaultValue: 'pending',
    comment: 'Estado del reporte'
  },
  reportedBy: {
    type: DataTypes.STRING,
    comment: 'Usuario o sistema que reportó el fallo'
  },
  resolved_at: {
    type: DataTypes.DATE,
    comment: 'Fecha y hora de resolución del problema'
  }
}, {
  tableName: 'reports',
  timestamps: true // Crea automáticamente createdAt y updatedAt
});

// Definir la relación con Product (si el reporte está asociado a un producto)
Report.belongsTo(Product, { foreignKey: 'productId' });
Product.hasMany(Report, { foreignKey: 'productId' });

module.exports = Report;