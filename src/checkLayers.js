import { performance } from 'perf_hooks';
import { checkUrlsSequentially } from './lib/tilesTools';

let start = performance.now();
let bplc;
//process.exit();
checkUrlsSequentially(bplc).then((result) => {
	console.log('');
	console.log(
		'checked ' +
			result.docsCounter +
			' documents of ' +
			result.bplanCounter +
			' bplan-objects with ' +
			result.pageCounter +
			' pages altogether'
	);
	const problemCounter = result.errors.length;
	if (problemCounter > 0) {
		console.log('found ' + problemCounter + ' problems and downloaded the originals');
	} else {
		console.log('no problems. everything seems to be fine');
	}
	if (result.downloadErrors.length > 0) {
		console.log('Download errors occured');
		for (const e of result.downloadErrors) {
			console.log(e);
		}
	}
	console.log('done (' + Math.round(performance.now() - start) / 1000 + ' s)');
	console.log('\ndone will exit');
});
