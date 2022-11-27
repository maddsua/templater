import fs from 'fs';

const regexes = {
	template_var: /\{\{\s[\_A-Za-z]{1}[A-Za-z0-9\_]{0,}\s\}\}/g,
	variable: /[\_A-Za-z]{1}[A-Za-z0-9\_]{0,}/g
}

const configPath = './templater.config.json';

const rootPathToLocalRoot = (path) => {
	if (path[0] === '/' || path[0] === '\\') return (`.${path}`);
	return path;
}

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
		if (typeof files.length !== 'number') {
			console.error('No files specified in config');
			return false;
		}
	const variables = config['data'];
		if (typeof variables !== 'object') {
			console.error('No template data block in config');
			return false;
		}
	let publicRoot = config['publicRoot'];
		if (typeof publicRoot !== 'string') publicRoot = false;


	const processTemplate = (templateText) => {

		//	insert text strings
		let tempHtml = templateText;

		const allTempVars = tempHtml.match(regexes.template_var);
		allTempVars.forEach(tempVar => {
			const varname = tempVar.match(regexes.variable)[0];
				if (!varname) return;
	
			tempHtml = tempHtml.replace(new RegExp(tempVar), variables[varname] || '');
		});

		if (publicRoot) {
			tempHtml = tempHtml.replace(new RegExp(`${publicRoot}`, 'g'), '/');
		}
	
		return tempHtml;
	};

	files.forEach(filepath => {

		const srcfile = rootPathToLocalRoot(filepath.from);
		const outfile = rootPathToLocalRoot(filepath.to);

		let htmltext = {};
		try {
			htmltext = fs.readFileSync(srcfile, {encoding: 'utf8'}).toString();
		} catch (error) {
			console.error(`Can't load template file ${srcfile}, error: ${error}`);
			return;
		}

		fs.writeFileSync(outfile, processTemplate(htmltext), {encoding: 'utf8'});
		
	});	
})();
