// routes/reports.js
const express = require('express');
const router = express.Router();
const Report = require('../db/models/report');
const Product = require('../db/models/product');

router.get('/', async (req, res) => {
    try {
        const reports = await Report.findAll({
            include: [{ model: Product }],
            order: [['createdAt', 'DESC']]
        });
        res.json(reports);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener reportes' });
    }
});

module.exports = router;
