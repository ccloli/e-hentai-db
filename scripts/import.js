const mysql = require('mysql');
const fs = require('fs');
const config = require('../config');

class Import {
	constructor() {
		this.connection = mysql.createConnection({
			host: config.dbHost,
			port: config.dbPort,
			user: config.dbUser,
			password: config.dbPass,
			database: config.dbName,
			timeout: 10e3,
		});

		this.tagMap = {};
		this.query = this.query.bind(this);
		this.readFile = this.readFile.bind(this);
		this.run = this.run.bind(this);
		this.filePath = process.argv[2] || './gdata.json';
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
				const rstream = fs.createReadStream(this.filePath, 'utf8');

				const parseChunk = (chunk) => {
					const result = chunk.match(/^{?"(\d+)":\s*?({[\s\S]+?})}?$/);
					const [, key, value] = result;
					data[key] = JSON.parse(value);
				};

				rstream.on('error', reject);
				rstream.on('data', (chunk) => {
					const parts = (lastChunk + chunk).split(/,\s?(?="\d+":)/);
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

	loadTags() {
		return this.query('SELECT * FROM tag').then((data) => {
			const result = {};
			data.forEach(e => result[e.name] = e.id);
			return result;
		});
	}

	loadGalleries() {
		return this.query('SELECT gid, posted, bytorrent FROM gallery').then((data) => {
			const result = {};
			data.forEach(e => result[e.gid] = e.posted);
			return result;
		});
	}

	async run() {
		const { connection } = this;

		const t = new Date();
		console.log(`loading gdata.json at ${t}`);

		const data = await this.readFile();
		// prefer to insert the smaller galleries first
		let ids = Object.keys(data).sort((a, b) => a - b);
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

			await this.query('SET NAMES UTF8MB4');

			this.tagMap = await this.loadTags();
			const galleries = await this.loadGalleries();

			let index = 0;
			let inserted = 0;
			const { tagMap } = this;
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
					const { insertId } = await this.query('INSERT INTO tag (name) VALUES ?', [newTags.map(e => [e])]);
					const results = await this.query('SELECT * FROM tag WHERE id >= ?', [insertId]);
					results.forEach((e) => tagMap[e.name] = e.id);
				}

				const queries = []; 
				if (!galleries[gid]) {
					inserted++;
					queries.push(this.query('INSERT INTO gallery SET ?', {
						gid, token, archiver_key, title, title_jpn, category, thumb, uploader,
						posted, filecount, filesize, expunged, rating, torrentcount
					}));
					if (tags.length) {
						queries.push(this.query('INSERT INTO gid_tid (gid, tid) VALUES ?', [
							tags.map(e => [+id, tagMap[e]])
						]));
					}
				}
				else if (posted > galleries[gid] || galleries.bytorrent) {
					inserted++;
					const curTags = (await this.query('SELECT tid FROM gid_tid WHERE gid = ?', [gid])).map(e => e.tid);
					const tids = tags.map(e => tagMap[e]);
					const addTids = tids.filter(e => curTags.indexOf(e) < 0);
					const delTids = curTags.filter(e => tids.indexOf(e) < 0);
					queries.push(this.query('UPDATE gallery SET ? WHERE gid = ?', [{
						token, archiver_key, title, title_jpn, category, thumb, uploader,
						posted, filecount, filesize, expunged, rating, torrentcount, bytorrent: 0
					}, gid]));
					if (addTids.length) {
						queries.push(this.query('INSERT INTO gid_tid (gid, tid) VALUES ?', [
							addTids.map(e => [+id, e])
						]));
					}
					if (delTids.length) {
						queries.push(this.query('DELETE FROM gid_tid WHERE (gid, tid) IN (?)', [
							delTids.map(e => [+id, e])
						]));
					}
				}
				else {
					continue;
				}
				await Promise.all(queries);
				if (inserted % 1000 === 0 || index === length) {
					console.log(`inserted gid = ${id} (${index}/${length})`);
				}
			}
			
			console.log(`inserts complete, inserted ${inserted} galleries`);
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