var host = 'ws://localhost:8000/game'
var WebSocket = new WebSocket(host);
var worker = new Worker('/static/countdown.js');

var mode = "menu"
var isPlaying = false
var timeLeft
var myEnergy
var gameID
var myName
var myID
var opponentName
var currentPlayers = {}
var messageSound = new buzz.sound("static/sounds/newMessage", {
    formats: [ "ogg", "mp3"],
    preload: true,
    autoplay: false,
    loop: false
});

$(document).ready(function(){    
    worker.onmessage = function(e) {
        data = e.data
        switch(data[0]){
            case ("timeLeft"):
               var thisTime = data[1];
               displayTimeLeft(thisTime) 
               break;
            case ("countEnd"):
                break;
            case("countZero"):
                endCountdown()            
                break;
            default:
                break;
        }
    };
    
    $('.inBattleFormItem').hide();
    
    $('#chatForm').bind("keyup", function(e) {
        var code = e.keyCode || e.which; 
        if (code  == 13) {               
            e.preventDefault();
            submitChat();
            return false;
        }else if (code == 9){
            e.preventDefault();
            return false;
        }
    });

    $('#chatForm').bind("keypress", function(e) {
        var code = e.keyCode || e.which; 
        if (code  == 13) {               
            e.preventDefault();
            return false;
        }  else if (code == 9){
            e.preventDefault();
            properFocus('#energyInput');
            return false;
        }
    });
    
    WebSocket.onopen = function (evt) {
        console.log("Connection open");
    };
    
    WebSocket.onerror = function(evt){
        console.log("WebSockets has encountered an error");
    };
    
    WebSocket.onmessage = function(evt){
        var mes = $.parseJSON(evt.data);
        console.log("Websocket message: "+mes["message"][0])
        switch (mes["message"][0]){
            case "newPlayer":
                playerList = mes["message"][1];
                updatePlayersList(playerList);
                break;
            case "gameID":
                gameID = mes["message"][1];
                opponentName = mes["message"][2];
                myName = mes["message"][3];
                break;
            case "energy":
                if (mode !== "menu"){
                    myEnergy = mes["message"][1]
                    $("#action").html('')
                }else{
                    $("#action").html('')
                }
                break;
            case "R1":
                mode = "inGame"
                info = mes["message"][1];
                round1Outcomes(info);
                break;
            case "R23":
                mode = "inGame"
                info = mes["message"][1]
                round2Outcomes(info);
                break;
            case "newOpenGame":
                showNewOpenGame(mes["message"][1]);
                break;
            case "deleteOpenGame":
                OpenGameDeleted(mes["message"][1]);
                break;
            case "StartingPVP":
                opponentName = mes["message"][2]
                gameID = mes["message"][1]
                myName = mes["message"][3];
                PvpBegin(opponentName)
                break;  
            case "waitingForOpponent":
                mode = "waitingForOpponentPlay";
                info = mes["message"][1]
                declare("Waiting...")
                break;
            case "waitingOnYou":
                mode = "waitingOnYou"
                waitingTime = mes["message"][1]
                startCountdown(waitingTime)
                break;
            case "chatMessage":
                theMessage = mes["message"][1]
                displayChat(theMessage)
                break;
            case "opponentLeft":
                opponentLeft()
                break;
            default:
                break;
        }
        scrollThrough("outcomes");
    };
});

function getCookie(name){
    var c = document.cookie.match("\\b" + name + "=([^;]*)\\b");
    return c ? c[1] : undefinted;
}

function createDeleteGame(){
    if (mode === "menu"){
        mode = "waiting"
        mes = {"message":["createGame"]}
        WebSocket.send(JSON.stringify(mes));
        $("#outcomes").append("<h2>_____________________________</h2>");
        $("#outcomes").append("<h2>Waiting for player to join...</h2>");
        $("#outcomes").append("<h2>_____________________________</h2>");
        scrollThrough("outcomes");
        $("#action").html('<h2>Waiting for challenger...</h2>')
        $("#createGame").html('Close')
    }else if(mode === "waiting"){
        mode = "menu"
        mes = {"message":["deleteGame"]}
        WebSocket.send(JSON.stringify(mes));
        $("#outcomes").append("<h2>Cancelled Game...</h2>");
        scrollThrough("outcomes");
        $("#action").html('')
        $("#createGame").html('Open to Play')
    };
};

function playBot(botName){
    if (mode === "menu"){
        mes = {"message":["startBotGame",botName]}
        WebSocket.send(JSON.stringify(mes));
        properFocus('#energyInput')
    }
};

function scrollThrough(box){
    $('#'+box).stop().animate({
      scrollTop: $('#'+box)[0].scrollHeight
    }, 800);
}

function submitChat(){
    var inputVal = $("#chatInput").val();
    if (inputVal === ""){
        return false;
    }else{
        mes = {"message":["chatMessage",inputVal]}
        WebSocket.send(JSON.stringify(mes));
        $('#chatInput').focus();
        $("#chatInput").val('');
    }
}

function displayChat(message){
    var player = message["from"]
    var safeMessage = safeHTML(message["messageText"])
    messageSound.play();
    $("#chatBox").append("<p class='chatMessage'><b>"+player+":</b>"+safeMessage+"</p>");
    scrollThrough('chatBox')
    
}


function safeHTML(text){
    var myHTML = text.replace(/[<>&\n]/g, function(x) {
        return {'<': '&lt;','>': '&gt;','&': '&amp;','\n': '<br />'}[x];
    });
    return myHTML
}

function submitAction(){
    if(readyForAction){
        var inputVal = $("#energyInput").val();
        if (isNaN(inputVal) || inputVal == "" || inputVal < 0){
            return false;
        }else{
            if(mode === "inGame" || mode === "waitingOnYou"){
                playPvpVal(gameID,inputVal)
                endCountdown()
            }
        }    
        $("#energyInput").val('');
    };
}
   
function playRoundVal(gameID,round,eValue){
    mes = {"message":["botAction",gameID,round,eValue]}
    WebSocket.send(JSON.stringify(mes));
};

function playPvpVal(gameID,inputVal){
    mes = {"message":["gameAction",gameID,inputVal,"Player"]};
    WebSocket.send(JSON.stringify(mes));
};

function updatePlayersList(playerList){
    htmlInsert = "";
    for (i=0;i<playerList.length;i++){
        idVal = playerList[i]['claimed_id'].substring(41)
        functionString = "challengePlayer('"+idVal+"')"
        htmlInsert += "<div value='closed' onClick="+functionString+" id='listPlayerName"+idVal+"' class='listPlayerName'><p>"+playerList[i]['username']+" ("+playerList[i]['rank']+")</p></div>"
    }
    $("#playersList").html(htmlInsert);
};

function round1Outcomes(info){
    bothShoot(info['p1r1'],info['p2r1'],"Round 1",null)
    news = "<h2>--Round 1--</h2><p class='p1history'>"+myName+": <strong>"+info['p1r1']+"</strong></p><p class='p2history'>"+opponentName+": <strong>"+info['p2r1']+"</strong></p><h4>Victor: "+info['Victor']+"</h4>" 
    $("#outcomes").append(news);
    scrollThrough("outcomes")
    if(info['p1r1'] === info['p2r1']){autoTie();}
}

function autoTie(){
    playPvpVal(gameID,0)
    declare("Draw")
    isTie = true
}

function round2Outcomes(info){
    bothShoot(info['p1r2'],info['p2r2'],"Round 2",info['endGame'])
    news2 = "<h2>--Round 2--</h2><p class='p1history'>"+myName+": <strong>"+info['p1r2']+"</strong></p><p class='p2history'>"+opponentName+": <strong>"+info['p2r2']+"</strong></p><h4>Victor: "+info['Victor2']+"</h4>" 
    news3 = "<h2>--Round 3--</h2><p class='p1history'>"+myName+": <strong>"+info['p1r3']+"</strong></p><p class='p2history'>"+opponentName+": <strong>"+info['p2r3']+"</strong></p><h4>Victor: "+info['Victor3']+"</h4>" 
    news4 = "<h1>Winner: "+info['endGame']+"</h1>"
    $("#outcomes").append(news2);
    $("#outcomes").append(news3);    
    $("#outcomes").append(news4);
    scrollThrough("outcomes")
    endBattle();
}

function PvpBegin(name){
    killObject(myAvatar)
    killObject(opponentAvatar)
    player1X = 50
    player2X = 500 - player1X
    myAvatar = getNewHero("You",player1X,200,1,animationDict,$("#myEnergyBarHolder"));
    opponentAvatar = getNewHero(name,player2X,200,-1,animationDict,$("#opponentEnergyBarHolder"))
    myAvatar.opponent = opponentAvatar
    opponentAvatar.opponent = myAvatar
    myEnergy = 100
    resetAll()
    
    
    $('#energyInput').bind("keyup", function(e) {
        var code = e.keyCode || e.which; 
        if (code  == 13) {
            e.preventDefault();
            submitAction();
            return false;
        }else if (code == 9){
            e.preventDefault();
            $('#chatInput').focus();
            return false;
        }
    });

    $('#energyInput').bind("keypress", function(e) {
        var code = e.keyCode || e.which;
        if (code  == 13) {               
            e.preventDefault();
            return false;
        }else if (code == 9){
            e.preventDefault();
            $('#chatInput').focus();
            return false;
        }
    });
    
    $(".inBattleFormItem").show()
    $("#outcomes").append("<h1>Game Start!</h1>");
    scrollThrough("outcomes");
    properFocus('#energyInput');
    
    news1 = "<h3>You are now playing against <strong>"+name+"</strong>.</h3>"
    $("#outcomes").append(news1);
    scrollThrough("outcomes")
    if (mode === "waiting"){
        $("#createGame").html('Open to Play')
        mes = {"message":["deleteGame"]}
        WebSocket.send(JSON.stringify(mes));
    }
    mode = "inGame"
}

function showNewOpenGame(idVal){
    $("#listPlayerName"+idVal).css('background-color',"rgb(200,0,0)");
    $("#listPlayerName"+idVal).attr('value',"open");
}

function OpenGameDeleted(idVal){
    $("#listPlayerName"+idVal).css('background-color',"black");
    $("#listPlayerName"+idVal).attr('value',"closed");
    
}

function challengePlayer(IDval){
    if (mode === "menu" || mode === "waiting"){
        if ($("#listPlayerName"+IDval).attr('value') == "open"){
            var message = {"message":["challengePlayer",IDval]};
            WebSocket.send(JSON.stringify(message));
        }
    }
}

function startCountdown(waitingTime){
    worker.postMessage(["waitingTime",waitingTime]);
}

function endCountdown(){
    worker.postMessage(["endCountdown"])
}

function displayTimeLeft(time){
    if (time <= 10 && time > 0){
        getNewText(time.toString(),250,150,"timeLeft")
    }
}

function opponentLeft(){
    if (mode === "waitingOnYou"){endCountdown();};
    news1 = "<h3>Your opponent has left the game.</h3>"
    news2 = "<h1>You Win!</h1>"
    $("#outcomes").append(news1);
    $("#outcomes").append(news2);
    scrollThrough("outcomes")
    killObject(opponentAvatar)
    declare("Opponent Left!")
    endBattle();
}

function endBattle(){
    endCountdown()
    mode = "menu"
    $(".inBattleFormItem").hide()
}

function muteToggle(){
    buzz.all().toggleMute()
    if ($("#soundButton").attr("value") === "On"){
        $("#soundButton").attr("src","/static/images/soundButtonOff.png");
        $("#soundButton").attr("value","Off");
    }else{
        $("#soundButton").attr("src","/static/images/soundButton.png");
        $("#soundButton").attr("value","On");
    };
};


function properFocus(JID){
    $(JID).focus()
    thisString = $(JID).val();
    $(JID).val('')
    $(JID).val(thisString);
}


    