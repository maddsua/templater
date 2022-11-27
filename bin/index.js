import fs from 'fs';

const regexes = {
	template_var: /\{\{\s[\_A-Za-z]{1}[A-Za-z0-9\_]{0,}\s\}\}/g,
	variable: /[\_A-Za-z]{1}[A-Za-z0-9\_]{0,}/g,
	inputFile: /^.*\.htm(l?)$/,
	directory: /^.*\//,
	dirSlashes: /(\/\/)|(\\\\)|(\\)/g
}

const configPath = './templater.config.json';

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
	if (path[0] === '/' || path[0] === '\\') return (`.${temp}`);
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


	//	deal with input files
	const files = config['files'];
	const sourceDir = config['sourceDir'];

	let publicRoot = config['publicRoot'];
		if (typeof publicRoot !== 'string') publicRoot = false;

	let inputs = [];
	//	add specifiend files
	if (typeof files.length === 'number') {
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

			if (!inputs.find((item) => (item.from == file_from && item.to === file_to))) inputs.push({
				from: file_from,
				to: file_to
			});
		});
	}


	// process templates
		
	const variables = config['data'];
		if (typeof variables !== 'object') {
			console.error('No template data block in config');
			return false;
		}

	const processTemplate = (templateText) => {

		//	insert text strings
		let tempHtml = templateText;

		const allTempVars = tempHtml.match(regexes.template_var);
		allTempVars.forEach(tempVar => {
			const varname = tempVar.match(regexes.variable)[0];
				if (!varname) return;
	
			tempHtml = tempHtml.replace(new RegExp(tempVar), variables[varname] || '');
		});

		if (publicRoot) tempHtml = tempHtml.replace(new RegExp(`${publicRoot}`, 'g'), '/');
	
		return tempHtml;
	};

	inputs.forEach(filepath => {

		let htmltext = {};
		try {
			htmltext = fs.readFileSync(filepath.from, {encoding: 'utf8'}).toString();
		} catch (error) {
			console.error(`Can't load template file ${filepath.from}, error: ${error}`);
			return;
		}

		const destDir = separatePath(filepath.to).dir;
	
		if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

		fs.writeFileSync(filepath.to, processTemplate(htmltext), {encoding: 'utf8'});
		console.log(`Processed ${filepath.from}`);
	});

})();
