import fs from 'fs-extra';
import producer from './lib/examinationPages';
import fetch from 'node-fetch';
import { getBPlanDB, getBaseUrl, getTileCheckUrls } from './lib/tilesTools';
import produceExaminationPages from './lib/examinationPages';

const args = process.argv.slice(2);

let tilesFolder = args[0];
let examinationPagesFolder = args[1];

console.log('arguments: ' + args);

produce(tilesFolder, examinationPagesFolder).then(() => {});
