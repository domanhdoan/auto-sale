var Enum = require('enum')
var config = require('../config/config.js')
var logger = require('./logger.js')

module.exports = {
    say_greetings: 'Xin kính chào quý khách',
    say_waiting_message: 'Hệ thống đang tìm kiếm ...',
    pls_select_product: 'Bạn nhập mã sản phẩm hoặc upload ảnh SP để tìm sản phẩm theo mong muốn',
    pls_select_product_color: 'Xin vui lòng chọn màu sản phẩm',
    pls_select_product_color_combo: '(VD chọn màu cho combo: nam màu xanh và nữ màu đỏ)',
    pls_select_product_size: 'Xin vui lòng chọn size',
    pls_select_product_size_combo: '(VD chọn size cho combo: nam 42 nữ 38)',
    pls_enter_quantity: 'Xin vui lòng chọn số lượng',
    pls_enter_name: 'Xin vui lòng nhập tên người nhận',
    pls_enter_address: 'Xin vui lòng nhập địa chỉ người nhận',
    pls_enter_phone: 'Xin vui lòng nhập số điện thoại',
    pls_enter_email: 'Xin vui lòng nhập email người nhận',
    pls_enter_delivery_date: 'Xin vui lòng nhập ngày nhận hàng',
    say_thank_buying: 'Cảm ơn bạn đã đặt hàng.\nNV sẽ gọi điện xác nhận ngày giao hàng trong thời gian sớm nhất',
    start_order_process: 'Bắt đầu quá trình đặt hàng',

    find_categories: 'find_categories',
    find_product: 'find_product',
    find_details: 'find_details', // ask about size, color and in-stock status
    select_product: 'select_product',
    select_type: 'select_type',
    select_product_color: 'select_product_color',
    select_product_size: 'select_product_size',
    set_quantity: 'set_quantity',
    set_recipient_name: 'set_recipient_name',
    set_address: 'set_address',
    set_phone: 'set_phone',
    set_email: 'set_email',
    set_delivery_date: 'set_delivery_date',

    notify_product_found: 'Bạn xem thông tin SP bên dưới nhé',
    notify_product_search: 'Bạn nhấn "Chi tiết sản phẩm" để xem hình ảnh, màu sắc và size của sản phẩm nhé',
    notify_product_search2: '(Bạn trượt sang ngang để xem những sản phẩm khác nhé)',
    notify_color_notfound: 'Không còn màu trong cửa hàng',
    notify_size_notfound: 'Không còn size trong cửa hàng',
    notify_product_notfound: 'Shop không thấy sản phẩm như mong muốn của bạn :(',
    notify_product_similar: 'Bạn xem sản phẩm tương tự bên dưới nhé :)',

    action_view_category: 'view_cat',
    action_terminate_order: 'huy',
    action_continue_search: 'search',
    action_view_details: 'view',
    action_order: 'order',
    action_select: 'select',
    action_purchase: 'purchase',
    action_confirm_order: 'ok',
    action_cancel_order: 'cancel',
    action_confirm_addr: 'confirm_addr',
    action_confirm_type: 'confirm_type',
    action_retype_addr: 'retype_addr',

    status_updating: 'Đang cập nhật',
    product_search_max: 10,

    INTENT_CHECK_PRICE: 'check_price',
    INTENT_CHECK_AVAILABILITY: 'check_availability',
    INTENT_CHECK_SHIP: 'check_ship',
    INTENT_ORDER_PRODUCT: 'order_product',
    INTENT_GENERAL_SEARCH: 'general_search',
    INTENT_UNKNOWN: 'unknow_intent',
    INTENT_ACCURACY_ABSOLUTE: 1.0,
    INTENT_ACCURACY_0_98: 0.98,
    INTENT_ACCURACY: 0.9,
    INTENT_ACCURACY_LOW: 0.55,
    PRODUCT_TYPE_MALE: 'nam',
    PRODUCT_TYPE_FEMALE: 'nu',
    PRODUCT_TYPE_COMBO: 'combo',
    PRODUCT_TYPE_UNKNOW: 'unknow',
    SEARCH_KEY_COLOR: 'mau',
    SEARCH_KEY_SIZE: 'size',
    SHIP_LOCATION: 'province',
    SHIP_FEE: 'price',
    SHIP_DURATION: 'duration',
    SHIP_RANGE: 'range',
    SHIP_FREE_SHIP: 'free_ship',
    SHIP_COD: 'COD'
}

module.exports.typical_question = {

}

module.exports.sale_steps = new Enum([
    'say_greetings',
    'find_product',
    // Select product with details
    'select_product',
    'select_type',
    'select_product_color',
    'select_product_size',
    'set_quantity',
    'select_next_product',
    // Order product
    'set_recipient_name',
    'set_address',
    'set_phone',
    'set_email',
    'set_delivery_date'
])

var color_vn = {
    do: 'Đỏ',
    den: 'Đen',
    xam: 'Xám',
    xanhlam: 'Xanh lam',
    hongphan: 'Hồng phấn',
    trang: 'Trắng',
    xanhtimthan: 'Xanh tím than',
    ghi: 'Ghi',
    tim: 'Tím',
    vang: 'Vàng',
    xanhcoban: 'Xanh cô ban',
    nau: 'Nâu',
    dogach: 'Đỏ Gạch',
    xanhdatroi: 'Xanh Da Trời',
    dodun: 'Đỏ Đun',
    xanhneon: 'Xanh Neon'
}

module.exports.get_color_vn = function(value) {
    return color_vn[value]
}

module.exports.getAllcolorVn = function() {
    return color_vn
}

module.exports.loadJson = function(path) {
    try {
        var json_object = JSON.parse(require('fs').readFileSync(path, 'utf8'));
    } catch (err) {
        logger.info(err);
    } finally {

    }
    return json_object
}

module.exports.isUrl = function(text) {
    var is_url_flag = false
    if (text.startsWith('http')) {
        is_url_flag = true
    }
    return is_url_flag
}

module.exports.isThumbUrl = function(text) {
    var is_url_flag = false
    var temp = text.split('?')
    var link = (temp.length == 2) ? temp[0] : text
    if (link.endsWith('png') || link.endsWith('jpg') || link.endsWith('jpeg')) {
        is_url_flag = true
    }
    return is_url_flag
}

module.exports.extractNumeric = function(text) {
    var myRe = new RegExp(/\d{2}/)
    var ret = ''
    var results = text.match(myRe)
    if (results != null && results.length > 0) {
        ret = results[0]
    }
    return ret
}
module.exports.extractProductPrices = function(title) {
    var message = ''
    title = title.latinise().toLowerCase()
    var maleIndex = title.indexOf('nam')
    var femaleIndex = title.indexOf('nu')
    var malePrice = this.extractValue(title, 'nam \\d+').replace('nam ', '')
    var femalePrice = this.extractValue(title, 'nu \\d+').replace('nu ', '')
    var comboPrice = this.extractValue(title.replaceAll('cb', 'combo'), 'combo \\d+').replace('combo ', '')
    var type = this.extractProductType(title)

    if (comboPrice === '' && (malePrice != '' && femalePrice != '')) {
        comboPrice = parseInt(malePrice) + parseInt(femalePrice)
    }

    var prices = {
        nam: malePrice + '000',
        nu: femalePrice + '000',
        combo: comboPrice + '000'
    }
    logger.info(JSON.stringify(prices))
    return prices
}

module.exports.toCurrencyString = function(value, currency) {
    var priceRegExp = /\B(?=(\d{3})+(?!\d))/g
    var string = value.toString().replace(priceRegExp, ',') + currency
    return string
}

module.exports.getProductTypeVN = function(type) {
    var types = {
        nam: 'Nam',
        nu: 'Nữ',
        combo: 'Combo'
    }
    return (types[type] != undefined) ? types[type] : 'không xác định'
}

module.exports.extractValue = function(text, regExpStr) {
    var ret = ''
    var regExp = new RegExp(regExpStr, 'gi')
    var results = text.match(regExp)
    if (results != null && results.length > 0) {
        ret = results[0]
    }
    return ret
}

module.exports.extractValues = function(text, regExpStr) {
    var regExp = new RegExp(regExpStr, 'gi')
    var results = text.match(regExp)
    if (results == null) {
        results = []
    }
    return results
}

module.exports.extractProductCode = function(text, pattern) {
    var upper = text.toUpperCase().replaceAll(/\s/,"");
    var ret = {
        isProductCode: false,
        code: ''
    }
    var myRe = new RegExp(pattern)
    var results = upper.match(myRe)

    if (results != null && results.length > 0) {
        ret.isProductCode = true
        ret.code = results[0];
    }
    return ret
}

module.exports.validateVNPhoneNo = function(text) {
    text = text.replaceAll(/\s|.|-/,"");
    var pattern = "\(\d{1,2}\)[0-9]{8}|\d{1,2}[0-9]{8}|09[0-9]{8}|\*849[0-9]{8}|(\*84)9[0-9]{8}|08[0-9]{8}|\*848[0-9]{8}|(\*84)8[0-9]{8}|01[0-9]{9}|\*841[0-9]{9}|(\*84)1[0-9]{9}";
    var ret = (this.extractValue(text, pattern) === "")?false:true;
    return ret;
}


module.exports.loadStoreScrapingPattern = function(storeType, url) {
    var product_pattern = url
    if (product_pattern.startsWith('http://')) {
        product_pattern = product_pattern.replace('http://', '')
    } else if (product_pattern.startsWith('https://')) {
        product_pattern = product_pattern.replace('https://', '')
    } else {}
    var patternPath = './datasets/' + storeType + '/' + product_pattern
    var pattern = JSON.parse(require('fs').readFileSync(patternPath, 'utf8'))
    pattern.url = url.replace('.json', '')
    return pattern
}

/**
 * ReplaceAll by Fagner Brack (MIT Licensed)
 * Replaces all occurrences of a substring in a string
 */
String.prototype.replaceAll = function(token, newToken, ignoreCase) {
    var _token
    var str = this + ''
    var i = -1

    if (typeof token === 'string') {
        if (ignoreCase) {
            _token = token.toLowerCase()

            while ((
                    i = str.toLowerCase().indexOf(
                        _token, i >= 0 ? i + newToken.length : 0
                    )) !== -1) {
                str = str.substring(0, i) +
                    newToken +
                    str.substring(i + token.length)
            }
        } else {
            return this.split(token).join(newToken)
        }
    }
    return str
}

module.exports.calculateDistance = function(origin, target, callback) {
    var distance = require('google-distance')
    distance.get({
            origin: origin,
            destination: target
        },
        function(err, data) {
            if (err) return console.log(err);
            var distance = parseFloat(data.distance.replace(",", ""));
            callback(distance);
        })
}

var NodeGeocoder = require('node-geocoder')
var options = {
    provider: config.bots.map_provider,
    // Optionnal depending of the providers 
    httpAdapter: 'https', // Default 
    apiKey: config.bots.map_key,
    countryCode: 'vn',
    minConfidence: 0.5,
    limit: 5,
    formatter: null // 'gpx', 'string', ... 
}
var geocoder = NodeGeocoder(options)
module.exports.searchAddress = function(origin, callback) {
    geocoder.geocode(origin, function(err, result) {
        callback(result)
    })
}

function chunkString(s, len) {
    var curr = len,
        prev = 0

    var output = []

    while (s[curr]) {
        if (s[curr++] == ' ') {
            output.push(s.substring(prev, curr))
            prev = curr
            curr += len
        } else {
            var currReverse = curr
            do {
                if (s.substring(currReverse - 1, currReverse) == ' ') {
                    output.push(s.substring(prev, currReverse))
                    prev = currReverse
                    curr = currReverse + len
                    break
                }
                currReverse--
            } while (currReverse > prev)
        }
    }
    output.push(s.substr(prev))
    return output
}

module.exports.saveToFile = function(path, content) {
    // require('fs').appendFile("./temp/" + url.replaceAll("http://", "").replaceAll("/", "#") + ".html",
    require('fs').appendFile(path,
        content + '\n',
        function(err) {
            if (err) {
                return console.log(err)
            }
        })
}

module.exports.saveToHTMLFile = function(url, content) {
    require('fs').writeFile('./temp/' + url.replaceAll('http://', '').replaceAll('/', '#') + '.html',
        content,
        function(err) {
            if (err) {
                return console.log(err)
            }
        })
}

module.exports.splitResponse = function(str) {
    if (str.length <= 320) {
        return [str]
    }

    var result = chunkString(str, 300)

    return result
}

module.exports.isDefined = function(obj) {
    if (typeof obj == 'undefined') {
        return false
    }

    if (!obj) {
        return false
    }

    return obj != null
}

module.exports.getAvailableProductType = function(title) {
    var type = this.extractProductType(title)
    var types = []
    if (type == this.PRODUCT_TYPE_COMBO) {
        types = ['nam', 'nu', 'combo']
    }
    return types
}

module.exports.extractProductType = function(title) {
    title = title.latinise()
    var maleIndex = title.indexOf('nam')
    var femaleIndex = title.indexOf('nu')
    var malePrice = this.extractValue(title, 'nam \\d+')
    var femalePrice = this.extractValue(title, 'nu \\d+')
    var comboPrice = this.extractValue(title.replaceAll('cb', 'combo'), 'combo \\d+')
    var types = ['nam', 'nu', 'combo', 'unknown']
    var type = null

    if ((malePrice != '' && femalePrice != '') || comboPrice != '') {
        type = types[2]
    } else if (malePrice != '' || maleIndex >= 0) {
        type = types[0]
    } else if (femalePrice != '' || femaleIndex >= 0) {
        type = types[1]
    } else {
        type = types[3]
    }
    return type
}

module.exports.insertRootLink = function(current_link, home_page) {
    if (current_link != null && !current_link.startsWith('http')) {
        current_link = home_page + current_link
    }
    return current_link
}

module.exports.insertHttpPrefix = function(current_link) {
    if (current_link != null && !current_link.startsWith('http')) {
        current_link = 'http://' + current_link
    }
    return current_link
}

var signedChar = 'ạóèăâđêôơưàảãạáằẳẵặắầẩẫậấèẻẽẹéềểễệếìỉĩịíòỏõọóồổỗộốờởỡợớùủũụúừửữựứỳỷỹỵýĂÂĐÊÔƠƯÀẢÃẠÁẰẲẴẶẮẦẨẪẬẤÈẺẼẸÉỀỂỄỆẾÌỈĨỊÍÒỎÕỌÓỒỔỖỘỐỜỞỠỢỚÙỦŨỤÚỪỬỮỰỨỲỶỸỴÝ'
var unsignedChar = 'aoeaadeoouaaaaaaaaaaaaaaaeeeeeeeeeeiiiiiooooooooooooooouuuuuuuuuuyyyyyAADEOOUAAAAAAAAAAAAAAAEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOUUUUUUUUUUYYYYYDD'

String.prototype.latinise = function() {
    // return this.replace(/[^A-Za-z0-9\[\] ]/g, function(a) {e
    // Use pattern that in latinse
    return this.replace(/[^A-Za-z0-9\[\] ]/g, function(a) {
        var index = signedChar.indexOf(a)
        var ret = (index >= 0) ? unsignedChar[index] : "";
        // logger.info('char = ' + a + " index = " + index + " to " + ret)
        return ret
    })
}

String.prototype.latinize = String.prototype.latinise
String.prototype.isLatin = function() {
    return this == this.latinise()
}
