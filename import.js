const mysql = require('mysql');
const fs = require('fs');
const config = require('./config');

class Import {
	constructor() {
		this.connection = mysql.createConnection({
			host: config.dbHost,
			port: config.dbPort,
			user: config.dbUser,
			pass: config.dbPass,
			database: config.dbName,
			timeout: 10e3,
		});

		this.tagMap = {};
		this.query = this.query.bind(this);
		this.readFile = this.readFile.bind(this);
		this.run = this.run.bind(this);
	}

	query(...args) {
		return new Promise((resolve, reject) => {
			try {
				this.connection.query(...args, (error, results, fields) => {
					if (error) {
						reject(error);
						return;
					}
					resolve(results);
				});
			} catch(err) {
				reject(err);
			}
		});
	}

	readFile() {
		return new Promise((resolve, reject) => {
			try {
				// work around with kMaxLength
				let data = {};
				let lastChunk = '';
				const rstream = fs.createReadStream('./gdata.json', 'utf8');

				const parseChunk = (chunk) => {
					const result = chunk.match(/^{?"(\d+)":\s*?({[\s\S]+?})}?$/);
					const [, key, value] = result;
					data[key] = JSON.parse(value);
				};

				rstream.on('error', reject);
				rstream.on('data', (chunk) => {
					const parts = (lastChunk + chunk).split(/,\s(?="\d+":)/);
					// last part may incomplete
					lastChunk = parts.pop();
					parts.forEach(parseChunk);
				});
				rstream.on('end', () => {
					// finally parse last chunk
					parseChunk(lastChunk);
					resolve(data);
				});
			} catch(err) {
				reject(err);
			}
		});
	}

	async run() {
		const { tagMap, connection } = this;

		const t = new Date();
		console.log(`loading gdata.json at ${t}`);

		const data = await this.readFile();
		// prefer to insert the smaller galleries first
		const ids = Object.keys(data).sort((a, b) => a - b);
		const length = ids.length;

		const lt = new Date();
		console.log(`loaded gdata.json at ${lt}, got ${length} records, total time ${lt - t}ms`);

		connection.connect(async (err) => {
			if (err) {
				console.error(err.stack);
				return;
			}
			console.log(`connected as id ${connection.threadId}`);
			const ct = new Date();
			console.log(`started inserting at ${ct}`);

			await this.query('SET NAMES UTF8');

			let index = 0;
			for (let id of ids) {
				index++;
				const item = data[id];
				// item may have other keys like `error`
				const {
					tags, gid, token, archiver_key, title, title_jpn, category, thumb, uploader,
					posted, filecount, filesize, expunged, rating, torrentcount
				} = item;

				const newTags = tags.filter(e => !tagMap[e]);
				if (newTags.length) {
					// insert multiple rows only returns the last insert id
					// to make it simple, select them again, but it may affect performance
					await this.query('INSERT INTO tag (name) VALUES ?', [newTags.map(e => [e])]);
					const results = await this.query('SELECT * FROM tag WHERE `name` IN (?)', [newTags]);
					results.forEach((e) => tagMap[e.name] = e.id);
				}

				const queries = []; 
				queries.push(this.query('INSERT INTO gallery SET ?', {
					gid, token, archiver_key, title, title_jpn, category, thumb, uploader,
					posted, filecount, filesize, expunged, rating, torrentcount
				}));
				if (tags.length) {
					queries.push(this.query('INSERT INTO gid_tid (gid, tid) VALUES ?', [
						tags.map(e => [+id, tagMap[e]])
					]));
				}
				await Promise.all(queries);
				if (index % 1000 === 0 || index === length) {
					console.log(`inserted gid = ${id} (${index}/${length})`);
				}
			}
			
			console.log(`inserts complete`);
			const nt = new Date();
			console.log(`finished at ${nt}, total time ${nt - ct}ms`);

			connection.destroy();
		});
	}
}

process.on('unhandledRejection', (err) => {
	console.log(err.stack);
	instance.connection.destroy();
});

const instance = new Import();
instance.run().catch(err => {
	console.log(err.stack);
	instance.connection.destroy();
});