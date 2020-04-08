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
	const hh = x.getHours() + '';
	hh.length == 1 && (hh = '0' + hh);
	let mm = x.getMinutes() + '';
	mm.length == 1 && (mm = '0' + mm);

	const yyyymmdd = y + m + d + '.' + hh + mm;

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
	.option('--topicname [topic]', 'the name of topic the processing should be done for')
	.action(function(command) {
		const tileChecking = command.tileChecking || false;
		const limit = command.limit || 0;
		checkUrlsSequentially(command.topicname, limit, tileChecking).then((result) => {
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
	.option('--topicname [topic]', 'the name of topic the processing should be done for')
	.action(function(command) {
		const tileChecking = command.tileChecking || false;
		const limit = command.limit || 0;
		const dirname = command.dirname || today;
		const topicname = command.topicname;
		checkUrlsSequentially(topicname, limit, tileChecking).then((result) => {
			console.log('try to download the missing documents');
			wgetFiles(result.wgetConfig, dirname);
			bye();
		});
	});

program
	.command('tile')
	.description('do the tiling')
	.option('--in [folder]', 'input folder (_in/[date] when not set)')
	.option('--out [folder]', 'output folder (_out/[date] when not set)') //.option('-c --collecting [folder]', 'collecting folder');
	.option(
		'--maxProcesses [max processes]',
		'maximum of parallel tiling processes (1 when not set)'
	)
	.option('--topicname [topic]', 'the name of topic the processing should be done for')
	.action(function(command) {
		const topicname = command.topicname;

		const inputFolder = command.in || '_in/' + today;
		const outputFolder = command.out || '_out/' + today + '.' + topicname;
		const maxProcesses = command.maxProcesses || 1;
		const collectingFolder = undefined;
		tiler(topicname, inputFolder, outputFolder, collectingFolder, maxProcesses, () => {
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
	.option('--topicname [topic]', 'the name of topic the processing should be done for')
	.action(function(command) {
		console.log('doing stuff for ', command.topicname);
		const topicname = command.topicname;

		const tileChecking = command.tileChecking || false;
		const limit = command.limit || 0;
		const dirname = command.dirname || today;

		const inputFolder = '_in/' + dirname;
		const outputFolder = command.out || '_out/' + today + '.' + topicname;
		const maxProcesses = command.maxProcesses || 1;
		const collectingFolder = undefined;
		const upload = command.upload || false;
		const skipChecks = command.skipChecks || false;

		slack(topicname, 'Start processing ...');

		checkUrlsSequentially(topicname, limit, tileChecking).then((result) => {
			console.log('try to download the missing documents');
			console.log('results', result);

			if (
				result.wgetConfig.constructor === Object &&
				Object.entries(result.wgetConfig).length > 0
			) {
				wgetFiles(result.wgetConfig, dirname);

				tiler(
					topicname,
					inputFolder,
					outputFolder,
					collectingFolder,
					maxProcesses,
					async (error) => {
						if (error) {
							console.log('errors during tiling. have a look.', error);
							slack(topicname, 'Errors during tiling. Have a look at the logs.');
						} else {
							slack(topicname, 'Tiling done. No Errors');

							console.log('Produce the Checkfolder');
							const checkInputFolder =
								command.checkIn || '_out/' + today + '.' + topicname;
							const checkOutputFolder =
								command.checkOut ||
								'_out/' +
									today +
									'.' +
									topicname +
									'/checks/' +
									today +
									'.' +
									topicname;
							await produceExaminationPagesFromTilesFolder(
								topicname,
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
							slack(topicname, 'Files uploaded. Done.');
						}

						bye();
					}
				);
			} else {
				slack(topicname, 'No errors => no wget => no tiling :wink:');
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
	.option('--topicname [topic]', 'the name of topic the processing should be done for')
	.action(async function(command) {
		const inputFolder = command.in || '_out/' + today;
		const topicname = command.topicname;

		const outputFolder = command.out || '_out/' + today + '.' + topicname + '/checks/' + today;

		await produceExaminationPagesFromTilesFolder(topicname, inputFolder, outputFolder);
	});
program
	.command('upload')
	.description('uploads the new tiles to the tileserver')
	.option('-i --in [folder]', 'input folder (_in/[date] when not set)')
	.option('--topicname [topic]', 'the name of topic the processing should be done for')
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

export function slack(topicname, msg) {
	let silence = false;
	let topicPrefix;
	let host = '';

	if (topicname === 'bplaene') {
		topicPrefix = ':blue_book: B-Pläne: ';
	} else {
		topicPrefix = ':green_book: Änderungsverfahren: ';
	}

	const cmd = `src/lib/slack  -i ":rasterfari:" -m "${topicPrefix}${msg}" -c "wuppertal-support" -u "Rasterfari Tile Prepper ${host}"`;
	if (silence === false) {
		execSync(cmd);
	} else {
		console.log('SLACK### ' + msg);
	}
}

//

program.parse(process.argv);
