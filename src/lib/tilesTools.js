import fetch from 'node-fetch';
//import fs from 'fs';
import path from 'path';
import fs from 'fs-extra';
import cliProgress from 'cli-progress';
import produceExaminationPages from './examinationPages';
import { slack } from '../processing';
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

export function fixUrlName(url) {
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

export function getDocFromUrl(url) {
	return { url, file: url.substring(url.lastIndexOf('/') + 1) };
}

export function getBaseUrl(doc_url) {
	return fixUrlName(
		doc_url
			.replace(/^http/, 'https')
			.replace(/^httpss/, 'https')
			.replace('https://www.wuppertal.de/geoportal/', 'https://aaa.cismet.de/tiles/')
	);
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
	topicname,
	breaking = 0,
	tileChecking = false,
	fileSystemChecks = false,
	localCheckDump = false // good for debugging. if set to true you it will use old results
) {
	let correctionDownloads = [];
	let docsCounter = 0;
	let pageCounter = 0;
	let entityCounter = 0;
	const bar1 = new cliProgress.Bar({}, cliProgress.Presets.shades_classic);
	let errors = [];
	let downloadErrors = [];
	let downloadsNeeded = '';
	let doclogs = {};
	let zoomlevelzerourls = [];
	let wgetConfig = {};
	let i = 0;

	if (!localCheckDump) {
		({
			pageCounter,
			docsCounter,
			entityCounter,
			errors,
			downloadErrors,
			downloadsNeeded,
			doclogs,
			zoomlevelzerourls,
			wgetConfig,
			correctionDownloads
		} = await getDataForTopic(topicname, bar1, breaking));

		fs.writeFileSync(
			'_internal/' + topicname + '_doclogs.json',
			JSON.stringify(doclogs, null, 2),
			'utf8'
		);
		fs.writeFileSync(
			'_internal/' + topicname + '_zoomlevelzerourls.json',
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

		fs.writeFileSync(
			'_internal/' + topicname + '_wgetConfig.json',
			JSON.stringify(wgetConfig, null, 0),
			'utf8'
		);
	} else {
		doclogs = JSON.parse(fs.readFileSync('_internal/' + topicname + '_doclogs.json', 'utf8'));
		zoomlevelzerourls = JSON.parse(
			fs.readFileSync('_internal/' + topicname + '_zoomlevelzerourls.json', 'utf8')
		);
		if (!doclogs) {
			console.log('Could not read ' + topicname + '_doclogs.json. No need to continue.', e);
			process.exit(1);
		}
		wgetConfig = JSON.parse(
			fs.readFileSync('_internal/' + topicname + '_wgetConfig.json', 'utf8')
		);
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

	//produceExaminationPages('allDocumentsExamination', zoomlevelzerourls);

	const result = { docsCounter, entityCounter, pageCounter, errors, downloadErrors, wgetConfig };
	console.log('');
	console.log(
		'checked ' +
			result.docsCounter +
			' documents of ' +
			result.entityCounter +
			' ' +
			topicname +
			'-objects with ' +
			result.pageCounter +
			' pages altogether'
	);
	console.log('result.errors', result.errors);

	const problemCounter = result.errors.length;
	if (problemCounter > 0) {
		console.log('found ' + problemCounter + ' problems.');
		slack(
			topicname,
			'Will try to fix ' +
				problemCounter +
				' missing or outdated ' +
				(problemCounter === 1 ? 'file.' : 'files.')
		);
	} else {
		console.log('no problems. everything seems to be fine');
	}
	if (result.downloadErrors.length > 0) {
		console.log('Download errors occured');
		for (const e of result.downloadErrors) {
			console.log(e);
		}
	}
	return result;
}

export async function getDataForTopic(topicname, bar1, breaking) {
	let correctionDownloads = [];
	let docsCounter = 0;
	let pageCounter = 0;
	let entityCounter = 0;
	let errors = [];
	let downloadErrors = [];
	let downloadsNeeded = '';
	let doclogs = {};
	let zoomlevelzerourls = [];
	let wgetConfig = {};
	let i = 0;

	switch (topicname) {
		case 'bplaene':
			{
				const bplc = await getBPlanDB();
				if (bplc === undefined) {
					process.exit(1);
				}
				bar1.start(breaking || bplc.length, 0);
				for (const bpl of bplc) {
					entityCounter++;
					bar1.update(entityCounter);

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
							if (testbaseurl.endsWith('.pdf')) {
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
								console.log('\nwill ignore the != 200 status of ', testbaseurl);
							}
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
			}
			break;

		case 'aev':
			{
				let fnpAEV = await getAEVDB();
				bar1.start(breaking || fnpAEV.length, 0);
				for (const aev of fnpAEV) {
					entityCounter++;
					bar1.update(entityCounter);
					let allUrls = [ getDocFromUrl(aev.url) ];
					for (const durl of aev.docUrls) {
						allUrls.push(getDocFromUrl(durl));
					}
					let docIndex = 0;
					for (const doc of allUrls) {
						let testbaseurl = getBaseUrl(doc.url);
						let result = await getMetaInfoForUrl(testbaseurl);
						let status = result.status;
						if (status !== 200) {
							if (testbaseurl.endsWith('.pdf')) {
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
								console.log('\nwill ignore the != 200 status of ', testbaseurl);
							}
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
									aev: aev.name,
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
			}
			break;

		default:
			break;
	}
	return {
		pageCounter,
		docsCounter,
		entityCounter,
		errors,
		downloadErrors,
		downloadsNeeded,
		doclogs,
		zoomlevelzerourls,
		wgetConfig,
		correctionDownloads
	};
}

export async function getDB(topicname, ignoreMD5) {
	if (topicname === 'bplaene') {
		return await getBPlanDB(ignoreMD5);
	} else if (topicname === 'aev') {
		return await getAEVDB(ignoreMD5);
	}
}

async function getBPlanDB(ignoreMD5) {
	const md5Response = await fetch(
		'https://wunda-geoportal.cismet.de/gaz/bplaene_complete.json.md5',
		{
			method: 'get',
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like ' +
					'Gecko) Chrome/56.0.2924.87 Safari/537.36',
				'Cache-Control': 'no-cache'
			}
		}
	);
	let status = await md5Response.status;
	let webMD5;
	if (status === 200) {
		try {
			webMD5 = await md5Response.text();
		} catch (e) {
			console.log('Could not download bplaene_complete.json.md5. No need to continue.', e);
			return undefined;
		}
	}

	let storedMD5;
	try {
		storedMD5 = fs.readFileSync('_internal/bplaene_complete.json.md5', 'utf8');
	} catch (e) {
		storedMD5 = '';
	}
	let content;

	if (webMD5 === storedMD5) {
		console.log('Will get PlanDump from cache.');

		content = JSON.parse(fs.readFileSync('_internal/bplaene_complete.json', 'utf8'));
	} else {
		console.log('Will get PlanDump online.');

		const response = await fetch(
			'https://wunda-geoportal.cismet.de/gaz/bplaene_complete.json',
			{
				method: 'get',
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like ' +
						'Gecko) Chrome/56.0.2924.87 Safari/537.36'
				}
			}
		);

		let status = await response.status;
		if (status === 200) {
			try {
				content = await response.json();
			} catch (e) {
				console.log('Could not download bplaene_complete.json. No need to continue.', e);
				return undefined;
			}
		}
		fs.writeFileSync(
			'_internal/bplaene_complete.json',
			JSON.stringify(content, null, 0),
			'utf8'
		);
		fs.writeFileSync('_internal/bplaene_complete.json.md5', webMD5, 'utf8');
	}
	return content;
}

async function getAEVDB(ignoreMD5) {
	const md5Response = await fetch(
		'https://wunda-geoportal.cismet.de/data/aenderungsv.data.json.md5',
		{
			method: 'get',
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like ' +
					'Gecko) Chrome/56.0.2924.87 Safari/537.36',
				'Cache-Control': 'no-cache'
			}
		}
	);
	let status = await md5Response.status;
	let webMD5;
	if (status === 200) {
		try {
			webMD5 = await md5Response.text();
		} catch (e) {
			console.log(
				'Could not download https://wunda-geoportal.cismet.de/data/aenderungsv.data.json.md5. No need to continue.',
				e
			);
			return undefined;
		}
	}

	let storedMD5;
	try {
		storedMD5 = fs.readFileSync('_internal/aenderungsv.data.json.md5', 'utf8');
	} catch (e) {
		storedMD5 = '';
	}
	let content;

	if (webMD5 === storedMD5) {
		console.log('Will get AEVDump from cache.');

		content = JSON.parse(fs.readFileSync('_internal/aenderungsv.data.json', 'utf8'));
	} else {
		console.log('Will get AEVDump online.');

		const response = await fetch(
			'https://wunda-geoportal.cismet.de/data/aenderungsv.data.json',
			{
				method: 'get',
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like ' +
						'Gecko) Chrome/56.0.2924.87 Safari/537.36'
				}
			}
		);

		let status = await response.status;
		if (status === 200) {
			try {
				content = await response.json();
			} catch (e) {
				console.log('Could not download bplaene_complete.json. No need to continue.', e);
				return undefined;
			}
		}
		fs.writeFileSync(
			'_internal/aenderungsv.data.json',
			JSON.stringify(content, null, 0),
			'utf8'
		);
		fs.writeFileSync('_internal/aenderungsv.data.json.md5', webMD5, 'utf8');
	}
	return content;
}

async function doTileChecking(topicname, nofTilechecks, doclogs, fileSystemChecks, breaking) {
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

				bar2.update(++tilecheckCounter);
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
