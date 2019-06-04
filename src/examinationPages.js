import fs from 'fs-extra';
import ColorHash from 'color-hash';

const chunk = (arr, size) =>
	arr.reduce((acc, _, i) => (i % size ? acc : [ ...acc, arr.slice(i, i + size) ]), []);

const getColor = (line) => {
	let colorHash = new ColorHash({ saturation: 0.3 });

	return colorHash.hex('' + line);
};
const docViewerService = 'https://alpha-wunda-geoportal.cismet.de';
//const docViewerService = 'http://localhost:3000';

export default function produceExaminationPages(examinationName, urls) {
	let counter = 0;
	let imagelinks = [];

	for (const check of urls) {
		let c = getColor(
			check.index + 1 + '.' + check.bplan + '...' + (check.index + 1) + '...' + check.doc.file
		);
		imagelinks.push(
			'<div style="float: left;"><a target="_docviewer" href="' +
				docViewerService +
				'/#/docs/bplaene/' +
				check.bplan +
				'/' +
				(check.index + 1) +
				'/' +
				(check.page + 1) +
				'"><img style="background:' +
				c +
				';" title="' +
				check.bplan +
				'.' +
				(check.index + 1) +
				'.' +
				(check.page + 1) +
				'" src="' +
				check.humantesturl +
				'"/></a><div> &uarr;' +
				check.bplan +
				'/' +
				(check.index + 1) +
				'/' +
				(check.page + 1) +
				' &uarr;</div></div>\n'
		);
	}
	let chunks = chunk(imagelinks, 500);

	let chunkIndex = 0;
	for (const c of chunks) {
		let examinationPageHtml = '<html><style>body {font-family: Arial;}</style>';
		let next, prev;
		if (chunkIndex !== chunks.length - 1) {
			next = '<a href="examination-' + (chunkIndex + 1) + '.html"> &gt;&gt; </a>';
		}
		if (chunkIndex !== 0) {
			prev = '<a href="examination-' + (chunkIndex - 1) + '.html"> &lt;&lt; </a>';
		}
		examinationPageHtml +=
			'<h1 align="center"> ' +
			(prev || '') +
			(chunkIndex + 1) +
			'/' +
			chunks.length +
			(next || '') +
			'</h1>\n';
		for (let imageLine of c) {
			examinationPageHtml += imageLine;
		}

		examinationPageHtml +=
			'<div style="clear:both;"><h1 align="center"> ' +
			(prev || '') +
			(chunkIndex + 1) +
			'/' +
			chunks.length +
			(next || '') +
			'</h1></div>\n';

		examinationPageHtml += '</html>';
		const dir = '_internal/' + examinationName + '/';
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir);
		}
		fs.writeFileSync(dir + 'examination-' + chunkIndex + '.html', examinationPageHtml, 'utf8');

		chunkIndex++;
	}
}
