const mysql = require('mysql');
const fs = require('fs');
const http = require('http');
const https = require('https');
const config = require('../config');

class TorrentImport {
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
		this.loadProxies = this.loadProxies.bind(this);
		this.getNotInited = this.getNotInited.bind(this);
		this.initProxy = this.initProxy.bind(this);
		this.requestProxy = this.requestProxy.bind(this);
		this.releaseProxy = this.releaseProxy.bind(this);
		this.getTorrents = this.getTorrents.bind(this);
		this.getExistTorrents = this.getExistTorrents.bind(this);
		this.sleep = this.sleep.bind(this);
		this.run = this.run.bind(this);
		this.getExistTorrents = this.getExistTorrents.bind(this);
		this.run = this.run.bind(this);
		this.host = process.argv[2] || 'e-hentai.org';
		this.cookies = this.loadCookies();
		this.proxies = this.loadProxies();
		this.proxyList = [];
		this.limit = 5;
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

	loadProxies() {
		try {
			return fs.readFileSync('.proxies', 'utf8').split(/\n/)
				.map(e => e.trim()).filter(e => e);
		} catch (err) {
			return '';
		}
	}

	async getNotInited() {
		return (await this.query('SELECT gid, token FROM gallery WHERE root_gid IS NULL AND removed = 0 ORDER BY gid ASC'));
	}

	initProxy(server) {
		return new Promise((resolve, reject) => {
			const [host, port = 80] = server.split(':');
			const request = http.request({
				method: 'CONNECT',
				host,
				port,
				path: `${this.host}:443`
			});
			request.on('connect', (res, socket) => {
				if (res.statusCode === 200 && socket) {
					// console.log(`inited proxy ${server}`);
					resolve(request);
				} else {
					reject(`proxy res.statusCode = ${res.statusCode}`);
				}
			});
			request.setTimeout(10e3, () => {
				request.abort();
				reject(`proxy ${server} timed out`);
			});
			request.on('error', (err) => {
				reject(err);
			});
			request.end();
			request.requestServer = server;
		});
	}

	async requestProxy() {
		const proxyList = this.proxyList.filter(e => !e.using);
		const proxy = proxyList[Math.floor(Math.random() * proxyList.length)];
		if (proxy) {
			proxy.using = true;
			return proxy;
		}
		else {
			try {
				const newProxy = await this.initProxy(
					this.proxies[Math.floor(Math.random() * this.proxies.length)]
				);
				newProxy.on('close', () => {
					this.releaseProxy(newProxy, true);
				});
				newProxy.on('error', () => {
					this.releaseProxy(newProxy, true);
				});
				this.proxyList.push(newProxy);
				newProxy.using = true;
				return newProxy;
			}
			catch(err) {
				return await this.requestProxy();
			}
		}
	}

	releaseProxy(proxy) {
		proxy.using = false;
		// reuse connection is not helping, response will be timed out
		const index = this.proxyList.indexOf(proxy);
		if (index >= 0) {
			this.proxyList.splice(index, 1);
		}
		proxy.abort();
	}

	async getTorrents(gid, token) {
		let connect;
		if (this.proxies.length) {
			connect = await this.requestProxy();
			// console.log(`${gid} uses proxy ${connect.requestServer}`);
		}
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
					...(!!connect && {
						socket: connect.socket,
						agent: false,
					})
				}, (res) => {
					let response = '';
					res.setEncoding('utf8');
					res.on('data', chunk => response += chunk);
					res.on('end', () => {
						try {
							if (connect) {
								this.releaseProxy(connect);
							}
							const torrentRegex = /name="gtid"\svalue="(\d+?)"[\s\S]*?Posted:<.*?(\d{4}-\d{2}-\d{2} \d{2}:\d{2})<\/[\s\S]*?Size:.*>\s?([\d.KMGTB ]+)<\/[\s\S]*?Uploader:.*?([\S]+)<\/[\s\S]*?(?:([0-9a-f]{40})\.torrent|(value="Expunged"))[\s\S]*?>(?:\s*?&nbsp;\s*?)?(.*?)(?:<\/a>)?<\/td>\s*?<\/tr>\s*?<\/table>/g;
							let exec;
							let list = [];
							// eslint-disable-next-line no-cond-assign
							while (exec = torrentRegex.exec(response)) {
								const [, gtid, posted, size, uploader, hash, expunged, name] = exec;
								list.push({ gtid, posted, size, uploader, hash, expunged: !!expunged, name });
							}
							const gid = (response.match(/\/(\d+)\/announce/) || [])[1];
							let removed = false;
							let pending = false;
							// console.log(gid, list);
							if (!gid) {
								if (response.indexOf('Your IP address has been temporarily banned') >= 0) {
									if (connect) {
										this.releaseProxy(connect);
										const index = this.proxies.indexOf(connect.requestServer);
										if (index >= 0) this.proxies.splice(index, 1);
										console.log(`${connect.requestServer} is banned`);
									} else {
										console.log(response);
										process.exit();
									}
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
					if (connect) {
						this.releaseProxy(connect);
					}
					reject(`request of ${gid} timed out (use ${connect ? connect.requestServer : 'direct'})`);
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
			const notInited = await this.getNotInited();
			const length = notInited.length;
			console.log(`${length} galleries needs to import`);

			let count = 0;
			let finished = 0;
			const requestQueue = async () => {
				if (!notInited.length && finished === length) {
					console.log(`${finished} galleries of torrents are imported`);
					connection.destroy();
					process.exit();
					return;
				}
				for (; count <= this.limit && notInited.length; count++) {
					const item = notInited.shift();
					this.getTorrents(item.gid, item.token).then(async (res) => {
						const { gid, list, removed, pending } = res;
						if (removed) {
							await this.query('UPDATE gallery SET removed = 1 WHERE gid = ?', [item.gid]);
							console.log(`*** gid ${item.gid} deleted!`);
						} else if (pending) {
							console.log(`*** gid ${item.gid} is pending for cache refresh`);
						} else {
							if (!gid) {
								notInited.unshift(item);
								count--;
								requestQueue();
								return;
							}
							const hashes = await this.getExistTorrents(gid);
							const newTorrents = list.filter(e => hashes.indexOf(e.hash) < 0);
							await Promise.all(newTorrents.map(
								e => this.query('INSERT INTO torrent SET ? ON DUPLICATE KEY UPDATE ?', [{
									id: e.gtid,
									gid,
									addedstr: e.posted,
									fsizestr: e.size,
									uploader: e.uploader,
									hash: e.hash,
									name: e.name,
									expunged: !!e.expunged,
								}, {
									expunged: !!e.expunged,
								}])
							));
							// set exist root_gid galleries to replaced, this improves search performance
							await this.query('UPDATE gallery SET replaced = 1 WHERE root_gid = ?', [gid]);
							await this.query('UPDATE gallery SET root_gid = ? WHERE gid = ?', [gid, item.gid]);
							if (+gid !== +item.gid) {
								console.log(`*** root gid of ${item.gid} is ${gid}`);
							}
							if (newTorrents.length) {
								console.log(`*** got ${newTorrents.length} new torrents for gid ${gid}`);
							}
						}
						finished++;
						if (finished % 100 === 0) {
							console.log(`*** imported ${finished} galleries of ${length} ***`);
						}
						await this.sleep(1);
						count--;
						requestQueue();
					}).catch(async (err) => {
						console.error(err);
						notInited.unshift(item);
						await this.sleep(1);
						count--;
						requestQueue();
					});
				}
			};
			requestQueue();
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

const instance = new TorrentImport();
instance.run().catch(err => {
	console.log(err.stack);
	instance.connection.destroy();
});