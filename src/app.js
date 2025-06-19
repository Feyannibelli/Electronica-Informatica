// src/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rutas existentes
app.use('/products', require('./routes/product'));
app.use('/sales', require('./routes/sales'));
app.use('/reports', require('./routes/reports'));
app.use('/export', require('./routes/export'));

// Nuevas rutas para pagos
app.use('/api', require('./routes/payment').router);

// Ruta principal para servir el dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Ruta para la página de pago (accesible vía QR)
app.get('/pay', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'payment.html'));
});

module.exports = app;