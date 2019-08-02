const cors = (enabled, origin) => (req, res, next) => {
	if (enabled) {
		res.header({
			'access-control-allow-origin': origin || req.headers.origin || '*',
			'access-control-allow-methods': 'GET, POST, OPTIONS',
			'access-control-allow-headers': req.headers['access-control-request-headers'] || 'Content-Type, X-Requested-With, Origin',
			'access-control-max-age': 86400
		});
	}
	if (req.method.toUpperCase() === 'OPTIONS') {
		res.status(204);
		res.end();
		return;
	}
	next();
};

module.exports = cors;