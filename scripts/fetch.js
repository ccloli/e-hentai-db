const fs = require('fs');
const { Buffer } = require('buffer');
const https = require('https');
const childProcess = require('child_process');

class Fetch {
	constructor() {
		this.run = this.run.bind(this);
		if (!process.argv[2]) {
			throw new Error('Please specify input file or gid/token');
		}
		if (/\d+[/,_\s][0-9a-f]/.test(process.argv[2])) {
			this.fetchList = process.argv.slice(2).map(e => e.split(/\/g\//).pop().split(/[/,_\s]/));
		}
		else {
			this.fetchList = fs.readFileSync(process.argv[2], {
				encoding: 'utf8'
			}).split(/\r?\n/).map(e => e.trim()).filter(e => e).map(e => e.split(/\/g\//).pop().split(/[/,_\s]/));
		}
		this.retryTimes = 3;
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
		const list = this.fetchList.map(([gid, token]) => ({ gid, token }));
		console.log(`got ${list.length} galleries to resync`);
		if (!list.length) {
			return;
		}

		let result = {};
		while (list.length) {
			await this.sleep(1);
			const curList = list.splice(0, 25).map(e => [e.gid, e.token]);
			console.log(`requesting metadata of ${curList[0][0]} to ${curList.slice(-1)[0][0]} (${curList.length})...`);
			const metadatas = await this.retryResolver(() => this.getMetadatas(curList), 3);
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
	}
}

process.on('unhandledRejection', (err) => {
	console.log(err.stack);
});

const instance = new Fetch();
instance.run().catch(err => {
	console.log(err.stack);
});