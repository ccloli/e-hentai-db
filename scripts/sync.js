const Basesync = require('./basesync');

class Sync extends Basesync { }

process.on('unhandledRejection', (err) => {
	console.log(err.stack);
	instance.connection.destroy();
});

const instance = new Sync();
instance.run().catch(err => {
	console.log(err.stack);
	instance.connection.destroy();
});