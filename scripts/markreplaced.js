const mysql = require('mysql');
const config = require('../config');

class MarkReplaced {
	constructor() {
		this.connection = mysql.createConnection({
			host: config.dbHost,
			port: config.dbPort,
			user: config.dbUser,
			password: config.dbPass,
			database: config.dbName,
			timeout: 10e3,
		});

		this.query = this.query.bind(this);
		this.run = this.run.bind(this);
	}

	query(...args) {
		return new Promise((resolve, reject) => {
			try {
				this.connection.query(...args, (error, results) => {
					if (error) {
						reject(error);
						return;
					}
					resolve(results);
				});
			} catch (err) {
				reject(err);
			}
		});
	}

	async run() {
		const { connection } = this;

		connection.connect(async (err) => {
			if (err) {
				console.error(err.stack);
				return;
			}

			await this.query('SET NAMES UTF8MB4');
			await this.query('UPDATE gallery LEFT JOIN (SELECT root_gid, MAX(gid) AS max_gid, gid FROM gallery GROUP BY IFNULL(root_gid, gid)) AS t ON gallery.gid = t.max_gid SET gallery.replaced = t.max_gid IS NULL');
			connection.destroy();
		});
	}
}

process.on('unhandledRejection', (err) => {
	console.log(err.stack);
	instance.connection.destroy();
});

const instance = new MarkReplaced();
instance.run().catch(err => {
	console.log(err.stack);
	instance.connection.destroy();
});