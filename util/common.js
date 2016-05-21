module.exports.load_crawl_pattern = function (url){
	var product_pattern = url;
	if (product_pattern.startsWith('http://')) {
		product_pattern = product_pattern.replace('http://', '');
	} else if (product_pattern.startsWith('https://')) {
		product_pattern = product_pattern.replace('https://', '');
	} else {

	}
	product_pattern = './pattern/' + product_pattern + ".json";
	var pattern = JSON.parse(require('fs').readFileSync(product_pattern, 'utf8'));
	return pattern;
}