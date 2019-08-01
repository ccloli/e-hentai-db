const Router = require('express').Router;
const api = require('./api');

const router = Router();
router.use('/api', api);

module.exports = router;