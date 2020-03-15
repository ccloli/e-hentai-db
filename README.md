# E-Hentai DB

Just another E-Hentai metadata database


## Requirements

- Node.js 8+

- MySQL 5.3+ / MariaDB 10+


## Setup & Start Up

**If you just want to see the data from `gdata.json`, use `0.1.x`, and if you want to keep your gallery up-to-date, use `0.2.x`. The `master` branch and `0.3.x` and latter includes more features like torrent hashes, and it may takes a long time to sync**

1. `git clone` the repo

2. Run `npm i --production` in the repo directory to install dependencies
    - If you want to build Web UI, use `npm i` directly, then run `npm run build`, the static Web UI files will be in `/dist` directory

3. Download `gdata.json` from [E-Hentai Forums](https://forums.e-hentai.org/index.php?s=&showtopic=201268&view=findpost&p=5474857) and place it into the repo directory

4. Import `struct.sql` into a MySQL / MariaDB database

5. Edit `config.js`, set database username, password, database name, etc.

6. Run `npm run import [file=gdata.json]` to import the JSON file into your database
    - If you want to update to latest galleries, run `npm run sync [host=e-hentai.org] [timestampOffset=0]`
    - If you want to resync gallery metadatas since a few hours ago, run `npm run resync [hour=24]`
    - If you want to mark all replaced galleries, run `npm run mark-replaced` (new galleries will mark them automatically)
    - If you want to get torrents from all galleries, run `npm run torrent-import [host=e-hentai.org]` (USE AT YOUR OWN RISK)
    - If you want to update torrents from torrent list, run `npm run torrent-sync [host=e-hentai.org]`
    - If you want to manually fetch some galleries, run `npm run fetch {gid}/{token} {gid}/{token} ...` or `npm run fetch [filename]`

7. Wait a few minutes, as it has about 800,000 records (on my PC it takes 260s, and on my server it's 850s)

8. Run `npm start`, the server should be run on `8880` port by default config


## Available APIs

All the params can be pass as a part of URL, or put it in search query. Like `/api/gallery/:gid/:token`, you can call it like `/api/gallery/123456/abcdef1234` or `/api/gallery?gid=123456&token=abcdef1234`.

The response type of all APIs are JSON, and follow the format below.

```js
{
    "code": 200,          // 200 = success
    "data": {...},        // response data
    "message": "success", // error message
    "total": 100          // result counts (if `data` is a list)
}
```

`data` should normally be a metadata, or a list of metadata, or `null` if any error happens. The format of metadata is based on E-Hentai's offical gallery JSON API, you can check it on [EHWiki](https://ehwiki.org/wiki/API). But data type may be a little different from offical API, like using `int` for `posted` and `filecount` instead of `string`.

```json
{
    "gid": 592178,
    "token": "41cc263dc7",
    "archiver_key": "434486--1617c38d90630b5e399e730d62dea241363cdce6",
    "title": "(Shota Scratch 5) [Studio Zealot (Various)] Bokutachi! Shotappuru!! (Boku no Pico)",
    "title_jpn": "(ショタスクラッチ5) [Studio Zealot (よろず)] ぼくたち!しょたっぷる!! (ぼくのぴこ)",
    "category": "Doujinshi",
    "thumb": "https://ehgt.org/4c/6a/4c6ad39fffcdefcb2cd35218a95395af2e5ad74d-1854978-2118-3000-jpg_l.jpg",
    "uploader": "tooecchi",
    "posted": 1368418878,
    "filecount": 63,
    "filesize": 75630519,
    "expunged": 0,
    "removed": 0,
    "replaced": 0,
    "rating": "4.54",
    "torrentcount": 1, // useless, count it by `torrents` instead
    "root_gid": 592178,
    "tags": [
        "male:crossdressing",
        "male:shotacon",
        "male:tomgirl",
        "male:yaoi",
        "artist:tower",
        "artist:mokkouyou bond",
        "male:anal",
        "male:schoolgirl uniform",
        "male:catboy",
        "artist:murasaki nyaa",
        "artist:po-ju",
        "artist:rustle",
        "artist:miyakawa hajime",
        "artist:fujinomiya yuu",
        "artist:tanuma yuuichirou",
        "male:school swimsuit",
        "artist:mikami hokuto",
        "artist:azuma kyouto",
        "male:josou seme",
        "parody:boku no pico",
        "male:frottage",
        "male:bloomers",
        "artist:nemunemu",
        "group:studio zealot",
        "artist:aoi madoka"
    ],
    "torrents": [
        {
            "id": 632947,
            "name": "(Shota Scratch 5) [Studio Zealot (Various)] Bokutachi! Shotappuru!! (Boku no Pico)",
            "hash": "2a4641feba9943b0e028927879ff6567e74bf0ae",
            "addedstr": "2019-02-28 00:39",
            "fsizestr": "72.13 MB",
            "uploader": "Hyenacub"
        }
    ]
}
```

### `/api/gallery/:gid/:token`

Alias: `/api/g/:gid/:token`

Get gallery metadata.

Query params:  
- `gid`: Gallery ID _(required)_
- `token`: Gallery token _(required)_

Returns: `metadata`

### `/api/list`  

Get a list of galleries.

Query params:  
- `page`: Page number _(default: `1`)_
- `limit`: Gallery number per page _(default: `10`, <= `25`)_

Returns: `metadata[]`

### `/api/category/:category`

Alias: `/api/cat/:category?page={page=1}&limit={limit=10}`

Get a list of galleries which matches one of specific categories, `category` can be a list split with `,`, then it will returns the matched galleries.

`category` can be a list of string or a number (use xor, and if you want to exclude some category, use negative number, like if you want to get a list of `Non-H` galleries, the `category` can be one of `Non-H`, `256` or `-767`)

```
Misc                1           (1 << 0)
Doujinshi           2           (1 << 1)
Manga               4           (1 << 2)
Artist CG           8           (1 << 3)
Game CG             16          (1 << 4)
Image Set           32          (1 << 5)
Cosplay             64          (1 << 6)
Asian Porn          128         (1 << 7)
Non-H               256         (1 << 8)
Western             512         (1 << 9)
```

Query params:  
- `category`: Gallery category _(required)_
- `page`: Page number _(default: `1`)_
- `limit`: Gallery number per page _(default: `10`, <= `25`)_

Returns: `metadata[]`

### `/api/tag/:tag`  

Get a list of galleries which matches ALL of specific tags, `tag` can be a list split with `,`, then it will returns the matched galleries.

The tag should include the category type of tag, like if you want to search some full-colored Chinese translated furry galleries with male fox, you can try `/api/tag/language:chinese,male:furry,male:fox,full%20color`.

Query params:  
- `tag`: Tags _(required)_
- `page`: Page number _(default: `1`)_
- `limit`: Gallery number per page _(default: `10`, <= `25`)_

Returns: `metadata[]`

### `/api/uploader/:uploader`  

Get a list of galleries which uploaded by soneone.

Query params:  
- `uploader`: Uploader _(required)_
- `page`: Page number _(default: `1`)_
- `limit`: Gallery number per page _(default: `10`, <= `25`)_

Returns: `metadata[]`

### `/api/search`  

Get a list of galleries which matches all the query requests.

The rule of `keyword` is the same as E-Hentai:
- If you want to search an uploader, use `uploader:{uploader}`
- If you want to search a tag, use `{tagType}:{tagName}$`, and if `tagName` contains space, quote it and `$`, like `{tagType}:"{tagName}$"`
- If you want to search a word, just put it, and if it contains space, quote it like `"{keyword}"`

You can use multiple keywords, split them with space `%20`, relations between all the keywords are `AND` (except `uploder` uses `OR`), so in theory more keywords will get more accure results

Query params:  
- `keyword`: Search keywords, split them with space `%20`
- `category`: Gallery category, same as `/api/category`
- `expunged`: Show expunged gallery _(default: `0`)_
- `removed`: Show removed gallery _(default: `0`)_
- `replaced`: Show replaced gallery _(default: `0`)_
- `minpage`: Show gallery with page count larger than this _(default: `0`)_
- `maxpage`: Show gallery with page count smaller than this _(default: `0`)_
- `minrating`: Show gallery with minimal stars (includes minus half stars) _(default: `0`, <= `5`)_
- `page`: Page number _(default: `1`)_
- `limit`: Gallery number per page _(default: `10`, <= `25`)_

Returns: `metadata[]`


## Notes

### It eats my memory when importing  

The import script will load the WHOLE JSON file (as I prefer to insert the older galleries, so I didn't import them by reading the file in chunk). So when importing, it may eat 1 GB ram or even more, make sure you've setup a swap file on your server

```sh
dd if=/dev/zero of=swapfile bs=1M count=2048
chmod 0600 swapfile
mkswap swapfile
swapon swapfile
```

![](https://user-images.githubusercontent.com/8115912/62408371-c0a4fb80-b5fa-11e9-8f17-f15b2c4ab505.png)

### I got duplicate records when re-importing  

~~Do not cancel when importing, as the import script doesn't support resume import, so you'll have to truncate all table or delete them and create a new one~~

Now the import script supports resume importing, you can cancel your imports and run `npm run import` at any time, it'll start from your last record

### The query speed is still too slow when querying multiple tags

Try adding indexes if you want

```sql
ALTER TABLE `gid_tid` ADD UNIQUE(`gid`, `tid`);
ALTER TABLE `gid_tid` ADD INDEX(`tid`);
ALTER TABLE `tag` ADD UNIQUE(`name`);
ALTER TABLE `gallery` ADD INDEX(`category`);
ALTER TABLE `gallery` ADD INDEX(`uploader`);
```

If you want to add all of these indexes, the database size will increased from 330 MB to about 500 MB

![](https://user-images.githubusercontent.com/8115912/62408338-54c29300-b5fa-11e9-81d1-7bb4bf5dd16c.png)

### No primary key in table `gid_tid`

I'm not sure should I add an `id` column, as I'm not using it to query. But if you want, try the following SQL, and it'll takes about 110 MB

```sql
ALTER TABLE `gid_tid` ADD `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST;
```

### Why MyISAM?

I've little knowledge with database, you can change `struct.sql` to use InnoDB or others you want

### The server quits when I exit the terminal  

Try `npm start &`, or use `PM2` or `forever` to keep it running in background

### Web UI is not included in git repository  

They may in GitHub release page, but if it's not here, you can build it by yourself, just run as simple as `npm i` then `npm run build`, and set `webui` to `true` in `config.js`.

### Why React, React Router, Moment.js ... are in `devDependencies`?

I prefer it's a Node.js project, and Web UI is just an optional function, also you can grab distributed Web UI files without building it. Whether you need Web UI or not, the front-end libraries are not touched when you setting up the server, as they've been packaged into distributed files.


## Todos (or not to do)

- [X] Advanced search (tags, category, uploader, keyword in one search)

- [X] Web UI

- [X] Torrent hashes

- [X] Update to latest galleries


## Thanks

- [Sachia Lanlus](https://forums.e-hentai.org/index.php?showuser=2351915), as he collects almost all the gallery metadatas before Ex downs and share the [`gdata.json`](https://forums.e-hentai.org/index.php?showtopic=201268&st=67900&p=5474857&#entry5474857)

- [Tlaster / ehdb](https://github.com/Tlaster/ehdb), the table structures are based on his SQLite database, as I've almost forgot how to handle the tag list with gallery

- [StackOverflow/11694761#21408164](https://stackoverflow.com/a/21408164), the answer helps me to handle multiple tags searching, the searching time of 3 tags is from 60s down to 1.7s on my PC

- [Tenboro](https://forums.e-hentai.org/index.php?showuser=6), the god who creates the world

- The community helps E-Hentai to overcome (YAY it's alive!)


## License

GPLv3