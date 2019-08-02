const { Router } = require('express');
const category = require('../../action/category');
const catchError = require('../../util/catchError');

const router = Router();
router.use('/:category', catchError(category));

module.exports = router;