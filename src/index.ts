import express = require("express");
import request = require("request");
import http = require("http");
import socketIo = require("socket.io");
import { OAuth2Client } from "google-auth-library";

const apiKey = "AIzaSyC1U07d0VAr7Lwhm4wqpMr6V-udN-pl3yM";
const clientID =
  "245046245085-aqtiof6fnq42g2u1uooag9q9j028h9i4.apps.googleusercontent.com";

const client = new OAuth2Client(clientID);

const port = process.env.PORT || 4001;

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

async function verify(token: string) {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience:
      "245046245085-aqtiof6fnq42g2u1uooag9q9j028h9i4.apps.googleusercontent.com",
  });
  return ticket.getPayload();
}

io.on("connection", (socket) => {
  socket.on("streamDetails", (streamInputData: any) => {
    console.log("here");

    verify(streamInputData.loginDetails.id_token)
      .then((data) => {
        /* login data in data var. n */
        getLiveChatId(streamInputData.url, (liveChatId: string) => {
          if (liveChatId) {
            requestChatMessages("", liveChatId, io);
          }
        });
      })
      .catch((error) => {
        console.log("login error", error);
      });
  });

  socket.on("disconnect", () => {
    socket.disconnect();
  });
});

const requestChatMessages = (
  nextPageToken: any,
  liveChatId: string,
  io: any
) => {
  const chatURL = "https://content.googleapis.com/youtube/v3/liveChat/messages";
  const requestProperties = {
    liveChatId: liveChatId,
    part: "snippet,id,authorDetails",
    key: apiKey,
    maxResults: 100,
    pageToken: nextPageToken,
  };

  request({ url: chatURL, qs: requestProperties }, (error, response, body) => {
    const bodyObj = JSON.parse(body);
    bodyObj.items.forEach((chat: any) => {
      console.log(
        `${chat.authorDetails.displayName} : ${chat.snippet.displayMessage}`
      );
    });

    if (bodyObj.items.length) {
      io.emit("chatMessages", bodyObj.items);
    }

    setTimeout(() => {
      requestChatMessages(bodyObj.nextPageToken, liveChatId, io);
    }, bodyObj.pollingIntervalMillis);
  });
};

const getLiveChatId = (videoId: any, callback: any) => {
  const videoURL = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=liveStreamingDetails,snippet`;
  request(videoURL, (error, request, body) => {
    var bodyObj = JSON.parse(body);

    callback(bodyObj.items[0].liveStreamingDetails.activeLiveChatId);
  });
};

server.listen(port, () => {});
