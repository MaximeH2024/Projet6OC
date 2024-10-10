const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Définir les types MIME acceptés pour les images
const MIME_TYPES = {
  'image/jpg': 'jpg',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  "image/webp": "webp"
};

// Configuration du stockage avec multer
const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, 'images'); // Dossier où les images seront enregistrées
  },
  filename: (req, file, callback) => {
    // Générer un nom de fichier unique
    const name = file.originalname.split(' ').join('_').split('.')[0];
    const extension = MIME_TYPES[file.mimetype];
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `${name}_${uniqueSuffix}.${extension}`;
    callback(null, filename);
  }
});

// Middleware multer pour traiter une seule image
const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, callback) => {
    // Vérifier le type de fichier
    if (MIME_TYPES[file.mimetype]) {
      callback(null, true);
    } else {
      callback(new Error('Seuls les fichiers image sont autorisés (jpg, jpeg, png).'));
    }
  }
}).single('image');

// Middleware pour redimensionner l'image avec sharp après l'upload
const optimizeImage = (req, res, next) => {
  if (req.file) { // check if request has a downloaded file
      const filePath = req.file.path;
      const output = path.join('images', `opt_${req.file.filename}`); // where picture will be sent, and name
      sharp.cache(false);
      sharp(filePath)         
          .resize({width: 412, height: 520, fit: 'cover' }) // Resize picture
          .webp({ quality: 85 })
          .toFile(output) // Upload new picture 
          .then(() => {
              fs.unlink(filePath, (err) => { // Delete old picture
                  if (err) {
                      console.log(err);
                      return next(err);
                  }
                  req.file.path = output;
                  next();
              });
          })
          .catch(err => next(err));
  } else {
      return next();
  }
};

module.exports = { upload, optimizeImage };