const { Router } = require('express');
const search = require('../../action/search');
const catchError = require('../../util/catchError');

const router = Router();
router.use('/', catchError(search));

module.exports = router;