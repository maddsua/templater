#!/usr/bin/env node

import fs from 'fs';

const regexes = {
	template_var: /\{\{\s[\_A-Za-z]{1}[A-Za-z0-9\_]{0,}\s\}\}/g,
	variable: /[\_A-Za-z]{1}[A-Za-z0-9\_]{0,}/g,
	var_file: /^\$file\=/,
	inputFile: /^.*\.htm(l?)$/,
	directory: /^.*\//,
	dirSlashes: /(\/\/)|(\\\\)|(\\)/g
}

const configPath = './templater.config.json';

const watchMode = process.argv.find((arg) => (arg === '--watch' || arg === '-w')) ? true : false;

const findAllFiles = (searchDir) => {

	let results = [];

	const dir_search = () => {	
		if (!fs.existsSync(searchDir)) return;

		fs.readdirSync(searchDir).forEach((file) => {
			const filename = `${searchDir}/${file}`;
			const stat = fs.lstatSync(filename);
	
			if (stat.isDirectory()) dir_search() 
			else if (regexes.inputFile.test(filename)) results.push(filename);
		})
	};
	dir_search();
	
	return results;
};

const separatePath = (path) => {

	const pathDir = path.match(regexes.directory)[0] || './';
	const pathFile = pathDir.length > 1 ? path.substring(pathDir.length) : path;

	return {
		dir: pathDir,
		file: pathFile
	}
};

const normalizePath = (path) => {
	let temp = path.replace(regexes.dirSlashes, '/');

	if (temp[0] === '/') temp = temp.substring(1);
	if (temp.slice(-1) === '/') temp = temp.slice(0, -1); 

	return temp;
};

//	the main()
(() => {

	//	load config
	let config = {};
	try {
		config = JSON.parse(fs.readFileSync(configPath).toString());
	} catch (error) {
		console.error(`Failed to load config file: can\'t read ${configPath} as json, error: ${error}`);
		return false;
	}

	const trimPubRoot = config['trimPublicRoot'];
	const watchUpdateInterval = config['watchUpdateInterval'] || 100;

	const variables = config['data'];
	if (typeof variables !== 'object') {
		console.error('No template data block in config');
		return false;
	}

	//	deal with input files
	const files = config['files'];
	const sourceDir = config['sourceDir'];

	let publicRoot = config['publicRoot'];
		if (typeof publicRoot !== 'string') publicRoot = false;

	let inputs = [];

	//	add specified files
	if (typeof files?.length === 'number') {
		files.forEach((file) => {
			if (typeof file.from === 'string' && typeof file.to === 'string') inputs.push({
				from: normalizePath(file.from),
				to: normalizePath(file.to)
			});
		});
	}

	//	add files, that were found in src directories
	if (typeof sourceDir === 'string' && publicRoot) {
		findAllFiles(normalizePath(sourceDir)).forEach((filepath) => {
			const file_from = normalizePath(filepath);
			const file_to = normalizePath(`${publicRoot}/${separatePath(file_from).file}`);

			if (!inputs.find((item) => (item.from === file_from && item.to === file_to))) inputs.push({
				from: file_from,
				to: file_to
			});
		});
	}


	// process templates

	const processTemplate = (templateText) => {
		//	the c language habits, completely unnecessary here
		let tempHtml = templateText;

		//	find all template literals?... or whatever you call that
		const allTempVars = tempHtml.match(regexes.template_var);
		allTempVars?.forEach(tempVar => {
			//	just to be sure
			const varname = tempVar.match(regexes.variable)[0];
				if (!varname) return;

			//	find value or return empty string
			let dataValue = variables[varname] || '';

				//	data post processing
				if (dataValue.length > 0) {

					//	load file contents from the path, specifiend in the string
					if (regexes.var_file.test(dataValue)) {
						const insertFilePath = normalizePath(dataValue.replace(regexes.var_file, ''));
						try {
							dataValue = fs.readFileSync(insertFilePath, {encoding: 'utf8'}).toString();
						} catch (error) {
							dataValue = '';
						}
					}
				}
	
			//	insert text to html document
			tempHtml = tempHtml.replace(new RegExp(tempVar), dataValue);
		});

		//	trim public folder path
		if (publicRoot && trimPubRoot) tempHtml = tempHtml.replace(new RegExp(`/${normalizePath(publicRoot)}/`, 'g'), '/');
	
		return tempHtml;
	};

	const processFileTemplate = (srcpath, destpath) => {

		let htmltext = '';
		try {
			htmltext = fs.readFileSync(srcpath, {encoding: 'utf8'}).toString();
		} catch (error) {
			return `Can't load template file ${srcpath}, error: ${error}`;
		}

		const destDir = separatePath(destpath).dir;
			if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

		try {
			fs.writeFileSync(destpath, processTemplate(htmltext), {encoding: 'utf8'});
		} catch (error) {
			return `Can't write to ${destpath}, error: ${error}`;
		}

		return false;
	};

	inputs.forEach(filepath => {
		const result = processFileTemplate(filepath.from, filepath.to);

		if (!result) console.log(`Processed '${filepath.from}'`);
		else console.warn(result);

		if (watchMode) {
			let updated = new Date().getTime();
			const watchdog = fs.watch(filepath.from, (eventType, filename) => {

				const now = new Date().getTime();
				if (now < (updated + watchUpdateInterval)) return;
				updated = now;

				if (eventType === 'change') {
					console.log(`Rebuilding '${filename}'`);
					processFileTemplate(filepath.from, filepath.to);

				} else {
					console.log(`File '${filename}' was renamed or moved`);
					watchdog.close();
				}
			});
		}
	});

	if (watchMode) console.log('Waiting for file changes...');

})();
