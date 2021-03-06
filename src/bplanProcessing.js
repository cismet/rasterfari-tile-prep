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

const today = yyyymmdd();

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
		const dirname = command.dirname || today;
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
		const inputFolder = command.in || '_in/' + today;
		const outputFolder = command.out || '_out/' + today;
		const maxProcesses = command.maxProcesses || 1;
		const collectingFolder = undefined;
		tiler(inputFolder, outputFolder, collectingFolder, maxProcesses, () => {
			console.log('Done with tiling :-)');
		});
	});

program
	.command('checkRetrieveAndTile')
	.description(
		'check for missing Plan Documents and download them to the given folder. then start the tiler'
	)
	.option(
		'-l --limit [number of docs]',
		'Stop after [number of docs] Documents (all Documents if not set)'
	)
	.option('-t --tileChecking', 'Check the 0/0 tile on each zoom level')
	.option(
		'-d --subDir [dirname]',
		'Store the retrieved docs in a subfolder named [dirname]. [date] if not set'
	)
	.option('-o --out [folder]', 'output folder (_out/[date] when not set)') //.option('-c --collecting [folder]', 'collecting folder');
	.option(
		'-p --maxProcesses [max processes]',
		'maximum of parallel tiling processes (1 when not set)'
	)
	.option('-u --upload', 'upload the produced stuff after the tiling')
	.option('-i --checkIn [folder]', 'input folder (_in/[date] when not set)')
	.option('-c --checkOut [folder]', 'output folder (_out/[date]/checks/[date] when not set)')
	.option('-s --skipChecks', 'skip the checkFolder creation')
	.action(function(command) {
		const tileChecking = command.tileChecking || false;
		const limit = command.limit || 0;
		const dirname = command.dirname || today;

		const inputFolder = '_in/' + dirname;
		const outputFolder = command.out || '_out/' + today;
		const maxProcesses = command.maxProcesses || 1;
		const collectingFolder = undefined;
		const upload = command.upload || false;
		const skipChecks = command.skipChecks || false;
		checkUrlsSequentially(limit, tileChecking).then((result) => {
			console.log('try to download the missing documents');

			if (
				result.wgetConfig.constructor === Object &&
				Object.entries(result.wgetConfig).length > 0
			) {
				wgetFiles(result.wgetConfig, dirname);

				tiler(inputFolder, outputFolder, collectingFolder, maxProcesses, async (error) => {
					if (error) {
						console.log('errors during tiling. have a look.', error);
					} else {
						console.log('Done with tiling :-)');

						if (skipChecks === false) {
							console.log('Produce the Checkfolder');
							const checkInputFolder = command.checkIn || '_out/' + today;
							const checkOutputFolder =
								command.checkOut || '_out/' + today + '/checks/' + today;
							await produceExaminationPagesFromTilesFolder(
								checkInputFolder,
								checkOutputFolder
							);
						}

						if (upload) {
							const inputFolderUpload = '_out/' + dirname + '/*';
							const uploadFolder = '_tilesstoragemount/';
							const cmd = `cp -r ${inputFolderUpload} ${uploadFolder}`;
							console.log('cmd', cmd);
							execSync(cmd);
						}
					}
					bye();
				});
			} else {
				console.log('No errors => no wget => no tiling ;-)');
				bye();
			}
		});
	});

program
	.command('produceChecks')
	.description('produces a set of html files to visually check the new tiles')
	.option('-i --in [folder]', 'tiles folder (_out/[date] when not set)')
	.option('-o --out [folder]', 'output folder (_out/[date]/checks/[date] when not set)') //.option('-c --collecting [folder]', 'collecting folder');
	.action(async function(command) {
		const inputFolder = command.in || '_out/' + today;
		const outputFolder = command.out || '_out/' + today + '/checks/' + today;
		await produceExaminationPagesFromTilesFolder(inputFolder, outputFolder);
	});
program
	.command('upload')
	.description('uploads the new tiles to the tileserver')
	.option('-i --in [folder]', 'input folder (_in/[date] when not set)')
	.action(function(command) {
		const inputFolder = command.in || '_out/' + today + '/*';
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
