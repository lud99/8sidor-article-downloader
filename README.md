# 8sidor-article-download

Download all articles from 8sidors rss feed. Includes the following information about the articles:
* Body, summary and title
* Subject
* Tags (not normally visible)
* Author (not normally visible either)
* Comments 
* Exact date

Does not include:
* Article likes and dislikes
* Image or image text
* Internal article id
* Website HTML

### How to run
```npm install``` then ```node main```. The downloading process can take up 30 minutes or an hour (there are over 30000 articles). The output files are saved into ```articles/urls``` and ```articles/json```. Errors that occurs when fetching are saved to ```temp/errors.json```.

If you wish to download the most recent articles, then run the script again (everything will be saved to todays date, so it never overrides your old downloads).
It will use your previous downloads to drastically speed up the downloading process, as it will only fetch the articles that aren't downloaded. 