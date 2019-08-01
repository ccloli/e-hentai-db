const { Router } = require('express');
const gallery = require('./gallery');
const notFound = require('../../action/notFound');

const router = Router();
router.use('/gallery', gallery);
router.use('/g', gallery);
router.use('/', notFound);

module.exports = router;