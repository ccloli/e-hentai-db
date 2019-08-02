const { Router } = require('express');
const tag = require('../../action/tag');
const catchError = require('../../util/catchError');

const router = Router();
router.use('/:tag', catchError(tag));

module.exports = router;