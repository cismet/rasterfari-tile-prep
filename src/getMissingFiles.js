import fetch from 'node-fetch';
//import fs from 'fs';
import path from 'path';
import fs from 'fs-extra';
import { performance } from 'perf_hooks';
import cliProgress from 'cli-progress';
import { execSync } from 'child_process';

const localPlanDump = false;
const localCheckDump = false;
const getTheMissingStuff = false;
const tileChecking = true;
const fileSystemChecks = true;

let i = 0;
let correctionDownloads = [];
let docsCounter = 0;
let pageCounter = 0;
let bplanCounter = 0;
const bar1 = new cliProgress.Bar({}, cliProgress.Presets.shades_classic);
let bar2;
let errors = [];
let downloadErrors = [];
let downloadsNeeded = '';
let doclogs = {};
let bplc;
let tilechecks = [];

const breaking = undefined; //100;

const fetchOrWget = 'fetch';

let start = performance.now();

let wgetConfig = JSON.parse(fs.readFileSync('./_internal/wgetConfig.json', 'utf8'));

for (const key in wgetConfig) {
	fs.ensureDirSync('./_in/' + key);
	console.log('in', key);

	const wgetList = '';
	for (const url of wgetConfig[key]) {
		wgetList = wgetList + url + '\n';
	}
	const fname = './_in/' + key + '/' + 'wgetConfig.urls.txt';

	fs.writeFileSync(fname, wgetList, 'utf8');
	console.log('written ', fname);

	try {
		execSync('wget -i wgetConfig.urls.txt ', {
			cwd: './_in/' + key
		});
		execSync('rm wgetConfig.urls.txt ', {
			cwd: './_in/' + key
		});
	} catch (e) {
		console.log('fehler', e);
	}
}

// //process.exit();
// checkUrlsSequentially(bplc).then(() => {
// 	if (bar2) bar2.stop();
// 	console.log('');
// 	console.log(
// 		'checked ' +
// 			docsCounter +
// 			' documents of ' +
// 			bplanCounter +
// 			' bplan-objects with ' +
// 			pageCounter +
// 			' pages altogether'
// 	);
// 	const problemCounter = errors.length;
// 	if (problemCounter > 0) {
// 		console.log('found ' + problemCounter + ' problems and downloaded the originals');
// 	} else {
// 		console.log('no problems. everything seems to be fine');
// 	}
// 	if (downloadErrors.length > 0) {
// 		console.log('Download errors occured');
// 		for (const e of downloadErrors) {
// 			console.log(e);
// 		}
// 	}
// 	console.log('done (' + Math.round(performance.now() - start) / 1000 + ' s)');
// });
