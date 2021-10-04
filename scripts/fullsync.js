const fs = require('fs');
const childProcess = require('child_process');
const config = require('../config');
const { uriCallInterval, startPage } = config;
const Basesync = require('./basesync');

/**
 * A simple extension of the existing sync class.
 * This class will scan all pages and filter out existing galleries,
 * with the intent of adding missing ones to the database based on gid.
 *
 * Keep in mind that this process will go over all gallery pages,
 * and thus will take ages to complete
 * (4631 pages takes roughly 2,5 hours)
 * (25388 pages takes roughly 14 hours)
 */
class Fullsync extends Basesync {
	async run() {
		const { connection } = this;

		connection.connect(async (err) => {
			if (err) {
				console.error(err.stack);
				return;
			}

			await this.query('SET NAMES UTF8MB4');
			const galleries = await this.query('SELECT gid FROM gallery');
			// const galleries = Dbgalleries.
			// connection.destroy();
			console.log(`loaded ${galleries.length} gallery ids from db`);

			const list = [];
			let page = startPage;
			let finish = false;
			let galleriesLoadedFromPage;

			while (!finish) {
				galleriesLoadedFromPage = 0;
				await this.sleep(uriCallInterval);
				console.log(`requesting page ${page}...`);
				const curList = await this.getPages(page);
				console.log(`got ${curList[0][0]} to ${curList.slice(-1)[0][0]}`);
				curList.forEach(e => {
					if(!galleries.find((a) => a.gid == e[0])) {
						list.push(e);
						galleriesLoadedFromPage++;
					}
				});
				console.log(`loaded ${galleriesLoadedFromPage} from page ${page} (tot. ${list.length})`);

				if(list.length > 0) {
					await this.storeGalleries(list);
					list.length = 0;
				}

				page++;
			}

			if (!list.length) {
				console.log('no new gallery available');
				return;
			}
			console.log(`got ${list.length} new galleries of ${list[0][0]} to ${list.slice(-1)[0][0]}`);

			let result = {};
			let delCount = 25;
			let calls = Math.ceil(list.length / delCount);
			let curCall = 1;
			while (list.length) {
				await this.sleep(uriCallInterval);
				const curList = list.splice(0, delCount);
				console.log(`(${curCall}/${calls}) requesting metadata of ${curList[0][0]} to ${curList.slice(-1)[0][0]} (${curList.length})...`);
				const metadatas = await this.getMetadatas(curList);
				metadatas.forEach(e => result[e.gid] = e);
				curCall++;
			}

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
			});
		});
	}

	async storeGalleries(galleryList) {
		let result = {};
		let delCount = 25;
		while(galleryList.length) {
			await this.sleep(uriCallInterval);
			const curList = galleryList.splice(0, delCount);
			console.log(`requesting metadata of ${curList[0][0]} to ${curList.slice(-1)[0][0]} (${curList.length})...`);
			const metadatas = await this.getMetadatas(curList);
			metadatas.forEach(e => result[e.gid] = e);
		}

		const path = `gdata-${Date.now()}-${Math.random()}.json`;
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
		});
	}
}

process.on('unhandledRejection', (err) => {
	console.log(err.stack);
	instance.connection.destroy();
});

const instance = new Fullsync();
instance.run().catch(err => {
	console.log(err.stack);
	instance.connection.destroy();
});