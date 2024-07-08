const express = require("express");
const cors = require("cors");
const fetch = require("cross-fetch");
const { db } = require("./firebase-modules"); 
const { dailyApiKey } = require("./configKeys");

const app = express();

app.use(cors());
app.use(express.json());

app.delete("/delete-call", async (req, res) => {
    console.log("delete call data: ", req.body);
    deleteCallFromUser(req.body.id1);
    deleteCallFromUser(req.body.id2);
    try {
        fetch("https://api.daily.co/v1/rooms/" + req.body.roomName, {
            headers: {
                Authorization: `Bearer ${dailyApiKey}`,
                "Content-Type": "application/json"
            },
            method: "DELETE"
        });
    } catch(e) {
        console.log("error deleting room for call delete!!");
        console.log(e);
    }
    res.status(200).send("delete-call success !!");
});

app.post("/create-room/:roomName", async (req, res) => {
    var room = await fetch("https://api.daily.co/v1/rooms/", {
        headers: {
            Authorization: `Bearer ${dailyApiKey}`,
            "Content-Type": "application/json"
        },
        method: "POST",
        body: JSON.stringify({
            name: req.params.roomName
        })
    });
    room = await room.json();
    console.log(room);
    res.json(room);
});

app.delete("/delete-room/:roomName", async (req, res) => {
    var deleteResponse = await fetch("https://api.daily.co/v1/rooms/" + req.params.roomName, {
        headers: {
            Authorization: `Bearer ${dailyApiKey}`,
            "Content-Type": "application/json"
        },
        method: "DELETE"
    });
    deleteResponse = await deleteResponse.json();
    console.log(deleteResponse);
    res.json(deleteResponse);
})

app.listen(process.env.PORT || 7000, () => {
    console.log("call server is running");
});

const deleteCallFromUser = userID => db.collection("users").doc(userID).collection("call").doc("call").delete();