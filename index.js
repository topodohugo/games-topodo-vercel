const app = require('express')();
const http = require('http').Server(app);
var io = require('socket.io')(http,{
    cors: {
    origin: "https://topodos.000webhostapp.com",
    methods: ["GET", "POST"]
  }});

let createdRooms = []; // 0-> room name 1->usercreator
let usersInRoom = new Object();
let userRoom = new Object();
let socketToUser = new Object();
let userSimbol = new Object();
let simbolsInRoom = new Object();
let roomTurn = new Object();
let waitList = new Object();

app.get('/', function(req, res){
res.send('Servidor de conexão online');
});

io.on("connection", function (socket) {
    console.log('user connected in localhost server');

    socket.on("roomCreated", function(arg){
        //arg 0 -> roomname arg 1 -> username
        let roomname = arg[0];
        let username = arg[1];
        let exist = false;
 
        for(let i = 0;i<createdRooms.length;i++){
            if(createdRooms[i][0] == roomname){
               exist = true;
            }
        }

        if(exist === false){
            createdRooms.push([roomname, username]);
            usersInRoom[roomname] = [];
            simbolsInRoom[roomname] = [];
            roomTurn[roomname] = [];
            waitList[roomname] = [];
            io.emit("newRoom", createdRooms);
            socket.emit("sucessCreated");
        }else{
            socket.emit("existRoom");
        }
    });

    socket.on("loadList", function(){
        let loted = [];

        for(let i = 0; i<Object.values(usersInRoom).length;i++){
            let thisRoom = usersInRoom[Object.keys(usersInRoom)[i]];

            if(thisRoom.length >= 3){
                loted.push(Object.keys(usersInRoom)[i]);
            };
        };
        
        socket.emit("newRoom", createdRooms, loted);
    });

    socket.on("inGame", function(username){
        let inRoom;

        if(userRoom[username]){
            inRoom = true;
        }else{
            inRoom = false;
        };

        socket.emit("inGame", inRoom);
    });

    socket.on("joinRoom", function(arg){
        let actualRoom = arg[0];
        let username = arg[1];
        let simbol = arg[2];
        let existSimbol = false;

        if(usersInRoom[actualRoom].length >= 3){
            socket.emit("lotedRoom");
        }else{
        roomTurn[actualRoom].push(username);
        userRoom[username] = actualRoom;
        userRoom[socket.id] = actualRoom;
        usersInRoom[actualRoom].push(username);
        if(waitList[actualRoom]){
            waitList[actualRoom].push(username);
        };
        socketToUser[socket.id] = username;
        io.in(actualRoom).emit("roomTurn", roomTurn[actualRoom]);
        socket.emit("roomTurn", roomTurn[actualRoom]);
        if(simbolsInRoom[actualRoom]){
            if(simbolsInRoom[actualRoom].length == 0){
                simbolsInRoom[actualRoom].push(simbol);
                userSimbol[username] = simbol;
            }else{
                for(let i = 0;i<simbolsInRoom[actualRoom].length;i++){
                    let simboly = simbolsInRoom[actualRoom][i];

                    if(simboly == simbol){
                        existSimbol = true;
                    };
                }

                if(existSimbol == true){
                    socket.emit("changeSimbol");
                }else{
                    simbolsInRoom[actualRoom].push(simbol);
                    userSimbol[username] = simbol;
                    if(usersInRoom[actualRoom].length == 3 && simbolsInRoom[actualRoom].length == 3){
                        //Sala Lotou
                        io.in(actualRoom).emit("initRoom");
                        socket.emit("initRoom");
                        io.emit("newLotedRoom", actualRoom);
                    }
                }
            }
        }

        socket.join(actualRoom);
        
        io.in(actualRoom).emit("updateUsers", usersInRoom[actualRoom], simbolsInRoom[actualRoom]);
        };
    });

    socket.on("modifyGameStatus", function(arg){
        let status = arg[0];
        let room = arg[1];
        
        io.in(room).emit("changeFStatus", arg);
        socket.emit("changeFStatus", arg)
    });

    socket.on("updateTurn", function(arg){
        io.in(arg[0]).emit("updateTurn", [arg[1],arg[2], arg[3]]);//poss o simbol
    });

    socket.on("waitList", function(arg){
        let user = arg[0];
        let room = arg[1];

        waitList[room].push(user);

        if(waitList[room] && waitList[room].length > 3){
            delete waitList[room];
            waitList[room] = [];
            waitList[room].push(user);
        };

        if(waitList[room] && waitList[room].length == 3){
            socket.emit("waitingList", true);
            io.in(room).emit("waitingList", true);
            waitList[room] = [];
        }else{
            socket.emit("waitingList", false);
        }

        let intervalVerify = setInterval(function(){
            if(waitList[room] && waitList[room].length == 3){
                clearInterval(timer);
                clearInterval(intervalVerify);
            }
        }, 1000);
        let timer = setTimeout(function(){
            if(waitList[room] && waitList[room].length < 3){
                socket.emit("roomEncerred");
                io.in(room).emit("roomEncerred");
                waitList[room] = [];
            }
        }, 30000);
    });

    socket.on('disconnect', function() {
        console.log("[SERVER] Desconected");

        let userroom = userRoom[socket.id];
        
        if(usersInRoom[userroom]){
            for(let i = 0; i<usersInRoom[userroom].length; i++){
                if(usersInRoom[userroom][i] == socketToUser[socket.id]){
                    usersInRoom[userroom].splice(i,1);
                };
            };
        };

        if(userSimbol[socketToUser[socket.id]]){
            for(let i = 0;i<simbolsInRoom[userroom].length;i++){
                let thiss = simbolsInRoom[userroom][i];

                if(thiss == userSimbol[socketToUser[socket.id]]){
                    simbolsInRoom[userroom].splice(i,1);
                }
            }
            delete userSimbol[socketToUser[socket.id]];
        };

        if(roomTurn[userroom]){
            for(let i = 0;i<roomTurn[userroom].length;i++){
                if(roomTurn[userroom][i] == socketToUser[socket.id]){
                    roomTurn[userroom].splice(i,1)
                }
            }
        }

        delete userRoom[socketToUser[socket.id]];
        delete userRoom[socket.id];

        io.in(userroom).emit("updateUsers", usersInRoom[userroom], simbolsInRoom[userroom]);
        io.in(userroom).emit("userLeft");
        io.emit("unlockRoom", userroom);
        socket.leave(userroom);
    });
});

let port = process.env.PORT||3000;

http.listen(port, function() {
   console.log('listening on *:'+port);
});
