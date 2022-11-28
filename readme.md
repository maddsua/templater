# Builds HTML pages from templates

## So, basically it does two things:

Converts html template:
```
<h1>{{ doc_header_text }}</h1>
<p>{{ first_paragraph }}</p>

<img src="/test_public/cat_image_1.jpg" alt="" class="src">
<img src="/test_public/cat_image_2.jpg" alt="" class="src">

<div>
{{ insert_doc }}
</div>
```

... to a html page (also trims 'public root' path left from VS Code's IntelliSence):
```
<h1>Page header</h1>
<p>Lorem ipsum blah blah blah...</p>

<img src="/cat_image_1.jpg" alt="" class="src">
<img src="/cat_image_2.jpg" alt="" class="src">

<div>
<ul>
	<li>Item one</li>
	<li>Item two</li>
	<li>Item three</li>
</ul>
</div>
```

## Config file example:

	templater.config.json
```
{
	"sourceDir": "/test_src",
	"publicRoot": "/test_public",
	"trimPublicRoot": true,

	"data": {
		"doc_header_text": "Page header",
		"first_paragraph": "Lorem ipsum blah blah blah...",
		"insert_doc": "$file=/test_include/block.html"
	}
}
```

## Start arguments

`--config=path` : Specifies the config file

`--watch` : Does the same as for typescript or sass (ok, it's 'rebuild on change')
