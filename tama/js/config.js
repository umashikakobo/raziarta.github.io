// ゲームパラメータと定数
var TAN_35 = 0.70020753821;
var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth < 900 && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window));

var params = {
            maxSpeed: 240.0, accel: 4.025, jerk: 0.075, friction: 0.0, gravity: 6.200,
            wallH: 5.791, wallT: 38.84, restitution: 0.4875, size: 263.25,
            ballRadius: 12.3201
        };
var initialParams = JSON.parse(JSON.stringify(params));

var ESC_DEFAULT_START_SPEED = initialParams.maxSpeed;
var ESC_DEFAULT_MAX_SPEED = 1000;

var origParams = {
            camFov: 50,
            maxSpeed: 200, accel: 2.25, jerk: 0.35, gravity: 3.3, ballRadius: 14.50,
            size: 298.25, wallH: 4.2, wallT: 31, slopeAngle: 0, restitution: 0.4875
        };

var teamColors = { A: 0xE6B422, B: 0xff0a57, C: 0x6767FC, D: 0xffc0cb, E: 0xF58220, F: 0xAD5F81 };
var teamNames = ['A', 'B', 'C', 'D', 'E', 'F'];

var defaultNames = [
            "くろねこ", "しろくま", "ふくろう", "きんぎょ", "まんぼう", "かるがも", "うみがめ", "きつねび", "たぬきや", "うぐいす",
            "ひまわり", "たんぽぽ", "あさがお", "どんぐり", "あじさい", "すずらん", "はなびら", "いなずま", "そよかぜ", "あおぞら",
            "ほしぞら", "ゆうやけ", "あさやけ", "みずたま", "みかづき", "まぼろし", "あまおと", "わたあめ", "だいふく", "まっちゃ",
            "たいやき", "おにぎり", "からあげ", "たこやき", "かまぼこ", "えだまめ", "せんべい", "かすてら", "はちみつ", "おりがみ",
            "えんぴつ", "ほうせき", "びーだま", "はぐるま", "けんだま", "すごろく", "おもちゃ", "ふうせん", "ふでばこ", "やじるし"
        ];

// ---- パケット定数 ----
var PKT = {
            SYNC: 0, CLIENT_UPDATE: 1, LOG: 2, APPLY_SETTINGS: 3, STOP_MATCH: 4,
            AI_ADDED: 5, AI_REMOVED: 6, RESET: 7, ELIMINATED: 8, NAME_CHANGE: 9,
            REQ_RESTART: 10, REQ_RESET: 11, REQ_ADD_AI: 12, REQ_REM_AI: 13,
            STAT_CHANGE: 14, PARAM_UPDATE: 15,
            SHOCKWAVE: 16
        };
var SYNC_INTERVAL = 16;
var round2 = function(n){ return Math.round(n * 100) / 100; };
