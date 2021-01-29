
module.exports.makeValidFilename = (string, replacor = "-") => string.replace(/[/\\?%*:|"<>]/g, replacor);

module.exports.sortByProperty = (property) => {
    var sortOrder = 1;
    if(property[0] === "-") {
        sortOrder = -1;
        property = property.substr(1);
    }
    return function (a,b) {
        var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
        return result * sortOrder;
    }
};

module.exports.getLatestFile = (dir) => {
    if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).sort().reverse(); // newest files at the beginning of the array
        const latestFile = `${dir}/${files[0]}`; 

        return require(latestFile);
    }
}

module.exports.getLatestFilePath = (dir) => {
    if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).sort().reverse(); // newest files at the beginning of the array
        const latestFile = `${dir}/${files[0]}`; 

        return latestFile;
    }
}

module.exports.removeSpecialCharacters = (string) => {
    // Remove å, ä, ö and accents
    string = string.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Remove emojis
    return string.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
}