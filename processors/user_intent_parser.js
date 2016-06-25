function UserIntentParser(){
    var question_indicator = ["khong", "ko", "?", "the nao", "tnao"];
    var product_gender = ["nam", "nu", "combo", "doi"];

    var keyword_check_price = ["bao nhieu", "bn", "bao nhieu"];
    var keyword_check_size = ["size", "sz", "saiz"];
    var keyword_check_size = ["mau", "color"];

    var keyword_check_availability = ["bao nhieu", "bn", "bao nhieu"];
    var keyword_check_ship = ["bao nhieu", "bn", "bao nhieu"];
    var keyword_ask_pitch = ["do size", "gia ship"];
    var keyword_ask_material = ["do size", "gia ship", "dia chi"];
    var keyword_ask_discount = ["sale off", "sale-off", "giam gia", "khuyen mai", "chiet khau"];

    this.isQuestion = function (userMsg) {
        var result = false;
        for (var i = 0; i < question_indicator.length; i++) {
            var index = userMsg.indexOf(question_indicator[i]);
            if (index >= 0) {
                result = true;
                break;
            }
        }
        return result;
    }

}

var method = UserIntentParser.prototype;

method.parse = function(userMsg){
    if(this.isQuestion(userMsg)){

    }else{

    }
}

module.exports = UserIntentParser;