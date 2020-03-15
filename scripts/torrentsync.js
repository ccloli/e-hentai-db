const mysql = require('mysql');
const fs = require('fs');
const https = require('https');
const childProcess = require('child_process');
const config = require('../config');

class TorrentSync {
	constructor() {
		this.connection = mysql.createConnection({
			host: config.dbHost,
			port: config.dbPort,
			user: config.dbUser,
			password: config.dbPass,
			database: config.dbName,
			timeout: 10e3,
		});

		this.initConnection = this.initConnection.bind(this);
		this.query = this.query.bind(this);
		this.loadCookies = this.loadCookies.bind(this);
		this.getLastTorrentId = this.getLastTorrentId.bind(this);
		this.getPages = this.getPages.bind(this);
		this.getTorrents = this.getTorrents.bind(this);
		this.getExistTorrents = this.getExistTorrents.bind(this);
		this.getMetadatas = this.getMetadatas.bind(this);
		this.sleep = this.sleep.bind(this);
		this.run = this.run.bind(this);
		this.host = process.argv[2] || 'e-hentai.org';
		let pages = process.argv[3] || 0;
		if (/^\d+$/.test(this.host)) {
			pages = this.hosts;
			this.host = 'e-hentai.org';
		}
		this.pages = +pages;
		this.cookies = this.loadCookies();
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
		} catch (err) {
			return '';
		}
	}

	async getLastTorrentId() {
		return ((
			await this.query('SELECT id FROM torrent ORDER BY id DESC LIMIT 1 OFFSET 0')
		)[0] || {}).id || 0;
	}

	async getExistTorrentIds() {
		return (
			await this.query('SELECT id FROM torrent')
		).map(e => e.id);
	}

	getPages(page = 0) {
		return new Promise((resolve, reject) => {
			try {
				const request = https.request({
					method: 'GET',
					hostname: this.host,
					path: `/torrents.php${ page ? `?page=${page}` : ''}`,
					headers: {
						'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*',
						'Accept-Language': 'en-US;q=0.9,en;q=0.8',
						'DNT': 1,
						'Referer': `https://${this.host}/torrents.php`,
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
							const list = response.match(/gallerytorrents\.php\?gid=(\d+)&(?:amp;)?t=([0-9a-f]{10})&(?:amp;)?gtid=(\d+)"/g);
							resolve(list.map(e => {
								const [, gid, token, gtid] = e.match(/gallerytorrents\.php\?gid=(\d+)&(?:amp;)?t=([0-9a-f]{10})&(?:amp;)?gtid=(\d+)"/) || [];
								return [gid, token, gtid];
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

	async getTorrents(gid, token) {
		return await new Promise((resolve, reject) => {
			try {
				const request = https.request({
					method: 'GET',
					hostname: this.host,
					path: `/gallerytorrents.php?gid=${gid}&t=${token}`,
					headers: {
						'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*',
						'Accept-Language': 'en-US;q=0.9,en;q=0.8',
						'DNT': 1,
						'Referer': `https://${this.host}/g/${gid}/${token}/`,
						'Upgrade-Insecure-Requests': 1,
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.142 Safari/537.36',
						...(!!this.cookies && { cookie: this.cookies }),
					},
				}, (res) => {
					let response = '';
					res.setEncoding('utf8');
					res.on('data', chunk => response += chunk);
					res.on('end', () => {
						try {
							const torrentRegex = /name="gtid"\svalue="(\d+?)"[\s\S]*?Posted:<.*?(\d{4}-\d{2}-\d{2} \d{2}:\d{2})<\/[\s\S]*?Size:.*>\s?([\d.KMGTB ]+)<\/[\s\S]*?Uploader:.*?([\S]+)<\/[\s\S]*?([0-9a-f]{40})\.torrent.*?>(.*?)<\/a><\/td>/g;
							let exec;
							let list = [];
							// eslint-disable-next-line no-cond-assign
							while (exec = torrentRegex.exec(response)) {
								const [, gtid, posted, size, uploader, hash, name] = exec;
								list.push({ gtid, posted, size, uploader, hash, name });
							}
							const gid = (response.match(/\/(\d+)\/announce/) || [])[1];
							let removed = false;
							let pending = false;
							// console.log(gid, list);
							if (!gid) {
								if (response.indexOf('Your IP address has been temporarily banned') >= 0) {
									console.log(response);
									process.exit();
								} else if (response.indexOf('This gallery is currently unavailable') >= 0) {
									removed = true;
								} else if (response.indexOf('Gallery not found') >= 0) {
									pending = true;
								} else {
									reject(`res.statusCode = ${res.statusCode}`);
								}
							}
							resolve({ gid, list, removed, pending });
						}
						catch (err) {
							reject(err);
						}
					});
					res.on('error', reject);
				});

				request.setTimeout(20e3, () => {
					request.abort();
					reject(`request of ${gid} timed out`);
				});
				request.on('error', reject);
				request.end();
			} catch (err) {
				reject(err);
			}
		});
	}

	async getExistTorrents(gid) {
		return (await this.query('SELECT hash FROM torrent WHERE gid = ?', [gid])).map(e => e.hash);
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
				}, (res) => {
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
			const lastTorrentId = (await this.getLastTorrentId()) || 0;
			console.log(`last torrent id = ${lastTorrentId}`);

			const list = [];
			let page = 0;
			let finish = false;
			const existTorrentIdMap = (await this.getExistTorrentIds()).reduce((pre, e) => {
				pre[e] = 1;
				return pre;
			}, {});

			while (!finish) {
				await this.sleep(1);
				console.log(`requesting page ${page}...`);
				const curList = await this.getPages(page);
				console.log(`got gtid ${curList[0][2]} to ${curList.slice(-1)[0][2]}`);
				curList.forEach(e => {
					if ((this.pages || e[2] > lastTorrentId)) {
						if (!existTorrentIdMap[e[2]]) {
							list.push(e);
						}
					}
					else {
						finish = true;
					}
				});

				if (this.pages === page) {
					break;
				}
				page++;
			}

			if (!list.length) {
				console.log('no new torrents available');
				connection.destroy();
				process.exit();
			}

			const gidMap = {};
			list.forEach(e => {
				gidMap[e[0]] = (gidMap[e[0]] || 0) + 1;
			});
			const gids = Object.keys(gidMap);
			const existGallery = (await this.query('SELECT gid FROM gallery WHERE gid IN (?)', [gids])).map(e => +e.gid);
			const notExistGallery = gids.filter(e => existGallery.indexOf(+e) < 0);
			if (notExistGallery.length) {
				console.log(`${notExistGallery.length} galleries are not exist, try to add their metadatas first`);

				const result = {};
				while (notExistGallery.length) {
					await this.sleep(1);
					const curList = notExistGallery.splice(0, 25);
					console.log(`requesting metadata of ${curList[0]} to ${curList.slice(-1)[0]} (${curList.length})...`);
					const metadatas = await this.getMetadatas(
						curList.map(e => list.find(item => +item[0] === +e).slice(0, 2))
					);
					metadatas.forEach(e => result[e.gid] = e);
				}

				await new Promise(resolve => {
					const path = `gdata-${Date.now()}.json`;
					fs.writeFileSync(path, JSON.stringify(result), 'utf8');
					console.log(`result is writted to ${path}, calling import script...`);

					const importProcess = childProcess.spawn('node', ['./scripts/import.js', path]);
					importProcess.stdout.on('data', (data) => {
						process.stdout.write(data.toString());
					});
					importProcess.stderr.on('data', (data) => {
						process.stderr.write(data.toString());
					});
					importProcess.on('close', (code) => {
						console.log(`import script is exited with code ${code}`);
						resolve();
					});
				});

				await this.query('UPDATE gallery SET bytorrent = 1 WHERE gid IN (?)', [gids]);
			}

			const torrentResult = [];
			while (gids.length) {
				await this.sleep(1);
				const curid = gids.shift();
				const [gid, token] = list.find(e => +e[0] === +curid);
				const res = await this.getTorrents(gid, token);
				const { gid: rootGid, list: result, pending } = res;
				if (pending) {
					console.log(`*** gid ${gid} is pending for cache refresh`);
				} else {
					if (!rootGid) {
						gids.push(gid);
						continue;
					}
					const hashes = await this.getExistTorrents(rootGid);
					const newTorrents = result.filter(e => hashes.indexOf(e.hash) < 0);
					if (newTorrents.length) {
						torrentResult.push(...newTorrents.map(e => ({
							id: e.gtid,
							gid: rootGid,
							addedstr: e.posted,
							fsizestr: e.size,
							uploader: e.uploader,
							hash: e.hash,
							name: e.name
						})));
					}
					if (+gid !== +rootGid) {
						console.log(`*** root gid of ${gid} is ${rootGid}`);
					}
					if (newTorrents.length) {
						console.log(`*** got ${newTorrents.length} new torrents for gid ${gid}`);
					}
				}
			}

			await Promise.all(
				torrentResult.sort((a, b) => a.id - b.id).map(async (e) => {
					await this.query('INSERT INTO torrent SET ?', [e]);
					await this.query('UPDATE gallery SET root_gid = ? WHERE gid = ?', [e.gid, e.gid]);
				})
			);
			console.log('update torrents complete');
			connection.destroy();
			process.exit();
		});
	}
}

process.on('unhandledRejection', (err) => {
	console.log(err.stack);
	instance.connection.destroy();
});

process.on('uncaughtException', (err) => {
	console.log(err.stack);
});

const instance = new TorrentSync();
instance.run().catch(err => {
	console.log(err.stack);
	instance.connection.destroy();
});