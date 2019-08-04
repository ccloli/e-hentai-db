const getResponse = (data, code = 200, message = '', rest) => ({
	code, data, message, ...rest
});

module.exports = getResponse;