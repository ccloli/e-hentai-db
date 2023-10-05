const mysql = require('mysql');
const fs = require('fs');
const { Buffer } = require('buffer');
const https = require('https');
const childProcess = require('child_process');
const config = require('../config');

class Sync {
	constructor() {
		this.query = this.query.bind(this);
		this.run = this.run.bind(this);
		this.host = process.argv[2] || 'e-hentai.org';
		let offset = process.argv[3] || 0;
		if (/^\d+$/.test(this.host)) {
			offset = this.host;
			this.host = 'e-hentai.org';
		}
		this.offset = Number.isNaN(-offset) ? 0 : -offset;
		this.cookies = this.loadCookies();
		this.retryTimes = 3;
		this.connection = this.initConnection();
	}

	initConnection() {
		const connection = mysql.createConnection({
			host: config.dbHost,
			port: config.dbPort,
			user: config.dbUser,
			password: config.dbPass,
			database: config.dbName,
			timeout: 10e3,
		});
		connection.on('error', (err) => {
			console.error(err);
			this.connection = this.initConnection();
			this.connection.connect();
		});
		return connection;
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

	loadCookies() {
		try {
			return fs.readFileSync('.cookies', 'utf8');
		} catch(err) {
			return '';
		}
	}

	async retryResolver(fn, time = 1, ...args) {
		for (let i = 0; i < time; i++) {
			try {
				return await fn(...args);
			} catch (err) {
				console.log(err.stack || err);
			}
		}
		throw new Error('Exceed maximum retry time');
	}

	async getLastPosted() {
		const { posted = 0 } = (await this.query('SELECT posted FROM gallery WHERE bytorrent = 0 ORDER BY posted DESC LIMIT 1 OFFSET 0'))[0] || {};
		return posted;
	}

	getPages(next = '', expunged = false) {
		return new Promise((resolve, reject) => {
			try {
				const request = https.request({
					method: 'GET',
					hostname: this.host,
					path: `/?next=${next}&f_cats=0&advsearch=1&f_sname=on&f_stags=on&f_sh=${expunged ? 'on' : ''}&f_spf=&f_spt=&f_sfl=on&f_sfu=on&f_sft=on`,
					headers: {
						'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*',
						'Accept-Language': 'en-US;q=0.9,en;q=0.8',
						'DNT': 1,
						'Referer': `https://${this.host}`,
						'Upgrade-Insecure-Requests': 1,
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.142 Safari/537.36',
						...(!!this.cookies && { cookie: this.cookies })
					}
				}, (res) => {
					if (res.statusCode !== 200) {
						reject(res);
					}

					let response = '';
					res.setEncoding('utf8');
					res.on('data', chunk => response += chunk);
					res.on('end', () => {
						try {
							const list = response.match(/gid=\d+&amp;t=[0-9a-f]{10}&.*?posted_.*?>\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}</g);
							resolve(list.map(e => {
								const [, gid, token, posted] = e.match(/gid=(\d+).*?t=([0-9a-f]{10}).*?>(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2})</) || [];
								return [gid, token, posted];
							}));
						}
						catch (err) {
							reject(err);
						}
					});
				});

				request.on('error', reject);
				request.end();
			} catch (err) {
				reject(err);
			}
		});
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
			let lastPosted = await this.getLastPosted();
			connection.destroy();
			console.log(`got last posted = ${lastPosted}`);
			if (this.offset) {
				lastPosted += this.offset * 3600;
				console.log(`offset last posted = ${lastPosted}`);
			}

			const list = [];

			const getPages = async (expunged) => {
				let page = 0;
				let finish = false;
				let next = '';

				while (!finish) {
					await this.sleep(1);
					console.log(`requesting ${expunged ? 'expunged' : 'default'} page ${page}...`);
					const curList = await this.retryResolver(() => this.getPages(next, expunged), this.retryTimes);
					console.log(`got ${curList[0][0]} to ${curList.slice(-1)[0][0]}`);
					curList.forEach(e => {
						if (new Date(`${e[2].split(' ').join('T')}Z`).getTime() > lastPosted * 1000) {
							list.push(e);
						}
						else {
							finish = true;
						}
					});
					page++;
					next = curList.slice(-1)[0][0];
				}
			};

			await getPages(false);
			await getPages(true);
			list.sort((a, b) => a[0] - b[0]);

			if (!list.length) {
				console.log('no new gallery available');
				return;
			}
			console.log(`got ${list.length} new galleries of ${list[0][0]} to ${list.slice(-1)[0][0]}`);

			let result = {};
			while (list.length) {
				await this.sleep(1);
				const curList = list.splice(0, 25);
				console.log(`requesting metadata of ${curList[0][0]} to ${curList.slice(-1)[0][0]} (${curList.length})...`);
				const metadatas = await this.retryResolver(() => this.getMetadatas(curList), this.retryTimes);
				metadatas.forEach(e => result[e.gid] = e);
			}

			const path = `gdata-${Date.now()}.json`;
			fs.writeFileSync(path, JSON.stringify(result), 'utf8');
			console.log(`result is writted to ${path}, calling import script...`);

			const importProcess = childProcess.spawn('node', ['./scripts/import.js', path, this.offset ? '-f' : ''].filter(e => e));
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

const instance = new Sync();
instance.run().catch(err => {
	console.log(err.stack);
	instance.connection.destroy();
});