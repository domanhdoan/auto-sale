module.exports.load_json = function (path) {
    var json_object = JSON.parse(require('fs').readFileSync(path, 'utf8'));
    return json_object;
}

module.exports.load_crawl_pattern = function (url) {
    var product_pattern = url;
    if (product_pattern.startsWith('http://')) {
        product_pattern = product_pattern.replace('http://', '');
    } else if (product_pattern.startsWith('https://')) {
        product_pattern = product_pattern.replace('https://', '');
    } else {

    }
    product_pattern = './datasets/' + product_pattern + ".json";
    var pattern = JSON.parse(require('fs').readFileSync(product_pattern, 'utf8'));
    return pattern;
}

/**
 * ReplaceAll by Fagner Brack (MIT Licensed)
 * Replaces all occurrences of a substring in a string
 */
String.prototype.replaceAll = function (token, newToken, ignoreCase) {
    var _token;
    var str = this + "";
    var i = -1;

    if (typeof token === "string") {

        if (ignoreCase) {

            _token = token.toLowerCase();

            while ((
                i = str.toLowerCase().indexOf(
                    _token, i >= 0 ? i + newToken.length : 0
                )) !== -1
            ) {
                str = str.substring(0, i) +
                    newToken +
                    str.substring(i + token.length);
            }

        } else {
            return this.split(token).join(newToken);
        }

    }
    return str;
};

module.exports.get_img_fingerprint = function (image_uri, target_url, callback) {
    var request = require('request');
    var req = request.post(target_url, function (err, resp, body) {
        if (err) {
            console.log('Error!');
        } else {
            console.log('URL: ' + body);
        }
    });
    var form = req.form();
    var fs = require('fs');
    form.append('file', fs.createReadStream(image_uri));
}