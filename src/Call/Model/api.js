import { callAPI as api } from "../../configKeys";
//const api = "http://localhost:7000"

export async function createRoom(roomName) {
  var room = await fetch(`${api}/create-room/${roomName}`, {
    method: "POST",
  });
  room = await room.json();
  console.log(room);
  return room;
}

export async function deleteRoom(roomName) {
  var deletedRoom = await fetch(`${api}/delete-room/${roomName}`, {
    method: "DELETE",
  });
  deletedRoom = await deletedRoom.json();
  console.log(deletedRoom);
  console.log("deleted");
};

export function deleteCall() {
  window.callDelete && fetch(`${api}/delete-call`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(window.callDelete)
  });
};