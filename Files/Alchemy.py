from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Sequence, ForeignKey, create_engine, Table, Text
from sqlalchemy.orm import sessionmaker, relationship, backref
from datetime import datetime
from MyCrypto import *
import math

from sqlalchemy.dialects.sqlite import \
            BLOB, BOOLEAN, CHAR, DATE, DATETIME, DECIMAL, FLOAT, \
            INTEGER, NUMERIC, SMALLINT, TEXT, TIME, TIMESTAMP, \
            VARCHAR


Base = declarative_base()
engine = create_engine('sqlite:///Arena.db', echo=False)
Session = sessionmaker(bind=engine) #define what a session is
session = Session()


class DBUser(Base):
    __tablename__ = "dbusers"
    id = Column(Integer, Sequence('dbuser_id_seq'), primary_key=True)
    username = Column(String(50),unique=True)
    passhash = Column(String(1024))
    claimed_id = Column(String(100))
    sign_up_date = Column(DATETIME, default=datetime.now)  
    rank =  Column(Integer)
    
    
    dbgames = relationship("DBPlayersGame", backref=backref('DBPlayersGames', order_by=id))
    
    def __init__(self,username,passhash,claimed_id=None,timestamp=datetime.now(),rank=1000):
        self.username = username
        self.passhash = passhash
        if claimed_id !=None: self.claimed_id = claimed_id
        else: self.claimed_id = "01234567890123456789012345678901234567890"+username
        self.sign_up_date = timestamp
        self.rank = rank
        
    def __repr__(self):
        return "<User('%s')>" % (self.username)
  
  
class DBGame(Base):
    __tablename__ = "dbgames"
    id = Column(Integer, Sequence('game_id_seq'), primary_key=True)
    timestamp = Column(DATETIME, default=datetime.now)   
    
    dbplayers = relationship("DBPlayersGame", backref=backref("DBGames"))
    
    def __init__(self, timestamp=datetime.now()):
        self.timestamp = timestamp
        
    def __repr__(self):
        myPlayers = [person for person in self.dbplayers]
        return "<Game('%s','%s')>" % (self.timestamp,myPlayers)

class DBPlayersGame(Base):
    __tablename__ = "dbplayersGames"
    player = Column(Integer, ForeignKey('dbusers.id'), primary_key=True)
    myGame = Column(Integer, ForeignKey('dbgames.id'), primary_key=True)
    round1 = Column(Integer)
    round2 = Column(Integer)
    round3 = Column(Integer)
    outcome = Column(Integer) # -1, 0, +1 for lose, draw, win.
    
    dbuser = relationship("DBUser", backref=backref('dbgamesPlayed'))
    dbgame = relationship("DBGame", backref=backref('dbplayersGames'))

    def __init__(self, r1,r2,r3,outcome):
        self.round1 = r1
        self.round2 = r2
        self.round3 = r3
        self.outcome = outcome
        
    def __repr__(self):
        if self.outcome == 1: result = "Win"
        elif self.outcome == 0: result = "Draw"
        elif self.outcome == -1: result = "Loss"
        return "<PlayersGame('%s','%s')>" % (self.dbuser.username, result)

def saveUser(username,password,claimed_id=None):
    """Add a new user to the database."""
    passhash = make_hash(password)
    session.add(DBUser(username,passhash,claimed_id))
    print "Adding new user."
    session.commit()
    
def authenticate(usernameAttempt,passwordAttempt):
    """Check if the username and passhash combination are in the database."""
    userFound = session.query(DBUser).filter_by(username=usernameAttempt).first()
    if userFound != None:
        realHash = userFound.passhash
        return check_hash(passwordAttempt, realHash) 
    else: 
        return False

def usernameTaken(newUsername):
    """Check if a username has already been used."""
    newSession = Session()
    sameNameCount = newSession.query(DBUser).filter_by(username=newUsername).count()
    if sameNameCount > 0: returnVal = True
    else: returnVal = False
    newSession.close()
    return returnVal
    
def getUserInfo(thisUsername):
    """Given a username,get all their info."""
    newSession = Session()
    P = newSession.query(DBUser).filter_by(username=thisUsername).first()
    returnVal = {'claimed_id':P.claimed_id,'username':P.username,'rank':P.rank}
    newSession.close()
    return returnVal
    
    
def saveGameStats(p1,p2,p1r1,p2r1,p1r2,p2r2,p1r3,p2r3,P1Outcome):
    """Save the records of a game that was played."""
    newSession = Session()
    Player1 = newSession.query(DBUser).filter_by(username=p1).first()
    Player2 = newSession.query(DBUser).filter_by(username=p2).first()

    game = DBGame(datetime.now())
    p1Side = DBPlayersGame(p1r1,p1r2,p1r3,P1Outcome)
    p2Side = DBPlayersGame(p2r1,p2r2,p2r3,-P1Outcome)
    p1Side.dbgame = game
    p2Side.dbgame = game
    p1Side.dbuser = Player1
    p2Side.dbuser = Player2
    game.dbplayers = [p1Side,p2Side]
    newSession.add_all([game,p1Side,p2Side])
    rank1 = Player1.rank
    rank2 = Player2.rank
    newRank1 = max(0, rank1 + rankChange(rank1,rank2,P1Outcome))
    newRank2 = max(0, rank2 + rankChange(rank2,rank1,-P1Outcome))
    Player1.rank = newRank1
    Player2.rank = newRank2
    newSession.commit()
    newSession.close()

def rankChange(rank1,rank2,PlayerOutcome):
    """Calculate and return the changes in rank for players."""
    deltaWin = -48.0*(math.atan((rank1 - rank2)*1.0/1800.0))/math.pi + 24
    deltaLose = deltaWin - 48
    if (PlayerOutcome == 1): return round(deltaWin)
    elif (PlayerOutcome == -1): return round(deltaLose)
    else: return round((deltaWin+deltaLose)/2)
         
def getRank(username):
    """Return the rank of a player."""
    newSession = Session()       
    returnVal = newSession.query(DBUser).filter_by(username=username).first().rank
    newSession.close()
    return returnVal
        
         
def getPlayerHistory(username):
    """Create a list of dictionaries with complete game information."""
    newSession = Session()
    gameHistory = []
    thisPlayer = newSession.query(DBUser).filter_by(username=username).first()
    for myGameSide in thisPlayer.dbgamesPlayed:
        gameInfo = {}
        thisGame = myGameSide.dbgame
        for side in thisGame.dbplayers:
            if side != myGameSide: 
                opponentSide = side
        gameInfo['timestamp'] = thisGame.timestamp
        gameInfo['oppName'] = opponentSide.dbuser.username
        gameInfo['myR1'] = myGameSide.round1
        gameInfo['myR2'] = myGameSide.round2
        gameInfo['myR3'] = myGameSide.round3
        gameInfo['oppR1'] = opponentSide.round1
        gameInfo['oppR2'] = opponentSide.round2
        gameInfo['oppR3'] = opponentSide.round3
        gameInfo['myOut'] = myGameSide.outcome
        gameInfo['oppOut'] = opponentSide.outcome
        gameHistory.append(gameInfo)
    return gameHistory
    
def getPlayerStats(username):
    """get general stats in a dictionary."""
    newSession = Session()
    playerStats = {}
    thisPlayer = newSession.query(DBUser).filter_by(username=username).first()
    wins = 0
    draws = 0
    losses = 0
    totalGamesPlayed = 0
    for myGameSide in thisPlayer.dbgamesPlayed:
        if myGameSide.outcome == 1: wins+=1
        elif myGameSide.outcome == 0: draws+=1
        elif myGameSide.outcome == -1: losses+=1
        totalGamesPlayed += 1
    playerStats["wins"] = wins
    playerStats["draws"] = draws
    playerStats["losses"] = losses
    playerStats["total"] = totalGamesPlayed
    playerStats["rank"] = thisPlayer.rank
    return playerStats
        
        
    
    
if __name__ == "__main__":
    """This is for making the initial database."""
    engine = create_engine('sqlite:///Arena.db', echo=False)
    Base.metadata.create_all(engine) #Makes the database tables based on our classes.
    Session = sessionmaker(bind=engine) #define what a session is
    session = Session()
    session.commit()
    
    #This code just for understanding syntax  
    """
    engine.execute("select 1").scalar()
    
    session = Session() #Start a dession
    Murelious = DBUser("Murelious","P4$$W0RD")
    session.add(Murelious)
    session.add_all([
        DBUser('wendy', 'foobar'),
        DBUser('mary', 'xxg527'),
        DBUser('fred', 'blah')])
    Murelious.passhash = "youcanthackme"    
    print "The dirty part of the session is: ", session.dirty
    our_user = session.query(DBUser).filter_by(username='Murelious').first() 
    print "Is Murelious the one who we just queried? ",Murelious is our_user
    session.commit()
    session.rollback() #Undo since last commit
    print "All users: "
    for row in session.query(DBUser,DBUser.username).all(): 
        print row.DBUser, row.username    
        
    game1 = DBGame()
    session.add_all([game1])
    
    Mside = DBPlayersGame(30,30,40,1)
    Mside.dbuser = Murelious
    Mside.dbgame = game1
    Wside = DBPlayersGame(80,10,10,-1)
    Wside.dbuser = session.query(DBUser).filter_by(username='wendy').first() 
    Wside.dbgame = game1
    game1.dbplayers = [Mside,Wside]
    print "All sides of all games: ",session.query(DBPlayersGame).all()
    myGames = session.query(DBGame).all()
    print "All games: ",myGames
    MureliousFound = session.query(DBUser).filter_by(username="Murelious").first()
    MureliousWins = session.query(DBPlayersGame).filter_by(dbuser=MureliousFound,outcome=1).all()
    print "Murelious Wins: ", MureliousWins

    session.commit()
    """
        
        
        
        