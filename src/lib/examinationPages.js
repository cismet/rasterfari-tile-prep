import ColorHash from 'color-hash';
import fs from 'fs-extra';
import { getBaseUrl, getBPlanDB, getTileCheckUrls } from './tilesTools';

const chunk = (arr, size) =>
	arr.reduce((acc, _, i) => (i % size ? acc : [ ...acc, arr.slice(i, i + size) ]), []);

const getColor = (line) => {
	let colorHash = new ColorHash({ saturation: 0.3 });

	return colorHash.hex('' + line);
};
const docViewerService = 'https://alpha-wunda-geoportal.cismet.de';
//const docViewerService = 'http://localhost:3000';

export default function produceExaminationPagesFromZoomLevelzeroUrls(
	outFolderForChecks,
	zoomlevelzerourls
) {
	let counter = 0;
	let imagelinks = [];

	for (const check of zoomlevelzerourls) {
		let c = getColor(
			check.index + 1 + '.' + check.bplan + '...' + (check.index + 1) + '...' + check.doc.file
		);
		imagelinks.push(
			'<div style="float: left;"><a target="_docviewer" href="' +
				docViewerService +
				'/#/docs/bplaene/' +
				check.bplan +
				'/' +
				(check.index + 1) +
				'/' +
				(check.page + 1) +
				'"><img style="background:' +
				c +
				';" title="' +
				check.bplan +
				'.' +
				(check.index + 1) +
				'.' +
				(check.page + 1) +
				'" src="' +
				check.humantesturl +
				'"/></a><div> &uarr;' +
				check.bplan +
				'/' +
				(check.index + 1) +
				'/' +
				(check.page + 1) +
				' &uarr;</div></div>\n'
		);
	}
	let chunks = chunk(imagelinks, 500);

	let chunkIndex = 0;
	for (const c of chunks) {
		let examinationPageHtml =
			'<html><head><meta charset="UTF-8"></head><style>body {font-family: Arial;}</style>';
		let next, prev;
		if (chunkIndex !== chunks.length - 1) {
			next = '<a href="examination-' + (chunkIndex + 1) + '.html"> &gt;&gt; </a>';
		}
		if (chunkIndex !== 0) {
			prev = '<a href="examination-' + (chunkIndex - 1) + '.html"> &lt;&lt; </a>';
		}
		examinationPageHtml +=
			'<h1 align="center"> ' +
			(prev || '') +
			(chunkIndex + 1) +
			'/' +
			chunks.length +
			(next || '') +
			'</h1>\n';
		for (let imageLine of c) {
			examinationPageHtml += imageLine;
		}

		examinationPageHtml +=
			'<div style="clear:both;"><h1 align="center"> ' +
			(prev || '') +
			(chunkIndex + 1) +
			'/' +
			chunks.length +
			(next || '') +
			'</h1></div>\n';

		examinationPageHtml += '</html>';
		const dir = outFolderForChecks + '/';
		fs.ensureDirSync(dir);

		const fileName = dir + 'examination-' + chunkIndex + '.html';
		console.log('write ' + fileName);

		fs.writeFileSync(fileName, examinationPageHtml, 'utf8');

		chunkIndex++;
	}
}

export async function produceExaminationPagesFromTilesFolder(
	topicname,
	tilesFolder,
	examinationPagesFolder
) {
	let bplaene = await getBPlanDB();

	const potFolders = [
		'/bplaene/rechtswirksam/',
		'/bplaene/verfahren/',
		'/bplaene_dokumente/abgelaufen/',
		'/bplaene_dokumente/im_Verfahren/',
		'/bplaene_dokumente/rechtsverbindlich/'
	];
	let urlsWithBPlan = [];
	console.log('bplaene.length', bplaene.length);

	for (let bpl of bplaene) {
		let allUrls = bpl.m.plaene_rk.concat(bpl.m.plaene_nrk, bpl.m.docs);
		let docIndex = 0;
		let planSection = true;
		let x = 0;
		for (let url of allUrls) {
			if (planSection && bpl.m.docs.indexOf(url) !== -1) {
				planSection = false;
				docIndex++; //increment index because of the describing meta document (first document after the real plans)
			}
			urlsWithBPlan.push({
				nummer: bpl.s,
				index: docIndex++,
				url: getBaseUrl(url.url).replace('https://aaa.cismet.de/tiles', '')
			});
		}
	}

	console.log('urlsWithBPlan.length', urlsWithBPlan.length);

	let hits = [];
	for (let folder of potFolders) {
		try {
			let filesInFolder = fs.readdirSync(tilesFolder + folder);

			for (let file of filesInFolder) {
				let found = urlsWithBPlan.filter((x) => {
					return x.url === folder + file;
				});

				if (found.length > 0) {
					hits = hits.concat(found);
				}
			}
		} catch (e) {}
	}

	let metaInfErrors = [];

	let zoomlevelzerourls = [];
	for (let hit of hits) {
		let metaInfUrl = tilesFolder + hit.url + '/meta.json';

		let metaInf;
		try {
			metaInf = JSON.parse(fs.readFileSync(metaInfUrl, 'utf8'));
		} catch (e) {
			metaInfErrors.push(hit);
		}
		if (metaInf) {
			for (let p = 0; p < metaInf.pages; ++p) {
				let zoomlevelzerourl = {
					bplan: hit.nummer,
					doc: {
						file: 'not needed',
						url: hit.url
					},
					index: hit.index,
					page: p,
					humantesturl: getTileCheckUrls(
						'https://aaa.cismet.de/tiles/' + hit.url,
						metaInf.pages,
						p,
						1
					)[0]
				};
				zoomlevelzerourls.push(zoomlevelzerourl);
			}
		}
	}

	console.log('Anzahl Layer', hits.length);

	console.log('Anzahl metaInf Errors', metaInfErrors.length);
	for (let error of metaInfErrors) {
		console.log(
			'Fehler in der metaInf Datei der folgenden Url. Wahrscheinlich bei der Konvertierung des PDF etwas schiefgegangen.',
			error
		);
	}

	produceExaminationPagesFromZoomLevelzeroUrls(examinationPagesFolder, zoomlevelzerourls);
}
