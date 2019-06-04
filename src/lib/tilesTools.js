import fetch from 'node-fetch';
//import fs from 'fs';
import path from 'path';
import fs from 'fs-extra';
import cliProgress from 'cli-progress';
import produceExaminationPages from '../examinationPages';

export function getTileCheckUrls(url, pages, pageNo, maxzoomlevel) {
	let ret = [];
	let between = '';
	if (pages > 1) {
		between = '-' + pageNo;
	}
	for (let zl = 0; zl < maxzoomlevel; ++zl) {
		ret.push(url + between + '/' + zl + '/0/0.png');
	}
	return ret;
}

function fixUrlName(url) {
	return url
		.replace(/ /g, '_')
		.replace(/A\u0308/g, 'AE')
		.replace(/a\u0308/g, 'ae')
		.replace(/u\u0308/g, 'ue')
		.replace(/U\u0308/g, 'UE')
		.replace(/o\u0308/g, 'oe')
		.replace(/O\u0308/g, 'OE')
		.replace(/ä/g, 'ae')
		.replace(/ü/g, 'ue')
		.replace(/ö/g, 'oe')
		.replace(/Ä/g, 'AE')
		.replace(/Ü/g, 'UE')
		.replace(/Ö/g, 'OE')
		.replace(/ß/g, 'ss');
}

export function getBaseUrl(doc_url) {
	return fixUrlName(
		doc_url
			.replace(/^http/, 'https')
			.replace(/^httpss/, 'https')
			.replace('https://www.wuppertal.de/geoportal/', 'https://aaa.cismet.de/tiles/')
	);
}

export async function getBPlanDB() {
	console.log('Will get PlanDump ');

	const response = await fetch('https://wunda-geoportal.cismet.de/gaz/bplaene_complete.json', {
		method: 'get',
		headers: {
			'User-Agent':
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like ' +
				'Gecko) Chrome/56.0.2924.87 Safari/537.36'
		}
	});

	let status = await response.status;
	let content;
	if (status === 200) {
		try {
			content = await response.json();
		} catch (e) {
			console.log('Could not download bplaene_complete.json. No need to continue.', e);
			return undefined;
		}
	}
	return content;
}

export async function getMetaInfoForUrl(url, fileSystemChecks = false) {
	let response;
	if (!fileSystemChecks) {
		response = await fetch(url + '/meta.json', {
			method: 'get',
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like ' +
					'Gecko) Chrome/56.0.2924.87 Safari/537.36'
			}
		});

		let status = response.status;

		let content;
		if (status === 200) {
			try {
				content = await response.json();
			} catch (e) {
				status = 406; //Not Acceptable > no valid json
			}
		}
		return { status, content };
	} else {
		let file =
			url.replace('https://aaa.cismet.de/tiles/', './_tilesstoragemount/') + '/meta.json';

		if (fs.existsSync(file)) {
			response = {};
			response.status = 200;
			try {
				response.content = JSON.parse(fs.readFileSync(file, 'utf8'));
			} catch (e) {
				response.status = 406; //Not Acceptable > no valid json
			}
		} else {
			response = {};
			response.status = 404;
		}
		return { status: response.status, content: response.content };
	}
}
export async function checkUrlsSequentially(
	bplc,
	localPlanDump = false,
	localCheckDump = false,
	tileChecking = true,
	fileSystemChecks = false
) {
	let i = 0;
	let correctionDownloads = [];
	let docsCounter = 0;
	let pageCounter = 0;
	let bplanCounter = 0;
	const bar1 = new cliProgress.Bar({}, cliProgress.Presets.shades_classic);
	let errors = [];
	let downloadErrors = [];
	let downloadsNeeded = '';
	let doclogs = {};
	let zoomlevelzerourls = [];
	let wgetConfig = {};

	const breaking = 3; //100;
	if (!localCheckDump) {
		if (!localPlanDump) {
			bplc = await getBPlanDB();
			if (bplc === undefined) {
				process.exit(1);
			}
			fs.writeFileSync(
				'_internal/bplaene_complete.json',
				JSON.stringify(bplc, null, 0),
				'utf8'
			);
			console.log('PlanDump written');
		} else {
			bplc = JSON.parse(fs.readFileSync('_internal/bplaene_complete.json', 'utf8'));
			if (!bplc) {
				console.log('Could not download bplaene_complete.json. No need to continue.', e);
				process.exit(1);
			}
		}

		bar1.start(breaking || bplc.length, 0);
		for (const bpl of bplc) {
			bplanCounter++;
			bar1.update(bplanCounter);

			let allUrls = bpl.m.plaene_rk.concat(bpl.m.plaene_nrk, bpl.m.docs);
			let docIndex = 0;
			let planSection = true;
			for (const doc of allUrls) {
				docsCounter++;
				if (planSection && bpl.m.docs.indexOf(doc) !== -1) {
					planSection = false;
					docIndex++; //increment index because of the describing meta document (first document after the real plans)
				}
				let testbaseurl = getBaseUrl(doc.url);

				let result = await getMetaInfoForUrl(testbaseurl);
				let status = result.status;

				if (status !== 200) {
					errors.push(testbaseurl + '/meta.json >> ' + status);
					//console.log(testbaseurl + '/meta.json) >> ' + status);

					correctionDownloads.push(doc.url);
					let tcobject = {
						doc,
						testbaseurl,
						testbaseurlstatus: status
					};
					doclogs[doc.file] = tcobject;
					downloadsNeeded = downloadsNeeded + doc.url + '\n';
				} else {
					let meta = result.content;
					let tilecheckurls = {};
					let tilecheckurl = getBaseUrl(doc.url);
					pageCounter += meta.pages;
					for (let i = 0; i < meta.pages; ++i) {
						tilecheckurls['page.' + i] = getTileCheckUrls(
							tilecheckurl,
							meta.pages,
							i,
							meta['layer' + i].maxZoom
						);
						let humantesturl = tilecheckurls['page.' + i][0];
						zoomlevelzerourls.push({
							bplan: bpl.s,
							doc,
							index: docIndex,
							page: i,
							humantesturl
						});
					}

					let tcobject = {
						doc,
						meta,
						tilecheckurls
					};
					doclogs[doc.file] = tcobject;
				}
				docIndex++;
			}
			i++;
			if (breaking && i >= breaking) {
				break;
			}
		}
		fs.writeFileSync('_internal/doclogs.json', JSON.stringify(doclogs, null, 2), 'utf8');
		fs.writeFileSync(
			'_internal/zommlevelzerourls.json',
			JSON.stringify(zoomlevelzerourls, null, 2),
			'utf8'
		);
		for (let dl of correctionDownloads) {
			if (dl.endsWith('.pdf')) {
				const dirKey = path
					.dirname(dl)
					.replace(/^https/, 'http')
					.replace('http://www.wuppertal.de/geoportal/', '');
				if (!fs.existsSync('./_in/' + dirKey + '/' + path.basename(dl))) {
					if (wgetConfig[dirKey]) {
						wgetConfig[dirKey].push(dl);
					} else {
						wgetConfig[dirKey] = [ dl ];
					}
				}
			}
		}

		fs.writeFileSync('_internal/wgetConfig.json', JSON.stringify(wgetConfig, null, 0), 'utf8');
	} else {
		doclogs = JSON.parse(fs.readFileSync('_internal/doclogs.json', 'utf8'));
		zoomlevelzerourls = JSON.parse(fs.readFileSync('_internal/zommlevelzerourls.json', 'utf8'));
		if (!doclogs) {
			console.log('Could not read doclogs.json. No need to continue.', e);
			process.exit(1);
		}
		wgetConfig = JSON.parse(fs.readFileSync('_internal/wgetConfig.json', 'utf8'));
		for (const key in wgetConfig) {
			correctionDownloads = correctionDownloads.concat(wgetConfig[key]);
		}
	}

	i = 0;
	let nofTilechecks = 0;

	for (const key in doclogs) {
		for (const pagekey in doclogs[key].tilecheckurls) {
			nofTilechecks += doclogs[key].tilecheckurls[pagekey].length;
		}
		i++;
		if (breaking && i >= breaking) {
			break;
		}
	}
	console.log('\n# tilechecks:' + nofTilechecks);
	let tileCheckingResult;
	if (tileChecking) {
		tileCheckingResult = await doTileChecking(
			nofTilechecks,
			doclogs,
			fileSystemChecks,
			breaking
		);
		tileCheckingResult.bar2.stop();
	}

	produceExaminationPages('allDocumentsExamination', zoomlevelzerourls);

	return { docsCounter, bplanCounter, pageCounter, errors, downloadErrors };
}

async function doTileChecking(nofTilechecks, doclogs, fileSystemChecks, breaking) {
	let tilechecks = [];

	//counting
	let i = 0;
	let bar2 = new cliProgress.Bar({}, cliProgress.Presets.shades_classic);
	bar2.start(nofTilechecks, 0);
	let tilecheckCounter = 0;
	for (const key in doclogs) {
		for (const pagekey in doclogs[key].tilecheckurls) {
			for (const tileCheckUrl of doclogs[key].tilecheckurls[pagekey]) {
				let resultTC;
				try {
					if (!fileSystemChecks) {
						resultTC = await fetch(tileCheckUrl, {
							method: 'get',
							headers: {
								'User-Agent':
									'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like ' +
									'Gecko) Chrome/56.0.2924.87 Safari/537.36'
							}
						});
					} else {
						let filename = tileCheckUrl.replace(
							'https://aaa.cismet.de/tiles/',
							'./_tilesstoragemount/'
						);
						//console.log('filecheck', filename);

						if (fs.existsSync(filename)) {
							resultTC = {};
							resultTC.status = 200;
						} else {
							resultTC = {};
							resultTC.status = 404;
						}
					}
				} catch (e) {
					resultTC = {};
					resultTC.status = 499;
					console.log('Fehler', e);
					break;
				}

				bar2.update(tilecheckCounter++);
				let tcstatus = resultTC.status;
				if (tcstatus !== 200) {
					let tcobject = {
						bplan: doclogs[key].doc,
						page: pagekey,
						url: tileCheckUrl,
						status: tcstatus
					};
					tilechecks.push(tcobject);
					if (correctionDownloads.indexOf(tcobject.bplan.url) === -1) {
						correctionDownloads.push(tcobject.bplan.url);
					}
					break;
				}
			}

			//console.log(doclogs[key].tilecheckurls);
		}
		i++;
		if (breaking && i >= breaking) {
			break;
		}
	}

	fs.writeFileSync('_internal/tilechecks.json', JSON.stringify(tilechecks, null, 2), 'utf8');
	return { bar2 };
}
