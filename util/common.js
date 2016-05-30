module.exports = {
    say_greetings: "Xin vui kính chào quý khách",
    say_waiting_message: "Hệ thống đang tìm kiếm theo mã sản phẩm hoặc từ khóa. Xin vui lòng đợi trong giây lát",
    pls_select_category: "Xin vui lòng chọn 1 danh mục sản phẩm",
    pls_select_product: "Xin vui lòng chọn sản phẩm (nhập code hoặc upload ảnh)",
    pls_select_product_color: "Xin vui lòng chọn màu sản phẩm",
    pls_select_product_size: "Xin vui lòng chọn size sản phẩm",
    pls_enter_quantity: "Xin vui lòng chọn số lượng sản phẩm",
    pls_enter_name: "Xin vui lòng nhập tên người nhận",
    pls_enter_address: "Xin vui nhập địa chỉ ngưởi nhận",
    pls_enter_phone: "Xin vui lòng nhập số điện thoại",
    pls_enter_email: "Xin vui lòng nhập email người nhận",
    pls_enter_delivery_date: "Xin vui lòng nhập ngày nhận hàng",
    pls_reset_buying: "Hủy đơn hàng. Xin vui lòng bắt đầu lại quá trình đặt hàng",
    pls_end_buying: "Kết thúc đặt hàng. Xin vui lòng nhập OK để bắt đầu đơn hàng mới",
    find_categories: "find_categories",
    find_product: "find_product",
    find_details: "find_details", // ask about size, color and in-stock status
    select_product: "select_product",
    select_product_color: "select_product_color",
    select_product_size: "select_product_size",
    set_quantity: "set_quantity",
    set_recipient_name: "set_recipient_name",
    set_address: "set_address",
    set_phone: "set_phone",
    set_email: "set_email",
    set_delivery_date: "set_delivery_date",
    notify_product_found: "Sản phẩm còn hàng",
    notify_product_notfound: "Sản phẩm không tìm thấy. Xin vui lòng nhập lại thông tin"
}

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