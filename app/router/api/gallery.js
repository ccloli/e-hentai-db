const { Router } = require('express');
const gallery = require('../../action/gallery');

const router = Router({ mergeParams: true });
router.use('/:gid?/:token?', gallery);

module.exports = router;