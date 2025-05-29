const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + '/public'));

// Rutas
app.use('/products', require('./routes/product'));
app.use('/sales', require('./routes/sales'));
app.use('/reports', require('./routes/reports'));
app.use('/export', require('./routes/export'));

module.exports = app;
