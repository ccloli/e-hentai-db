SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

CREATE TABLE IF NOT EXISTS `gallery` (
  `gid` int(11) NOT NULL,
  `token` char(10) NOT NULL,
  `archiver_key` varchar(60) NOT NULL,
  `title` varchar(300) NOT NULL,
  `title_jpn` varchar(300) NOT NULL,
  `category` varchar(15) NOT NULL,
  `thumb` varchar(150) NOT NULL,
  `uploader` varchar(50) DEFAULT NULL,
  `posted` int(11) NOT NULL,
  `filecount` int(11) NOT NULL,
  `filesize` bigint(20) NOT NULL,
  `expunged` tinyint(1) NOT NULL,
  `removed` tinyint(1) NOT NULL DEFAULT 0,
  `rating` char(4) NOT NULL,
  `torrentcount` int(11) NOT NULL,
  `root_gid` int(11) DEFAULT NULL,
  `bytorrent` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`gid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `gid_tid` (
  `gid` int(11) NOT NULL,
  `tid` int(11) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tag` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `torrent` (
  `id` int(11) NOT NULL,
  `gid` int(11) NOT NULL,
  `name` varchar(300) NOT NULL,
  `hash` char(40) NOT NULL,
  `addedstr` varchar(20) DEFAULT NULL,
  `fsizestr` varchar(15) DEFAULT NULL,
  `uploader` varchar(50) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;
