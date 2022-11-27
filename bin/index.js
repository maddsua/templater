import fs from 'fs';

const regexes = {
	template_var: /\{\{\s[\_A-Za-z]{1}[A-Za-z0-9\_]{0,}\s\}\}/g,
	variable: /[\_A-Za-z]{1}[A-Za-z0-9\_]{0,}/g,
	inputFile: /^.*\.htm(l?)$/,
	directory: /^.*\//
}

const configPath = './templater.config.json';

const rootPathToLocalRoot = (path) => {
	if (path[0] === '/' || path[0] === '\\') return (`.${path}`);
	return path;
};

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

//	the main()
(() => {

	let config = {};
	try {
		config = JSON.parse(fs.readFileSync(configPath).toString());
	} catch (error) {
		console.error(`Failed to load config file: can\'t read ${configPath} as json, error: ${error}`);
		return false;
	}

	const files = config['files'];
	const sourceDir = config['sourceDir'];

	let publicRoot = config['publicRoot'];
		if (typeof publicRoot !== 'string') publicRoot = false;

	let inputs = [];
	//	add specifiend files
	if (typeof files.length === 'number') {
		files.forEach((file) => {
			if (typeof file.from === 'string' && typeof file.to === 'string') inputs.push(file);
		});
	}
	//	add files, that were found in src directories
	if (typeof sourceDir === 'string' && publicRoot) {
		const sources = findAllFiles(rootPathToLocalRoot(sourceDir));
		console.log(sources);
	}
		
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

		const srcfile = rootPathToLocalRoot(filepath.from);
		const outfile = rootPathToLocalRoot(filepath.to);

		let htmltext = {};
		try {
			htmltext = fs.readFileSync(srcfile, {encoding: 'utf8'}).toString();
		} catch (error) {
			console.error(`Can't load template file ${srcfile}, error: ${error}`);
			return;
		}

		const destDir = outfile.match(regexes.directory)[0];
		const destFile = destDir.length > 1 ? outfile.substring(destDir.length) : outfile;
	
		if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

		fs.writeFileSync(outfile, processTemplate(htmltext), {encoding: 'utf8'});
		console.log(`Processed ${srcfile}`);
	});

})();
