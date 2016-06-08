const imghash = require('imghash');
var Enum = require('enum');

module.exports = {
    say_greetings: "Xin kính chào quý khách",
    say_waiting_message: "Hệ thống đang tìm kiếm ...",
    say_search_continue_message: "Xin vui lòng tiếp tục tìm kiếm nếu bạn chưa tìm thấy hay tìm kiếm sản phẩm mới",
    pls_select_category: "Xin vui lòng chọn 1 danh mục sản phẩm",
    pls_select_product: "Xin vui lòng chọn sản phẩm (nhập mã sản phẩm hoặc upload ảnh)",
    pls_select_product_color: "Xin vui lòng chọn màu",
    pls_select_product_size: "Xin vui lòng chọn size",
    pls_enter_quantity: "Xin vui lòng chọn số lượng",
    pls_enter_name: "Xin vui lòng nhập tên người nhận",
    pls_enter_address: "Xin vui nhập địa chỉ người nhận",
    pls_enter_phone: "Xin vui lòng nhập số điện thoại",
    pls_enter_email: "Xin vui lòng nhập email người nhận",
    pls_enter_delivery_date: "Xin vui lòng nhập ngày nhận hàng",
    pls_reset_buying: "Hủy đơn hàng. Xin vui lòng bắt đầu lại quá trình đặt hàng",
    pls_end_buying: "Kết thúc đặt hàng. Xin vui lòng nhập OK để bắt đầu đơn hàng mới",
    start_order_process: "Bắt đầu quá trình đặt hàng",
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
    notify_product_notfound: "Sản phẩm không tìm thấy. Xin vui lòng nhập lại thông tin",
    cmd_terminate_order: "huy",
    cmd_continue_search: "search",
    cmd_order: "order",
    cmd_confirm_order: "ok",
}

module.exports.sale_steps = new Enum([
    "say_greetings",

    "find_product",
    // Select product with details
    "select_product",
    "select_product_color",
    "select_product_size",
    "set_quantity",
    "select_next_product",
    // Order product
    "set_recipient_name",
    "set_address",
    "set_phone",
    "set_email",
    "set_delivery_date"
]);

var color_vn = {do:"Đỏ", den: "Đen", xam: "Xám", xanhlam: "Xanh lam", 
    hongphan: "Hồng phấn", trang: "Trắng", xanhtimthan: "Xanh tím than",
    ghi: "Ghi", tim: "Tím"};

module.exports.get_color_vn = function (value) {
    return color_vn[value];
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

module.exports.generate_remoteimg_hash = function (url, callback) {
    var http = require('http')
        , fs = require('fs')
        , options

    var request = http.get(url, function (res) {
        var imagedata = ''
        res.setEncoding('binary')
        var contentType = res.headers['content-type'];

        res.on('data', function (chunk) {
            imagedata += chunk
        })

        res.on('end', function () {
            var crypto = require('crypto');
            var hash = crypto.createHash('md5').update(url).digest('hex');
            var fileName = "./temp/" + hash + "." + contentType.replaceAll('/', ".");
            fs.writeFile(fileName, imagedata, 'binary', function (err) {
                if (err) throw err
                imghash
                    .hash(fileName)
                    .then((hash) => {
                        console.log(hash);
                        callback(hash);
                    });
            })
        })
    })
}

module.exports.generate_localimg_hash = function (path, callback) {
    imghash
        .hash(path)
        .then((hash) => {
            console.log(hash);
            callback(hash);
        });
}