const express = require('express');
const router = express.Router();
const Sale = require('../db/models/sale');
const Product = require('../db/models/product');

router.get('/', async (req, res) => {
    try {
        const sales = await Sale.findAll({
            include: [{ model: Product }],
            order: [['createdAt', 'DESC']]
        });
        res.json(sales);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener ventas' });
    }
});

module.exports = router;
