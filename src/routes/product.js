// src/routes/product.js
const express = require('express');
const router = express.Router();
const Product = require('../db/models/product');

router.get('/', async (req, res) => {
    try {
        const productos = await Product.findAll();
        console.log('Productos:', productos);
        res.json(productos);
    } catch (error) {
        console.error('Error en /products:', error);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});


module.exports = router;
