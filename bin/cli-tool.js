#!/usr/bin/env node

/*

	CopyLeft 2022 maddsua
	https://github.com/maddsua/
	License - No license (specified MIT but not really)
	Use it however you want
	I don't guarantee anything, but at very least, this package is safe from dependency-related security issues

*/

import fs from 'fs';

const configTemplate = '{\r\n\t"sourceDir": "/src/pages/",\r\n\t"publicRoot": "/public/",\r\n\t"trimPublicRoot": true,\r\n\t\r\n\t"files": [\r\n\t\t{\r\n\t\t\t"from": "/src/embed/map.html",\r\n\t\t\t"to": "/public/map.html"\r\n\t\t}\r\n\t],\r\n\t\r\n\t"data": {\r\n\t\t"testString": "Test value"\r\n\t}\r\n}';

/*	/\{\{([\s]{0,}\|[\t]{0,})[\_A-Za-zА-Яа-яІіЇїҐґЄє0-9]{1,}([\s]{0,}\|[\t]{0,})\}\}/g	*/
const varNameSpace = '\\_A-Za-zА-Яа-яІіЇїҐґЄє0-9';
const regexes = {
	template_var: new RegExp(`\\{\\{([\\s]{0,}\|[\\t]{0,})[${varNameSpace}]{1,}([\\s]{0,}\|[\\t]{0,})\\}\\}`, 'g'),
	variable: new RegExp(`[${varNameSpace}]{1,}`, 'g'),
	var_file: /^\$file\=/,
	inputFile: /^.*\.htm(l?)$/,
	directory: /^.*\//,
	dirSlashes: /(\/\/)|(\\\\)|(\\)/g
}

const fsWatch_evHold = 50;

const colorText = (text, color, style) => {
	const table = {
		black: '\x1b[30m',
		red: '\x1b[31m',
		green: '\x1b[32m',
		yellow: '\x1b[33m',
		blue: '\x1b[34m',
		magenta: '\x1b[35m',
		cyan: '\x1b[36m',
		white: '\x1b[37m'
	};
	const styles = {
		bright: '\x1b[1m',
		dim: '\x1b[2m',
		underscore: '\x1b[4m',
		blink: '\x1b[5m',
		reverse: '\x1b[7m',
		hidden: '\x1b[8m'
	};

	return (table[color] || table.white) + (styles[style] || '') + text + '\x1b[0m';
};

const findAllFiles = (searchDir) => {

	let results = [];

	const dir_search = () => {	
		if (!fs.existsSync(searchDir)) {
			console.error(colorText(`Directory '${searchDir}' does not exist`, 'red', 'reverse'));
			return;
		}

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

	if (temp[0] === '.') temp = temp.substring(1);
	if (temp[0] === '/') temp = temp.substring(1);
	if (temp.slice(-1) === '/') temp = temp.slice(0, -1); 

	return temp;
};



//	start arguments
const initMode = process.argv.find((arg) => (arg === 'init') ? true : false);
const watchMode = process.argv.find((arg) => (arg === '--watch' || arg === '-w')) ? true : false;

let differentRootDir = false;
const configPath = ((argpattern) => {
	const argument = process.argv.find((arg) => arg.startsWith(argpattern));
	if (typeof argument === 'string') {
		const newCfgPath = normalizePath(argument.substring(argpattern.length))
		differentRootDir = separatePath(newCfgPath).dir;
		return newCfgPath;
	}
	return false;
})('--config=') || './templater.config.json';

const addNestedPath = (path) => {
	if (typeof differentRootDir === 'string') return normalizePath(`${differentRootDir}/${path}`);
	return normalizePath(path);
};

//	the main()
(() => {

	//	init template
	if (initMode) {
		try { fs.writeFileSync(configPath, configTemplate); }
			catch (error) { console.error('\r\n', colorText(` Can't write config file to ${configPath} `, 'green', 'reverse'), '\r\n'); }
		console.log('\r\n', colorText(' Templater init ok ', 'green', 'reverse'), '\r\n');

		if (!watchMode) process.exit(0);
	}

	//	load config
	let config = {};

	const loadConfig = () => {
		try { config = JSON.parse(fs.readFileSync(configPath).toString()); }
			catch (error) { return `Can't load config file from ${configPath}`; }
		return false;
	}
	const configLoadResult = loadConfig();
		if (configLoadResult) {
			console.error('\r\n', colorText(` ${configLoadResult} `, 'red', 'reverse'), '\r\n');
			process.exit(1);
		}

	//	control vars
	let sourcesWatchdogs = [];

	let watchDirectory = false;
	let srcDirWatchDog = false;

	const coreFunction = () => {

		const trimPubRoot = config['trimPublicRoot'];

		const variables = config['data'];
		if (typeof variables !== 'object') {
			console.error('\r\n', colorText(' No template data block in config ', 'red', 'reverse'), '\r\n');
			return 0;
		}

		//	deal with input files
		const files = config['files'];
		let sourceDir = config['sourceDir'];
		const publicRoot = config['publicRoot'];

		let sourseFiles = [];

		//	add specified files
		if (typeof files?.length === 'number') {
			files.forEach((file) => {
				if (typeof file.from === 'string' && typeof file.to === 'string') sourseFiles.push({
					from: addNestedPath(file.from),
					to: addNestedPath(file.to)
				});
			});
		}

		const filterNewFiles = (searchDir) => {
			let result = [];

			searchDir.forEach((filepath) => {
				const file_from = normalizePath(filepath);
				const file_to = normalizePath(`${addNestedPath(publicRoot)}/${separatePath(file_from).file}`);
				if (!sourseFiles.find((item) => (item.from === file_from && item.to === file_to))) {
					result.push({from: file_from, to: file_to});
				}
			});

			return result;
		}

		//	add files, that were found in src directories
		if (typeof sourceDir === 'string' && publicRoot) {
			sourceDir = addNestedPath(sourceDir);
			if (watchMode) watchDirectory = sourceDir;

			sourseFiles = sourseFiles.concat(filterNewFiles(findAllFiles(sourceDir)));
		}

		if (!sourseFiles.length) console.error(colorText('No source files found', 'red', 'bright'));


		// process the templates

		const buildTemplate = (srcpath, destpath) => {

			let templateHtml = '';
			try { templateHtml = fs.readFileSync(srcpath, {encoding: 'utf8'}).toString(); }
				catch (error) { return -1; }
			
			if (templateHtml.length < 15) return 0;
			
			const destDir = separatePath(destpath).dir;
				if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

			const pageHtml = ((templateText) => {
				//	find all template literals?... or whatever you call that
				const allTempVars = templateText.match(regexes.template_var);
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
									dataValue = fs.readFileSync(addNestedPath(insertFilePath), {encoding: 'utf8'}).toString();
								} catch (error) {
									dataValue = '';
									console.warn(colorText(`Included file '${insertFilePath}' not found`, 'yellow'));
								}
							}

							//	hidden variables
							if (dataValue.startsWith('~!')) dataValue = '';

						} else console.warn(colorText(`Variable ${varname} not found`, 'yellow'));

					//	insert text to html document
					templateText = templateText.replace(new RegExp(tempVar), dataValue);
				});

				//	trim public folder path
				if (publicRoot && trimPubRoot) templateText = templateText.replace(new RegExp(`/${normalizePath(publicRoot)}/`, 'g'), '/');

				return templateText;
				
			})(templateHtml);

			try { fs.writeFileSync(destpath, pageHtml, {encoding: 'utf8'}); }
				catch (error) { return -2; }

			return 1;
		};

		let filesSuccessful = 0;
		const templateFileHandler = (pathObj) => {

			switch (buildTemplate(pathObj.from, pathObj.to)) {
				case 1:
					console.log(colorText(`Processed '${pathObj.from}'`, 'green'));
					filesSuccessful++;
					break;
				case 0:
					console.log(colorText(`Skipped '${pathObj.from}'`, 'yellow'), ': too short');
					break;
				case -1:
					console.error(colorText(`Can't load template file ${pathObj.from}`, 'red', 'reverse'));
					return;
				case -2:
					console.error(colorText(`Can't write to ${pathObj.to}`, 'red', 'reverse'));
					return;
				default:
					console.error(colorText(`Unknown processing result for ${pathObj.from}`, 'red', 'reverse'));
					return;
			}
	
			if (watchMode) {
				let changeHandler = 0;
				const watchdog = fs.watch(pathObj.from, () => {

					clearTimeout(changeHandler);
					changeHandler = setTimeout(() => {

						const rebuildResult = buildTemplate(pathObj.from, pathObj.to);
							if (rebuildResult) console.log(colorText(`Rebuilt '${pathObj.from}'`, 'green'));

					}, fsWatch_evHold);
				});

				sourcesWatchdogs.push(watchdog);
			}
		};

		sourseFiles.forEach(item => templateFileHandler(item));

		if (watchDirectory) {
			srcDirWatchDog = fs.watch(watchDirectory, {recursive: true}, (eventType, filename) => {
				if (eventType === 'change') return;

				filterNewFiles([normalizePath(`${watchDirectory}/${filename}`)]).forEach((newFile) => {
					sourseFiles.push(newFile);
					templateFileHandler(newFile);
				});
			});
		}
		return filesSuccessful;
	};

	const runResult = coreFunction();

	if (watchMode) {
		console.log('\r\n', colorText(' Waiting for source changes... ', 'blue', 'reverse'), '\r\n');

		let configChangeHandler = 0;
		fs.watch(configPath, () => {
			clearTimeout(configChangeHandler);
			configChangeHandler = setTimeout(() => {

				let configReloadResult = loadConfig();
				if (!configReloadResult) {
					srcDirWatchDog.close();
					sourcesWatchdogs.forEach((watchdog) => watchdog.close());
					console.log('Config reloaded');
					coreFunction();
				}
				else console.error(colorText(configReloadResult, 'red'));

			}, fsWatch_evHold);
		});

	} else {
		
		if (runResult > 0) {
			console.log('\r\n', colorText(' Template build done ', 'green', 'reverse'), '\r\n');
			process.exit(0);
		}
		else {
			console.error('\r\n', colorText(' No templates were build ', 'red', 'reverse'), '\r\n');
			process.exit(3);
		}
	}

})();
