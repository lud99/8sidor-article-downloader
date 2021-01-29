const fs = require("fs");

const validate = require("./validate");
const path = require('path');

const today = new Date().toLocaleDateString();

const { getAllArticleUrls, getAllArticleData } = require("./fetch");
const { makeValidFilename } = require("./utils");

global.errors = [];

// create folders
if (!fs.existsSync("./temp"))
    fs.mkdirSync("./temp");

if (!fs.existsSync("./articles"))
    fs.mkdirSync("./articles");

const deleteFolderRecursive = function (directoryPath) {
    if (fs.existsSync(directoryPath)) {
        fs.readdirSync(directoryPath).forEach((file, index) => {
            const curPath = path.join(directoryPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                // recurse
                deleteFolderRecursive(curPath);
            } else {
                // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(directoryPath);
    }
};

const start = async () => {
    const articleUrls = await getAllArticleUrls();

    // Save article urls to file
    const urlsFilename = `./articles/urls/article-urls-${makeValidFilename(today)}.json`;
    fs.writeFileSync(urlsFilename, JSON.stringify(articleUrls, null, 4));

    const articles = await getAllArticleData(articleUrls);

    // Save articles to file
    const articlesFilename = `./articles/json/articles-${makeValidFilename(today)}.json`;
    fs.writeFileSync(articlesFilename, JSON.stringify(articles, null, 4));

    // Validate the articles to make sure every article fetched successfully
    const missingUrls = validate.validate(articleUrls, articles);
    const fixedArticles = await validate.fix(articleUrls, articles, missingUrls);

    // Save them
    console.log("Done (finally). Saved final articles file to", articlesFilename);
    const finalArticles = articles.concat(fixedArticles);
    fs.writeFileSync(articlesFilename, JSON.stringify(finalArticles, null, 4));

}

start();