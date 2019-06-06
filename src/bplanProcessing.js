import { performance } from 'perf_hooks';
import { checkUrlsSequentially } from './lib/tilesTools';
import tiler from './lib/gdalTiling';
import { produceExaminationPagesFromTilesFolder } from './lib/examinationPages';
import { execSync } from 'child_process';

import wgetFiles from './lib/getMissingFiles';
import program from 'commander';

function yyyymmdd() {
	let x = new Date();
	let y = x.getFullYear().toString();
	let m = (x.getMonth() + 1).toString();
	let d = x.getDate().toString();
	d.length == 1 && (d = '0' + d);
	m.length == 1 && (m = '0' + m);
	var yyyymmdd = y + m + d;
	return yyyymmdd;
}

const bye = () => {
	console.log('done (' + Math.round(performance.now() - start) / 1000 + ' s)');
	console.log('\ndone will exit');
	process.exit(0);
};

let start = performance.now();

program.version('0.9.3').option('-v,--verbose', 'verbose output');

program
	.command('checkAndPrint')
	.description('check for missing Plan Documents')
	.option(
		'-l --limit <number of docs>',
		'Stop after <number of docs> Documents (all Documents if not set)',
		0
	)
	.option('-t --tileChecking', 'Check the 0/0 tile on each zoom level', false)
	.action(function(command) {
		const tileChecking = command.tileChecking || false;
		const limit = command.limit || 0;
		checkUrlsSequentially(limit, tileChecking).then((result) => {
			bye();
		});
	});
program
	.command('checkAndRetrieve')
	.description('check for missing Plan Documents and download them to the given folder')
	.option(
		'-l --limit [number of docs]',
		'Stop after [number of docs] Documents (all Documents if not set)'
	)
	.option('-t --tileChecking', 'Check the 0/0 tile on each zoom level')
	.option(
		'-d --subDir [dirname]',
		'Store the retrieved docs in a subfolder named [dirname]. [date] if not set'
	)
	.action(function(command) {
		const tileChecking = command.tileChecking || false;
		const limit = command.limit || 0;
		const dirname = command.dirname || yyyymmdd();
		checkUrlsSequentially(limit, tileChecking).then((result) => {
			console.log('try to download the missing documents');
			wgetFiles(result.wgetConfig, dirname);
			bye();
		});
	});

program
	.command('tile')
	.description('do the tiling')
	.option('-i --in [folder]', 'input folder (_in/[date] when not set)')
	.option('-o --out [folder]', 'output folder (_out/[date] when not set)') //.option('-c --collecting [folder]', 'collecting folder');
	.option(
		'-p --maxProcesses [max processes]',
		'maximum of parallel tiling processes (1 when not set)'
	)
	.action(function(command) {
		const inputFolder = command.in || '_in/' + yyyymmdd();
		const outputFolder = command.out || '_out/' + yyyymmdd();
		const maxProcesses = command.maxProcesses || 1;
		const collectingFolder = undefined;
		tiler(inputFolder, outputFolder, collectingFolder, maxProcesses, () => {
			console.log('Done with tiling :-)');
		});
	});

program
	.command('produceChecks')
	.description('produces a set of html files to visually check the new tiles')
	.option('-i --in [folder]', 'input folder (_in/[date] when not set)')
	.option('-o --out [folder]', 'output folder (_out/[date]/checks when not set)') //.option('-c --collecting [folder]', 'collecting folder');
	.action(function(command) {
		const inputFolder = command.in || '_in/' + yyyymmdd();
		const outputFolder = command.out || '_out/' + yyyymmdd() + '/checks';
		produceExaminationPagesFromTilesFolder(inputFolder, outputFolder);
	});
program
	.command('upload')
	.description('uploads the new tiles to the tileserver')
	.option('-i --in [folder]', 'input folder (_in/[date] when not set)')
	.action(function(command) {
		const inputFolder = command.in || '_out/' + yyyymmdd() + '/*';
		const outputFolder = '_tilesstoragemount/';
		const cmd = `cp -r ${inputFolder} ${outputFolder}`;
		console.log('cmd', cmd);
		execSync(cmd);
	});
// case 'checkRetrieveAndTile': {
// 	if (args.length > 1) {
// 		parallelThreads = args[1];
// 	}

// 	console.log('not supported yet');

// 	break;
// }
// case 'checkRetrieveTileAndUpload': {
// 	console.log('not supported yet');
// 	break;
// }

program.parse(process.argv);
