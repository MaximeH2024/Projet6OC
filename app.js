const express = require('express');
const mongoose = require('mongoose');

const app = express();

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content, Accept, Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    next();
  });

  mongoose.connect('mongodb+srv://mhouguet:cWc0jJ8O9Qek7Ooo@projet6oc.orivc.mongodb.net/?retryWrites=true&w=majority')
  .then(() => console.log('Connexion à MongoDB réussie !'))
  .catch((error) => {
    console.error('Connexion à MongoDB échouée :', error.message);
  });


module.exports = app;