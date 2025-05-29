const express = require('express');
const ExcelJS = require('exceljs');
const Product = require('../db/models/product');
const router = express.Router();

router.get('/products', async (req, res) => {
    try {
        const products = await Product.findAll();

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Productos');

        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Nombre', key: 'name', width: 30 },
            { header: 'Precio', key: 'price', width: 10 },
            { header: 'Stock', key: 'stock', width: 10 },
            { header: 'Posición', key: 'position', width: 10 },
            { header: 'Última venta', key: 'lastSold', width: 20 },
            { header: 'Estado', key: 'status', width: 15 }
        ];

        products.forEach(product => {
            worksheet.addRow({
                id: product.id,
                name: product.name,
                price: product.price,
                stock: product.stock,
                position: product.position,
                lastSold: product.lastSold ? new Date(product.lastSold).toLocaleString() : '',
                status: product.status
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="productos.xlsx"');

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Error al exportar productos:', err.message);
        res.status(500).json({ error: 'Error al generar archivo Excel' });
    }
});

module.exports = router;
