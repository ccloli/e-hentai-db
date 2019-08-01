const express = require('express');
const path = require('path');
const router = require('./router');
const useCors = require('./util/useCors');
const config = require('../config');
const { port = 8880, cors = false, corsOrigin } = config;


const app = express();

app.use(useCors(cors, corsOrigin));
app.all('/', (req, res) => {
	res.sendFile(path.resolve(__dirname, './assets/sadpanda.jpg'), {
		maxAge: 86400
	});
});
app.use('/', router);
app.listen(port, () => {
	console.log(`Server is now listening on port ${port}`);
});