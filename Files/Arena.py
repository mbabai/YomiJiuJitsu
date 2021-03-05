import tornado.httpserver
import tornado.ioloop
import logging
import tornado.auth
import tornado.escape
import tornado.options
import tornado.web
import textwrap
import os.path
import tornado.websocket
import json
import random
from Alchemy import *
from uuid import uuid4
import time
from datetime import datetime
import _thread

from tornado import gen
from tornado.options import define, options
define ("port", default=8000, help="run on the given port", type=int)

#Global Variables.
UsernameToBaseHandler = {}
#Play Variables
now = 0
games = {} #{gameID:game}
gamesIDnum = 0
allottedWaitingTime = 15 #In seconds
openGames = {} #{openGameString:openGame}
playersToSocket = {} #{playerid:handler}
socketToPlayers = {} #{Handler:playerid}
waitingOnPlayers = {} #{playerID:[gameID,waiting_start_time]}
inputBuffers = {} #{gameID:buffer}
allOpponentsGames = {} #{playerID:[playerID,gameID]}
botList = ["RandoBot","SmartBot","OmniBot"]


def unJSON(message):
    """Just a shorthand for decoding json in tornado."""
    return tornado.escape.json_decode(message)

class Application(tornado.web.Application):
    def __init__(self):
        handlers = [
            (r"/", HomeHandler),
            (r"/play", PlayHandler),
            (r"/game", GameHandler),
            (r'/auth/login', LoginHandler),
            (r'/auth/logout', LogoutHandler),
            (r'/auth/signup', SignupHandler),
            (r'/auth/noAuth', noAuthHandler),
            (r'/howtoplay', HowToPlayHandler),
            (r'/aboutus', AboutUsHandler),
            (r'/account', AccountHandler)
        ]
        settings = dict(
            template_path = os.path.join(os.path.dirname(__file__), "templates"),
            static_path = os.path.join(os.path.dirname(__file__), "static"),
            cookie_secret = 'H9DwdTPgQoa9GuUiZRPp8+5PhFYV4UHNmWCG3W7TUqc=',
            xsrf_cookies = True,
            login_url = "/auth/login",
            debug = True
        )
        tornado.web.Application.__init__(self,handlers,**settings)

class BaseHandler(tornado.web.RequestHandler):
    
    def get_login_url(self):
        return u"/auth/login"
    
    def get_current_user(self):
        user_json = self.get_secure_cookie("user")
        if not user_json: return None
        return unJSON(user_json)

class HomeHandler(BaseHandler):
    def get(self):
        self.render("home.html")
        
class LoginHandler(BaseHandler):
    @tornado.web.asynchronous
    #@gen.coroutine
    def get(self):
        self.clear_cookie("user")
        self.render("login.html",error="",next=self.get_argument("next","/play"))
       
    def post(self):
        username = self.get_argument("username", "")
        password = self.get_argument("password", "")
        auth = authenticate(username, password)
        if auth:
            self.set_current_user(username)
            self.redirect(self.get_argument("next", u"/play"))
        else:
            self.render("login.html",error="Username or Password incorrect")

    def set_current_user(self, user):
            if user:
                self.set_secure_cookie("user", tornado.escape.json_encode(getUserInfo(user)))
            else:
                self.clear_cookie("user")

class LogoutHandler(BaseHandler):
    @tornado.web.authenticated
    def get(self):
        self.clear_cookie("user")
        self.render("logout.html")

class noAuthHandler(BaseHandler):
    def get(self):
        self.clear_cookie("user")
        self.render("noAuth.html")

class HowToPlayHandler(BaseHandler):
    def get(self):
        self.render("howtoplay.html")
        
class AboutUsHandler(BaseHandler):
    def get(self):
        self.render("aboutus.html")

class SignupHandler(BaseHandler):
    def get(self):
        self.clear_cookie("user")
        self.render("signup.html",error="")
        
    def post(self):
        newUsername = self.get_argument("newUsername","")
        pass1 = self.get_argument("pass1","")
        pass2 = self.get_argument("pass2","")
        if usernameTaken(newUsername):
            self.render("signup.html",error="Username is Taken!")
        elif pass1 != pass2:
            self.render("signup.html",error="Passwords didn't Match!")
        else:
            saveUser(newUsername,pass1)
            self.redirect(u"/auth/login")

class AccountHandler(BaseHandler):
    @tornado.web.authenticated
    def get(self):
        HL=getPlayerHistory(self.current_user["username"])
        HL.sort(key=lambda HI:HI["timestamp"],reverse=True)
        
        PS = getPlayerStats(self.current_user["username"])
        
        self.render('account.html',user=self.current_user,historyList=HL,playerStats=PS)
    

    def post(self):
        sortVariable = self.get_argument("sortVariable","")
        reverser = self.get_argument("reverser","")
        HL=getPlayerHistory(self.current_user["username"])
        HL.sort(key=lambda HI:HI[sortVariable],reverse=reverser)
        self.render('account.html',user=self.current_user,historyList=HL)
        
        

class PlayHandler(BaseHandler):
    @tornado.web.authenticated
    def get(self):
        UsernameToBaseHandler[self.current_user["username"]] = self
        self.render('index.html',user=self.current_user)

    def open(self):
        pass

    def on_close(self):
        pass

    def callback(self):
        pass


class GameHandler(tornado.websocket.WebSocketHandler):
    @tornado.web.authenticated
    def get(self):
        self.redirect("/play")
    
    def open(self):
        user = self.get_secure_cookie("user")
        newPlayer(user,self)
        updateOpenGames(self)
        player = socketToPlayers[self]['username']
        printString = "("+str(datetime.now())+")::"+player+" has entered the game room."
        print(printString)

    def on_close(self):
        user = unJSON(self.get_secure_cookie("user"))['claimed_id'][41:]
        player = socketToPlayers[self]['username']
        if user in allOpponentsGames:
            closeOutUnfishedGame(user)
        leavingPlayer(user)
        deleteOpenGame(user)
        printString = "("+str(datetime.now())+")::"+player+" has left the game room."
        print(printString)
        

    def callback(self):
        print("Echo Callback.")

    def on_message(self, message):
        """Playing against the computer:"""
        pyMessage = json.loads(message)
        sendback = {}
        user = unJSON(self.get_secure_cookie("user"))['claimed_id'][41:]
        sendbackMessages = True
        if pyMessage["message"][0] == "startBotGame":
            sendback = initiateBotGame(self,user,pyMessage["message"][1])
        elif pyMessage["message"][0] == "chatMessage":
            theMessage = pyMessage["message"][1]
            fromName = playerIDToInfo(user)['username']
            sendChatMessage(fromName,theMessage)
        elif pyMessage["message"][0] == "createGame":
            openAGame(user)
            sendback = {"message":["gameCreated"]}
        elif pyMessage["message"][0] == "deleteGame":
            deleteOpenGame(user)
            sendback = {"message":["gameDeleted"]}
        elif pyMessage["message"][0] == "challengePlayer":
            thisID = pyMessage["message"][1]
            sendback = challengePlayer(self,user,thisID)
        elif pyMessage["message"][0] == "gameAction":
            thisGameID = "game"+str(pyMessage["message"][1])
            inputVal = pyMessage["message"][2]
            sendback = enterGameAction(self,user,thisGameID,inputVal)  
        self.write_message(sendback)            


class BotPlayer():
    """This is a bot."""
    def __init__(self,ID,name):
        self.handler = RoboHandler(self)
        self.dict = {'claimed_id':ID,'username':name,"rank":getRank(name)}
        self.id = self.dict['claimed_id'][41:]
        self.energy = 100
        playersToSocket[self.id] = self.handler
        socketToPlayers[self.handler] = self.dict
        self.strategy = name
        
        
class RoboHandler():
    """This is a mock-handler for bots."""
    def __init__(self,bot):
        self.gameID = None
        self.bot = bot
    
    def destruct(self):
        """Delete this bot when it's done playing."""
        del playersToSocket[self.bot.id] 
        del socketToPlayers[self.bot.handler]
    
    def write_message(self,message):
        if message["message"][0] == "StartingPVP":
            self.gameID = "game"+str(message["message"][1])
        elif message["message"][0] == "energy":
            self.bot.energy = message["message"][1]
        elif message["message"][0] == "waitingOnYou":
            gbuffer = message["message"][2]
            self.thinkAndAct(gbuffer)
            
        elif message["message"][0] == "R23":
            self.destruct()
            
    def thinkAndAct(self,gbuffer):
        """Let the action of the bot happen in another thread."""
        thread.start_new_thread(self.BotAction,(gbuffer,))
        
    def BotAction(self,gbuffer):
        """Doing actions in parallel."""
        time.sleep(.1)
        action = self.getAction(self.bot.strategy,gbuffer)
        self.sendAction(action)            
            
    def getAction(self,strategy,gbuffer):
        """Play the bots action given a strategy"""
        opponentPlay = int(gbuffer.p1Play)
        thisRound = gbuffer.currentRound
        opponent = gbuffer.game.player1
        if strategy == "RandoBot":
            execute =  random.randrange(0,self.bot.energy+1)
        elif strategy == "OmniBot":
            if opponentPlay < 50:
                execute =  opponentPlay+1
            elif opponentPlay > 50:
                execute =  0
            elif (opponentPlay == 50 and thisRound == 0):
                execute =  0
            elif (opponentPlay == 50 and thisRound == 1):
                if self.bot.energy > 50: execute =  51    
                else: execute =  0
        elif strategy == "SmartBot":
            if thisRound == 0:
                rand1 = random.randrange(0,4)
                if rand1 == 0: execute =  random.randrange(0,4)
                elif rand1 < 3: execute =  random.randrange(3,35)
                else: execute = random.randrange(0,50)
            elif thisRound == 1:
                if self.bot.energy > opponent.energy: #Bot lost round 1
                    if self.bot.energy > 2*opponent.energy:
                        execute = opponent.energy + random.randrange(0,2)
                    else:
                        execute = self.highLoMid(opponent,False)
                else: #Bot won round 1
                    execute = self.highLoMid(opponent,True)
        
        return min(execute,opponent.energy+1,self.bot.energy)
                
                
    
    def highLoMid(self,opponent,r1win):
        if not r1win: basePlayer = opponent
        else: basePlayer = self.bot 
        rand1 = random.randrange(0,3)
        if rand1 == 0: execute = basePlayer.energy/2 + random.randrange(-3,6)
        elif rand1 == 1: execute = random.randrange(0,6)
        else: execute = opponent.energy+1
        return execute
    
    
    def sendAction(self,action):
        """Send the action to the game Buffer."""
        enterGameAction(self,self.bot.id,self.gameID,action)
 
class OpenGame():
    """This is a game waiting for a player."""
    def __init__(self,player1,idnum):
        self.player1 = player1
        self.id = idnum
        self.player2 = None
    
    def getP2(self,player2):
        """Get the second player and start the game."""
        self.player2 = player2
        return startGame(self.player1,self.player2)
        
class Player():
    """This is a player of PKJJ."""
    def __init__(self,controler):
        self.energy = 100
        self.controler = controler
        self.round1play = 0
        self.round2play = 0
        self.round3play = 0
        
    def __str__ (self):
        if type(self.controler) == dict: return self.controler['username']
        else: return playerIDToInfo(self.controler)['username']   
    
    def setRound1(self,value):
        if value > self.energy:
            value = self.energy
        elif value < 0:
            value = 0
        self.round1play = value
        self.energy -= self.round1play
        return value
    
    def setRound23(self,value):
        if value > self.energy:
            value = self.energy
        self.round2play = value
        self.energy -= self.round2play
        self.round3play = self.energy        
        self.energy = 0
        return value
    
    def playRandom(self):
        return random.randrange(0,self.energy+1)

class GameInputBuffer():
    """This collects PvP input, then sends it to the game once both players have played."""
    def __init__(self,game):
        self.gameID = game.id
        self.game = game
        self.p1 = game.player1.controler
        self.p2 = game.player2.controler
        self.currentRound = 0
        self.p1Play = None
        self.p2Play = None
        inputBuffers[self.gameID] = self
        
    def playoutInputs(self,value,player):
        self.sortInput(value,player)
        if self.checkReady():
            results = self.sendInputsToGame()
        else:
            results = None
        return results  
        
    def sortInput(self,value,player):
        """Decide which player has just played """
        if player == self.p1: 
            self.p1Play = value
        elif player == self.p2: 
            self.p2Play = value
        else: 
            print(str(datetime.now()), "Input user error #001.")
            return False
    
    def checkReady(self):
        """Check if we have inputs from both players."""
        if self.p1Play != None and self.p2Play != None:
            return True
        else:
            return False    
            
    def sendInputsToGame(self):
        """Send the inputs to the game, and clear the inputs."""
        G = games[self.gameID]
        if self.currentRound == 0:
            result = G.playR1(int(self.p1Play),int(self.p2Play))
        elif self.currentRound == 1:
            result = G.playR23(int(self.p1Play),int(self.p2Play))
        return result    
        
    def nextRound(self):
        """Set the buffer to the next round, and clear play information."""
        self.p1Play = None
        self.p2Play = None
        self.currentRound+=1
        if self.currentRound == 2:
            self.destruct()
    
    def destruct(self):
        """Delete this buffer."""
        del inputBuffers[self.gameID]
            
            
class Game():
    """This is a game between two players."""
    def __init__(self,idnum,p1,p2):
        self.id = idnum
        self.player1 = Player(p1)
        self.player2 = Player(p2)
        self.round = []
        self.players = {p1:self.player1,p2:self.player2}
        self.opposingPlayer = {p2:self.player1,p1:self.player2}
        
    def playR1(self,p1Play,p2Play):
        """Determine the winner of round 1."""
        p1r1 = self.player1.setRound1(p1Play)
        p2r1 = self.player2.setRound1(p2Play)
        if p1r1 > p2r1:
            self.round.append(self.player1)
        elif p1r1 < p2r1:
            self.round.append(self.player2)
        else:
            self.round.append("draw")
        return self.round[0]
            
    def playR23(self,p1Play,p2Play):
        """Determine the winners of round 2 and 3."""
        p1r2 = self.player1.setRound23(p1Play)
        p2r2 = self.player2.setRound23(p2Play)
        p1r3 = self.player1.round3play
        p2r3 = self.player2.round3play
        if p1r2 > p2r2:
            self.round.append(self.player1)
        elif p1r2 < p2r2:
            self.round.append(self.player2)
        else:
            self.round.append("draw")
        if p1r3 > p2r3:
            self.round.append(self.player1)
        elif p1r3 < p2r3:
            self.round.append(self.player2)     
        else:
            self.round.append("draw")
        return (self.round[1],self.round[2])
    
    def endGame(self):
        """Count who won more rounds, and decide the victor."""
        p1count = 0
        p2count = 0
        isDraw = False
        for thisRound in self.round:
            if thisRound == "draw":
                isDraw = True
                break
            elif thisRound == self.player1:
                p1count+=1
            elif thisRound == self.player2:
                p2count+=1
        if isDraw:
            victor = "draw"
            P1Outcome = 0      
        elif p1count > p2count: 
            victor = self.player1
            P1Outcome = 1
        else:  
            victor = self.player2
            P1Outcome = -1
            
        player1 = playerIDToInfo(self.player1.controler)
        player2 = playerIDToInfo(self.player2.controler)
        p1 = player1['username']
        p2 = player2['username']
        p1r1 = self.player1.round1play
        p1r2 = self.player1.round2play
        p1r3 = self.player1.round3play
        p2r1 = self.player2.round1play
        p2r2 = self.player2.round2play
        p2r3 = self.player2.round3play
        noLongerOpponents(self.player1.controler,self.player2.controler)
        saveGameStats(p1,p2,p1r1,p2r1,p1r2,p2r2,p1r3,p2r3,P1Outcome)

        updatePlayersInChatRoom()
        del games[self.id]
        print("Ended Game",self.id )
        return str(victor)


    
        
        
        
def startGame(p1,p2):
    """Play a game of PKJJ."""
    global gamesIDnum
    gamesIDnum += 1
    printString = "("+str(datetime.now())+")::Starting game:"+ str(gamesIDnum)  
    print(printString)
    gameString = "game" + str(gamesIDnum)
    games[gameString] = Game(gameString,p1,p2)
    return gamesIDnum

def updateOpenGames(player):
    """Let a player who just joined know what games are open."""
    for key, value in openGames.iteritems():
        idString = value.id[8:]
        mes = {"message":["newOpenGame",idString]}
        player.write_message(mes)

def openAGame(user):
    openGameIDval = user
    openGameString = "openGame"+ openGameIDval
    openGames[openGameString] = OpenGame(user,openGameString)
    for otherPlayer in socketToPlayers:
        mes = {"message":["newOpenGame",openGameIDval]}
        otherPlayer.write_message(mes)
    return openGameString
    
def deleteOpenGame(ID):
    gameID = "openGame"+ID
    if gameID in openGames.keys():
        del openGames[gameID]
    for otherPlayer in socketToPlayers:
        mes = {"message":["deleteOpenGame",ID]}
        otherPlayer.write_message(mes)
    
def newPlayer(player,messagePigeon):
    playersToSocket[unJSON(player)['claimed_id'][41:]] = messagePigeon
    socketToPlayers[messagePigeon] = unJSON(player)
    updatePlayersInChatRoom()
    
def playerIDToInfo(user):
    """Cycle through the dictionaries to get player info."""
    
    return socketToPlayers[playersToSocket[user]]

def leavingPlayer(player):
    """Get rid of a player's references when they leave."""
    messagePigeon = playersToSocket[player]
    del playersToSocket[player]
    del socketToPlayers[messagePigeon]
    updatePlayersInChatRoom()
     
def updatePlayersInChatRoom():
    """Send a message to all players that a new person has entered the game."""
    for key, val in playersToSocket.iteritems():
        playerList = []
        for playerKey,playerVal in socketToPlayers.iteritems():
            if playerKey != val and playerVal['username'] not in botList:
                userInfo = getUserInfo(playerVal['username'])
                playerList.append(userInfo)
        mes = {"message":["newPlayer",playerList]}
        val.write_message(mes)           
    
def sendChatMessage(fromName,theMessage):    
    """Send a chat message to all players."""
    fullMessage = {"from":fromName,"messageText":theMessage}
    mes = {"message":["chatMessage",fullMessage]}
    for player in socketToPlayers:
        player.write_message(mes)
        
def challengePlayer(playerHandler,user,thisID):
    """Challenge a player"""
    OG = openGames["openGame"+thisID]
    thisGameID = OG.getP2(user)
    G = games["game"+str(thisGameID)]
    gameBuffer = GameInputBuffer(G)
    otherPlayer = OG.player1 
    #Let players know the game has begun.
    mes1 = {"message":["StartingPVP",thisGameID,playerIDToInfo(otherPlayer)['username'],socketToPlayers[playerHandler]['username']]}
    playerHandler.write_message(mes1)
    mes2 = {"message":["StartingPVP",thisGameID,socketToPlayers[playerHandler]['username'],playerIDToInfo(otherPlayer)['username']]}
    playersToSocket[otherPlayer].write_message(mes2)
    #send energy levels
    hisEnergyVal = {"message":["energy",G.player1.energy]}
    playersToSocket[otherPlayer].write_message(hisEnergyVal) 
    myEnergyVal = {"message":["energy",G.player2.energy]}
    playerHandler.write_message(myEnergyVal)
    deleteOpenGame(otherPlayer)
    trackPlayersInGames(user,otherPlayer,G.id)
    
    sendback = {"message":["filler"]}      
    return sendback
        
def enterGameAction(userHandler,user,thisGameID,inputVal):
    """Input a player's action into play"""
    sendback = {}
    gBuffer = inputBuffers[thisGameID]
    G = games[thisGameID]
    results = gBuffer.playoutInputs(inputVal,user)
    opponentID = G.opposingPlayer[user].controler
    if results != None:
        noLongerWaitingOn(user)
        if gBuffer.currentRound == 0:
            myR1 = G.players[user].round1play
            yourR1 = G.players[opponentID].round1play
            sendback["message"] = ["R1",{"p1r1":myR1,"p2r1":yourR1, "Victor":str(results)}]
            mes = {"message":["R1",{"p1r1":yourR1,"p2r1":myR1, "Victor":str(results)}]}
        elif gBuffer.currentRound == 1:
            myR2 = G.players[user].round2play
            yourR2 = G.players[opponentID].round2play
            myR3 = G.players[user].round3play
            yourR3 = G.players[opponentID].round3play
            endGame = G.endGame()
            sendback["message"] = ["R23",{"p1r2":myR2,"p2r2":yourR2, "Victor2":str(results[0]), \
                "p1r3":myR3,"p2r3":yourR3, "Victor3":str(results[1]), "endGame":endGame}] 
            mes = {"message":["R23",{"p1r2":yourR2,"p2r2":myR2, "Victor2":str(results[0]), \
                "p1r3":yourR3,"p2r3":myR3, "Victor3":str(results[1]), "endGame":endGame}]}
        #Send all the messages!
        myEnergyVal = {"message":["energy",G.players[user].energy]}
        yourEnergyVal = {"message":["energy",G.players[opponentID].energy]}
        userHandler.write_message(myEnergyVal)
        userHandler.write_message(sendback) 
        playersToSocket[opponentID].write_message(yourEnergyVal)            
        playersToSocket[opponentID].write_message(mes)
        sendback = {"message":["filler"]}
        gBuffer.nextRound()
    elif results == None:
        waitStart = int(time.time())
        mes = {"message":["waitingOnYou",allottedWaitingTime,gBuffer]}
        waitingOnPlayer = playersToSocket[opponentID]
        if socketToPlayers[waitingOnPlayer]["username"] in botList:
            mes = {"message":["waitingOnYou",allottedWaitingTime,gBuffer]}
        else:
            mes = {"message":["waitingOnYou",allottedWaitingTime]}
        waitingOnPlayer.write_message(mes)
        waitingOnPlayers[opponentID] = [thisGameID,waitStart]
        sendback = {"message":["waitingForOpponent",inputVal]}
    return sendback


def trackPlayersInGames(p1,p2,gameID):
    """Track the players for easy checking if they leave, later."""
    allOpponentsGames[p1] = [p2,gameID]
    allOpponentsGames[p2] = [p1,gameID]
 
def noLongerOpponents(p1,p2):
    """Stop tracking these opponents"""
    del allOpponentsGames[p1]
    del allOpponentsGames[p2]    
    
def noLongerWaitingOn(player):
    """Stop waiting on a player, if you were."""
    if player in waitingOnPlayers:
        del waitingOnPlayers[player]
    
    
def closeOutUnfishedGame(user):
    """What do do when a player leave mid-game."""
    otherPlayer = allOpponentsGames[user][0]
    noLongerWaitingOn(otherPlayer)
    noLongerWaitingOn(user)
    p2 = playerIDToInfo(otherPlayer)['username']
    p1 = playerIDToInfo(user)['username']
    thisGameID = allOpponentsGames[user][1]
    saveGameStats(p1,p2,0,0,0,0,0,0,1)
    inputBuffers[thisGameID].destruct()
    del games[thisGameID]
    otherHandler = playersToSocket[otherPlayer]
    mes = {"message":["opponentLeft"]}
    noLongerOpponents(user,otherPlayer)
    otherHandler.write_message(mes)
    
        
        
def initiateBotGame(playerHandler,user,botName):
    """Start a game with a Bot"""
    botPlayer = BotPlayer("01234567890123456789012345678901234567890"+botName+str(gamesIDnum),botName)        
    thisGameID = startGame(user,botPlayer.id)
    G = games['game'+ str(thisGameID)]
    gameBuffer = GameInputBuffer(G)
    energyVal = {"message":["energy",G.player1.energy]}
    playerHandler.write_message(energyVal)
    mes2 = {"message":["StartingPVP",thisGameID,socketToPlayers[playerHandler]['username'],playerIDToInfo(botPlayer.id)['username']]}
    playersToSocket[botPlayer.id].write_message(mes2)
    sendback = {"message":["StartingPVP",thisGameID,playerIDToInfo(botPlayer.id)['username'],socketToPlayers[playerHandler]['username']]}
    trackPlayersInGames(user,botPlayer.id,G.id)
    
    return sendback
        
def heartbeat(threadName,interval):
    """The keeps a steady pulse going in the game to keep track of time."""
    while(True):
        global now
        time.sleep(interval)
        now = int(time.time())
        currentWaitingOnPlayers = waitingOnPlayers.copy()
        for player,waitInfo in currentWaitingOnPlayers.items():
            waitStartTime = waitInfo[1]
            waitGameID = waitInfo[0]
            global allottedWaitingTime
            timeLeft = allottedWaitingTime - (now - waitStartTime)
            if timeLeft <= 0:
                user = playerIDToInfo(player)['claimed_id'][41:]
                playerHandler = playersToSocket[player]
                sendback = enterGameAction(playerHandler,user,waitGameID,0)
                playerHandler.write_message(sendback) 

def noBotMakeBot():
    """Check the database for bots, if they don't exist, make them."""
    for name in ["RandoBot","SmartBot","OmniBot"]:
        if not usernameTaken(name):
            saveUser(name,"1010101010")

    
        
         
                
        
if __name__ == "__main__":
    tornado.options.parse_command_line()
    http_server = tornado.httpserver.HTTPServer(Application())
    http_server.listen(options.port)
    noBotMakeBot()
    printString = "("+str(datetime.now())+")::Server Online:"
    print(printString)
    _thread.start_new_thread( heartbeat,("hearbeat", 1,))
    tornado.ioloop.IOLoop.instance().start()
    
    
    
    
    