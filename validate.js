const fs = require("fs");

const { removeSpecialCharacters, makeValidFilename, getLatestFilePath } = require("./utils");

const { getAllArticleData } = require("./fetch")

const today = new Date().toLocaleDateString();

const validate = (articleUrls, fetchedArticles) => {
    const missing = [];

    // Make sure all urls has a fetched article
    console.log("---\nValidating fetched articles...");
    articleUrls.forEach(url => {
        let found = false;

        for (let i = 0; i < fetchedArticles.length; i++) {
            if (!fetchedArticles[i]) continue;

            if (fetchedArticles[i].url == url) {
                found = true;
                break;
            }
        }

        if (!found) missing.push(url);
    });

    console.log("---\nDone\n%s of the %s articles are missing", missing.length, fetchedArticles.length);

    return missing;
};

const fix = async (allArticleUrls, articles, missingUrls) => {
    let newArticles = [];

    // Perform the request one more time to fetch articles that dissapeared or something
    /*newArticles = newArticles.concat(await getAllArticleData(missingUrls, 25, false));

    console.log("%s new articles fetched when performing the request again (default)", newArticles.length);*/

    // Try to remove special characters from the urls
    console.log("---\nTrying to remove special characters from the urls...");        
    const urlsNormalized = missingUrls.map(url => {
        const normalized = removeSpecialCharacters(url);

        // remove '-/' endings
        return normalized.replace("-/", "/");
    });

    const articlesFetchedFromNormalizedUrls = await getAllArticleData(urlsNormalized, 25, false);

    newArticles = newArticles.concat(articlesFetchedFromNormalizedUrls);

    return newArticles;
}

module.exports.validate = validate;
module.exports.fix = fix;

const runFromCmd = async () => {
    global.errors = [];

    const missing = validate(getLatestFile("./articles/urls"), getLatestFile("./articles/json"));
    const fixedArticles = fix(getLatestFile("./articles/urls"), getLatestFile("./articles/json"), missing);

    // save
    const articles = getLatestFile("./articles/urls").concat(fixedArticles);
    fs.writeFileSync(getLatestFilePath("./articles/json"), JSON.stringify(articles, null, 4));
    console.log("---\nSaved final articles file to", getLatestFilePath("./articles/json"));
}

if (require.main === module)
    runFromCmd();