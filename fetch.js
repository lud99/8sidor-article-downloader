const fetch = require("node-fetch");
const cheerio = require("cheerio");
const fs = require("fs");

const { makeValidFilename, sortByProperty } = require("./utils")

const FeedParser = require('feedparser');

const today = new Date().toLocaleDateString();

const fetchRss = (articleUrl) => (
    new Promise(async resolve => {
        const feedparser = new FeedParser();

        let response;
        try {
            response = await fetch(articleUrl);
        } catch (error) {
            console.error(error)
            console.log(articleUrl)

            errors.push("Invalid url probably " + articleUrl);
            return resolve();
        }
    
        // Check the response code and then save the body
        if (response.status !== 200 && response.status !== 403 && response.status !== 301) {
            errors.push("Bad status code " + response.status + " (limit reached or bad url) " + articleUrl);
            
            console.log("Bad status code", response.status, articleUrl);
            return resolve();
        } else
            // The response `body` -- res.body -- is a stream
            response.body.pipe(feedparser);
    
        // Parser errors
        feedparser.on('error', function (error) {
            console.log("Not a feed", articleUrl);
            errors.push("Not a feed " + articleUrl);
        });

        const items = [];
    
        feedparser.on('readable', function () {
            // This is where the action is!
            var stream = this; // `this` is `feedparser`, which is a stream
            var item;
    
            while (item = stream.read()) {
                items.push(item);
            }
        });

        feedparser.on("end", function () {
            return resolve(items);
        })
    })
);
module.exports.fetchRss = fetchRss;

const parseArticleBodyRss = (rss) => {
    try {
        if (!rss) return;

        // If 'rss' is an array, then set it to the the first element
        if (rss.length !== undefined)
            rss = rss[0];

        if (!rss) return;

        // Get the tags names from the array only (not the other object junk)
        // It may be an object, or an array
        var tags = null;
        if (rss["dc:subject"]) {
            if (rss["dc:subject"].length)  // array 
                tags = rss["dc:subject"].map(subjectEntry => subjectEntry["#"]);
            else // object
                tags = [rss["dc:subject"]["#"]];
        }

        const article = {
            url: rss.link,
            title: rss.title,
            subject: tags ? tags[0] : null, // The subject is the first tag
            tags: tags,
            previewText: rss.summary,
            mainText: rss.description,
            date: rss.date,
            author: rss.author
        };

        return article;
            
    } catch (error) {
        console.error(error);
        console.log(rss);

        errors.push("RSS error " + JSON.stringify(rss));
    }
};
module.exports.parseArticleBodyRss = parseArticleBodyRss;

const parseArticleCommentsRss = (rss) => (
    rss.map(rssComment => ({
            url: rssComment.link,
            text: rssComment.description, // html elements
            author: rssComment.author,
            date: rssComment.date,
            replyingTo: rssComment["thr:in-reply-to"]["@"].href // parent comment
        })
    )
);
module.exports.parseArticleCommentsRss = parseArticleCommentsRss;

const fetchArticleData = async (articleUrl) => {
    const article = parseArticleBodyRss(await fetchRss(`${articleUrl}feed/rdf`));

    if (!article) return;

    // Don't fetch comments if the article is before year 2019, as those comments doesn't exist anymore
    let comments = [];
    if (new Date(article.date).getFullYear() >= 2019) {
        comments = parseArticleCommentsRss(await fetchRss(`${articleUrl}feed/atom`));
    }

    // Add the comments into the article
    article.comments = comments;

    return article;
};
module.exports.fetchArticleData = fetchArticleData;

const getAllArticleUrls = async () => {
    const batchSize = 100;

    // Get article page count
    const getArticlePageCount = async () => {
        const html = await (await fetch(`https://8sidor.se/page/0/?s`)).text(); 

        const $ = cheerio.load(html);
        const lastPageHref = $(".pagination > li > a")[3].attribs.href;

        const count = lastPageHref.match(/\+?\d+/g)[1]; // get the count from the href link
        return count;
    }; 
    const articlePageCount = await getArticlePageCount();
    let articlePagesToFetchCount = articlePageCount;

    // check if some article urls have already been fetched
    let articleUrls = [];
    let previousArticleUrls = [];

    // Check if previous article urls have already been fetched 
    if (fs.existsSync("./articles/urls") && fs.readdirSync("./articles/urls").length > 0) {
        const articleUrlFiles = fs.readdirSync("./articles/urls").sort().reverse(); // newest files at the beginning of the array
        const latestArticleUrlsFilepath = `./articles/urls/${articleUrlFiles[0]}`; 

        console.log("Reading previously fetched article urls from", latestArticleUrlsFilepath);

        previousArticleUrls = require(latestArticleUrlsFilepath);

        const newArticlesApprox = articlePageCount * 10 - previousArticleUrls.length;
    
        console.log("There might be about %s new articles to fetch", newArticlesApprox);

        articlePagesToFetchCount = Math.ceil((articlePageCount * 10 - previousArticleUrls.length) / 10) /* add some margin for safety */ + 2;
        // don't fetch the same articles multiple times. also make a copy of the array instead of reference
        // reverse the array so the new articles are appended next to the other newest ones
        articleUrls = previousArticleUrls.reverse().slice(); 
    } else {
        console.log("No previously fetched article urls found. Fetching everything");

        console.log("%s article pages exists, %s articles in total", articlePageCount, articlePageCount * 10);

        if (!fs.existsSync("./articles/urls"))
            fs.mkdirSync("./articles/urls");
    }

    console.log("Will fetch %s articles...", articlePagesToFetchCount * 10);

    const pageUrls = [];
    for (let i = 0; i <= articlePagesToFetchCount; i++) {
        pageUrls.push(`https://8sidor.se/page/${i}/?s`);
    }

    const doRequest = async (urls, originalArrOffset, total) => {
        const promises = [];

        for (let i = 0; i < urls.length; i++)
            promises.push(fetch(urls[i]));

        const responses = await Promise.all(promises);

        for (let i = 0; i < responses.length; i++) {
            const html = await responses[i].text();

            const $ = cheerio.load(html);

            $(".blog-main .article h2 a").each((index, a) => {
                const url = a.attribs.href;

                if (!articleUrls.includes(url))
                    articleUrls.push(url);
            });

            // clamp at 0
            const remaining = (total - (originalArrOffset + batchSize) > 0) ? total - (originalArrOffset + batchSize) : 0;
            if (i == responses.length - 1) { // if batch is finished
                console.log("---\nBatch for page %s fetched. %s article pages remaining (%s article links)", originalArrOffset, remaining, remaining * 10);

                // Save the current article urls temporary if a crash or something occurs
                const filename = `temp/article-list-${makeValidFilename(today)}.json`;
                fs.writeFile(filename, JSON.stringify(articleUrls, null, 4), () => {})
                fs.writeFile("temp/errors.json", JSON.stringify(errors, null, 4), () => {});
            }
        };
    }

    // Start each batch
    for (let i = 0; i < pageUrls.length; i += batchSize) {
        try {
            await doRequest(pageUrls.slice(i, i + batchSize), i, pageUrls.length)
        } catch (error) {
            console.log("Error:", error, pageUrls[i]);
        }
    }

    console.log("---\nDone. Fetched %s new article urls", articleUrls.length - previousArticleUrls.length);

    // latest articles at the top. the array was reversed at the start, so reverse it back
    if (previousArticleUrls.length > 0)
        return articleUrls.reverse();
    else 
        return articleUrls;
};
module.exports.getAllArticleUrls = getAllArticleUrls;

const getAllArticleData = async (articleUrls, batchSize = 25, compareWithPrevious = true) => {
    // check if some articles have already been fetched
    let articles = [];
    let previousArticles = [];
    let articlesToFetch = [];

    // Check if previous articles have already been fetched 
    if (compareWithPrevious && fs.existsSync("./articles/json") && fs.readdirSync("./articles/json").length > 0) {
        const articlesFiles = fs.readdirSync("./articles/json").sort().reverse(); // newest files at the beginning of the array
        const latestArticlesFilepath = `./articles/json/${articlesFiles[0]}`; 

        console.log("Reading previously fetched articles from", latestArticlesFilepath);

        previousArticles = require(latestArticlesFilepath);

        // set articles to the previous, without the null ones
        articles = previousArticles.filter(article => article != null);

        // Finding new articles 
        console.log("---\nFinding new articles to fetch...")
        articleUrls.forEach(url => {
            let found = false;

            for (let i = 0; i < previousArticles.length; i++) {
                if (!previousArticles[i]) continue;

                if (previousArticles[i].url == url) {
                    found = true;
                    break;
                }
            }

            if (!found) articlesToFetch.push(url);
        });

        // don't fetch the same articles multiple times. also make a copy of the array instead of reference to avoid modifying it
        // reverse the array so the new articles are appended next to the other newest ones
        //articles = previousArticles.reverse().slice(); 
    } else {
        console.log("No previously fetched articles found. Fetching everything (%s articles)", articleUrls.length);

        articlesToFetch = articleUrls.slice();

        if (!fs.existsSync("./articles/json"))
            fs.mkdirSync("./articles/json");
    }

    console.log("Will fetch %s articles...", articlesToFetch.length);

    const doRequest = async (urls, originalArrOffset, total) => {
        const promises = [];

        for (let i = 0; i < urls.length; i++)
            promises.push(fetchArticleData(urls[i]));

        const articlesData = await Promise.all(promises);

        for (let i = 0; i < articlesData.length; i++) {
            // Only add the article if it could be parsed
            if (articlesData[i])
                articles.push(articlesData[i]);

            // clamp at 0
            const remaining = (total - (originalArrOffset + batchSize) > 0) ? total - (originalArrOffset + batchSize) : 0
            if (i == articlesData.length - 1) {
                console.log("---\nBatch fetched. %s articles remaining", remaining);

                // Save the current articles temporary if a crash or something occurs
                const filename = `temp/article-list-${makeValidFilename(today)}.json`;
                fs.writeFile(filename, JSON.stringify(articleUrls, null, 4), () => {})
                fs.writeFile("temp/errors.json", JSON.stringify(errors, null, 4), () => {});
            }
        };
    }

    // Start each batch
    for (let i = 0; i < articlesToFetch.length; i += batchSize) {
        try {
            await doRequest(articlesToFetch.slice(i, i + batchSize), i, articlesToFetch.length)
        } catch (error) {
            console.log("Error:", error, articlesToFetch[i]);
        }
    }

    // remove nulls and sort them properly
    const finalArticles = articles.filter(article => article != null).sort(sortByProperty("date"));

    console.log("---\nDone. Fetched %s new articles", finalArticles.length - previousArticles.filter(article => article != null).length);

    return finalArticles;
};
module.exports.getAllArticleData = getAllArticleData;