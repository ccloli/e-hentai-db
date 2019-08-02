const { Router } = require('express');
const gallery = require('../../action/gallery');
const catchError = require('../../util/catchError');

const router = Router({ mergeParams: true });
router.use('/:gid?/:token?', catchError(gallery));

module.exports = router;