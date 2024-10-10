const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const Book = require('../models/Book');

exports.createBook = (req, res, next) => {
  try {
    // Si une erreur a été levée par Multer (type de fichier non autorisé)
    if (req.fileValidationError) {
      return res.status(400).json({ error: 'Seuls les fichiers image sont autorisés (jpg, jpeg, png, webp).' });
    }

    // Vérifier si le fichier est bien une image valide
    if (!req.file) {
      return res.status(400).json({ error: "Seuls les fichiers image sont autorisés (jpg, jpeg, png, webp)." });
    }
    
    const bookObject = JSON.parse(req.body.book);
    delete bookObject._id;
    delete bookObject._userId;

    // Récupérer le rating à partir de l'objet book
    const userRating = bookObject.ratings && bookObject.ratings.length > 0
      ? bookObject.ratings[0].grade
      : 0;  // S'il n'y a pas de note, utiliser 0 comme valeur par défaut

    const optimizedImageFilename = `opt_${req.file.filename}`;
    const book = new Book({
      ...bookObject,
      userId: req.auth.userId,
      imageUrl: `${req.protocol}://${req.get("host")}/images/${optimizedImageFilename}`,
      ratings: [
        {
          userId: req.auth.userId,
          grade: userRating // Utiliser le rating récupéré
        }
      ],
      averageRating: userRating // Initialiser l'averageRating avec le rating reçu
    });

    // Sauvegarder le livre dans la base de données
    book.save()
      .then(() => {
        res.status(201).json({ message: "Livre enregistré avec succès !" });
      })
      .catch((error) => {
        res.status(400).json({ error });
      });

  } catch (error) {
    res.status(400).json({ error: "Données invalides ou mal formatées." });
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
        // Vérifier si l'utilisateur est autorisé à modifier ce livre
        if (book.userId != req.auth.userId) {
          return res.status(401).json({ message: 'Not authorized' });
        }
  
        // Désérialiser les données du livre (comme dans createBook)
        const bookObject = req.file
          ? { ...JSON.parse(req.body.book) } // S'il y a un fichier, traiter req.body.book comme JSON
          : { ...req.body }; // Sinon, utiliser req.body directement
  
        // Si une nouvelle image est fournie (optimisée par optimizeImage)
        if (req.file) {
          const oldFilename = book.imageUrl.split('/images/')[1]; // Nom de l'ancienne image
  
          // Supprimer l'ancienne image du serveur
          fs.unlink(`images/${oldFilename}`, (err) => {
            if (err) {
              console.error('Erreur lors de la suppression de l\'ancienne image :', err);
            }
          });
  
          // Utiliser la nouvelle image optimisée, assurons-nous d'utiliser `req.file.filename` qui contient l'image optimisée
          const cacheBuster = `?t=${Date.now()}`;
          bookObject.imageUrl = `${req.protocol}://${req.get("host")}/images/opt_${req.file.filename}${cacheBuster}`;
        }
  
        // Mettre à jour le livre dans la base de données
        Book.updateOne({ _id: req.params.id }, { ...bookObject, _id: req.params.id })
          .then(() => res.status(200).json({ message: 'Livre mis à jour avec succès !' }))
          .catch((error) => res.status(400).json({ error }));
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
                fs.unlink(`images/${filename}`, () => {
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
    return parseFloat(average.toFixed(2)); // Arrondir à deux décimales
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