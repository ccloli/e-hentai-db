const { Router } = require('express');
const list = require('../../action/list');
const catchError = require('../../util/catchError');

const router = Router();
router.use('/', catchError(list));

module.exports = router;