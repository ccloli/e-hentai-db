const { Router } = require('express');
const list = require('../../action/list');

const router = Router();
router.use('/', list);

module.exports = router;