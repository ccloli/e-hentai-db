const mysql = require('mysql');
const fs = require('fs');
const { Buffer } = require('buffer');
const https = require('https');
const childProcess = require('child_process');
const config = require('../config');

class Resync {
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
		this.duration = process.argv[2] || '24';
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

	getResyncList() {
		return this.query('SELECT gid, token FROM gallery WHERE posted >= ?', [Math.floor(Date.now() / 1000) - this.duration * 3600]);
	}

	getMetadatas(gidlist) {
		return new Promise((resolve, reject) => {
			try {
				const data = JSON.stringify({
					method: 'gdata',
					gidlist,
					namespace: 1
				});
				const request = https.request({
					method: 'POST',
					hostname: 'api.e-hentai.org',
					path: '/api.php',
					headers: {
						'Accept': 'application/json;q=0.9,*/*',
						'Accept-Language': 'en-US;q=0.9,en;q=0.8',
						'Content-Type': 'application/json',
						'Content-Length': Buffer.byteLength(data),
						'DNT': 1,
						'Upgrade-Insecure-Requests': 1,
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.142 Safari/537.36'
					},
				} ,(res) => {
					if (res.statusCode !== 200) {
						reject(res);
					}

					let response = '';
					res.setEncoding('utf8');
					res.on('data', chunk => response += chunk);
					res.on('end', () => {
						try {
							resolve(JSON.parse(response).gmetadata);
						}
						catch (err) {
							reject(err);
						}
					});
				});

				request.on('error', reject);
				request.write(data);
				request.end();
			} catch (err) {
				reject(err);
			}
		});
	}

	sleep(time) {
		return new Promise(resolve => setTimeout(resolve, time * 1000));
	}

	async run() {
		const { connection } = this;

		connection.connect(async (err) => {
			if (err) {
				console.error(err.stack);
				return;
			}

			await this.query('SET NAMES UTF8MB4');
			const list = await this.getResyncList();
			connection.destroy();
			console.log(`got ${list.length} galleries to resync`);
			if (!list.length) {
				return;
			}

			let result = {};
			while (list.length) {
				await this.sleep(1);
				const curList = list.splice(0, 25).map(e => [e.gid, e.token]);
				console.log(`requesting metadata of ${curList[0][0]} to ${curList.slice(-1)[0][0]} (${curList.length})...`);
				const metadatas = await this.getMetadatas(curList);
				metadatas.forEach(e => result[e.gid] = e);
			}

			const path = `gdata-${Date.now()}.json`;
			fs.writeFileSync(path, JSON.stringify(result), 'utf8');
			console.log(`result is writted to ${path}, calling import script...`);

			const importProcess = childProcess.spawn('node', ['./scripts/import.js', path, '-f']);
			importProcess.stdout.on('data', (data) => {
				process.stdout.write(data.toString());
			});
			importProcess.stderr.on('data', (data) => {
				process.stderr.write(data.toString());
			});
			importProcess.on('close', (code) => {
				console.log(`import script is exited with code ${code}`);
			});
		});
	}
}

process.on('unhandledRejection', (err) => {
	console.log(err.stack);
	instance.connection.destroy();
});

const instance = new Resync();
instance.run().catch(err => {
	console.log(err.stack);
	instance.connection.destroy();
});