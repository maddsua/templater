# Builds HTML pages from templates

## Whats that?

This little build script will come handy for creating single-page (or a few more) sites without use of frameworks and other heavy tools.

Let's say, you have to place a company's phone number in 15 places on a page. If you pick a custom script or, let's say, Vue as a solution - well, that's your choise. But I would prefer a simple tool that puts a text string where it needs to be.

**Then, why not php?**

 \- Hehe \[visibly nervous\]. Well yes, Netlify allows you to use PHP as a build tool, so that it could be used to put that text in place. The thing is, I don't like PHP's syntax and it would be like driving a nail with an anvil

---

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

---

## Config file properties:

1. `srcDir` : Directory to look for templates

2. `destDir` : Destination directory or simply output

3. `trimPublicRoot` : A part of resourese path to remove so the result will look like this: `"public/app/logo.svg"` --> `"app/logo.svg"`

	Must be a valid string or boolean `false`. Defaults to `destDir` if set as `true` or if omitted.

4. `buildIncluded` : Try to build included files as templates

5. `maxNestedTemplates` : How many templates can be included inside each other

6. `dirScanDepth` : Directory search depth

7. `files` : Contains exact files to process, example below

8. `data` : All the variables and their values

### Config file example:

[templater.config.json](test/templater.config.json)

---

## Start arguments

`init`	: Create basic config file

`--config=path` : Specifies the config file

`--watch` : Does the same as for typescript or sass (ok, it's 'rebuild on change')

---
Run `npm test` and check out the [test](test/) directory