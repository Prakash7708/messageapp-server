// Libraray
const express = require("express");
const socketio = require("socket.io");
const http = require("http");
const { addUser, removeUser, getUser, getRoomUsers } = require("./entity");
const cors = require("cors");
const dotenv = require("dotenv").config();
const mongodb = require("mongodb");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoClient = mongodb.MongoClient;

const URL = process.env.DB;
const SECRET = process.env.SECRET;

// Instances
const app = express()
const server = http.createServer(app);
const io = socketio(server,{cors: { origin: '*' }})

// End point
app.get('/',(req,res) => {
  res.json("Api is working");
})

// Socket

io.on('connect',(socket) => {
  

  socket.on('join',({user,room},callback) => {
    console.log(user,room)
      const {response , error} = addUser({id: socket.id , user:user, room: room})

      console.log(response)

      if(error) {
        callback(error)
        return;
      }
      socket.join(response.room);
      socket.emit('message', { user: 'admin' , text: `Welcome ${response.user} ` });
      socket.broadcast.to(response.room).emit('message', { user: 'admin', text : `${response.user} has joined` })

      io.to(response.room).emit('roomMembers', getRoomUsers(response.room))
  })

  socket.on('sendMessage',(message,callback) => {
    
      const user = getUser(socket.id)

      io.to(user.room).emit('message',{ user: user.user, text : message })

      callback()
  })


 

  socket.on('disconnect',() => {
    console.log("User disconnected");
    const user = removeUser(socket.id);

    if(user) {
      io.to(user.room).emit('message',{ user: 'admin', text : `${user.user} has left` })
    }
  }) 
})

// JWT
app.use(express.json());
app.use(
  cors({
    origin: "*",
  })
);

let authenticate = function (req, res, next) {
  //console.log(req.headers.authorization)
  
 if(req.headers.authorization) {
   try {
    let verify = jwt.verify(req.headers.authorization, SECRET);
    if(verify) {
      req.userid = verify._id;
      next();
    } else {
      res.status(401).json({ message: "Unauthorized1" });
    }
   } catch (error) {
    res.json({ message: "🔒Please Login to Continue" });
   }
  } else {
    res.status(401).json({ message: "Unauthorized3" });
  }
};

app.post("/register",async function (req, res) {

  try {
    const connection = await mongoClient.connect(URL);

    const db = connection.db("message");

    const user = await db
      .collection("users")
      .findOne({ username: req.body.username });
    if(user){
       res.json({
        message:"Usename already used"
       })
    }else{
      const salt = await bcryptjs.genSalt(10);
    const hash = await bcryptjs.hash(req.body.password, salt);
    req.body.password = hash;
    await db.collection("users").insertOne(req.body);
    await connection.close();
    res.json({
      message: "Successfully Registered",
    });}
  } catch (error) {
    res.status(500).json({
      message: "Error",
    });
  }
});

app.post("/login",async function (req, res) {
  try {
    const connection = await mongoClient.connect(URL);
    const db = connection.db("message");
    const user = await db
      .collection("users")
      .findOne({ username: req.body.username });

    if (user) {
      const match = await bcryptjs.compare(req.body.password, user.password);
      if (match) {
        // Token
        // const token = jwt.sign({ _id: user._id }, SECRET, { expiresIn: "1m" });
        const token = jwt.sign({ _id: user._id }, SECRET);
        res.status(200).json({
          message: "Successfully Logged In",
          token,
        });
      } else {
        res.json({
          message: "Password is incorrect",
        });
      }
    } else {
      res.json({
        message: "User not found Please sign in",
      });
    }
  } catch (error) {
    console.log(error);
  }
});


//server.listen(3001,() => console.log('Server started on 3001'))
server.listen(process.env.PORT || 3001);