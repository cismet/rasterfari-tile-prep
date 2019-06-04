import fs from 'fs-extra';
import producer from './examinationPages';
import fetch from 'node-fetch';
import { getBPlanDB } from './lib/tilesTools';
const args = process.argv.slice(2);

let tilesFolder = args[0];
let examinationPagesFolder = args[1];

const potFolders = [
	'bplaene/rechtswirksam',
	'bplaene/verfahren',
	'bplaene_dokumente/abgelaufen',
	'bplaene_dokumente/im_Verfahren',
	'bplaene_dokumente/rechtsverbindlich'
];

console.log('arguments: ' + args);

async function prod(tilesFolder, examinationPagesFolder) {
	//	let bplc = await getBPlanDB();

	for (let folder of potFolders) {
		console.log('folder', folder);
	}
}

//prod(tilesFolder, examinationPagesFolder).then(() => {});

require('./checkLayers');
