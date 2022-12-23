#!/usr/bin/env node

/*

	CopyLeft 2022 maddsua
	https://github.com/maddsua/
	License - No license (specified MIT but not really)
	Use it however you want
	I don't guarantee anything, but at very least, this package is safe from dependency-related security issues

	The structure of this code is cursed 💀, so don't touch it unless you are ready to waste
	several hours of your life trying to figure out how it works.
	Bc even I don't 😎
	
	And, it also contains several cringe moments, just bc I hate using oop for everything here and there

	P.S.2: Bring your own ketchup if you actually wanna try this noodles-code out

*/

import fs from 'fs';

const configTemplate = '{\r\n\t"srcDir": "/src/pages/",\r\n\t"destDir": "/public/",\r\n\t\r\n\t"files": [\r\n\t\t{\r\n\t\t\t"from": "/src/embed/map.html",\r\n\t\t\t"to": "/public/map.html"\r\n\t\t}\r\n\t],\r\n\t\r\n\t"data": {\r\n\t\t"testString": "Test value"\r\n\t}\r\n}';

/*	/\{\{[\s\t]{0,}[\_A-Za-zА-Яа-яІіЇїҐґЄє0-9]{1,}[\s\t]{0,}\}\}/g	*/
const svcRegexes = {
	tplOpen: /\{\{[\s\t]{0,}/,
	tplNs: /\\_A-Za-zА-Яа-яІіЇїҐґЄє0-9/,
	tplClose: /[\s\t]{0,}\}\}/,
	precIndent: /\n[\s\t]{1,}/
};
const regexes = {
	template_var: new RegExp(`${svcRegexes.tplOpen.source}[${svcRegexes.tplNs.source}]{1,}${svcRegexes.tplClose.source}`, 'g'),
	variable: new RegExp(`[${svcRegexes.tplNs.source}]{1,}`, 'g'),
	var_file: /^\$file\=/,
	inputFile: /^.*\.htm(l?)$/,
	directory: /^.*\//,
	dirSlashes: /(\/\/)|(\\\\)|(\\)/g
};

//	very important consts
const fsWatch_evHold = 50;
const minSrcFileLength = 16;

const colorText = (text: string, color: string | null, style: string | null) => {
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


const separatePath = (path:string) => {

	const pathDir = path.match(regexes.directory)[0] || './';
	const pathFile = pathDir.length > 1 ? path.substring(pathDir.length) : path;

	return {
		dir: pathDir,
		file: pathFile
	}
};
const normalizePath = (path:string) => {
	let temp = path.replace(regexes.dirSlashes, '/');

	if (temp[0] === '.') temp = temp.substring(1);
	if (temp[0] === '/') temp = temp.substring(1);
	if (temp.slice(-1) === '/') temp = temp.slice(0, -1); 

	return temp;
};

//	start arguments
const initMode = process.argv.find((arg) => (arg === 'init') ? true : false);
const watchMode = process.argv.find((arg) => (arg === '--watch' || arg === '-w')) ? true : false;

let differentRootDir: string | boolean = false;
const configPath = ((argpattern) => {
	const argument = process.argv.find((arg) => arg.startsWith(argpattern));
	if (typeof argument === 'string') {
		const newCfgPath = normalizePath(argument.substring(argpattern.length))
		differentRootDir = separatePath(newCfgPath).dir;
		return newCfgPath;
	}
	return false;
})('--config=') || './templater.config.json';


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
const sourcesWatchdogs = [];

interface _wathchIncludedFile {
	variable: string,
	watchdog: fs.FSWatcher,
	_evTiomeout: NodeJS.Timeout | number
};
interface _wathchIncludedFiles {
	parent: string,
	files: _wathchIncludedFile[]
};
const includedWatchdogs = Array<_wathchIncludedFiles>(0);

let watchDirectory: string | null = null;
let srcDirWatchDog: fs.FSWatcher | null = null;

const coreFunction = () => {

	//	input files
	let files = config['files'];
		if (typeof files !== 'object' || !files.length) files = [];
	
	let sourceDir = config['srcDir'];
		if (typeof sourceDir !== 'string') sourceDir = null;

	let destDir = config['destDir'];
		if (typeof destDir !== 'string') destDir = null;

	//	flags and values
	let trimPubRoot = config['trimPublicRoot'];
		if (typeof trimPubRoot == 'undefined' || trimPubRoot === true) trimPubRoot = destDir;

	let buildIncluded = config['buildIncluded'];
		if (typeof buildIncluded !== 'boolean') buildIncluded = true;

	let dirScanDepth = config['dirScanDepth'];
		if (typeof dirScanDepth !== 'number') dirScanDepth = 10;

	let maxNestedTemplates = config['maxNestedTemplates'];
		if (typeof maxNestedTemplates !== 'number') maxNestedTemplates = 3;

	let watchIncluded = config['watchIncluded'];
		if (typeof watchIncluded !== 'boolean') watchIncluded = true;

	//	data variables
	const variables = config['data'];
		if (typeof variables !== 'object') {
			console.error('\r\n', colorText(' No template data block in config ', 'red', 'reverse'), '\r\n');
			return 0;
		}

	const addNestedPath = (path:string) => {
		if (typeof differentRootDir === 'string') return normalizePath(`${differentRootDir}/${path}`);
		return normalizePath(path);
	};

	interface _pathObj {
		from: string,
		to: string
	};

	let sourseFiles = Array<_pathObj>(0);

	//	add specified files
	if (typeof files?.length === 'number') {
		files.forEach((file:object) => {
			if (typeof file['from'] === 'string' && typeof file['to'] === 'string') sourseFiles.push({
				from: addNestedPath(file['from']),
				to: addNestedPath(file['to'])
			});
		});
	}

	const filterNewFiles = (fileList:Array<string>, parentDir:string) => {
		let result = [];

		fileList.forEach((filepath) => {
			const file_from = normalizePath(filepath);
			const file_to = normalizePath(`${addNestedPath(destDir)}/${file_from.replace(parentDir, '')}`);

			if (!sourseFiles.find((item) => (item.from === file_from && item.to === file_to))) {
				result.push({from: file_from, to: file_to});
			}
		});

		return result;
	}

	const findAllFiles = (inDirectory:string, depth:number) => {
		let results = [];
		let nested = -1;	//	(0 - 1) so on the first run the nesting will be equal to zero
	
		const dir_search = (searchDir:string) => {	
			nested++;
	
			if (!fs.existsSync(searchDir)) {
				console.error(colorText(`Directory '${searchDir}' does not exist`, 'red', 'reverse'));
				return;
			}
	
			fs.readdirSync(searchDir).forEach((file) => {
				const filaPath = `${searchDir}/${file}`;
				const stat = fs.lstatSync(filaPath);
		
				if (stat.isDirectory() && nested < depth) dir_search(filaPath);
				else if (regexes.inputFile.test(filaPath)) results.push(filaPath);
			})
		};
		dir_search(inDirectory);
		
		return results;
	};

	//	add files, that were found in the src dirs
	if (sourceDir && destDir) {
		sourceDir = addNestedPath(sourceDir);
		if (watchMode && fs.existsSync(sourceDir)) watchDirectory = sourceDir;

		sourseFiles = sourseFiles.concat(filterNewFiles(findAllFiles(sourceDir, dirScanDepth), sourceDir));
	}

	if (!sourseFiles.length) {
		console.error(colorText('No source files found', 'red', 'bright'));
		console.log('Check if the config file contains source and destination directory path, or a list of files');
	}

	let filesSuccessful = 0;
	const templateFileHandler = (pathObj:_pathObj) => {

		// process the templates
		const buildTemplateFile = (srcpath:string, destpath:string) => {

			let templateHtml = '';
			try { templateHtml = fs.readFileSync(srcpath, {encoding: 'utf8'}).toString(); }
				catch (error) { return -1; }
			
			if (templateHtml.length < minSrcFileLength) return 0;
			
			const destDir = separatePath(destpath).dir;
				if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

			let included = includedWatchdogs.find((item) => item.parent === srcpath);

			//	set to (0 - 1) so during the first run it will be equal to zero 
			let nestedTemplate = -1;
			let allTemplateVars = Array<string>(0);

			//	the builder function itself
			const buildTemplate = (templateText:string) => {
				nestedTemplate++;
				
				//	find all template literals?... or whatever you call that
				interface _tempLiteral {
					pattern: string,
					name: string
				};
				const templateVars = Array<_tempLiteral>(0);
					templateText.match(regexes.template_var)?.forEach((literal) => {
						const varname = literal.match(regexes.variable)[0];
						if (typeof varname === 'string') {
							templateVars.push({pattern: literal, name: varname});
							allTemplateVars.push(varname);
						}
					});
				
				templateVars.forEach(tempVar => {

					//	find value or return empty string
					let dataValue = variables[tempVar.name] || '';

						//	data post processing
						if (dataValue.length > 0) {

							//	load file contents from the path, specifiend in the string
							if (regexes.var_file.test(dataValue)) {

								const getPreceedingIndenting = ((source:string, varName:string) => {
									//	get the line containing template literal and the previous one
									const segment = source.match(new RegExp(svcRegexes.precIndent.source + svcRegexes.tplOpen.source + varName));
										if (!segment?.length) return '';	//	abort if not found

									//	get all the chars starting from previous string and to '{' sign
									let format = segment[0].slice(1, segment[0].indexOf('{'));

									//	cut only the current line, if were captured two
									if (format.match(/\n/g)?.length) format = format.slice(format.lastIndexOf('\n'));

									//	remove LF's and return the result
									return format.replace(/[\r\n]+/g, '');
								});

								const inclDocPath = addNestedPath(dataValue.replace(regexes.var_file, ''));

								try {
									dataValue = fs.readFileSync(inclDocPath, {encoding: 'utf8'}).toString();

									const syntaxIndenting = getPreceedingIndenting(templateText, tempVar.name);
										if (syntaxIndenting.length) dataValue = dataValue.replace(/\n/g, `\n${syntaxIndenting}`);

									if (watchMode && watchIncluded) {

										if (!included) {
											included = {
												parent: srcpath,
												files: Array<_wathchIncludedFile>(0)
											}
											includedWatchdogs.push(included);
										}

										if (!included.files.find((item) => item.variable === tempVar.name)) {
//	! fix this bs asap
											//	well, the only idea I have is to convert the object to a class,
											//	so I could use 'this' to access it's properties
											//	fucking oop everywhere
											let this_timeout: NodeJS.Timeout | number = 0;
											included.files.push({
												_evTiomeout: this_timeout,
												variable: tempVar.name,
												watchdog: fs.watch(inclDocPath, () => {
													clearTimeout(this_timeout);
													this_timeout = setTimeout(() => rebuildTemplate(), fsWatch_evHold);
												})
											});
										}
									}

								} catch (error) {
									dataValue = '';
									console.warn(colorText(`Included file '${inclDocPath}' not found`, 'yellow', null));
								}

								if (buildIncluded && dataValue.length > 8) {
									if (nestedTemplate <= maxNestedTemplates) {
										dataValue = buildTemplate(dataValue);
									} else {
										dataValue = '';
										console.warn(colorText(`File '${inclDocPath}' nested too deeply. Skipped`, 'yellow', null));
									}
								}
							}

							//	hidden variables
							if (dataValue.startsWith('~!')) dataValue = '';

						} else console.warn(colorText(`Variable ${tempVar.name} not found`, 'yellow', null));

					//	insert text to html document
					templateText = templateText.replace(tempVar.pattern, dataValue);
				});

				//	clean up unused watchdogs and merge
				if (included && !nestedTemplate) {

					included.files.forEach((wdog) => {
						if (!allTemplateVars.find((item) => item === wdog.variable)) {
							wdog.watchdog.close();
							included.files = included.files.filter((item) => item !== wdog);
						}
					});

					if (!included.files.length) {
						includedWatchdogs.filter((item) => item.parent !== included.parent);
					}
				}

				//	trim public folder path
				if (typeof trimPubRoot === 'string') templateText = templateText.replace(new RegExp(`/${normalizePath(trimPubRoot)}/`, 'g'), '/');

				return templateText;
			}

			try { fs.writeFileSync(destpath, buildTemplate(templateHtml), {encoding: 'utf8'}); }
				catch (error) { return -2; }

			return 1;
		};

		switch (buildTemplateFile(pathObj.from, pathObj.to)) {
			case 1:
				console.log(colorText(`Processed '${pathObj.from}'`, 'green', null));
				filesSuccessful++;
				break;
			case 0:
				console.log(colorText(`Skipped '${pathObj.from}'`, 'yellow', null), ': too short');
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

		const rebuildTemplate = () => {
			const rebuildResult = buildTemplateFile(pathObj.from, pathObj.to);
				if (rebuildResult > 0) console.log(colorText(`Rebuilt '${pathObj.from}'`, 'green', null));
		};

		if (watchMode) {
			let changeHandler: NodeJS.Timeout | number = 0;
			const watchdog = fs.watch(pathObj.from, () => {
				clearTimeout(changeHandler);
				changeHandler = setTimeout(() => rebuildTemplate(), fsWatch_evHold);
			});
			sourcesWatchdogs.push(watchdog);
		}
	};

	sourseFiles.forEach(item => templateFileHandler(item));

	if (watchDirectory) {
		srcDirWatchDog = fs.watch(watchDirectory, {recursive: true}, (eventType, filename) => {
			if (eventType === 'change') return;
			if (!regexes.inputFile.test(filename)) return;
			filterNewFiles([normalizePath(`${watchDirectory}/${filename}`)], watchDirectory).forEach((newFile) => {
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

	let configChangeHandler: NodeJS.Timeout | number = 0;
	fs.watch(configPath, () => {
		clearTimeout(configChangeHandler);
		configChangeHandler = setTimeout(() => {

			let configReloadResult = loadConfig();
			if (!configReloadResult) {
				if (srcDirWatchDog) {
					srcDirWatchDog?.close();
					srcDirWatchDog = null;
				}
				
				sourcesWatchdogs.forEach((watchdog) => watchdog.close());

				console.log('Config reloaded');
				coreFunction();
			}
			else console.error(colorText(configReloadResult, 'red', null));

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
