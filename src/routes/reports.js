const express = require('express');
const router = express.Router();
const Report = require('../db/models/report');
const Product = require('../db/models/product');

router.get('/', async (req, res) => {
    try {
        const { type, status } = req.query;

        const where = {};
        if (type) where.type = type;
        if (status) where.status = status;

        const reports = await Report.findAll({
            where,
            include: [{ model: Product }],
            order: [['createdAt', 'DESC']]
        });

        // Formato más limpio para frontend
        const formatted = reports.map(r => ({
            id: r.id,
            type: r.type,
            description: r.description,
            status: r.status,
            machineId: r.machineId,
            reportedBy: r.reportedBy,
            createdAt: r.createdAt,
            product: r.Product ? {
                id: r.Product.id,
                name: r.Product.name,
                position: r.Product.position
            } : null
        }));

        res.json(formatted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener reportes' });
    }
});

module.exports = router;
