import { performance } from 'perf_hooks';
import { checkUrlsSequentially } from './lib/tilesTools';
import wgetFiles from './lib/getMissingFiles';

let start = performance.now();

const args = process.argv.slice(2);

let command = 'notSet';
let limit = 0;
let tileChecking = false;
let parallelThreads = 1;
if (args.length > 0) {
	command = args[0];
}

switch (command) {
	case 'checkAndPrint': {
		if (args.length > 1) {
			limit = args[1];
		}
		if (args.length > 2) {
			tileChecking = args[2];
		}
		checkUrlsSequentially(limit, tileChecking).then((result) => {
			console.log('done (' + Math.round(performance.now() - start) / 1000 + ' s)');
			console.log('\ndone will exit');
			process.exit(0);
		});
		break;
	}
	case 'checkAndRetrieve': {
		if (args.length > 1) {
			limit = args[1];
		}
		if (args.length > 2) {
			tileChecking = args[2];
		}
		checkUrlsSequentially(limit, tileChecking).then((result) => {
			console.log('try to download the missing documents');
			wgetFiles(result.wgetConfig, '20190605');
			console.log('done (' + Math.round(performance.now() - start) / 1000 + ' s)');

			console.log('\ndone will exit');
			process.exit(0);
		});
		break;
	}
	case 'checkRetrieveAndTile': {
		if (args.length > 1) {
			parallelThreads = args[1];
		}

		console.log('not supported yet');

		break;
	}
	case 'checkRetrieveTileAndUpload': {
		console.log('not supported yet');
		break;
	}
	case 'tile': {
		if (args.length > 1) {
			limit = args[1];
		}

		console.log('not supported yet');
		break;
	}
	case 'upload': {
		console.log('not supported yet');
		break;
	}
	case 'revisit': {
		console.log('not supported yet');
		break;
	}
	default: {
		console.log(
			'command must be in: \n[checkAndPrint, checkAndRetrieve, checkRetrieveAndTile, checkRetrieveTileAndUpload, tile, upload, revisit]'
		);
	}
}
