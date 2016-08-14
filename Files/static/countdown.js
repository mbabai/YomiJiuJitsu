var countingDown


function postTimeLeft(startTime,waitingTime){
    var timeLeft = waitingTime
    var nowTime = new Date().getTime() / 1000;
    timeLeft = waitingTime - Math.ceil(nowTime - startTime)
    self.postMessage(["timeLeft",timeLeft]);
    if (timeLeft <= 0){
        clearInterval(countingDown);
        self.postMessage(["countZero"]);
    }
}


self.onmessage = function(e) {
    data = e.data
    switch(data[0]){
        case "waitingTime":
            var waitingTime = data[1]
            var startTime = new Date().getTime() / 1000;
            if (countingDown){clearInterval(countingDown)}
            countingDown = setInterval(function(){
                postTimeLeft(startTime,waitingTime)
                }, 1000)
            break;
        case "endCountdown":
            clearInterval(countingDown);
            self.postMessage(["countEnd"]);
            break;
        default:
            break;
            
    }
}