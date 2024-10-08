const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const Book = require('../models/Book');

exports.createBook = (req, res, next) => {
  try {
    // Vérifier si le corps de la requête contient bien un livre
    if (!req.body.book) {
      return res.status(400).json({ message: "Données du livre manquantes" });
    }

    // Parser le livre seulement si disponible
    const bookObject = JSON.parse(req.body.book);

    // Supprimer les propriétés non voulues
    delete bookObject._id;
    delete bookObject._userId;
    delete bookObject.ratings;
    delete bookObject.averageRating;

    // Vérifier si un fichier a bien été envoyé
    if (!req.file) {
      return res.status(400).json({ message: "Image manquante" });
    }

    const inputPath = req.file.path; // Chemin de l'image téléchargée (entrée)
    const optimizedFilename = `opt_${Date.now()}_${req.file.originalname}`; // Nouveau nom pour l'image optimisée avec un timestamp
    const outputPath = path.join('images', optimizedFilename); // Chemin du fichier optimisé

    // Optimiser l'image avec Sharp
    sharp(inputPath)
      .resize(500) // Redimensionner l'image à une largeur maximale de 500px
      .toFile(outputPath) // Sauvegarder l'image optimisée sous un autre nom
      .then(() => {
        // Supprimer l'image originale après optimisation
        fs.unlink(inputPath, (err) => {
          if (err) {
            console.error('Erreur lors de la suppression du fichier original :', err);
          } else {
            console.log('Fichier original supprimé avec succès.');
          }
        });

        // Créer le livre avec le lien vers l'image optimisée
        const book = new Book({
          ...bookObject,
          userId: req.auth.userId, // Ajoute l'ID utilisateur
          imageUrl: `${req.protocol}://${req.get('host')}/images/${optimizedFilename}`, // Utilise l'image optimisée
          ratings: [],
          averageRating: 0 // Initialiser la note moyenne à 0
        });

        // Sauvegarder le livre dans la base de données
        book.save()
          .then(() => res.status(201).json({ message: 'Livre enregistré avec succès !' }))
          .catch(error => res.status(400).json({ error }));

      })
      .catch(err => {
        console.error('Erreur lors de l\'optimisation de l\'image :', err);
        res.status(500).json({ error: 'Erreur lors de l\'optimisation de l\'image.' });
      });

  } catch (error) {
    // Gestion des erreurs
    res.status(400).json({ message: "Erreur lors de la création du livre : " + error.message });
  }
};


exports.getAllBooks = (req, res, next) => {
    Book.find().then(
      (books) => {
        res.status(200).json(books);
      }
    ).catch(
      (error) => {
        res.status(400).json({
          error: error
        });
      }
    );
}

exports.getOneBook = (req, res, next) => {
    Book.findOne({
      _id: req.params.id
    }).then(
      (book) => {
        res.status(200).json(book);
      }
    ).catch(
      (error) => {
        res.status(404).json({
          error: error
        });
      }
    );
  }

  exports.updateBook = (req, res, next) => {
    Book.findOne({ _id: req.params.id })
      .then((book) => {
        if (book.userId != req.auth.userId) {
          return res.status(401).json({ message: 'Not authorized' });
        }
  
        const bookObject = req.file
          ? {
              ...JSON.parse(req.body.book),
            }
          : { ...req.body };
  
        // Handle image update if a new file is provided
        if (req.file) {
          const oldFilename = book.imageUrl.split('/images/')[1]; // Extract the old image filename
          const newFilename = `opt_${Date.now()}_${req.file.originalname}`; // Generate new optimized filename
          const inputPath = req.file.path; // Path of the new image file
          const outputPath = path.join('images', newFilename); // Path to store the optimized new image
  
          // Optimize the new image
          sharp(inputPath)
            .resize(500)
            .toFile(outputPath)
            .then(() => {
              // Delete the old optimized image file
              fs.unlink(path.join('images', oldFilename), (err) => {
                if (err) {
                  console.error('Error deleting the old image:', err);
                } else {
                  console.log('Old image deleted successfully.');
                }
              });
  
              // Update the book object with the new image URL
              bookObject.imageUrl = `${req.protocol}://${req.get('host')}/images/${newFilename}`;
  
              // Save the updated book
              Book.updateOne({ _id: req.params.id }, { ...bookObject, _id: req.params.id })
                .then(() => res.status(200).json({ message: 'Book updated successfully!' }))
                .catch((error) => res.status(400).json({ error }));
            })
            .catch((error) => {
              console.error('Error optimizing the new image:', error);
              res.status(500).json({ error: 'Image optimization failed.' });
            });
        } else {
          // If no new image is uploaded, just update the book data
          Book.updateOne({ _id: req.params.id }, { ...bookObject, _id: req.params.id })
            .then(() => res.status(200).json({ message: 'Book updated successfully!' }))
            .catch((error) => res.status(400).json({ error }));
        }
      })
      .catch((error) => {
        res.status(400).json({ error });
      });
  };

 exports.deleteOneBook = (req, res, next) => {
  Book.findOne({ _id: req.params.id})
      .then(book => {
          if (book.userId != req.auth.userId) {
              res.status(401).json({message: 'Not authorized'});
          } else {
              const filename = book.imageUrl.split('/images/')[1];
              fs.unlink(`images/opt_${filename}`, () => {
                  Book.deleteOne({_id: req.params.id})
                      .then(() => { res.status(200).json({message: 'Objet supprimé !'})})
                      .catch(error => res.status(401).json({ error }));
              });
          }
      })
      .catch( error => {
          res.status(500).json({ error });
      });
};

exports.userRating = (req, res, next ) => {
  const oneRating = req.body
  delete oneRating._userId
  oneRating.userId = req.auth.userId
  function averageCalcul(ratings) {
    const totalGrade = ratings.reduce((total, rate) => total + rate.grade, 0);
    const average = totalGrade / ratings.length;
    return average;
  }
  Book.findOne({ _id: req.params.id })
    .then(book => {
      if (book.ratings.userId === req.auth.userId) {
        return res.status(400).json({ message: 'Une seule note par utilisateur est autorisée.' });
      } else {
        book.ratings.push({
          userId: oneRating.userId,
          grade: oneRating.rating
        });
        book.save()
          .then((book) => {
            const averageRatingValue = averageCalcul(book.ratings);
            Book.updateOne({ _id: req.params.id }, { $set: { averageRating: averageRatingValue } })
              .then(() => {
                book.save()
                .then(() => {
                  res.status(200).json(book);
                })
              })
              .catch(error => res.status(401).json({ error }));
          })
          .catch(error => res.status(401).json({ error }));
      }
    })
    .catch(error => {
      res.status(500).json({ error });
    });
  }

  exports.bestThreeBooks = (req, res, next ) => {
    Book.find().then(
      (books) => {
        const sortedBooks = books.sort((a, b) => b.averageRating - a.averageRating); 
        const bestBooks = sortedBooks.slice(0, 3); 
        res.status(200).json(bestBooks );
      }
    ).catch(
      (error) => {
        res.status(400).json({
          error: error
        });
      }
    );
  };