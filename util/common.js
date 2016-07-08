var Enum = require('enum');
var config = require('../config/config.js');
var logger = require('./logger.js');

module.exports = {
    say_greetings: "Xin kính chào quý khách",
    say_waiting_message: "Hệ thống đang tìm kiếm ...",
    say_search_continue_message: "Xin vui lòng tiếp tục tìm kiếm nếu bạn chưa tìm thấy hay tìm kiếm sản phẩm mới",
    pls_select_category: "Xin vui lòng chọn 1 danh mục sản phẩm",
    pls_select_product: "Xin vui lòng chọn sản phẩm (nhập mã sản phẩm hoặc upload ảnh)",
    pls_select_product_color: "Xin vui lòng chọn màu sản phẩm (xem bên dưới)",
    pls_select_product_size: "Xin vui lòng chọn size (xem bên dưới)",
    pls_enter_quantity: "Xin vui lòng chọn số lượng",
    pls_enter_name: "Xin vui lòng nhập tên người nhận",
    pls_enter_address: "Xin vui lòng nhập địa chỉ người nhận",
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
    select_type: "select_type",
    select_product_color: "select_product_color",
    select_product_size: "select_product_size",
    set_quantity: "set_quantity",
    set_recipient_name: "set_recipient_name",
    set_address: "set_address",
    set_phone: "set_phone",
    set_email: "set_email",
    set_delivery_date: "set_delivery_date",

    notify_product_found: "Bạn xem thông tin SP bên dưới nhé",
    notify_product_search: "Bạn nhấn \"Chi tiết sản phẩm\" để xem hình ảnh, màu sắc và size của sản phẩm nhé",
    notify_product_search2: "(Bạn trượt sang ngang để xem những sản phẩm khác nhé)",
    notify_color_notfound: "Không còn màu trong cửa hàng",
    notify_size_notfound: "Không còn size trong cửa hàng",
    notify_product_notfound: "Mình không tìm thấy sản phẩm như mong muốn của bạn.",
    notify_product_similar: "Bạn xem sản phẩm tương tự bên dưới nhé",

    action_view_category: "view_cat",
    action_terminate_order: "huy",
    action_continue_search: "search",
    action_view_details: "view",
    action_order: "order",
    action_select: "select",
    action_purchase: "purchase",
    action_confirm_order: "ok",
    action_cancel_order: "cancel",
    action_confirm_addr: "confirm_addr",
    action_confirm_type: "confirm_type",
    action_retype_addr: "retype_addr",

    status_updating: "Đang cập nhật",
    product_search_max: 10,
    INTENT_CHECK_PRICE: 'check_price',
    INTENT_CHECK_AVAILABILITY: 'check_availability',
    INTENT_CHECK_SHIP: 'check_ship',
    INTENT_GENERAL_SEARCH: 'general_search',
    INTENT_UNKNOWN: 'unknow_intent',
    INTENT_ACCURACY: 0.9,
    INTENT_ACCURACY_LOW: 0.6
}

module.exports.typical_question = {

}

module.exports.sale_steps = new Enum([
    "say_greetings",
    "find_product",
    // Select product with details
    "select_product",
    "select_type",
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

var color_vn = {
    do: "Đỏ",
    den: "Đen",
    xam: "Xám",
    xanhlam: "Xanh lam",
    hongphan: "Hồng phấn",
    trang: "Trắng",
    xanhtimthan: "Xanh tím than",
    ghi: "Ghi",
    tim: "Tím",
    vang: "Vàng",
    xanhcoban: "Xanh cô ban",
    nau: "Nâu",
    dogach: "Đỏ Gạch",
    xanhdatroi: "Xanh Da Trời",
    dodun: "Đỏ Đun",
    xanhneon: "Xanh Neon"
};

module.exports.get_color_vn = function(value) {
    return color_vn[value];
}

module.exports.getAllcolorVn = function() {
    return color_vn;
}

module.exports.loadJson = function(path) {
    var json_object = JSON.parse(require('fs').readFileSync(path, 'utf8'));
    return json_object;
}

module.exports.isUrl = function(text) {
    var is_url_flag = false;
    if (text.startsWith('http')) {
        is_url_flag = true;
    }
    return is_url_flag;
}

module.exports.isThumbUrl = function(text) {
    var is_url_flag = false;
    var temp = text.split("?");
    var link = (temp.length == 2) ? temp[0] : text;
    if (link.endsWith('png') || link.endsWith('jpg') || link.endsWith('jpeg')) {
        is_url_flag = true;
    }
    return is_url_flag;
}

module.exports.extract_numeric = function(text) {
    var myRe = new RegExp(/\d{2}/);
    var ret = "";
    var results = text.match(myRe);
    if (results != null && results.length > 0) {
        ret = results[0];
    }
    return ret;
}

module.exports.toCurrencyString = function(value, currency) {
    var priceRegExp = /\B(?=(\d{3})+(?!\d))/g;
    var string = value.toString().replace(priceRegExp, ",") + currency;
    return string;

}

module.exports.extractValue = function(text, regExpStr) {
    var ret = "";
    var regExp = new RegExp(regExpStr, "gi");
    var results = text.match(regExp);
    if (results != null && results.length > 0) {
        ret = results[0];
    }
    return ret;
}

module.exports.extractValues = function(text, regExpStr) {
    var regExp = new RegExp(regExpStr, "gi");
    var results = text.match(regExp);
    if (results == null) {
        results = [];
    }
    return results;
}

module.exports.extractProductCode = function(text, pattern) {
    var upper = text.toUpperCase();
    var ret = {
        isProductCode: false,
        code: ""
    };
    var myRe = new RegExp(pattern);
    var results = upper.match(myRe);

    if (results != null && results.length > 0) {
        ret.isProductCode = true;
        ret.code = results[0];
    }
    return ret;
}

module.exports.loadStoreScrapingPattern = function(storeType, url) {
    var product_pattern = url;
    if (product_pattern.startsWith('http://')) {
        product_pattern = product_pattern.replace('http://', '');
    } else if (product_pattern.startsWith('https://')) {
        product_pattern = product_pattern.replace('https://', '');
    } else {

    }
    var patternPath = './datasets/' + storeType + "/" + product_pattern;
    var pattern = JSON.parse(require('fs').readFileSync(patternPath, 'utf8'));
    pattern.url = url.replace(".json", "");
    return pattern;
}

/**
 * ReplaceAll by Fagner Brack (MIT Licensed)
 * Replaces all occurrences of a substring in a string
 */
String.prototype.replaceAll = function(token, newToken, ignoreCase) {
    var _token;
    var str = this + "";
    var i = -1;

    if (typeof token === "string") {

        if (ignoreCase) {

            _token = token.toLowerCase();

            while ((
                    i = str.toLowerCase().indexOf(
                        _token, i >= 0 ? i + newToken.length : 0
                    )) !== -1) {
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

module.exports.calculate_distance = function(origin, target, callback) {
    var distance = require('google-distance');
    distance.get({
            origin: origin,
            destination: target
        },
        function(err, data) {
            if (err) return console.log(err);
            callback(data);
        });
}

module.exports.searchAddress = function(origin, callback) {
    var NodeGeocoder = require('node-geocoder');
    var options = {
        provider: config.bots.map_provider,
        // Optionnal depending of the providers 
        httpAdapter: 'https', // Default 
        apiKey: config.bots.map_key,
        countryCode: 'vn',
        minConfidence: 0.5,
        limit: 5,
        formatter: null // 'gpx', 'string', ... 
    };

    var geocoder = NodeGeocoder(options);
    geocoder.geocode(origin, function(err, res) {
        callback(res);
    });
}

function chunkString(s, len) {
    var curr = len,
        prev = 0;

    var output = [];

    while (s[curr]) {
        if (s[curr++] == ' ') {
            output.push(s.substring(prev, curr));
            prev = curr;
            curr += len;
        } else {
            var currReverse = curr;
            do {
                if (s.substring(currReverse - 1, currReverse) == ' ') {
                    output.push(s.substring(prev, currReverse));
                    prev = currReverse;
                    curr = currReverse + len;
                    break;
                }
                currReverse--;
            } while (currReverse > prev)
        }
    }
    output.push(s.substr(prev));
    return output;
}

module.exports.saveToFile = function(path, content) {
    //require('fs').appendFile("./temp/" + url.replaceAll("http://", "").replaceAll("/", "#") + ".html",
    require('fs').appendFile(path,
        content + "\n",
        function(err) {
            if (err) {
                return console.log(err);
            }
        });
}

module.exports.saveToHTMLFile = function(url, content) {
    require('fs').writeFile("./temp/" + url.replaceAll("http://", "").replaceAll("/", "#") + ".html",
        content,
        function(err) {
            if (err) {
                return console.log(err);
            }
        });
}

module.exports.splitResponse = function(str) {
    if (str.length <= 320) {
        return [str];
    }

    var result = chunkString(str, 300);

    return result;

}

module.exports.isDefined = function(obj) {
    if (typeof obj == 'undefined') {
        return false;
    }

    if (!obj) {
        return false;
    }

    return obj != null;
}

module.exports.insertRootLink = function(current_link, home_page) {
    if (current_link != null && !current_link.startsWith('http')) {
        current_link = home_page + current_link;
    }
    return current_link;
}

module.exports.insertHttpPrefix = function(current_link) {
    if (current_link != null && !current_link.startsWith('http')) {
        current_link = "http://" + current_link;
    }
    return current_link;
}

var Latinise = {};
Latinise.latin_map = {
    "Á": "A",
    "Ă": "A",
    "Ắ": "A",
    "Ặ": "A",
    "Ằ": "A",
    "Ẳ": "A",
    "Ẵ": "A",
    "Ǎ": "A",
    "Â": "A",
    "Ấ": "A",
    "Ậ": "A",
    "Ầ": "A",
    "Ẩ": "A",
    "Ẫ": "A",
    "Ä": "A",
    "Ǟ": "A",
    "Ȧ": "A",
    "Ǡ": "A",
    "Ạ": "A",
    "Ȁ": "A",
    "À": "A",
    "Ả": "A",
    "Ȃ": "A",
    "Ā": "A",
    "Ą": "A",
    "Å": "A",
    "Ǻ": "A",
    "Ḁ": "A",
    "Ⱥ": "A",
    "Ã": "A",
    "Ꜳ": "AA",
    "Æ": "AE",
    "Ǽ": "AE",
    "Ǣ": "AE",
    "Ꜵ": "AO",
    "Ꜷ": "AU",
    "Ꜹ": "AV",
    "Ꜻ": "AV",
    "Ꜽ": "AY",
    "Ḃ": "B",
    "Ḅ": "B",
    "Ɓ": "B",
    "Ḇ": "B",
    "Ƀ": "B",
    "Ƃ": "B",
    "Ć": "C",
    "Č": "C",
    "Ç": "C",
    "Ḉ": "C",
    "Ĉ": "C",
    "Ċ": "C",
    "Ƈ": "C",
    "Ȼ": "C",
    "Ď": "D",
    "Ḑ": "D",
    "Ḓ": "D",
    "Ḋ": "D",
    "Ḍ": "D",
    "Ɗ": "D",
    "Ḏ": "D",
    "ǲ": "D",
    "ǅ": "D",
    "Đ": "D",
    "Ƌ": "D",
    "Ǳ": "DZ",
    "Ǆ": "DZ",
    "É": "E",
    "Ĕ": "E",
    "Ě": "E",
    "Ȩ": "E",
    "Ḝ": "E",
    "Ê": "E",
    "Ế": "E",
    "Ệ": "E",
    "Ề": "E",
    "Ể": "E",
    "Ễ": "E",
    "Ḙ": "E",
    "Ë": "E",
    "Ė": "E",
    "Ẹ": "E",
    "Ȅ": "E",
    "È": "E",
    "Ẻ": "E",
    "Ȇ": "E",
    "Ē": "E",
    "Ḗ": "E",
    "Ḕ": "E",
    "Ę": "E",
    "Ɇ": "E",
    "Ẽ": "E",
    "Ḛ": "E",
    "Ꝫ": "ET",
    "Ḟ": "F",
    "Ƒ": "F",
    "Ǵ": "G",
    "Ğ": "G",
    "Ǧ": "G",
    "Ģ": "G",
    "Ĝ": "G",
    "Ġ": "G",
    "Ɠ": "G",
    "Ḡ": "G",
    "Ǥ": "G",
    "Ḫ": "H",
    "Ȟ": "H",
    "Ḩ": "H",
    "Ĥ": "H",
    "Ⱨ": "H",
    "Ḧ": "H",
    "Ḣ": "H",
    "Ḥ": "H",
    "Ħ": "H",
    "Í": "I",
    "Ĭ": "I",
    "Ǐ": "I",
    "Î": "I",
    "Ï": "I",
    "Ḯ": "I",
    "İ": "I",
    "Ị": "I",
    "Ȉ": "I",
    "Ì": "I",
    "Ỉ": "I",
    "Ȋ": "I",
    "Ī": "I",
    "Į": "I",
    "Ɨ": "I",
    "Ĩ": "I",
    "Ḭ": "I",
    "Ꝺ": "D",
    "Ꝼ": "F",
    "Ᵹ": "G",
    "Ꞃ": "R",
    "Ꞅ": "S",
    "Ꞇ": "T",
    "Ꝭ": "IS",
    "Ĵ": "J",
    "Ɉ": "J",
    "Ḱ": "K",
    "Ǩ": "K",
    "Ķ": "K",
    "Ⱪ": "K",
    "Ꝃ": "K",
    "Ḳ": "K",
    "Ƙ": "K",
    "Ḵ": "K",
    "Ꝁ": "K",
    "Ꝅ": "K",
    "Ĺ": "L",
    "Ƚ": "L",
    "Ľ": "L",
    "Ļ": "L",
    "Ḽ": "L",
    "Ḷ": "L",
    "Ḹ": "L",
    "Ⱡ": "L",
    "Ꝉ": "L",
    "Ḻ": "L",
    "Ŀ": "L",
    "Ɫ": "L",
    "ǈ": "L",
    "Ł": "L",
    "Ǉ": "LJ",
    "Ḿ": "M",
    "Ṁ": "M",
    "Ṃ": "M",
    "Ɱ": "M",
    "Ń": "N",
    "Ň": "N",
    "Ņ": "N",
    "Ṋ": "N",
    "Ṅ": "N",
    "Ṇ": "N",
    "Ǹ": "N",
    "Ɲ": "N",
    "Ṉ": "N",
    "Ƞ": "N",
    "ǋ": "N",
    "Ñ": "N",
    "Ǌ": "NJ",
    "Ó": "O",
    "Ŏ": "O",
    "Ǒ": "O",
    "Ô": "O",
    "Ố": "O",
    "Ộ": "O",
    "Ồ": "O",
    "Ổ": "O",
    "Ỗ": "O",
    "Ö": "O",
    "Ȫ": "O",
    "Ȯ": "O",
    "Ȱ": "O",
    "Ọ": "O",
    "Ő": "O",
    "Ȍ": "O",
    "Ò": "O",
    "Ỏ": "O",
    "Ơ": "O",
    "Ớ": "O",
    "Ợ": "O",
    "Ờ": "O",
    "Ở": "O",
    "Ỡ": "O",
    "Ȏ": "O",
    "Ꝋ": "O",
    "Ꝍ": "O",
    "Ō": "O",
    "Ṓ": "O",
    "Ṑ": "O",
    "Ɵ": "O",
    "Ǫ": "O",
    "Ǭ": "O",
    "Ø": "O",
    "Ǿ": "O",
    "Õ": "O",
    "Ṍ": "O",
    "Ṏ": "O",
    "Ȭ": "O",
    "Ƣ": "OI",
    "Ꝏ": "OO",
    "Ɛ": "E",
    "Ɔ": "O",
    "Ȣ": "OU",
    "Ṕ": "P",
    "Ṗ": "P",
    "Ꝓ": "P",
    "Ƥ": "P",
    "Ꝕ": "P",
    "Ᵽ": "P",
    "Ꝑ": "P",
    "Ꝙ": "Q",
    "Ꝗ": "Q",
    "Ŕ": "R",
    "Ř": "R",
    "Ŗ": "R",
    "Ṙ": "R",
    "Ṛ": "R",
    "Ṝ": "R",
    "Ȑ": "R",
    "Ȓ": "R",
    "Ṟ": "R",
    "Ɍ": "R",
    "Ɽ": "R",
    "Ꜿ": "C",
    "Ǝ": "E",
    "Ś": "S",
    "Ṥ": "S",
    "Š": "S",
    "Ṧ": "S",
    "Ş": "S",
    "Ŝ": "S",
    "Ș": "S",
    "Ṡ": "S",
    "Ṣ": "S",
    "Ṩ": "S",
    "Ť": "T",
    "Ţ": "T",
    "Ṱ": "T",
    "Ț": "T",
    "Ⱦ": "T",
    "Ṫ": "T",
    "Ṭ": "T",
    "Ƭ": "T",
    "Ṯ": "T",
    "Ʈ": "T",
    "Ŧ": "T",
    "Ɐ": "A",
    "Ꞁ": "L",
    "Ɯ": "M",
    "Ʌ": "V",
    "Ꜩ": "TZ",
    "Ú": "U",
    "Ŭ": "U",
    "Ǔ": "U",
    "Û": "U",
    "Ṷ": "U",
    "Ü": "U",
    "Ǘ": "U",
    "Ǚ": "U",
    "Ǜ": "U",
    "Ǖ": "U",
    "Ṳ": "U",
    "Ụ": "U",
    "Ű": "U",
    "Ȕ": "U",
    "Ù": "U",
    "Ủ": "U",
    "Ư": "U",
    "Ứ": "U",
    "Ự": "U",
    "Ừ": "U",
    "Ử": "U",
    "Ữ": "U",
    "Ȗ": "U",
    "Ū": "U",
    "Ṻ": "U",
    "Ų": "U",
    "Ů": "U",
    "Ũ": "U",
    "Ṹ": "U",
    "Ṵ": "U",
    "Ꝟ": "V",
    "Ṿ": "V",
    "Ʋ": "V",
    "Ṽ": "V",
    "Ꝡ": "VY",
    "Ẃ": "W",
    "Ŵ": "W",
    "Ẅ": "W",
    "Ẇ": "W",
    "Ẉ": "W",
    "Ẁ": "W",
    "Ⱳ": "W",
    "Ẍ": "X",
    "Ẋ": "X",
    "Ý": "Y",
    "Ŷ": "Y",
    "Ÿ": "Y",
    "Ẏ": "Y",
    "Ỵ": "Y",
    "Ỳ": "Y",
    "Ƴ": "Y",
    "Ỷ": "Y",
    "Ỿ": "Y",
    "Ȳ": "Y",
    "Ɏ": "Y",
    "Ỹ": "Y",
    "Ź": "Z",
    "Ž": "Z",
    "Ẑ": "Z",
    "Ⱬ": "Z",
    "Ż": "Z",
    "Ẓ": "Z",
    "Ȥ": "Z",
    "Ẕ": "Z",
    "Ƶ": "Z",
    "Ĳ": "IJ",
    "Œ": "OE",
    "ᴀ": "A",
    "ᴁ": "AE",
    "ʙ": "B",
    "ᴃ": "B",
    "ᴄ": "C",
    "ᴅ": "D",
    "ᴇ": "E",
    "ꜰ": "F",
    "ɢ": "G",
    "ʛ": "G",
    "ʜ": "H",
    "ɪ": "I",
    "ʁ": "R",
    "ᴊ": "J",
    "ᴋ": "K",
    "ʟ": "L",
    "ᴌ": "L",
    "ᴍ": "M",
    "ɴ": "N",
    "ᴏ": "O",
    "ɶ": "OE",
    "ᴐ": "O",
    "ᴕ": "OU",
    "ᴘ": "P",
    "ʀ": "R",
    "ᴎ": "N",
    "ᴙ": "R",
    "ꜱ": "S",
    "ᴛ": "T",
    "ⱻ": "E",
    "ᴚ": "R",
    "ᴜ": "U",
    "ᴠ": "V",
    "ᴡ": "W",
    "ʏ": "Y",
    "ᴢ": "Z",
    "á": "a",
    "ă": "a",
    "ắ": "a",
    "ặ": "a",
    "ằ": "a",
    "ẳ": "a",
    "ẵ": "a",
    "ǎ": "a",
    "â": "a",
    "ấ": "a",
    "ậ": "a",
    "ầ": "a",
    "ẩ": "a",
    "ẫ": "a",
    "ä": "a",
    "ǟ": "a",
    "ȧ": "a",
    "ǡ": "a",
    "ạ": "a",
    "ȁ": "a",
    "à": "a",
    "ả": "a",
    "ȃ": "a",
    "ā": "a",
    "ą": "a",
    "ᶏ": "a",
    "ẚ": "a",
    "å": "a",
    "ǻ": "a",
    "ḁ": "a",
    "ⱥ": "a",
    "ã": "a",
    "ꜳ": "aa",
    "æ": "ae",
    "ǽ": "ae",
    "ǣ": "ae",
    "ꜵ": "ao",
    "ꜷ": "au",
    "ꜹ": "av",
    "ꜻ": "av",
    "ꜽ": "ay",
    "ḃ": "b",
    "ḅ": "b",
    "ɓ": "b",
    "ḇ": "b",
    "ᵬ": "b",
    "ᶀ": "b",
    "ƀ": "b",
    "ƃ": "b",
    "ɵ": "o",
    "ć": "c",
    "č": "c",
    "ç": "c",
    "ḉ": "c",
    "ĉ": "c",
    "ɕ": "c",
    "ċ": "c",
    "ƈ": "c",
    "ȼ": "c",
    "ď": "d",
    "ḑ": "d",
    "ḓ": "d",
    "ȡ": "d",
    "ḋ": "d",
    "ḍ": "d",
    "ɗ": "d",
    "ᶑ": "d",
    "ḏ": "d",
    "ᵭ": "d",
    "ᶁ": "d",
    "đ": "d",
    "ɖ": "d",
    "ƌ": "d",
    "ı": "i",
    "ȷ": "j",
    "ɟ": "j",
    "ʄ": "j",
    "ǳ": "dz",
    "ǆ": "dz",
    "é": "e",
    "ĕ": "e",
    "ě": "e",
    "ȩ": "e",
    "ḝ": "e",
    "ê": "e",
    "ế": "e",
    "ệ": "e",
    "ề": "e",
    "ể": "e",
    "ễ": "e",
    "ḙ": "e",
    "ë": "e",
    "ė": "e",
    "ẹ": "e",
    "ȅ": "e",
    "è": "e",
    "ẻ": "e",
    "ȇ": "e",
    "ē": "e",
    "ḗ": "e",
    "ḕ": "e",
    "ⱸ": "e",
    "ę": "e",
    "ᶒ": "e",
    "ɇ": "e",
    "ẽ": "e",
    "ḛ": "e",
    "ꝫ": "et",
    "ḟ": "f",
    "ƒ": "f",
    "ᵮ": "f",
    "ᶂ": "f",
    "ǵ": "g",
    "ğ": "g",
    "ǧ": "g",
    "ģ": "g",
    "ĝ": "g",
    "ġ": "g",
    "ɠ": "g",
    "ḡ": "g",
    "ᶃ": "g",
    "ǥ": "g",
    "ḫ": "h",
    "ȟ": "h",
    "ḩ": "h",
    "ĥ": "h",
    "ⱨ": "h",
    "ḧ": "h",
    "ḣ": "h",
    "ḥ": "h",
    "ɦ": "h",
    "ẖ": "h",
    "ħ": "h",
    "ƕ": "hv",
    "í": "i",
    "ĭ": "i",
    "ǐ": "i",
    "î": "i",
    "ï": "i",
    "ḯ": "i",
    "ị": "i",
    "ȉ": "i",
    "ì": "i",
    "ỉ": "i",
    "ȋ": "i",
    "ī": "i",
    "į": "i",
    "ᶖ": "i",
    "ɨ": "i",
    "ĩ": "i",
    "ḭ": "i",
    "ꝺ": "d",
    "ꝼ": "f",
    "ᵹ": "g",
    "ꞃ": "r",
    "ꞅ": "s",
    "ꞇ": "t",
    "ꝭ": "is",
    "ǰ": "j",
    "ĵ": "j",
    "ʝ": "j",
    "ɉ": "j",
    "ḱ": "k",
    "ǩ": "k",
    "ķ": "k",
    "ⱪ": "k",
    "ꝃ": "k",
    "ḳ": "k",
    "ƙ": "k",
    "ḵ": "k",
    "ᶄ": "k",
    "ꝁ": "k",
    "ꝅ": "k",
    "ĺ": "l",
    "ƚ": "l",
    "ɬ": "l",
    "ľ": "l",
    "ļ": "l",
    "ḽ": "l",
    "ȴ": "l",
    "ḷ": "l",
    "ḹ": "l",
    "ⱡ": "l",
    "ꝉ": "l",
    "ḻ": "l",
    "ŀ": "l",
    "ɫ": "l",
    "ᶅ": "l",
    "ɭ": "l",
    "ł": "l",
    "ǉ": "lj",
    "ſ": "s",
    "ẜ": "s",
    "ẛ": "s",
    "ẝ": "s",
    "ḿ": "m",
    "ṁ": "m",
    "ṃ": "m",
    "ɱ": "m",
    "ᵯ": "m",
    "ᶆ": "m",
    "ń": "n",
    "ň": "n",
    "ņ": "n",
    "ṋ": "n",
    "ȵ": "n",
    "ṅ": "n",
    "ṇ": "n",
    "ǹ": "n",
    "ɲ": "n",
    "ṉ": "n",
    "ƞ": "n",
    "ᵰ": "n",
    "ᶇ": "n",
    "ɳ": "n",
    "ñ": "n",
    "ǌ": "nj",
    "ó": "o",
    "ŏ": "o",
    "ǒ": "o",
    "ô": "o",
    "ố": "o",
    "ộ": "o",
    "ồ": "o",
    "ổ": "o",
    "ỗ": "o",
    "ö": "o",
    "ȫ": "o",
    "ȯ": "o",
    "ȱ": "o",
    "ọ": "o",
    "ő": "o",
    "ȍ": "o",
    "ò": "o",
    "ỏ": "o",
    "ơ": "o",
    "ớ": "o",
    "ợ": "o",
    "ờ": "o",
    "ở": "o",
    "ỡ": "o",
    "ȏ": "o",
    "ꝋ": "o",
    "ꝍ": "o",
    "ⱺ": "o",
    "ō": "o",
    "ṓ": "o",
    "ṑ": "o",
    "ǫ": "o",
    "ǭ": "o",
    "ø": "o",
    "ǿ": "o",
    "õ": "o",
    "ṍ": "o",
    "ṏ": "o",
    "ȭ": "o",
    "ƣ": "oi",
    "ꝏ": "oo",
    "ɛ": "e",
    "ᶓ": "e",
    "ɔ": "o",
    "ᶗ": "o",
    "ȣ": "ou",
    "ṕ": "p",
    "ṗ": "p",
    "ꝓ": "p",
    "ƥ": "p",
    "ᵱ": "p",
    "ᶈ": "p",
    "ꝕ": "p",
    "ᵽ": "p",
    "ꝑ": "p",
    "ꝙ": "q",
    "ʠ": "q",
    "ɋ": "q",
    "ꝗ": "q",
    "ŕ": "r",
    "ř": "r",
    "ŗ": "r",
    "ṙ": "r",
    "ṛ": "r",
    "ṝ": "r",
    "ȑ": "r",
    "ɾ": "r",
    "ᵳ": "r",
    "ȓ": "r",
    "ṟ": "r",
    "ɼ": "r",
    "ᵲ": "r",
    "ᶉ": "r",
    "ɍ": "r",
    "ɽ": "r",
    "ↄ": "c",
    "ꜿ": "c",
    "ɘ": "e",
    "ɿ": "r",
    "ś": "s",
    "ṥ": "s",
    "š": "s",
    "ṧ": "s",
    "ş": "s",
    "ŝ": "s",
    "ș": "s",
    "ṡ": "s",
    "ṣ": "s",
    "ṩ": "s",
    "ʂ": "s",
    "ᵴ": "s",
    "ᶊ": "s",
    "ȿ": "s",
    "ɡ": "g",
    "ᴑ": "o",
    "ᴓ": "o",
    "ᴝ": "u",
    "ť": "t",
    "ţ": "t",
    "ṱ": "t",
    "ț": "t",
    "ȶ": "t",
    "ẗ": "t",
    "ⱦ": "t",
    "ṫ": "t",
    "ṭ": "t",
    "ƭ": "t",
    "ṯ": "t",
    "ᵵ": "t",
    "ƫ": "t",
    "ʈ": "t",
    "ŧ": "t",
    "ᵺ": "th",
    "ɐ": "a",
    "ᴂ": "ae",
    "ǝ": "e",
    "ᵷ": "g",
    "ɥ": "h",
    "ʮ": "h",
    "ʯ": "h",
    "ᴉ": "i",
    "ʞ": "k",
    "ꞁ": "l",
    "ɯ": "m",
    "ɰ": "m",
    "ᴔ": "oe",
    "ɹ": "r",
    "ɻ": "r",
    "ɺ": "r",
    "ⱹ": "r",
    "ʇ": "t",
    "ʌ": "v",
    "ʍ": "w",
    "ʎ": "y",
    "ꜩ": "tz",
    "ú": "u",
    "ŭ": "u",
    "ǔ": "u",
    "û": "u",
    "ṷ": "u",
    "ü": "u",
    "ǘ": "u",
    "ǚ": "u",
    "ǜ": "u",
    "ǖ": "u",
    "ṳ": "u",
    "ụ": "u",
    "ű": "u",
    "ȕ": "u",
    "ù": "u",
    "ủ": "u",
    "ư": "u",
    "ứ": "u",
    "ự": "u",
    "ừ": "u",
    "ử": "u",
    "ữ": "u",
    "ȗ": "u",
    "ū": "u",
    "ṻ": "u",
    "ų": "u",
    "ᶙ": "u",
    "ů": "u",
    "ũ": "u",
    "ṹ": "u",
    "ṵ": "u",
    "ᵫ": "ue",
    "ꝸ": "um",
    "ⱴ": "v",
    "ꝟ": "v",
    "ṿ": "v",
    "ʋ": "v",
    "ᶌ": "v",
    "ⱱ": "v",
    "ṽ": "v",
    "ꝡ": "vy",
    "ẃ": "w",
    "ŵ": "w",
    "ẅ": "w",
    "ẇ": "w",
    "ẉ": "w",
    "ẁ": "w",
    "ⱳ": "w",
    "ẘ": "w",
    "ẍ": "x",
    "ẋ": "x",
    "ᶍ": "x",
    "ý": "y",
    "ŷ": "y",
    "ÿ": "y",
    "ẏ": "y",
    "ỵ": "y",
    "ỳ": "y",
    "ƴ": "y",
    "ỷ": "y",
    "ỿ": "y",
    "ȳ": "y",
    "ẙ": "y",
    "ɏ": "y",
    "ỹ": "y",
    "ź": "z",
    "ž": "z",
    "ẑ": "z",
    "ʑ": "z",
    "ⱬ": "z",
    "ż": "z",
    "ẓ": "z",
    "ȥ": "z",
    "ẕ": "z",
    "ᵶ": "z",
    "ᶎ": "z",
    "ʐ": "z",
    "ƶ": "z",
    "ɀ": "z",
    "ﬀ": "ff",
    "ﬃ": "ffi",
    "ﬄ": "ffl",
    "ﬁ": "fi",
    "ﬂ": "fl",
    "ĳ": "ij",
    "œ": "oe",
    "ﬆ": "st",
    "ₐ": "a",
    "ₑ": "e",
    "ᵢ": "i",
    "ⱼ": "j",
    "ₒ": "o",
    "ᵣ": "r",
    "ᵤ": "u",
    "ᵥ": "v",
    "ₓ": "x"
};
String.prototype.latinise = function() {
    return this.replace(/[^A-Za-z0-9\[\] ]/g, function(a) {
        return Latinise.latin_map[a] || a
    })
};

String.prototype.latinize = String.prototype.latinise;
String.prototype.isLatin = function() {
    return this == this.latinise()
}
