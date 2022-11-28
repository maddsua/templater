#!/usr/bin/env node

/*

	CopyLeft 2022 maddsua
	https://github.com/maddsua/
	License - No license (specified MIT but not really)
	Use it however you want
	I don't guarantee anything, but at very least, this package is safe from dependency-related security issues

*/

import fs from 'fs';

/*	/\{\{([\s]{0,}\|[\t]{0,})[\_A-Za-zА-Яа-яІіЇїҐґЄє]{1}[\_A-Za-zА-Яа-яІіЇїҐґЄє0-9]{0,}([\s]{0,}\|[\t]{0,})\}\}/g	*/
const varNameSpace = '\\_A-Za-zА-Яа-яІіЇїҐґЄє0-9';
const regexes = {
	template_var: new RegExp(`\\{\\{([\\s]{0,}\|[\\t]{0,})[${varNameSpace}]{1}[${varNameSpace}]{0,}([\\s]{0,}\|[\\t]{0,})\\}\\}`, 'g'),
	variable: new RegExp(`[${varNameSpace}]{1}[${varNameSpace}]{0,}`, 'g'),
	var_file: /^\$file\=/,
	inputFile: /^.*\.htm(l?)$/,
	directory: /^.*\//,
	dirSlashes: /(\/\/)|(\\\\)|(\\)/g
}

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

//console.log(colorText('welcome', 'red', 'reverse'))


//	start arguments
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
}

//	the main()
(() => {

	//	load config
	let config = {};

	const loadConfig = () => {
		try {
			config = JSON.parse(fs.readFileSync(configPath).toString());
		} catch (error) {
			return `Failed to load config file: can\'t read ${configPath} as json, error: ${error}`;
		}
		return false;
	}
	const configLoadResult = loadConfig();
		if (configLoadResult) {
			console.error(configLoadResult);
			return;
		}

	const watchUpdateInterval = config['watchUpdateInterval'] || 500;
	let srcdirWatchDog = false;
	let watchDirectory = false;

	let sourcesWatched = [];

	const coreFunction = () => {

		const trimPubRoot = config['trimPublicRoot'];

		const variables = config['data'];
		if (typeof variables !== 'object') {
			console.error('No template data block in config');
			return;
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

		//	add files, that were found in src directories
		if (typeof sourceDir === 'string' && publicRoot) {
			sourceDir = addNestedPath(sourceDir);

			findAllFiles(sourceDir).forEach((filepath) => {

				const file_from = normalizePath(filepath);
				const file_to = normalizePath(`${addNestedPath(publicRoot)}/${separatePath(file_from).file}`);

				if (!sourseFiles.find((item) => (item.from === file_from && item.to === file_to))) {
					sourseFiles.push({from: file_from, to: file_to});
					watchDirectory = sourceDir;
				}
			});
		}

		if (!sourseFiles.length) console.error(colorText('No source files found', 'red', 'bright'));

		// process the templates

		const buildTemplate = (templateText) => {
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
								dataValue = fs.readFileSync(addNestedPath(insertFilePath), {encoding: 'utf8'}).toString();
							} catch (error) {
								dataValue = '';
								console.warn(colorText(`Included file '${insertFilePath}' not found`, 'yellow'));
							}
						}
					} else console.warn(colorText(`Variable ${varname} not found`, 'yellow'));

				//	insert text to html document
				tempHtml = tempHtml.replace(new RegExp(tempVar), dataValue);
			});

			//	trim public folder path
			if (publicRoot && trimPubRoot) tempHtml = tempHtml.replace(new RegExp(`/${normalizePath(publicRoot)}/`, 'g'), '/');

			return tempHtml;
		};

		const compileTemplateFile = (srcpath, destpath) => {

			let htmltext = '';
			try {
				htmltext = fs.readFileSync(srcpath, {encoding: 'utf8'}).toString();
			} catch (error) {
				return `Can't load template file ${srcpath}, error: ${error}`;
			}
			
			if (htmltext.length < 10) return `Source file read error or file too short, '${srcpath}'`;
			
			const destDir = separatePath(destpath).dir;
				if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

			try {
				fs.writeFileSync(destpath, buildTemplate(htmltext), {encoding: 'utf8'});
			} catch (error) {
				return `Can't write to ${destpath}, error: ${error}`;
			}

			return false;
		};

		sourseFiles.forEach(filepath => {
			const result = compileTemplateFile(filepath.from, filepath.to);
				if (!result) console.log(colorText(`Processed '${filepath.from}'`, 'green', 'bright'));
				else console.error(colorText(result, 'red', 'reverse'));
	
			if (watchMode) {
				//	don't add a watcher to a file that will be watched by directory
				if (watchDirectory && filepath?.from?.includes(watchDirectory)) return;

				fs.watchFile(filepath.from, {persistent: true, interval: watchUpdateInterval}, () => {
					const rebuildResult = compileTemplateFile(filepath.from, filepath.to);
						if (!rebuildResult) console.log(colorText(`Rebuilt '${filepath.from}'`, 'green', 'bright'));
						else console.error(colorText(result, 'red', 'reverse'));
				});
				sourcesWatched.push(filepath.from);
			}
		});
		
		//	wach on source dir changes
		if (watchDirectory) {
			let srcdirUpdated = new Date().getTime();
			srcdirWatchDog = fs.watch(watchDirectory, {recursive: true}, () => {
	
				const now = new Date().getTime();
				if (now < (srcdirUpdated + watchUpdateInterval)) return;
				srcdirUpdated = now;
	
				sourcesWatched.forEach((watchdog) => watchdog.close());
				coreFunction();
			});
		}
	};

	coreFunction();

	if (watchMode) {
		console.log('\r\n', colorText(' Waiting for source changes... ', 'blue', 'reverse'))

		//	watch config changes
		fs.watchFile(configPath, {persistent: true, interval: watchUpdateInterval}, () => {

			sourcesWatched.forEach((srcFilePath) => fs.unwatchFile(srcFilePath));
			srcdirWatchDog.close();
			
			const configReloadResult = loadConfig();
			if (configReloadResult) {
				console.error(colorText(configReloadResult, 'red'));
				return;
			}
			console.log('Config reloaded');
			coreFunction();
		});

	} else console.log('\r\n', colorText(' Template build done ', 'green', 'reverse'));

})();
