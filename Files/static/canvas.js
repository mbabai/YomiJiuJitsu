frameRate = 25
var Buffers = []
DrawingBuffer = 1

animationDict = {
"st1":loadImage("static/animation/standing01.png"),
"st2":loadImage("static/animation/standing02.png"),
"st3":loadImage("static/animation/standing03.png"),
"st4":loadImage("static/animation/standing04.png"),
"st5":loadImage("static/animation/standing05.png"),
"ch1":loadImage("static/animation/charging01.png"),
"ch2":loadImage("static/animation/charging02.png"),
"sh1":loadImage("static/animation/shot01.png"),
"sh2":loadImage("static/animation/shot02.png"),
"sh3":loadImage("static/animation/shot03.png"),
"sh4":loadImage("static/animation/shot04.png"),
"sh5":loadImage("static/animation/shot05.png"),
"gh1":loadImage("static/animation/getHit01.png"),
"gh2":loadImage("static/animation/getHit02.png"),
"wk1":loadImage("static/animation/walking01.png"),
"wk2":loadImage("static/animation/walking02.png"),
"wk3":loadImage("static/animation/walking03.png"),
"wk4":loadImage("static/animation/walking04.png"),
"wk5":loadImage("static/animation/walking05.png"),
"wk6":loadImage("static/animation/walking06.png"),
"wk7":loadImage("static/animation/walking07.png"),
"wk8":loadImage("static/animation/walking08.png"),
"wk9":loadImage("static/animation/walking09.png"),
"wk10":loadImage("static/animation/walking10.png"),
"wk11":loadImage("static/animation/walking11.png"),
"wk12":loadImage("static/animation/walking12.png"),
"wk13":loadImage("static/animation/walking13.png"),
"wk14":loadImage("static/animation/walking14.png"),
"wk15":loadImage("static/animation/walking15.png"),
"wk16":loadImage("static/animation/walking16.png"),
"vt1":loadImage("static/animation/victory01.png"),
"vt2":loadImage("static/animation/victory02.png"),
"vt3":loadImage("static/animation/victory03.png"),
"vt4":loadImage("static/animation/victory04.png"),
"sl1":loadImage("static/animation/slide01.png"),
"sl2":loadImage("static/animation/slide02.png"),
"sl3":loadImage("static/animation/slide03.png"),
"sl4":loadImage("static/animation/slide04.png"),
"sl5":loadImage("static/animation/slide05.png"),
"sl6":loadImage("static/animation/slide06.png"),
"sl7":loadImage("static/animation/slide07.png"),
"sw1":loadImage("static/animation/sword01.png"),
"sw2":loadImage("static/animation/sword02.png"),
"sw3":loadImage("static/animation/sword03.png"),
"sw4":loadImage("static/animation/sword04.png"),
"sw5":loadImage("static/animation/sword05.png"),
"sw6":loadImage("static/animation/sword06.png"),
"sw7":loadImage("static/animation/sword07.png"),
"sw8":loadImage("static/animation/sword08.png"),
"sw9":loadImage("static/animation/sword09.png"),
"sw10":loadImage("static/animation/sword10.png"),
"sw11":loadImage("static/animation/sword11.png"),
"sw12":loadImage("static/animation/sword12.png"),
"sw13":loadImage("static/animation/sword13.png"),
"sw14":loadImage("static/animation/sword14.png"),

"dead":loadImage("static/animation/dead01.png"),
"blank":loadImage(null),

}

heartImg = document.createElement('img');
heartImg.src = "static/images/heart.png"
allObjects = []
allHeros = []
allCharges = []
var physics
var declarationText;
var myAvatar
var myEnergy = 100;
var opponentAvatar
var isTie = false
var isVictory = false
var readyForAction = true

function loadImage(link){
    var thisImage = document.createElement('img');
    thisImage.src=link;

    return thisImage;
}

$(document).ready(function(){
    
    $(function(){
        $(".energySlider").slider({
            orientation: "vertical",
            range: "min",
            min: 0,
            max: 100,
            value: 0,
            slide: function( event, ui ) {
                $("#amount").val( ui.value );
                var currentLocation = $(this).find('.ui-slider-handle').css('bottom')
                $("#energyInput").css('bottom',currentLocation);
                $('#energyInput').val(ui.value);
                properFocus('#energyInput');
            },
            create: function(event, ui) {
                var v=$(this).slider('value');
                $(this).find('.ui-slider-handle').append("<input type='number' id='energyInput' value='0'>");
                $('#energyInput').val(v);
                properFocus('#energyInput')
            }
        });    
    });
    
    $(function(){
        $('#energyInput').on('keyup',(function() {
            thisVal = (parseInt($('#energyInput').val()) || "0")
            if (thisVal > myEnergy){thisVal = myEnergy}
            else if(thisVal < 0 || isNaN(thisVal)){thisVal = 0;};
            $('#energyInput').val(thisVal)
            $(".energySlider").slider('value', thisVal);
            }));
    });
    

    $(".energyBarHolder").hover(
        function(){
            energyPixels = $(".caseFull", this).height();
            totalPixels = $(".energyCase", this).height();
            energyVal = Math.round((energyPixels/totalPixels)*100)
            $(".energyInfo", this).html(energyVal);
        },function(){
            $(".energyInfo", this).html('');
        }
    );
    
        
    Buffers[0] = document.getElementById("canvas0");
    Buffers[1] = document.getElementById("canvas1");    
    

    //Main function
    drawAll();
    startPhysics();
});

// shim layer with setTimeout fallback 
window.requestAnimFrame = (function(){ 
  return  window.requestAnimationFrame       ||  
          window.webkitRequestAnimationFrame ||  
          window.mozRequestAnimationFrame    ||  
          window.oRequestAnimationFrame      ||  
          window.msRequestAnimationFrame     ||  
          function( callback ){ 
            window.setTimeout(callback, 1000 / 60); 
          }; 
})();

function drawAll(){
    window.requestAnimFrame(drawAll)
    Buffers[1-DrawingBuffer].style.visibility='visible';
    Buffers[DrawingBuffer].style.visibility='hidden';
    c=Buffers[DrawingBuffer]
    
    ctx = c.getContext('2d');
    
    ctx.clearRect(0,0,c.width,c.height)
    for (var i=0;i<allObjects.length;i++){
        ctx.restore();
        ctx.save()
        allObjects[i].draw();
    };
    DrawingBuffer=1-DrawingBuffer;
}


function startPhysics(){
    physics = window.setInterval(function(){
        checkAllCollisions();
        checkAllHits();
    },1);
};


function checkAllHits(){
    for (i=0;i < allCharges.length;i++){
        for (j=0;j < allHeros.length;j++){
            thisCharge = allCharges[i];
            thisHero = allHeros[j];
            if (thisCharge.orientation != thisHero.orientation){
                distance = Math.abs(thisCharge.X - thisHero.X)
                if (distance < 10 +thisCharge.magnitude && thisCharge.currentState != CHARGE_HIT){
                    thisCharge.hit()
                    thisHero.getHit()
                }
            }
        }
    }
}

function checkAllCollisions(){
    for (i=0;i < allCharges.length;i++){
        for (j=i;j < allCharges.length;j++){
            if (j!=i){allCharges[j].checkCollision(allCharges[i])}
        }
    }
}

function TextObj(text,x,y,state,orientation){
    if(typeof(orientation)==='undefined'){orientation=1};
    this.startTime = new Date().getTime()
    this.textInfo = text
    this.X = x
    this.Y = y
    this.state = state
    this.orientation = orientation
    
    this.draw = function(){
        var timeIn = new Date().getTime() - this.startTime;
        switch (this.state){
            case "fadeOut":
                ctx.textAlign = 'center';
                if (timeIn < 4000){
                    fade = (4000 - timeIn)/2000
                    ctx.font="30px Arial";
                    ctx.fillStyle = "rgba(200,0,0,"+fade+")"
                    ctx.strokeStyle ="rgba(200,200,200,"+fade+")"
                    this.Y -= 1.5;
                }else{
                    ctx.fillStyle = "rgba(0,0,0,0)"
                    ctx.strokeStyle ="rgba(0,0,0,0)"
                    killObject(this);
                }
                break;
            case "declaration":
                ctx.textAlign = 'center';
                if (timeIn < 3000){
                    ctx.font="50px Arial";
                    ctx.fillStyle = "rgb(200,180,50)"
                    ctx.strokeStyle ="rgb(250,250,250)"
                }else{
                    ctx.fillStyle = "rgba(0,0,0,0)"
                    ctx.strokeStyle ="rgba(0,0,0,0)"
                    ctx.lineWidth = 5
                    killObject(this);
                }
                break;
            case "playerName":
                if(this.orientation ==1){ctx.textAlign = "left"}
                else{ctx.textAlign = "right"}
                ctx.font="35px Arial";
                ctx.fillStyle = "rgb(40,80,160)"
                ctx.strokeStyle ="rgb(250,250,250)"
                break;
            case "timeLeft":
                ctx.textAlign = 'center';
                if (timeIn < 1000){
                    var fontSize = (Math.min((50 +(1000 - timeIn)/20),75)).toString()
                    var opacity = (Math.min((.5 +(1000 - timeIn)/1000),1)).toString()
                    ctx.font = fontSize+"px Arial";
                    ctx.fillStyle = "rgba(255,0,0,"+opacity+")"
                    ctx.strokeStyle ="rgba(0,0,0,1)"
                }else{
                    ctx.fillStyle = "rgba(0,0,0,0)"
                    ctx.strokeStyle ="rgba(0,0,0,0)"
                    killObject(this);
                }
                break;
            default:
                break;
        }
        ctx.fillText(this.textInfo,this.X,this.Y);
        ctx.strokeText(this.textInfo,this.X,this.Y);
    }
}


function Charge(x,y,orientation){
    CHARGE_CHARGING = 0
    CHARGE_FLYING = 1
    CHARGE_EXPLODING = 2
    CHARGE_HIT = 3
    
    this.magnitude = 0
    this.magnitudePlus = 0
    this.X = x
    this.Y = y
    this.orientation = orientation
    this.speed = 5
    this.currentState = CHARGE_CHARGING
    this.actionStartTime
    
    this.fly = function(){
        this.actionStartTime = new Date().getTime()
        this.currentState = CHARGE_FLYING;
        damage = (this.magnitude).toString()
        getNewText(damage,this.X+10,this.Y,'fadeOut')
    },
    
    this.hit = function(){
        this.currentState = CHARGE_HIT;
    }
    
    this.explode = function(){
        this.actionStartTime = new Date().getTime();
        this.currentState = CHARGE_EXPLODING;
    },
    
    this.draw = function(){
        timeIn = new Date().getTime() - this.actionStartTime
        
        switch (this.currentState){
            case CHARGE_CHARGING:
                if (this.magnitudePlus > 0){
                    this.magnitude += .5
                    this.magnitudePlus -=.5
                }
                break;
            case CHARGE_FLYING:
                this.X+= this.speed*this.orientation;
                if (timeIn > 15000){killObject(this)}
                break;
            case CHARGE_HIT:
                if (timeIn > 1500){killObject(this)}
                else{this.X+= this.speed*this.orientation*5;}
                break;
            case CHARGE_EXPLODING:
                if (timeIn < 600){
                    var p = Math.round(timeIn/20)
                    var m = .5
                    var radius = timeIn/300
                    ctx.beginPath();
                    ctx.translate(this.X, this.Y);
                    ctx.moveTo(0,0-this.magnitude*radius);
                    for (var i = 0; i < p; i++){
                        ctx.rotate(Math.PI / p);
                        ctx.lineTo(0, 0 - (this.magnitude*radius*m));
                        ctx.rotate(Math.PI /p);
                        ctx.lineTo(0, 0 - this.magnitude*radius);
                    }
                    var grd=ctx.createRadialGradient(
                        0,0,this.magnitude*radius/10,
                        0,0,this.magnitude*radius
                        );
                        
                        grd.addColorStop(0,"green");
                        grd.addColorStop(0.05,"transparent");
                        grd.addColorStop(0.5,"blue");
                        grd.addColorStop(1,"red");


                    ctx.fillStyle=grd;
                    ctx.strokeStyle = "white"
                    ctx.closePath()
                    ctx.fill();
                    ctx.stroke();
                }else{
                    killObject(this)
                }
                break;
            default:
                break;
        }
        if (this.currentState != CHARGE_EXPLODING){
            ctx.beginPath();
            var radius = this.magnitude
            if (radius != 0){radius +=5}
            else{killObject(this)}
            ctx.arc(this.X,this.Y,radius,0,2*Math.PI);
            var grd=ctx.createRadialGradient(
                this.X,this.Y,0,
                this.X,this.Y,radius
                );
            
            grd.addColorStop(0,"red");
            grd.addColorStop(0.2,"rgb(100,0,100)");
            grd.addColorStop(0.35,"rgba(0,150,255,.7)");
            grd.addColorStop(0.4,"rgba(0,0,255,.5)");
            grd.addColorStop(0.9,"rgba(150,200,255,.4)");
            
            grd.addColorStop(1,"transparent");

            // Fill with gradient
            ctx.fillStyle=grd;
            ctx.fill()
        }
    }
    
    this.checkCollision = function(charge2){
        minDist = this.magnitude+charge2.magnitude+5;
        currentDist = Math.abs(this.X-charge2.X)
        if (currentDist <= minDist && this.currentState != CHARGE_EXPLODING && charge2.currentState != CHARGE_EXPLODING){
            if (this.magnitude < charge2.magnitude){this.explode()}
            else if (this.magnitude > charge2.magnitude){charge2.explode()}
            else{
                killObject(this);
                killObject(charge2);
            };
        }
    }
    
};


function Hero(name,x,y,orientation,anim,energyBarHolder){
    HERO_STANDING = 0
    HERO_SHOOTING = 1
    HERO_CHARGING = 2
    HERO_GOT_HIT = 3
    HERO_DEAD = 4
    HERO_WALKING = 5
    HERO_VICTORY = 6
    HERO_SLIDING = 7
    HERO_SWORD = 8
        
    this.username = name;
    this.opponent = null;
    this.energy = 100
    this.realX = x;
    this.X = x;
    this.Y = y;
    this.HP = 2;
    this.orientation = orientation;
    this.anim = animationDict
    this.currentAction = HERO_STANDING;
    this.img = document.createElement('img');
    this.actionStartTime;
    this.chargedShot = null;
    this.energyBarHolder = energyBarHolder;
    if (name==="You"){displayName = myName}
    else{displayName = name}
    this.nameText = getNewText(displayName,this.realX-orientation*20,y-160,"playerName",orientation)
    
    this.walkIn = function(){
        this.actionStartTime = new Date().getTime();
        this.currentAction = HERO_WALKING
        this.X -= 120*this.orientation;
    },
    
    this.stopWalking = function(){
        this.currentAction = HERO_STANDING
    },
    
    this.getHit = function(){
        this.actionStartTime = new Date().getTime();
        this.currentAction = HERO_GOT_HIT;
        this.HP--;
    },
    
    this.die = function(){
        this.actionStartTime = new Date().getTime();
        this.currentAction = HERO_DEAD;
        $(".energyBarHolder .energySlider .ui-slider-handle",this.energyBarHolder).hide()
        
    },
    
    this.victory = function(){
        isVictory = true
        this.actionStartTime = new Date().getTime();
        this.currentAction = HERO_VICTORY;
        $(".energyBarHolder .energySlider .ui-slider-handle",this.energyBarHolder).hide()
        if (this.username === "You"){winWord = "win"}
        else{winWord = "wins"}
        displayString = this.username+" "+winWord+"!"
        declare(displayString)
    },
    
    this.slide = function(){
        this.actionStartTime = new Date().getTime();
        this.currentAction = HERO_SLIDING; 
    },
    
    this.sword = function(){
        this.actionStartTime = new Date().getTime();
        this.currentAction = HERO_SWORD;
    }
    
    this.shoot = function(){
        this.actionStartTime = new Date().getTime();
        this.currentAction = HERO_SHOOTING;
        if(!this.chargedShot){
            this.makeShot();
        }
        this.chargedShot.fly();
        this.chargedShot = null;
    },
    
    this.charge = function(chargeTime){
        if (chargeTime > this.energy){chargeTime = this.energy}
        else if (chargeTime < 0){chargeTime = 0};
        if (!this.chargedShot){
            this.makeShot()
        }
        this.energy -= chargeTime;
        animateEnergyLoss(this.energyBarHolder,this.energy,chargeTime*50)
        this.chargedShot.magnitudePlus = chargeTime
        this.actionStartTime = new Date().getTime();
        this.chargeTime = chargeTime
        this.currentAction = HERO_CHARGING; 
    },
    
    this.makeShot = function(){
        x = this.X+65*this.orientation;
        y = this.Y+45; 
        this.chargedShot = getNewCharge(x,y,this.orientation)
    },
    
    
    this.draw = function(){
        var nowTime = new Date().getTime()
        var timeIn = nowTime - this.actionStartTime;
        switch (this.currentAction){
            case HERO_STANDING:
                if (nowTime%1800 < 200){this.img = anim["st1"]}
                else if(nowTime%1800 < 400){this.img = anim["st2"]}
                else if(nowTime%1800 < 600){this.img = anim["st3"]}
                else if(nowTime%1800 < 800){this.img = anim["st4"]}
                else if(nowTime%1800 < 1000){this.img = anim["st5"]}
                else if(nowTime%1800 < 1200){this.img = anim["st5"]}
                else if(nowTime%1800 < 1400){this.img = anim["st4"]}
                else if(nowTime%1800 < 1600){this.img = anim["st3"]}
                else if(nowTime%1800 < 1800){this.img = anim["st2"];}
                if (this.opponent.currentAction === HERO_SWORD){
                    this.getHit()
                }else if(this.opponent.HP === 0){
                    this.victory()
                }
                break;
            case HERO_SHOOTING:
                if (timeIn < 150){this.img = anim["sh1"]}
                else if(timeIn < 250){this.img = anim["sh2"]}
                else if(timeIn < 350){this.img = anim["sh3"]}
                else if(timeIn < 450){this.img = anim["sh4"]}
                else if(timeIn < 600){this.img = anim["sh5"]}
                else {this.currentAction = HERO_STANDING;}
                break;
            case HERO_CHARGING:
                var chargeTotal = this.chargeTime*60               
                if (timeIn < 200 && timeIn < chargeTotal){this.img = anim["ch1"]}
                else if(timeIn < chargeTotal - 200){this.img = anim["ch2"]}
                else if(timeIn < chargeTotal){this.img = anim["ch1"]}
                else {this.shoot();}
                break;
            case HERO_GOT_HIT:
                if (timeIn%100 < 50){this.img = anim["blank"];}
                else if (timeIn < 500){this.img = anim["gh1"]}
                else if (this.HP <= 0){this.die();}
                else if (timeIn < 1500){this.img = anim["st1"]}
                else{
                    this.currentAction = HERO_STANDING;
                    readyForAction = true;
                }
                break;
            case HERO_DEAD:
                if (timeIn < 400){this.img = anim["gh2"]}
                else if (this.HP <=0){this.img = anim["dead"]}
                else{this.currentAction = HERO_STANDING;}
                break;
            case HERO_WALKING:
                var frameStep = 60
                var totalFrames = frameStep*14
                var walkTime = 2000;
                this.X += (1800/walkTime)*this.orientation;
                if (timeIn > walkTime){this.stopWalking();readyForAction = true;}
                else if (timeIn < frameStep){this.img = anim["wk1"]}
                else if (timeIn < frameStep*2){this.img = anim["wk2"]}
                else if (timeIn%totalFrames < frameStep*1){this.img = anim["wk15"]}
                else if (timeIn%totalFrames < frameStep*2){this.img = anim["wk16"]}
                else if (timeIn%totalFrames < frameStep*3){this.img = anim["wk3"]}
                else if (timeIn%totalFrames < frameStep*4){this.img = anim["wk4"]}
                else if (timeIn%totalFrames < frameStep*5){this.img = anim["wk5"]}
                else if (timeIn%totalFrames < frameStep*6){this.img = anim["wk6"]}
                else if (timeIn%totalFrames < frameStep*7){this.img = anim["wk7"]}
                else if (timeIn%totalFrames < frameStep*8){this.img = anim["wk8"]}
                else if (timeIn%totalFrames < frameStep*9){this.img = anim["wk9"]}
                else if (timeIn%totalFrames < frameStep*10){this.img = anim["wk10"]}
                else if (timeIn%totalFrames < frameStep*11){this.img = anim["wk11"]}
                else if (timeIn%totalFrames < frameStep*12){this.img = anim["wk12"]}
                else if (timeIn%totalFrames < frameStep*13){this.img = anim["wk13"]}
                else if (timeIn%totalFrames < frameStep*14){this.img = anim["wk14"]}
                break;
            case HERO_VICTORY:
                var pauseTime = 1000;
                var shiftTime = pauseTime +1000;
                var endSpot = 250 - 50*this.orientation;
                if (timeIn < pauseTime){this.img = anim["st5"]}
                else if (timeIn < shiftTime + 100 ){
                    this.img = anim["vt1"]
                    this.X = (endSpot - this.X)*Math.min(timeIn/shiftTime,1) + this.X
                }
                else if (timeIn < shiftTime + 200){this.img = anim["vt2"]}
                else if (timeIn < shiftTime + 300){this.img = anim["vt3"]}
                else {this.img = anim["vt4"]}
                break;
            case HERO_SLIDING:
                var frameStep = 30
                var slidingFrames = 15
                var shiftTime = frameStep*(slidingFrames+4)
                var endSpot = this.realX + 240*this.orientation;
                this.X = (endSpot - this.X)*Math.min(timeIn/shiftTime,1) + this.X
                if (timeIn < frameStep*1){this.img = anim["sl1"]}
                else if (timeIn < frameStep*2){this.img = anim["sl2"]}
                else if (timeIn < frameStep*slidingFrames){this.img = anim["sl3"]}
                else if (timeIn < frameStep*(slidingFrames+1)){this.img = anim["sl4"]}
                else if (timeIn < frameStep*(slidingFrames+2)){this.img = anim["sl5"]}
                else if (timeIn < frameStep*(slidingFrames+3)){this.img = anim["sl6"]}
                else if (timeIn < frameStep*(slidingFrames+4)){this.img = anim["sl7"]}
                else{this.sword()}
                break;
            case HERO_SWORD:
                var frameStep = 30
                if (timeIn < frameStep*1){this.img = anim["sw1"]}
                else if (timeIn < frameStep*2){this.img = anim["sw2"]}
                else if (timeIn < frameStep*3){this.img = anim["sw3"]}
                else if (timeIn < frameStep*4){this.img = anim["sw4"]}
                else if (timeIn < frameStep*5){this.img = anim["sw5"]}
                else if (timeIn < frameStep*6){this.img = anim["sw6"]}
                else if (timeIn < frameStep*7){this.img = anim["sw7"]}
                else if (timeIn < frameStep*8){this.img = anim["sw8"]}
                else if (timeIn < frameStep*9){this.img = anim["sw9"]}
                else if (timeIn < frameStep*10){this.img = anim["sw10"]}
                else if (timeIn < frameStep*11){this.img = anim["sw11"]}
                else if (timeIn < frameStep*12){this.img = anim["sw12"]}
                else if (timeIn < frameStep*13){this.img = anim["sw13"]}
                else if (timeIn < frameStep*14){this.img = anim["sw14"]}
                else{this.currentAction = HERO_STANDING;}
                break;
            default:                
                break;
        }
        ctx.translate(this.X,this.Y)
        ctx.scale(this.orientation,1)
        ctx.drawImage(this.img,0,0);
        //draw hearts
        var xTrans = this.orientation*(this.realX-this.X)-50
        ctx.translate(xTrans,-150)
        for (var i=0;i<this.HP;i++){
            ctx.translate(35,0);
            ctx.drawImage(heartImg,0,0,30,30)
        //draw name
        
        }
        ctx.restore()
    }
};

function colorImage(imgElement) {
    // create hidden canvas (using image dimensions)
    var tempCanvas = document.createElement("canvas");
    
    
    tempCanvas.width = 200 //imgElement.offsetWidth;
    tempCanvas.height = 100 //imgElement.offsetHeight;
    //console.log(tempCanvas.width)
    //console.log(tempCanvas.height)

    var context = tempCanvas.getContext("2d");
    context.drawImage(imgElement,0,0);

    var map = context.getImageData(0,0,200,100);
    var imdata = map.data;
    // convert image to grayscale
    var r,g,b,a,avg;
    for(var p = 0, len = imdata.length; p < len; p+=4) {
        r = imdata[p]
        g = imdata[p+1];
        b = imdata[p+2];
        avg = Math.floor((r+g+b)/3);
        //R:239, G:208, B:207 --- skin tone
        /*
        if(r/g>1.1 && r/g < 1.8 && r/b>1.5 && r/b <2.5){
            continue;
        }else 
        */
        if((Math.max(r,g,b) - Math.min(r,g,b))<.3*avg){
            imdata[p] = avg-50
            imdata[p+1] = avg-50
            imdata[p+2] = avg+100
        }
    }

    context.putImageData(map,0,0)

    // replace image source with canvas data
    imgElement.src = tempCanvas.toDataURL();
    return imgElement
}

function heroShoot(thisVal){
    time = parseInt(thisVal) || 0;
    myAvatar.charge(time)
}

function opponentShoot(time){
    opponentAvatar.charge(time)
}

function bothShoot(p1,p2,round,endGame){
    readyForAction = false
    if (!isTie){
        declare(round)
        heroShoot(p1);
        opponentShoot(p2);
    }
    if (round === "Round 2"){
        if (endGame === "draw"){isTie = true;declare("Draw")};
        var greatestTime = (Math.max(p1,p2)*60 + 2000)
        if (!isVictory && !isTie){
            setTimeout(function(){
                victorSwordAttack()
            },greatestTime)
        }
    }
}

function herosAttack(){
    for (i=0;i<allHeros.length;i++){
        thisHero = allHeros[i];
        if (thisHero.HP === 2){
            thisHero.slide();
        }
    }
}

function victorSwordAttack(){
    HP1s = 0
    if (allHeros[0].HP === 1){HP1s++;}
    if (allHeros[1].HP === 1){HP1s++;}
    if (HP1s === 2){
        if (allHeros[1].energy > allHeros[0].energy){
            victorHero = allHeros[1]
        }else if (allHeros[0].energy > allHeros[1].energy){
            victorHero = allHeros[0]
        }else{
            victorHero = null
        }
    if (victorHero){
        victorHero.slide();
    }
    else{declare("Draw")}    
    }
    
};

function declare(word){
    if (declarationText){
        killObject(declarationText)
    }
    declarationText = getNewText(word,250,150,"declaration")
};

function checkVictory(){
    for (i=0;i<allHeros.length;i++){
        thisHero = allHeros[i];
        if (thisHero.HP > 0){
            thisHero.victory();
        }
    }
}

function getNewHero(name,x,y,orientation,anim,energyBarHolder){
    var hero = new Hero(name,x,y,orientation,anim,energyBarHolder)
    allObjects.push(hero)
    allHeros.push(hero)
    return hero
}

function getNewCharge(x,y,getNewCharge){
    var charge = new Charge(x,y,getNewCharge)
    allObjects.push(charge)
    allCharges.push(charge)
    return charge
}

function getNewText(text,x,y,state,orientation){
    var thisText = new TextObj(text,x,y,state,orientation)
    allObjects.push(thisText)
    return thisText
}

function getNewStar(x,y,r,p,m){
    var thisStar = new Star(x,y,r,p,m)
    allObjects.push(thisStar)
    return thisStar
}

function killObject(object){
    allObjects.splice(allObjects.indexOf(object),1)
    if (allHeros.indexOf(object) !=-1){
        allHeros.splice(allHeros.indexOf(object),1);
        killObject(object.nameText);
    }else if (allCharges.indexOf(object) !=-1){allCharges.splice(allCharges.indexOf(object),1);}
    else if (declarationText === object){declarationText = null}

}


function animateEnergyLoss(holderDiv,energy,time){
    var full = energy.toString() + "%";
    var empty = (100 - energy).toString()+"%";
    $(".energyBarHolder .energySlider .ui-slider-handle",holderDiv).hide()
    $(".energyBarHolder .caseEmpty",holderDiv).animate({
       height: empty
    }, { duration: time, queue: false });
    $(".energyBarHolder .caseFull",holderDiv).animate({
       height: full
    }, { duration: time, queue: false });
    $(".energyBarHolder .energySlider",holderDiv).animate({
        height: full,
    },{ duration: time, queue: false , 
        complete: function(){
            $('#energyInput').keyup()
            $(".energySlider").slider("option", "max", energy)
            $(".energyBarHolder .energySlider .ui-slider-handle",holderDiv).show()
            $('#energyInput').val(0)
            properFocus('#energyInput')
        }
    });   
};

function resetPlayer(avatar){
    avatar.energy = 100;
    avatar.HP = 2
    animateEnergyLoss(avatar.energyBarHolder,100,200);
    avatar.X = avatar.realX;
    avatar.walkIn()
}

function resetAll(){
    isTie = false
    isVictory = false
    readyForAction = false
    for (i=0;i<allHeros.length;i++){
        resetPlayer(allHeros[i])
    }
}

function Star( x, y, r, p, m){
    this.X = x
    this.Y = y
    this.radius = r
    this.numPoints = p
    this.m = m

    this.draw = function(){
        ctx.beginPath();
        ctx.translate(this.X, this.Y);
        ctx.moveTo(0,0-this.radius);
        for (var i = 0; i < this.numPoints; i++){
            ctx.rotate(Math.PI / this.numPoints);
            ctx.lineTo(0, 0 - (this.radius*this.m));
            ctx.rotate(Math.PI / this.numPoints);
            ctx.lineTo(0, 0 - this.radius);
        }
        var grd=ctx.createLinearGradient(this.radius,this.radius,-this.radius,-this.radius);
            
        grd.addColorStop(0,"#f6e6b4");    
        grd.addColorStop(.4,"#ed9017");
        grd.addColorStop(.6,"#f6e6b4");
        grd.addColorStop(1,"#ed9017");
        
        
        ctx.fillStyle=grd;
        ctx.strokeStyle = "#ed9017"
        ctx.closePath()
        ctx.fill();
        ctx.stroke();
    }
}


