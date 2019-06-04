import fs from 'fs-extra';
import producer from './lib/examinationPages';
import fetch from 'node-fetch';
import { getBPlanDB, getBaseUrl, getTileCheckUrls } from './lib/tilesTools';
import produceExaminationPages from './lib/examinationPages';

const args = process.argv.slice(2);

let tilesFolder = args[0];
let examinationPagesFolder = args[1];

const potFolders = [
	'/bplaene/rechtswirksam/',
	'/bplaene/verfahren/',
	'/bplaene_dokumente/abgelaufen/',
	'/bplaene_dokumente/im_Verfahren/',
	'/bplaene_dokumente/rechtsverbindlich/'
];

console.log('arguments: ' + args);

async function prod(tilesFolder, examinationPagesFolder) {
	let bplaene = await getBPlanDB();

	let urlsWithBPlan = [];

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

	// {
	//     "bplan": "1000",
	//     "doc": {
	//       "file": "B1000_DBA.pdf",
	//       "url": "http://www.wuppertal.de/geoportal/bplaene/rechtswirksam/B1000_DBA.pdf"
	//     },
	//     "index": 0,
	//     "page": 0,
	//     "humantesturl": "https://aaa.cismet.de/tiles/bplaene/rechtswirksam/B1000_DBA.pdf/0/0/0.png"
	//   }

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
	//console.log('zoomlevelzerourls', zoomlevelzerourls);

	produceExaminationPages('/current', zoomlevelzerourls);
}

prod(tilesFolder, examinationPagesFolder).then(() => {});
