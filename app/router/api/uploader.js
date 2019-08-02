const { Router } = require('express');
const uploader = require('../../action/uploader');
const catchError = require('../../util/catchError');

const router = Router();
router.use('/:uploader', catchError(uploader));

module.exports = router;