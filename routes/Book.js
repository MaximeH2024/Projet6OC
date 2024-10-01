const express = require('express');
const router = express.Router();
const bookCtrl = require('../controllers/Book');
const auth = require('../middleware/auth');
const { upload, optimizeImage } = require('../middleware/multer-config');


router.get('/bestrating', bookCtrl.bestThreeBooks);
router.post('/', auth, upload, optimizeImage, bookCtrl.createBook);
router.get('/' + '', bookCtrl.getAllBooks);
router.get('/:id', bookCtrl.getOneBook);
router.put('/:id', auth, upload, optimizeImage, bookCtrl.updateBook);
router.delete('/:id', auth, bookCtrl.deleteOneBook);
router.post('/:id/rating', auth, bookCtrl.userRating)
module.exports = router;