const express = require('express');
const router = express.Router();
const bookCtrl = require('../controllers/Book');
const auth = require('../middleware/auth');

router.post('/', auth, bookCtrl.createBook);
router.get('/' + '', bookCtrl.getAllBooks);
router.get('/:id', bookCtrl.getOneBook);
router.put('/:id', auth, bookCtrl.updateBook);
router.delete('/:id', auth, bookCtrl.deleteOneBook);

module.exports = router;